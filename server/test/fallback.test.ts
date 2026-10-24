import { describe, expect, it } from 'vitest';
import { refresh, setStore } from '../src/aggregator.js';
import type { SourceConfig } from '../src/types.js';

const src: SourceConfig = { id: 'x', name: 'X', type: 'rss', url: 'https://invalid.test/feed', homepage: '', defaultSection: 'modelos', enabled: true };

describe('fallback', () => {
  it('si todas las fuentes fallan, conserva los datos previos y reporta el error por fuente', async () => {
    setStore({ mode: 'cache', fetchedAt: '2026-10-01T00:00:00.000Z', articles: [{ id: '1' } as never], sources: [] });
    const { store, live } = await refresh([src, { ...src, id: 'off', enabled: false }], async () => {
      throw new Error('sin red');
    });
    expect(live).toBe(false);
    expect(store.mode).toBe('cache');
    expect(store.articles).toHaveLength(1);
    expect(store.sources.find((s) => s.id === 'x')).toMatchObject({ ok: false, error: 'sin red' });
    expect(store.sources.find((s) => s.id === 'off')).toMatchObject({ enabled: false, ok: null });
  });
});
