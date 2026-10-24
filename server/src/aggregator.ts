import { readCache, readSample, writeCache } from './cache.js';
import { dedupe } from './dedup.js';
import { fetchSource } from './fetchers.js';
import { normalizeItem, type NormalizedItem } from './normalize.js';
import { AI_TERMS, isOnDevice, rank, scoreItem } from './ranking.js';
import { SOURCES } from './sources.config.js';
import type { Article, NewsStore, RawItem, SourceConfig, SourceStatus } from './types.js';

export const MAX_AGE_DAYS = 60;
export const MAX_ARTICLES = 400;

/** Pipeline puro: normaliza → filtra → limita → (luego) deduplica y rankea. */
export function processSourceItems(raw: RawItem[], source: SourceConfig, now = new Date()): NormalizedItem[] {
  const minDate = now.getTime() - MAX_AGE_DAYS * 864e5;
  const items = raw
    .map((r) => normalizeItem(r, source, now))
    .filter((it): it is NormalizedItem => it !== null)
    .filter((it) => new Date(it.publishedAt).getTime() >= minDate)
    .filter((it) => {
      if (source.requireKeywords === 'on-device') return isOnDevice(it.title, it.excerpt);
      if (source.requireKeywords) return AI_TERMS.test(`${it.title} ${it.excerpt}`) || isOnDevice(it.title, it.excerpt);
      return true;
    })
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  return source.maxItems ? items.slice(0, source.maxItems) : items;
}

export function buildArticles(perSource: { source: SourceConfig; items: NormalizedItem[] }[], now = new Date()): Article[] {
  const flat = perSource.flatMap(({ source, items }) => items.map((item) => ({ ...item, defaultSection: source.defaultSection })));
  const scored = dedupe(flat).map(({ defaultSection, ...item }) => scoreItem(item, defaultSection, now));
  return rank(scored).slice(0, MAX_ARTICLES);
}

export interface RefreshResult {
  store: NewsStore;
  live: boolean;
}

let current: NewsStore | null = null;
let inFlight: Promise<RefreshResult> | null = null;

export function getStore(): NewsStore | null {
  return current;
}

export function setStore(store: NewsStore | null) {
  current = store;
}

/** Carga la caché o, si no existe, el dataset de muestra (marcado como `sample`). */
export async function loadInitialStore(): Promise<NewsStore> {
  const cache = await readCache();
  if (cache?.articles?.length) {
    current = { ...cache, mode: 'cache' };
    return current;
  }
  const sample = await readSample();
  current = sample
    ? { ...sample, mode: 'sample', articles: sample.articles.map((a) => ({ ...a, sample: true })) }
    : { mode: 'sample', fetchedAt: new Date(0).toISOString(), articles: [], sources: [] };
  return current;
}

/**
 * Descarga todas las fuentes activas en paralelo. Si al menos una responde, guarda y sirve
 * datos en vivo. Si todas fallan, mantiene la última caché (o la muestra).
 */
export function refresh(sources: SourceConfig[] = SOURCES, fetcher = fetchSource): Promise<RefreshResult> {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    const now = new Date();
    const active = sources.filter((s) => s.enabled);
    const firstSeen = new Map((current?.articles ?? []).filter((a) => a.undated).map((a) => [a.id, a.publishedAt]));
    const results = await Promise.allSettled(active.map((s) => fetcher(s)));
    const statuses: SourceStatus[] = [];
    const perSource: { source: SourceConfig; items: NormalizedItem[] }[] = [];
    active.forEach((source, i) => {
      const r = results[i];
      const base = { id: source.id, name: source.name, homepage: source.homepage, enabled: true, note: source.note, lastFetch: now.toISOString() };
      if (r.status === 'fulfilled') {
        // Para feeds sin fecha conservamos la fecha en que vimos la nota por primera vez
        const items = processSourceItems(r.value, source, now).map((it) =>
          it.undated && firstSeen.has(it.id) ? { ...it, publishedAt: firstSeen.get(it.id)! } : it,
        );
        perSource.push({ source, items });
        statuses.push({ ...base, ok: true, items: items.length });
      } else {
        statuses.push({ ...base, ok: false, items: 0, error: String(r.reason?.message ?? r.reason) });
      }
    });
    for (const s of sources.filter((x) => !x.enabled)) {
      statuses.push({ id: s.id, name: s.name, homepage: s.homepage, enabled: false, ok: null, items: 0, note: s.note });
    }

    const articles = buildArticles(perSource, now);
    if (articles.length > 0) {
      const store: NewsStore = { mode: 'live', fetchedAt: now.toISOString(), articles, sources: statuses };
      current = store;
      await writeCache(store).catch((e) => console.error('[cache] no se pudo escribir:', e));
      return { store, live: true };
    }
    const fallback = current ?? (await loadInitialStore());
    current = { ...fallback, sources: statuses };
    return { store: current, live: false };
  })().finally(() => {
    inFlight = null;
  });
  return inFlight;
}
