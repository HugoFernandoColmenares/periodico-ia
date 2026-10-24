import type { RefreshSettings } from './settings.js';

/** Partes de fecha/hora de `date` vistas en la zona `timeZone`. */
export function zonedParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour'), minute: get('minute'), second: get('second') };
}

/** Desfase (ms) de la zona respecto a UTC en el instante dado. Bogotá: −5 h. */
export function timezoneOffsetMs(date: Date, timeZone: string): number {
  const p = zonedParts(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/**
 * Convierte una hora de pared (año, mes, día, hora, minuto) en `timeZone` al instante UTC.
 * Seguro ante cambios de horario: en el salto de primavera una hora inexistente se corre
 * hacia adelante (p. ej. 02:30 → 03:30) y en el retroceso de otoño se usa la primera ocurrencia.
 */
export function zonedTimeToUtc(year: number, month: number, day: number, hour: number, minute: number, timeZone: string): Date {
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  const before = timezoneOffsetMs(new Date(wall - 864e5 / 2), timeZone);
  const after = timezoneOffsetMs(new Date(wall + 864e5 / 2), timeZone);
  // Probamos ambos desfases cercanos y nos quedamos con el que reproduce la hora de pared
  const candidates = [wall - before, wall - after].sort((a, b) => a - b);
  for (const t of candidates) {
    const p = zonedParts(new Date(t), timeZone);
    if (p.year === year && p.month === month && p.day === day && p.hour === hour && p.minute === minute) return new Date(t);
  }
  // Hora inexistente (salto de primavera): aplicamos el desfase previo, que cae después del salto
  return new Date(wall - before);
}

function addDays(year: number, month: number, day: number, days: number) {
  const d = new Date(Date.UTC(year, month - 1, day + days));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

function parseTime(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number);
  return { hour: h, minute: m };
}

/** Próxima ocurrencia estrictamente posterior a `now` de HH:mm en la zona dada. */
export function nextDailyRun(now: Date, dailyTime: string, timeZone: string): Date {
  const { hour, minute } = parseTime(dailyTime);
  const today = zonedParts(now, timeZone);
  for (let offset = 0; offset <= 2; offset++) {
    const d = addDays(today.year, today.month, today.day, offset);
    const t = zonedTimeToUtc(d.year, d.month, d.day, hour, minute, timeZone);
    if (t.getTime() > now.getTime()) return t;
  }
  throw new Error('No se pudo calcular la próxima ejecución diaria');
}

/** Última ocurrencia (≤ now) de HH:mm en la zona dada. */
export function previousDailySlot(now: Date, dailyTime: string, timeZone: string): Date {
  const { hour, minute } = parseTime(dailyTime);
  const today = zonedParts(now, timeZone);
  for (let offset = 0; offset >= -2; offset--) {
    const d = addDays(today.year, today.month, today.day, offset);
    const t = zonedTimeToUtc(d.year, d.month, d.day, hour, minute, timeZone);
    if (t.getTime() <= now.getTime()) return t;
  }
  throw new Error('No se pudo calcular la ejecución diaria anterior');
}

/** ¿Hace falta actualizar ya? (caché vacía, intervalo vencido o franja diaria perdida). */
export function isDue(settings: RefreshSettings, lastRun: Date | null, now: Date): boolean {
  if (!lastRun) return true;
  if (settings.mode === 'interval') return now.getTime() - lastRun.getTime() >= settings.intervalMinutes * 60_000;
  return lastRun.getTime() < previousDailySlot(now, settings.dailyTime, settings.timezone).getTime();
}

/** Próximo instante de actualización según la configuración y la última ejecución. */
export function computeNextRun(settings: RefreshSettings, lastRun: Date | null, now: Date): Date {
  if (settings.mode === 'interval') {
    if (!lastRun) return now;
    return new Date(Math.max(now.getTime(), lastRun.getTime() + settings.intervalMinutes * 60_000));
  }
  return nextDailyRun(now, settings.dailyTime, settings.timezone);
}

/** setTimeout acepta como máximo ~24,8 días; por encima reprogramamos en tramos. */
const MAX_TIMEOUT = 2 ** 31 - 1;

export interface SchedulerOptions<T = unknown> {
  getSettings: () => RefreshSettings;
  /** Ejecuta la actualización. El planificador registra la hora del intento, haya o no datos nuevos. */
  run: (reason: string) => Promise<T>;
  /** Última actualización conocida al arrancar (p. ej. `fetchedAt` de la caché). */
  lastRun?: Date | null;
  now?: () => Date;
}

/** Reemplaza al antiguo setInterval: calcula la próxima ejecución y se reprograma al cambiar la configuración. */
export class RefreshScheduler<T = unknown> {
  private timer: NodeJS.Timeout | null = null;
  private lastRun: Date | null;
  private next: Date | null = null;
  private running: Promise<T> | null = null;
  private readonly now: () => Date;

  constructor(private readonly opts: SchedulerOptions<T>) {
    this.lastRun = opts.lastRun ?? null;
    this.now = opts.now ?? (() => new Date());
  }

  get lastRunAt(): Date | null {
    return this.lastRun;
  }

  get nextRunAt(): Date | null {
    return this.next;
  }

  /** Al arrancar: actualiza una vez si toca; si no, espera a la próxima hora programada. */
  async start(): Promise<void> {
    if (isDue(this.opts.getSettings(), this.lastRun, this.now())) await this.runNow('inicio');
    else this.reschedule();
  }

  /** Ejecuta ya (manual o programado) y reprograma la siguiente. Las llamadas simultáneas comparten ejecución. */
  async runNow(reason: string): Promise<T> {
    if (this.running) return this.running;
    this.running = (async () => {
      try {
        return await this.opts.run(reason);
      } finally {
        this.lastRun = this.now();
        this.running = null;
        this.reschedule();
      }
    })();
    return this.running;
  }

  /** Recalcula la próxima ejecución (llamar tras cambiar la configuración). */
  reschedule(): Date {
    this.clear();
    const now = this.now();
    const next = computeNextRun(this.opts.getSettings(), this.lastRun, now);
    this.next = next;
    const delay = Math.max(0, next.getTime() - now.getTime());
    this.timer = setTimeout(() => {
      this.timer = null;
      if (delay > MAX_TIMEOUT) this.reschedule();
      else this.runNow('programado').catch((e) => console.error('[scheduler] la actualización programada falló:', e));
    }, Math.min(delay, MAX_TIMEOUT));
    this.timer.unref?.();
    return next;
  }

  stop() {
    this.clear();
    this.next = null;
  }

  private clear() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
}
