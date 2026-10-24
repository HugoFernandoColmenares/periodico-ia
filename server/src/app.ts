import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyInstance } from 'fastify';
import { getStore, loadInitialStore, refresh } from './aggregator.js';
import { loadRoadmap, withTrending } from './learning.js';
import type { SectionId } from './types.js';

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

export async function buildApp(opts: { serveStatic?: boolean; logger?: boolean } = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: opts.logger ?? false });
  if (!getStore()) await loadInitialStore();

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

  app.post('/api/refresh', async () => {
    const { store, live } = await refresh();
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
