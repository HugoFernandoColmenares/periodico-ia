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
