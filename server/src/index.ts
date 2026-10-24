import { refresh } from './aggregator.js';
import { buildApp, WEB_DIST } from './app.js';

const PORT = Number(process.env.PORT ?? 3000);
const HOST = process.env.HOST ?? '0.0.0.0';
const REFRESH_MINUTES = Number(process.env.REFRESH_MINUTES ?? 30);
const production = process.env.NODE_ENV === 'production';

async function runRefresh(reason: string) {
  const t0 = Date.now();
  try {
    const { store, live } = await refresh();
    const okSources = store.sources.filter((s) => s.ok).length;
    console.log(`[refresh:${reason}] ${live ? 'en vivo' : `sin datos nuevos, sirviendo ${store.mode}`} · ${store.articles.length} artículos · ${okSources}/${store.sources.filter((s) => s.enabled).length} fuentes · ${Date.now() - t0} ms`);
  } catch (e) {
    console.error(`[refresh:${reason}] error`, e);
  }
}

const app = await buildApp({ serveStatic: production, logger: false });
await app.listen({ port: PORT, host: HOST });
console.log(`El Periódico de la IA escuchando en http://localhost:${PORT}${production ? ` (sirviendo ${WEB_DIST})` : ''}`);

void runRefresh('inicio');
const timer = setInterval(() => void runRefresh('programado'), REFRESH_MINUTES * 60_000);
timer.unref();
