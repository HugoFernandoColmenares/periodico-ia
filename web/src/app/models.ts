export type SectionId = 'on-device' | 'modelos' | 'investigacion' | 'industria' | 'herramientas';
export type DataMode = 'live' | 'cache' | 'sample';

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

export interface Section {
  id: SectionId;
  label: string;
}

export interface NewsResponse {
  mode: DataMode;
  fetchedAt: string;
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  sections: Section[];
  items: Article[];
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

export interface LearningTopic {
  id: string;
  title: string;
  level: string;
  why: string;
  resources: { title: string; url: string; type: string }[];
  mentions: number;
  trending: boolean;
}

export interface LearningRoadmap {
  title: string;
  intro: string;
  updatedAt: string;
  topics: LearningTopic[];
}

export const SECTION_LABELS: Record<SectionId, string> = {
  'on-device': 'On-device e IA pequeña',
  modelos: 'Modelos',
  investigacion: 'Investigación',
  industria: 'Industria',
  herramientas: 'Herramientas',
};

export const SECTION_ORDER: SectionId[] = ['on-device', 'modelos', 'investigacion', 'industria', 'herramientas'];

export type RefreshMode = 'interval' | 'daily';

export interface RefreshSettings {
  mode: RefreshMode;
  intervalMinutes: number;
  dailyTime: string;
  timezone: string;
}

export interface SettingsResponse extends RefreshSettings {
  lastRefreshAt: string | null;
  nextRefreshAt: string | null;
  allowedIntervals: number[];
  minIntervalMinutes: number;
  adminTokenRequired: boolean;
}
