import { buildApp, WEB_DIST } from './app.js';

const PORT = Number(process.env.PORT ?? 3000);
const HOST = process.env.HOST ?? '0.0.0.0';
const production = process.env.NODE_ENV === 'production';

if (process.env.REFRESH_MINUTES) {
  console.warn('[settings] REFRESH_MINUTES ya no se usa: configura la frecuencia en /opciones (o en server/data/settings.json).');
}

const app = await buildApp({ serveStatic: production, logger: false });
await app.listen({ port: PORT, host: HOST });
console.log(`El Periódico de la IA escuchando en http://localhost:${PORT}${production ? ` (sirviendo ${WEB_DIST})` : ''}`);

const s = app.settingsStore.get();
console.log(`[scheduler] frecuencia: ${s.mode === 'daily' ? `diaria a las ${s.dailyTime} (${s.timezone})` : `cada ${s.intervalMinutes} min`}`);
app.scheduler
  .start()
  .then(() => console.log(`[scheduler] próxima actualización: ${app.scheduler.nextRunAt?.toISOString()}`))
  .catch((e) => console.error('[refresh:inicio] error', e));
