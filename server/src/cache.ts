import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NewsStore } from './types.js';

const here = dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = resolve(here, '..', 'data');
export const CACHE_FILE = process.env.CACHE_FILE ?? resolve(DATA_DIR, 'cache.json');
export const SAMPLE_FILE = resolve(DATA_DIR, 'sample-news.json');

export async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(file, 'utf8')) as T;
  } catch {
    return null;
  }
}

/** Escritura atómica (archivo temporal + rename) para no dejar la caché corrupta. */
export async function writeCache(store: NewsStore, file = CACHE_FILE): Promise<void> {
  await mkdir(dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  await writeFile(tmp, JSON.stringify(store, null, 2));
  await rename(tmp, file);
}

export const readCache = (file = CACHE_FILE) => readJson<NewsStore>(file);
export const readSample = (file = SAMPLE_FILE) => readJson<NewsStore>(file);
