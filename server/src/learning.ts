import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Article } from './types.js';

const here = dirname(fileURLToPath(import.meta.url));
export const LEARNING_FILE = process.env.LEARNING_FILE ?? resolve(here, '..', '..', 'content', 'learning.json');

export interface LearningResource {
  title: string;
  url: string;
  type: string;
}

export interface LearningTopic {
  id: string;
  title: string;
  level: 'básico' | 'intermedio' | 'avanzado';
  why: string;
  /** Expresiones (insensibles a mayúsculas) para detectar si el tema aparece en las noticias. */
  keywords: string[];
  resources: LearningResource[];
}

export interface LearningRoadmap {
  title: string;
  intro: string;
  updatedAt: string;
  topics: LearningTopic[];
}

export async function loadRoadmap(file = LEARNING_FILE): Promise<LearningRoadmap> {
  return JSON.parse(await readFile(file, 'utf8')) as LearningRoadmap;
}

/** Cuenta cuántas noticias recientes mencionan cada tema (para marcarlo como "en tendencia"). */
export function trendingCounts(topics: LearningTopic[], articles: Pick<Article, 'title' | 'excerpt'>[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const t of topics) {
    const res = t.keywords.map((kw) => new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i'));
    out[t.id] = articles.filter((a) => res.some((re) => re.test(`${a.title} ${a.excerpt}`))).length;
  }
  return out;
}

export function withTrending(roadmap: LearningRoadmap, articles: Pick<Article, 'title' | 'excerpt'>[]) {
  const counts = trendingCounts(roadmap.topics, articles);
  const sorted = Object.values(counts).sort((a, b) => b - a);
  const cutoff = Math.max(3, sorted[2] ?? 0); // top 3 temas con al menos 3 menciones
  return {
    ...roadmap,
    topics: roadmap.topics.map((t) => ({ ...t, mentions: counts[t.id], trending: counts[t.id] >= cutoff })),
  };
}
