import { describe, expect, it } from 'vitest';
import { canonicalUrl, EXCERPT_MAX, makeExcerpt, normalizeItem, normalizeTitle, stripHtml } from '../src/normalize.js';

const src = { id: 'demo', name: 'Demo' };

describe('stripHtml', () => {
  it('quita etiquetas, scripts y decodifica entidades', () => {
    expect(stripHtml('<p>Hola&nbsp;<b>mundo</b> &amp; IA</p><script>alert(1)</script>')).toBe('Hola mundo & IA');
    expect(stripHtml('&#8220;Gemma&#8221; &#x2014; ok')).toBe('“Gemma” — ok');
  });
  it('tolera valores que no son texto', () => {
    expect(stripHtml(undefined)).toBe('');
    expect(stripHtml({ a: 1 })).toBe('');
  });
});

describe('makeExcerpt', () => {
  it('nunca supera el máximo y corta en palabra', () => {
    const long = 'palabra '.repeat(200);
    const out = makeExcerpt(long);
    expect(out.length).toBeLessThanOrEqual(EXCERPT_MAX + 1);
    expect(out.endsWith('…')).toBe(true);
    expect(out).not.toMatch(/palab…$/);
  });
  it('elimina la firma de Reddit y de WordPress', () => {
    expect(makeExcerpt('Gran modelo submitted by /u/alguien [link] [comments]')).toBe('Gran modelo');
    expect(makeExcerpt('Texto. The post X appeared first on MarkTechPost.')).toBe('Texto.');
  });
});

describe('canonicalUrl', () => {
  it('normaliza protocolo, www, hash, slash final y parámetros de tracking', () => {
    expect(canonicalUrl('http://www.Example.com/post/?utm_source=x&id=3#top')).toBe('https://example.com/post?id=3');
  });
  it('unifica versiones de arXiv', () => {
    expect(canonicalUrl('https://arxiv.org/abs/2501.00001v2')).toBe(canonicalUrl('http://arxiv.org/abs/2501.00001'));
  });
});

describe('normalizeTitle', () => {
  it('quita acentos y puntuación', () => {
    expect(normalizeTitle('¡Cuantización: 4-bit en el Teléfono!')).toBe('cuantizacion 4 bit en el telefono');
  });
});

describe('normalizeItem', () => {
  const now = new Date('2026-10-23T12:00:00Z');
  it('produce el formato común con extracto corto', () => {
    const item = normalizeItem(
      { title: ' <b>Gemma</b> on phones ', link: 'https://x.dev/a', isoDate: '2026-10-22T10:00:00Z', content: `<p>${'texto '.repeat(100)}</p>`, image: 'https://x.dev/i.png' },
      src,
      now,
    );
    expect(item).toMatchObject({ title: 'Gemma on phones', url: 'https://x.dev/a', source: 'demo', sourceName: 'Demo', image: 'https://x.dev/i.png', publishedAt: '2026-10-22T10:00:00.000Z' });
    expect(item!.excerpt.length).toBeLessThanOrEqual(EXCERPT_MAX + 1);
    expect(item!.id).toHaveLength(12);
  });
  it('descarta ítems sin título o sin URL http(s)', () => {
    expect(normalizeItem({ title: '', link: 'https://x.dev' }, src)).toBeNull();
    expect(normalizeItem({ title: 'Hola', link: 'javascript:alert(1)' }, src)).toBeNull();
  });
  it('acota fechas futuras a "ahora" y usa pubDate si falta isoDate', () => {
    expect(normalizeItem({ title: 'a', link: 'https://x.dev', isoDate: '2030-01-01T00:00:00Z' }, src, now)!.publishedAt).toBe(now.toISOString());
    expect(normalizeItem({ title: 'a', link: 'https://x.dev', pubDate: 'Thu, 22 Oct 2026 08:00:00 GMT' }, src, now)!.publishedAt).toBe('2026-10-22T08:00:00.000Z');
  });
  it('limpia el prefijo de anuncio de arXiv', () => {
    const it = normalizeItem({ title: 'p', link: 'https://arxiv.org/abs/1', contentSnippet: 'arXiv:2510.1 Announce Type: new Abstract: We study tiny models.' }, src, now);
    expect(it!.excerpt).toBe('We study tiny models.');
  });
});
