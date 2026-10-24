import type { Article } from './models';

let n = 0;
export function makeArticle(partial: Partial<Article> = {}): Article {
  n++;
  return {
    id: `a${n}`,
    title: `Titular ${n}`,
    url: `https://example.com/${n}`,
    source: 'hf',
    sourceName: 'Hugging Face Blog',
    publishedAt: new Date(Date.now() - 2 * 3600_000).toISOString(),
    excerpt: 'Extracto breve de la nota.',
    section: 'on-device',
    score: 80,
    scoreBreakdown: { topic: 10, onDevice: 40, recency: 28, popularity: 2 },
    matchedKeywords: ['on-device', 'Gemma'],
    ...partial,
  };
}
