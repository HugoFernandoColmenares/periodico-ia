import Parser from 'rss-parser';
import { HN_QUERIES } from './sources.config.js';
import type { RawItem, SourceConfig } from './types.js';

export const USER_AGENT = 'PeriodicoIA/1.0 (+https://github.com/hugocolmenares/periodico-ia; lector de noticias sin fines de lucro)';
const TIMEOUT_MS = 20_000;

type MediaNode = { $?: { url?: string; medium?: string; type?: string } };
type ParsedItem = Parser.Item & {
  'media:content'?: MediaNode | MediaNode[];
  'media:thumbnail'?: MediaNode | MediaNode[];
  'content:encoded'?: string;
  enclosure?: { url?: string; type?: string };
  author?: string;
  creator?: string;
  summary?: string;
};

const parser: Parser<object, ParsedItem> = new Parser({
  customFields: { item: ['media:content', 'media:thumbnail', 'content:encoded', 'summary', 'author'] },
});

async function httpGet(url: string, accept: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: accept },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

const first = <T>(v: T | T[] | undefined): T | undefined => (Array.isArray(v) ? v[0] : v);

/** Busca una imagen en enclosure, media:content, media:thumbnail o el primer <img> del contenido. */
export function extractImage(item: ParsedItem): string | undefined {
  if (item.enclosure?.url && (!item.enclosure.type || item.enclosure.type.startsWith('image'))) return item.enclosure.url;
  const media = first(item['media:content']);
  if (media?.$?.url && media.$.medium !== 'video') return media.$.url;
  const thumb = first(item['media:thumbnail']);
  if (thumb?.$?.url) return thumb.$.url;
  const html = [item['content:encoded'], item.content].find((x): x is string => typeof x === 'string') ?? '';
  const m = /<img[^>]+src=["']([^"']+)["']/i.exec(html);
  return m?.[1]?.replace(/&amp;/g, '&');
}

export async function fetchRss(source: SourceConfig): Promise<RawItem[]> {
  const xml = await httpGet(source.url, 'application/rss+xml, application/atom+xml, application/xml;q=0.9, */*;q=0.8');
  const feed = await parser.parseString(xml);
  return feed.items.map((it) => ({
    title: typeof it.title === 'string' ? it.title : undefined,
    link: it.link,
    pubDate: it.pubDate,
    isoDate: it.isoDate,
    content: [it['content:encoded'], it.content].find((x): x is string => typeof x === 'string'),
    contentSnippet: it.contentSnippet,
    summary: typeof it.summary === 'string' ? it.summary : undefined,
    image: extractImage(it),
    author: it.creator ?? (typeof it.author === 'string' ? it.author : undefined),
  }));
}

interface HnHit {
  objectID: string;
  title?: string;
  url?: string | null;
  points?: number;
  num_comments?: number;
  created_at?: string;
  author?: string;
  story_text?: string | null;
}

/** Hacker News vía la API pública de Algolia: varias consultas, últimos 10 días, ≥ 20 puntos. */
export async function fetchHackerNews(source: SourceConfig, now = new Date()): Promise<RawItem[]> {
  const since = Math.floor(now.getTime() / 1000) - 10 * 24 * 3600;
  const results = await Promise.allSettled(
    HN_QUERIES.map(async (q) => {
      const url = `${source.url}?tags=story&hitsPerPage=12&query=${encodeURIComponent(q)}&numericFilters=${encodeURIComponent(`created_at_i>${since},points>=20`)}`;
      const body = JSON.parse(await httpGet(url, 'application/json')) as { hits: HnHit[] };
      return body.hits;
    }),
  );
  const ok = results.filter((r): r is PromiseFulfilledResult<HnHit[]> => r.status === 'fulfilled');
  if (!ok.length) throw new Error((results[0] as PromiseRejectedResult).reason?.message ?? 'HN sin respuesta');
  const seen = new Set<string>();
  const items: RawItem[] = [];
  for (const hit of ok.flatMap((r) => r.value)) {
    if (seen.has(hit.objectID) || !hit.title) continue;
    seen.add(hit.objectID);
    const discussionUrl = `https://news.ycombinator.com/item?id=${hit.objectID}`;
    items.push({
      title: hit.title,
      link: hit.url || discussionUrl,
      isoDate: hit.created_at,
      contentSnippet: hit.story_text ?? '',
      author: hit.author,
      extra: { points: hit.points, comments: hit.num_comments, discussionUrl },
    });
  }
  return items;
}

export function fetchSource(source: SourceConfig): Promise<RawItem[]> {
  return source.type === 'hn' ? fetchHackerNews(source) : fetchRss(source);
}
