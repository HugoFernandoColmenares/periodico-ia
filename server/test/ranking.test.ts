import { describe, expect, it } from 'vitest';
import { buildArticles, processSourceItems } from '../src/aggregator.js';
import type { NormalizedItem } from '../src/normalize.js';
import { classify, isOnDevice, matchKeywords, ON_DEVICE_KEYWORDS, rank, recencyScore, scoreItem } from '../src/ranking.js';
import type { SourceConfig } from '../src/types.js';

const now = new Date('2026-10-23T12:00:00Z');
const hoursAgo = (h: number) => new Date(now.getTime() - h * 36e5).toISOString();
const item = (title: string, excerpt = '', h = 2, extra: Partial<NormalizedItem> = {}): NormalizedItem => ({
  id: title, title, url: `https://e.com/${encodeURIComponent(title)}`, source: 's', sourceName: 'S', publishedAt: hoursAgo(h), excerpt, ...extra,
});

describe('detección on-device', () => {
  it.each([
    'Running Gemma 3n on-device on Android phones',
    'llama.cpp adds new GGUF quantization types',
    'ExecuTorch 1.0 brings PyTorch models to mobile',
    'Phi-4-mini: a small language model for edge devices',
    'Ollama now supports MLX on Apple silicon',
  ])('detecta: %s', (t) => expect(isOnDevice(t, '')).toBe(true));

  it.each([
    'OpenAI raises $40B in new funding round',
    'Scaling laws for offline reinforcement learning',
    'New benchmark for low-resource languages',
    'Startup raises $1B to build data centers',
  ])('no confunde: %s', (t) => expect(isOnDevice(t, '')).toBe(false));

  it('pondera doble las coincidencias en el título', () => {
    const inTitle = matchKeywords('on-device AI', '', ON_DEVICE_KEYWORDS).score;
    const inBody = matchKeywords('Noticia', 'on-device AI', ON_DEVICE_KEYWORDS).score;
    expect(inTitle).toBe(inBody * 2);
  });
});

describe('clasificación por sección', () => {
  it('asigna secciones según palabras clave', () => {
    expect(classify('Core ML on iPhone gets faster', '', 'industria')).toBe('on-device');
    expect(classify('Anthropic raises funding at $60B valuation', '', 'modelos')).toBe('industria');
    expect(classify('We propose a new training method', 'paper on arXiv', 'industria')).toBe('investigacion');
    expect(classify('New open-source SDK and CLI for agents', '', 'modelos')).toBe('herramientas');
  });
  it('usa la sección por defecto de la fuente si no hay señales', () => {
    expect(classify('Una nota sin pistas', '', 'industria')).toBe('industria');
  });
});

describe('puntaje', () => {
  it('la recencia decae con vida media de 36 h', () => {
    expect(recencyScore(hoursAgo(0), now)).toBeCloseTo(30);
    expect(recencyScore(hoursAgo(36), now)).toBeCloseTo(15);
    expect(recencyScore(hoursAgo(72), now)).toBeCloseTo(7.5);
  });
  it('expone un desglose que suma el puntaje total', () => {
    const a = scoreItem(item('Gemma on-device quantization', '', 5, { points: 150 }), 'modelos', now);
    const { topic, onDevice, recency, popularity } = a.scoreBreakdown;
    expect(a.score).toBeCloseTo(topic + onDevice + recency + popularity, 0);
    expect(a.matchedKeywords).toContain('Gemma');
    expect(popularity).toBeGreaterThan(0);
  });
  it('una noticia on-device de hace 2 días supera a una general reciente', () => {
    const general = scoreItem(item('OpenAI launches GPT-6 model for enterprise customers', '', 1), 'industria', now);
    const onDevice = scoreItem(item('Small language model runs on phones with 4-bit quantization', '', 48), 'modelos', now);
    expect(rank([general, onDevice])[0].title).toBe(onDevice.title);
  });
});

describe('pipeline', () => {
  const src: SourceConfig = { id: 'arxiv', name: 'arXiv', type: 'rss', url: '', homepage: '', defaultSection: 'investigacion', requireKeywords: 'on-device', maxItems: 5, enabled: true };
  it('filtra por requireKeywords, antigüedad y máximo de ítems', () => {
    const raw = [
      { title: 'Quantization for on-device LLMs', link: 'https://arxiv.org/abs/1', isoDate: hoursAgo(3) },
      { title: 'A theory of graph neural networks', link: 'https://arxiv.org/abs/2', isoDate: hoursAgo(3) },
      { title: 'Old on-device paper', link: 'https://arxiv.org/abs/3', isoDate: hoursAgo(24 * 90) },
    ];
    expect(processSourceItems(raw, src, now).map((i) => i.url)).toEqual(['https://arxiv.org/abs/1']);
  });
  it('deduplica entre fuentes y ordena con on-device primero', () => {
    const a = item('Funding round for AI startup', 'raises money', 1);
    const b = item('Gemma 3n runs on-device on Android', '', 10);
    const dup = { ...b, url: 'https://other.com/x', source: 'otra' };
    const out = buildArticles([{ source: { ...src, requireKeywords: undefined }, items: [a, b] }, { source: { ...src, id: 'otra' }, items: [dup] }], now);
    expect(out).toHaveLength(2);
    expect(out[0].section).toBe('on-device');
  });
});
