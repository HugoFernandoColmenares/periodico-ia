import { canonicalUrl, normalizeTitle } from './normalize.js';

const STOP = new Set(['the', 'a', 'an', 'of', 'to', 'in', 'for', 'and', 'on', 'with', 'is', 'its', 'by', 'at', 'from', 'how', 'new']);

export function titleTokens(title: string): Set<string> {
  return new Set(normalizeTitle(title).split(' ').filter((t) => t.length > 1 && !STOP.has(t)));
}

/** Similitud de Jaccard entre los tokens de dos títulos (0..1). */
export function titleSimilarity(a: string, b: string): number {
  const ta = titleTokens(a);
  const tb = titleTokens(b);
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return inter / (ta.size + tb.size - inter);
}

export interface Dedupable {
  title: string;
  url: string;
  excerpt?: string;
  image?: string;
  points?: number;
}

/**
 * Elimina duplicados por URL canónica y por títulos casi idénticos (Jaccard ≥ umbral).
 * Conserva el primero, pero completa extracto/imagen/puntos que le falten con los del duplicado.
 */
export function dedupe<T extends Dedupable>(items: T[], threshold = 0.75): T[] {
  const byUrl = new Map<string, T>();
  const kept: T[] = [];
  for (const item of items) {
    const key = canonicalUrl(item.url);
    const existing = byUrl.get(key) ?? kept.find((k) => titleSimilarity(k.title, item.title) >= threshold);
    if (existing) {
      if (!existing.excerpt && item.excerpt) existing.excerpt = item.excerpt;
      if (!existing.image && item.image) existing.image = item.image;
      if (item.points && (!existing.points || item.points > existing.points)) existing.points = item.points;
      byUrl.set(key, existing);
      continue;
    }
    byUrl.set(key, item);
    kept.push(item);
  }
  return kept;
}
