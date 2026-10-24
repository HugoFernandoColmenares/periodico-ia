import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { loadInitialStore, setStore } from '../src/aggregator.js';
import { buildApp } from '../src/app.js';

describe('API REST (con datos de muestra)', () => {
  let app: FastifyInstance;
  beforeAll(async () => {
    process.env.CACHE_FILE = '/nonexistent/cache.json';
    setStore(null);
    const { readSample } = await import('../src/cache.js');
    const sample = await readSample();
    setStore({ ...sample!, mode: 'sample' });
    app = await buildApp();
  });
  afterAll(() => app.close());

  it('GET /api/news pagina y marca el modo', async () => {
    const res = await app.inject('/api/news?page=1&pageSize=3');
    const body = res.json();
    expect(res.statusCode).toBe(200);
    expect(body.mode).toBe('sample');
    expect(body.items).toHaveLength(3);
    expect(body.items[0].section).toBe('on-device');
  });
  it('filtra por sección, fuente y texto', async () => {
    expect((await app.inject('/api/news?section=industria')).json().items.every((a: { section: string }) => a.section === 'industria')).toBe(true);
    expect((await app.inject('/api/news?source=hackernews')).json().total).toBe(2);
    expect((await app.inject('/api/news?q=ollama')).json().total).toBe(1);
    expect((await app.inject('/api/news?section=nope')).statusCode).toBe(400);
  });
  it('GET /api/learning devuelve la ruta con conteo de menciones', async () => {
    const body = (await app.inject('/api/learning')).json();
    expect(body.topics.length).toBeGreaterThan(5);
    expect(body.topics[0]).toHaveProperty('mentions');
  });
  it('GET /api/sources responde', async () => {
    expect((await app.inject('/api/sources')).statusCode).toBe(200);
  });
  it('loadInitialStore cae en la muestra si no hay caché', async () => {
    const store = await loadInitialStore();
    expect(['cache', 'sample']).toContain(store.mode);
  });
});
