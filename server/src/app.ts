import { timingSafeEqual } from 'node:crypto';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyInstance } from 'fastify';
import { getStore, loadInitialStore, refresh, type RefreshResult } from './aggregator.js';
import { loadRoadmap, withTrending } from './learning.js';
import { RefreshScheduler } from './scheduler.js';
import { ALLOWED_INTERVALS, MIN_INTERVAL_MINUTES, SettingsStore } from './settings.js';
import type { NewsStore, SectionId } from './types.js';

declare module 'fastify' {
  interface FastifyInstance {
    scheduler: RefreshScheduler<RefreshResult>;
    settingsStore: SettingsStore;
  }
}

export const SECTIONS: { id: SectionId; label: string }[] = [
  { id: 'on-device', label: 'On-device e IA pequeña' },
  { id: 'modelos', label: 'Modelos' },
  { id: 'investigacion', label: 'Investigación' },
  { id: 'industria', label: 'Industria' },
  { id: 'herramientas', label: 'Herramientas' },
];

const here = dirname(fileURLToPath(import.meta.url));
export const WEB_DIST = process.env.WEB_DIST ?? resolve(here, '..', '..', 'web', 'dist', 'web', 'browser');

interface NewsQuery {
  section?: string;
  source?: string;
  q?: string;
  page?: string;
  pageSize?: string;
}

/** Actualiza y deja una línea de registro con el resultado. */
export async function loggedRefresh(reason: string): Promise<RefreshResult> {
  const t0 = Date.now();
  const result = await refresh();
  const { store, live } = result;
  const okSources = store.sources.filter((s) => s.ok).length;
  console.log(
    `[refresh:${reason}] ${live ? 'en vivo' : `sin datos nuevos, sirviendo ${store.mode}`} · ${store.articles.length} artículos · ${okSources}/${store.sources.filter((s) => s.enabled).length} fuentes · ${Date.now() - t0} ms`,
  );
  return result;
}

/** Fecha de la última edición real (la muestra no cuenta: obliga a actualizar al arrancar). */
export function lastRefreshFromStore(store: NewsStore | null): Date | null {
  if (!store || store.mode === 'sample' || !store.articles.length) return null;
  const d = new Date(store.fetchedAt);
  return Number.isNaN(d.getTime()) ? null : d;
}

function tokenMatches(given: string | undefined, expected: string): boolean {
  if (!given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export interface AppOptions {
  serveStatic?: boolean;
  logger?: boolean;
  /** Archivo de configuración (por defecto server/data/settings.json o SETTINGS_FILE). */
  settingsFile?: string;
  /** Si se define (o existe ADMIN_TOKEN), PUT /api/settings exige la cabecera X-Admin-Token. */
  adminToken?: string;
  /** Función de actualización (inyectable en tests). */
  runRefresh?: (reason: string) => Promise<RefreshResult>;
}

export async function buildApp(opts: AppOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: opts.logger ?? false });
  if (!getStore()) await loadInitialStore();

  const settingsStore = new SettingsStore(opts.settingsFile);
  await settingsStore.load();
  const scheduler = new RefreshScheduler<RefreshResult>({
    getSettings: () => settingsStore.get(),
    run: opts.runRefresh ?? loggedRefresh,
    lastRun: lastRefreshFromStore(getStore()),
  });
  app.decorate('scheduler', scheduler);
  app.decorate('settingsStore', settingsStore);
  app.addHook('onClose', async () => scheduler.stop());
  const adminToken = opts.adminToken ?? (process.env.ADMIN_TOKEN || undefined);

  const settingsResponse = () => ({
    ...settingsStore.get(),
    lastRefreshAt: scheduler.lastRunAt?.toISOString() ?? null,
    nextRefreshAt: scheduler.nextRunAt?.toISOString() ?? null,
    allowedIntervals: ALLOWED_INTERVALS,
    minIntervalMinutes: MIN_INTERVAL_MINUTES,
    adminTokenRequired: !!adminToken,
  });

  app.get('/api/health', async () => ({ ok: true }));

  app.get<{ Querystring: NewsQuery }>('/api/news', async (req, reply) => {
    const store = getStore()!;
    const { section, source, q } = req.query;
    if (section && !SECTIONS.some((s) => s.id === section)) return reply.code(400).send({ error: `Sección desconocida: ${section}` });
    const page = Math.max(1, parseInt(req.query.page ?? '1', 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize ?? '20', 10) || 20));
    const needle = q?.trim().toLowerCase();
    let items = store.articles;
    if (section) items = items.filter((a) => a.section === section);
    if (source) items = items.filter((a) => a.source === source);
    if (needle) items = items.filter((a) => `${a.title} ${a.excerpt} ${a.sourceName}`.toLowerCase().includes(needle));
    return {
      mode: store.mode,
      fetchedAt: store.fetchedAt,
      total: items.length,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(items.length / pageSize)),
      sections: SECTIONS,
      items: items.slice((page - 1) * pageSize, page * pageSize),
    };
  });

  app.get('/api/sources', async () => {
    const store = getStore()!;
    return { mode: store.mode, fetchedAt: store.fetchedAt, sources: store.sources };
  });

  app.get('/api/learning', async () => withTrending(await loadRoadmap(), getStore()!.articles));

  app.get('/api/settings', async () => settingsResponse());

  app.put('/api/settings', async (req, reply) => {
    if (adminToken) {
      const header = req.headers['x-admin-token'];
      const bearer = req.headers.authorization?.replace(/^Bearer\s+/i, '');
      const given = (Array.isArray(header) ? header[0] : header) ?? bearer;
      if (!tokenMatches(given, adminToken)) {
        return reply.code(401).send({ error: 'Se requiere un token de administrador válido (cabecera X-Admin-Token) para cambiar las opciones.' });
      }
    }
    const result = await settingsStore.update(req.body ?? null);
    if (!result.ok) return reply.code(400).send({ error: result.errors.join(' '), errors: result.errors });
    scheduler.reschedule();
    return settingsResponse();
  });

  app.post('/api/refresh', async () => {
    const { store, live } = await scheduler.runNow('manual');
    return { ok: live, mode: store.mode, fetchedAt: store.fetchedAt, articles: store.articles.length, sources: store.sources };
  });

  if (opts.serveStatic && existsSync(WEB_DIST)) {
    await app.register(fastifyStatic, { root: WEB_DIST, wildcard: false });
    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith('/api/')) return reply.code(404).send({ error: 'No encontrado' });
      return reply.sendFile('index.html');
    });
  }
  return app;
}
