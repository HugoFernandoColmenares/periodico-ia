/** Verifica que cada fuente configurada responda y cuántos artículos aporta: `npm run check:sources`. */
import { processSourceItems } from './aggregator.js';
import { fetchSource } from './fetchers.js';
import { SOURCES } from './sources.config.js';

const rows = await Promise.all(
  SOURCES.map(async (s) => {
    const t0 = Date.now();
    try {
      const raw = await fetchSource(s);
      const kept = processSourceItems(raw, s).length;
      return { id: s.id, enabled: s.enabled, status: 'OK', raw: raw.length, kept, ms: Date.now() - t0 };
    } catch (e) {
      return { id: s.id, enabled: s.enabled, status: `FALLA: ${(e as Error).message}`, raw: 0, kept: 0, ms: Date.now() - t0 };
    }
  }),
);
console.table(rows);
const dead = rows.filter((r) => r.enabled && r.status !== 'OK');
if (dead.length) console.warn(`Fuentes activas caídas: ${dead.map((d) => d.id).join(', ')}`);
