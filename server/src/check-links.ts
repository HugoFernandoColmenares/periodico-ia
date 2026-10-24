/** Verifica que todos los enlaces de content/learning.json respondan: `npm run check:links -w server`. */
import { USER_AGENT } from './fetchers.js';
import { loadRoadmap } from './learning.js';

const roadmap = await loadRoadmap();
const links = roadmap.topics.flatMap((t) => t.resources.map((r) => ({ topic: t.id, url: r.url })));
const rows = await Promise.all(
  links.map(async (l) => {
    try {
      const res = await fetch(l.url, { headers: { 'User-Agent': USER_AGENT }, redirect: 'follow', signal: AbortSignal.timeout(20_000) });
      return { ...l, status: res.status };
    } catch (e) {
      return { ...l, status: (e as Error).message };
    }
  }),
);
console.table(rows);
const bad = rows.filter((r) => r.status !== 200);
if (bad.length) {
  console.warn(`${bad.length} enlace(s) con problemas`);
  process.exitCode = 1;
}
