const dateFmt = new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Bogota' });
const shortFmt = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', timeZone: 'America/Bogota' });
const timeFmt = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'America/Bogota' });

export function longDate(d: Date | string): string {
  const s = dateFmt.format(new Date(d));
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function dateTime(d: string): string {
  return timeFmt.format(new Date(d));
}

/** "hace 3 horas", "hace 2 días" o la fecha corta si es más antiguo. */
export function relativeTime(iso: string, now = new Date()): string {
  const diff = (now.getTime() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'hace un momento';
  if (diff < 3600) return `hace ${Math.round(diff / 60)} min`;
  if (diff < 86400) {
    const h = Math.round(diff / 3600);
    return `hace ${h} ${h === 1 ? 'hora' : 'horas'}`;
  }
  if (diff < 7 * 86400) {
    const d = Math.round(diff / 86400);
    return `hace ${d} ${d === 1 ? 'día' : 'días'}`;
  }
  return shortFmt.format(new Date(iso));
}

const ZONE_NAMES: Record<string, string> = {
  'America/Bogota': 'Bogotá',
  'America/Mexico_City': 'Ciudad de México',
  'America/New_York': 'Nueva York',
  'America/Sao_Paulo': 'São Paulo',
  'America/Buenos_Aires': 'Buenos Aires',
  'America/Argentina/Buenos_Aires': 'Buenos Aires',
  'America/Panama': 'Panamá',
  'America/Los_Angeles': 'Los Ángeles',
  'Europe/London': 'Londres',
  'Asia/Tokyo': 'Tokio',
};

/** "hora de Bogotá", "hora de Madrid"… a partir de un nombre IANA. */
export function zoneLabel(timeZone: string): string {
  if (timeZone === 'UTC' || timeZone === 'Etc/UTC') return 'UTC';
  const city = ZONE_NAMES[timeZone] ?? timeZone.split('/').pop()!.replace(/_/g, ' ');
  return `hora de ${city}`;
}

const dayKey = (d: Date, timeZone: string) =>
  new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);

/** Hora en formato colombiano con espacios normales: "7:00 a. m.". */
export function clockTime(d: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('es-CO', { hour: 'numeric', minute: '2-digit', timeZone })
    .format(d)
    .replace(/[\u00a0\u202f]/g, ' ');
}

/** "hoy 7:00 a. m. (hora de Bogotá)", "mañana …", "ayer …" o "lunes, 26 de octubre, …". */
export function friendlySchedule(iso: string, timeZone: string, now = new Date()): string {
  const d = new Date(iso);
  const key = dayKey(d, timeZone);
  const offsets: [number, string][] = [
    [0, 'hoy'],
    [1, 'mañana'],
    [-1, 'ayer'],
  ];
  let day = offsets.find(([o]) => dayKey(new Date(now.getTime() + o * 864e5), timeZone) === key)?.[1];
  if (!day) {
    day = new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long', timeZone }).format(d) + ',';
  }
  return `${day} ${clockTime(d, timeZone)} (${zoneLabel(timeZone)})`;
}
