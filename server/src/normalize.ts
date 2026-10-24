import { createHash } from 'node:crypto';
import type { RawItem, SourceConfig } from './types.js';

export const EXCERPT_MAX = 280;

const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…', mdash: '—', ndash: '–',
  rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“',
};

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, code: string) => {
    if (code[0] === '#') {
      const n = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return ENTITIES[code.toLowerCase()] ?? m;
  });
}

/** Quita etiquetas HTML, scripts/estilos y colapsa espacios. */
export function stripHtml(html: unknown): string {
  if (typeof html !== 'string' || !html) return '';
  return decodeEntities(
    html
      .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<br\s*\/?>|<\/p>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Recorta a un extracto corto (nunca el texto completo del artículo),
 * cortando en un límite de palabra y añadiendo "…".
 */
export function makeExcerpt(text: string, max = EXCERPT_MAX): string {
  const clean = text
    .replace(/submitted by\s+\/u\/\S+.*$/i, '')
    .replace(/The post .* appeared first on .*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,.;:–—-]+$/, '')}…`;
}

const TRACKING_PARAMS = /^(utm_\w+|ref|ref_src|fbclid|gclid|mc_cid|mc_eid|guccounter|ncid|cmpid|source)$/i;

/** URL canónica para deduplicar: https, sin www, sin hash, sin parámetros de tracking ni "/" final. */
export function canonicalUrl(raw: string): string {
  try {
    const u = new URL(raw.trim());
    u.protocol = 'https:';
    u.hostname = u.hostname.replace(/^www\./, '').toLowerCase();
    u.hash = '';
    for (const key of [...u.searchParams.keys()]) if (TRACKING_PARAMS.test(key)) u.searchParams.delete(key);
    // arXiv: versiones distintas del mismo paper (v1, v2) cuentan como uno
    if (u.hostname.endsWith('arxiv.org')) u.pathname = u.pathname.replace(/^\/(abs|pdf)\//, '/abs/').replace(/v\d+$/, '');
    if (u.pathname.length > 1) u.pathname = u.pathname.replace(/\/+$/, '');
    return u.toString();
  } catch {
    return raw.trim();
  }
}

/** Título normalizado: minúsculas, sin acentos ni puntuación. */
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function toIsoDate(...candidates: (string | undefined)[]): string | undefined {
  for (const c of candidates) {
    if (!c) continue;
    const d = new Date(c);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return undefined;
}

export function articleId(url: string): string {
  return createHash('sha1').update(canonicalUrl(url)).digest('hex').slice(0, 12);
}

export interface NormalizedItem {
  id: string;
  title: string;
  url: string;
  source: string;
  sourceName: string;
  publishedAt: string;
  excerpt: string;
  image?: string;
  author?: string;
  discussionUrl?: string;
  points?: number;
  comments?: number;
}

/** Convierte un ítem crudo de cualquier fuente al formato común. Devuelve null si no es utilizable. */
export function normalizeItem(raw: RawItem, source: Pick<SourceConfig, 'id' | 'name'>, now = new Date()): NormalizedItem | null {
  const title = stripHtml(raw.title);
  const link = raw.link?.trim();
  if (!title || !link || !/^https?:\/\//i.test(link)) return null;
  const published = toIsoDate(raw.isoDate, raw.pubDate) ?? now.toISOString();
  // fechas en el futuro (zonas horarias mal declaradas) se acotan a "ahora"
  const publishedAt = new Date(published) > now ? now.toISOString() : published;
  const text = stripHtml(raw.contentSnippet || raw.summary || raw.content)
    .replace(/^arXiv:\S+\s+Announce Type:\s*\S+\s*Abstract:\s*/i, '');
  const image = raw.image && /^https?:\/\//i.test(raw.image) ? raw.image : undefined;
  return {
    id: articleId(link),
    title: makeExcerpt(title, 200),
    url: link,
    source: source.id,
    sourceName: source.name,
    publishedAt,
    excerpt: makeExcerpt(text),
    image,
    author: raw.author ? stripHtml(raw.author).slice(0, 80) : undefined,
    discussionUrl: raw.extra?.discussionUrl,
    points: raw.extra?.points,
    comments: raw.extra?.comments,
  };
}
