export type SectionId = 'on-device' | 'modelos' | 'investigacion' | 'industria' | 'herramientas';

export type SourceType = 'rss' | 'hn';

export interface SourceConfig {
  /** Identificador estable (se usa en filtros: /api/news?source=<id>). */
  id: string;
  name: string;
  type: SourceType;
  /** URL del feed RSS/Atom o, para `hn`, la consulta de búsqueda de Algolia. */
  url: string;
  homepage: string;
  /** Sección por defecto si la heurística no detecta otra con claridad. */
  defaultSection: SectionId;
  /**
   * Si es `true`, solo se aceptan artículos que mencionen algún término de IA.
   * Si es `'on-device'`, solo se aceptan los que tengan términos on-device / IA pequeña.
   */
  requireKeywords?: boolean | 'on-device';
  /** Máximo de artículos que se toman del feed (después de filtrar). */
  maxItems?: number;
  enabled: boolean;
  /** Nota libre (por ejemplo, por qué está desactivada). */
  note?: string;
}

export interface RawItem {
  title?: string;
  link?: string;
  pubDate?: string;
  isoDate?: string;
  content?: string;
  contentSnippet?: string;
  summary?: string;
  image?: string;
  author?: string;
  /** Datos extra (p. ej. puntos de HN). */
  extra?: { points?: number; comments?: number; discussionUrl?: string };
}

export interface Article {
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
  undated?: boolean;
  section: SectionId;
  score: number;
  scoreBreakdown: { topic: number; onDevice: number; recency: number; popularity: number };
  matchedKeywords: string[];
  sample?: boolean;
}

export interface SourceStatus {
  id: string;
  name: string;
  homepage: string;
  enabled: boolean;
  ok: boolean | null;
  items: number;
  lastFetch?: string;
  error?: string;
  note?: string;
}

export type DataMode = 'live' | 'cache' | 'sample';

export interface NewsStore {
  mode: DataMode;
  fetchedAt: string;
  articles: Article[];
  sources: SourceStatus[];
}
