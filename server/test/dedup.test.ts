import { describe, expect, it } from 'vitest';
import { dedupe, titleSimilarity } from '../src/dedup.js';

describe('titleSimilarity', () => {
  it('es alta para el mismo titular con pequeñas diferencias', () => {
    expect(titleSimilarity('Google releases Gemma 3n for phones', 'Google Releases Gemma 3n For Phones!')).toBe(1);
    expect(titleSimilarity('Google releases Gemma 3n for phones', 'Apple announces new Core ML tools')).toBeLessThan(0.2);
  });
});

describe('dedupe', () => {
  it('elimina duplicados por URL canónica', () => {
    const out = dedupe([
      { title: 'A', url: 'https://www.site.com/post?utm_source=rss' },
      { title: 'A (copia)', url: 'http://site.com/post/', image: 'https://img' },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].image).toBe('https://img'); // completa datos faltantes del duplicado
  });
  it('elimina duplicados por título casi idéntico en distintas fuentes', () => {
    const out = dedupe([
      { title: 'Meta releases Llama 3.2 1B and 3B for edge devices', url: 'https://a.com/1' },
      { title: 'Meta releases Llama 3.2 1B and 3B for edge devices', url: 'https://b.com/2', points: 300 },
      { title: 'Something completely different', url: 'https://c.com/3' },
    ]);
    expect(out.map((o) => o.url)).toEqual(['https://a.com/1', 'https://c.com/3']);
    expect(out[0].points).toBe(300);
  });
});
