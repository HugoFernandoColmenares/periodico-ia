import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { DATA_DIR } from './cache.js';

/** Intervalos permitidos (minutos). El mínimo es 30; el máximo, una vez al día (modo `daily`). */
export const ALLOWED_INTERVALS = [30, 60, 120, 180, 360, 720] as const;
export const MIN_INTERVAL_MINUTES = 30;

export type RefreshMode = 'interval' | 'daily';

export interface RefreshSettings {
  /** `interval`: cada N minutos · `daily`: una vez al día a la hora `dailyTime`. */
  mode: RefreshMode;
  /** Solo aplica en modo `interval`. Uno de ALLOWED_INTERVALS. */
  intervalMinutes: number;
  /** Hora local HH:mm (24 h) en `timezone`. Solo aplica en modo `daily`. */
  dailyTime: string;
  /** Zona horaria IANA, p. ej. `America/Bogota`. */
  timezone: string;
}

export const DEFAULT_SETTINGS: RefreshSettings = {
  mode: 'daily',
  intervalMinutes: 60,
  dailyTime: '07:00',
  timezone: 'America/Bogota',
};

export const settingsFile = () => process.env.SETTINGS_FILE ?? resolve(DATA_DIR, 'settings.json');

export function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export type ValidationResult = { ok: true; settings: RefreshSettings } | { ok: false; errors: string[] };

/**
 * Valida (y completa con `base`) un objeto de configuración recibido del cliente.
 * Devuelve mensajes de error en español pensados para mostrarse tal cual en la interfaz.
 */
export function validateSettings(input: unknown, base: RefreshSettings = DEFAULT_SETTINGS): ValidationResult {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { ok: false, errors: ['El cuerpo de la petición debe ser un objeto JSON con la configuración.'] };
  }
  const raw = input as Record<string, unknown>;
  const errors: string[] = [];
  const known = new Set(['mode', 'intervalMinutes', 'dailyTime', 'timezone']);
  const unknown = Object.keys(raw).filter((k) => !known.has(k));
  if (unknown.length) errors.push(`Campos desconocidos: ${unknown.join(', ')}.`);

  const mode = raw.mode ?? base.mode;
  if (mode !== 'interval' && mode !== 'daily') {
    errors.push('La frecuencia debe ser “interval” (cada cierto tiempo) o “daily” (diaria a una hora).');
  }

  let intervalMinutes = base.intervalMinutes;
  if (raw.intervalMinutes !== undefined) {
    const n = raw.intervalMinutes;
    if (typeof n !== 'number' || !Number.isInteger(n)) {
      errors.push('El intervalo debe ser un número entero de minutos.');
    } else if (n < MIN_INTERVAL_MINUTES) {
      errors.push(`La frecuencia mínima es cada ${MIN_INTERVAL_MINUTES} minutos; ${n} min no está permitido.`);
    } else if (!(ALLOWED_INTERVALS as readonly number[]).includes(n)) {
      errors.push('Intervalo no disponible. Elige 30 min, 1 h, 2 h, 3 h, 6 h o 12 h, o la opción diaria.');
    } else {
      intervalMinutes = n;
    }
  }

  let dailyTime = base.dailyTime;
  if (raw.dailyTime !== undefined) {
    if (typeof raw.dailyTime !== 'string' || !TIME_RE.test(raw.dailyTime)) {
      errors.push('La hora diaria debe tener el formato HH:mm de 24 horas (por ejemplo, 07:00).');
    } else {
      dailyTime = raw.dailyTime;
    }
  }

  let timezone = base.timezone;
  if (raw.timezone !== undefined) {
    if (typeof raw.timezone !== 'string' || !raw.timezone.trim() || !isValidTimezone(raw.timezone)) {
      errors.push(`Zona horaria no reconocida: ${String(raw.timezone)}. Usa un nombre IANA como America/Bogota.`);
    } else {
      timezone = raw.timezone;
    }
  }

  if (errors.length) return { ok: false, errors };
  return { ok: true, settings: { mode: mode as RefreshMode, intervalMinutes, dailyTime, timezone } };
}

/** Configuración persistida en un JSON. Si falta o está dañado, se crea con los valores por defecto. */
export class SettingsStore {
  private current: RefreshSettings = { ...DEFAULT_SETTINGS };
  constructor(readonly file = settingsFile()) {}

  get(): RefreshSettings {
    return { ...this.current };
  }

  async load(): Promise<RefreshSettings> {
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(await readFile(this.file, 'utf8'));
    } catch {
      parsed = null;
    }
    const result = parsed === null ? null : validateSettings(parsed);
    if (result?.ok) {
      this.current = result.settings;
    } else {
      if (result) console.warn(`[settings] ${this.file} no es válido (${result.errors.join(' ')}); se usan los valores por defecto.`);
      this.current = { ...DEFAULT_SETTINGS };
      await this.save(this.current).catch((e) => console.error('[settings] no se pudo escribir:', e));
    }
    return this.get();
  }

  async update(input: unknown): Promise<ValidationResult> {
    const result = validateSettings(input, this.current);
    if (!result.ok) return result;
    await this.save(result.settings);
    this.current = result.settings;
    return result;
  }

  private async save(settings: RefreshSettings) {
    await mkdir(dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    await writeFile(tmp, JSON.stringify(settings, null, 2) + '\n');
    await rename(tmp, this.file);
  }
}
