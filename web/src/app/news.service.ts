import { HttpClient, HttpParams } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { Article, DataMode, LearningRoadmap, NewsResponse, SectionId, SourceStatus } from './models';

/** Estado global de la app con signals. Toda la lectura de datos pasa por aquí. */
@Injectable({ providedIn: 'root' })
export class NewsService {
  private readonly http = inject(HttpClient);

  readonly frontPage = signal<Article[]>([]);
  readonly listing = signal<NewsResponse | null>(null);
  readonly sources = signal<SourceStatus[]>([]);
  readonly learning = signal<LearningRoadmap | null>(null);
  readonly mode = signal<DataMode | null>(null);
  readonly fetchedAt = signal<string | null>(null);
  readonly loading = signal(false);
  readonly refreshing = signal(false);
  readonly error = signal<string | null>(null);

  readonly liveSources = computed(() => this.sources().filter((s) => s.ok).length);

  async loadFrontPage(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const res = await firstValueFrom(this.http.get<NewsResponse>('/api/news', { params: { pageSize: 100 } }));
      this.frontPage.set(res.items);
      this.mode.set(res.mode);
      this.fetchedAt.set(res.fetchedAt);
    } catch {
      this.error.set('No pudimos conectar con el servidor de noticias. Intenta de nuevo en unos minutos.');
    } finally {
      this.loading.set(false);
    }
  }

  async loadListing(opts: { section?: SectionId | null; q?: string; source?: string; page?: number }): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    let params = new HttpParams().set('page', opts.page ?? 1).set('pageSize', 20);
    if (opts.section) params = params.set('section', opts.section);
    if (opts.q) params = params.set('q', opts.q);
    if (opts.source) params = params.set('source', opts.source);
    try {
      const res = await firstValueFrom(this.http.get<NewsResponse>('/api/news', { params }));
      this.listing.set(res);
      this.mode.set(res.mode);
      this.fetchedAt.set(res.fetchedAt);
    } catch {
      this.error.set('No pudimos cargar esta sección.');
    } finally {
      this.loading.set(false);
    }
  }

  async loadSources(): Promise<void> {
    try {
      const res = await firstValueFrom(this.http.get<{ sources: SourceStatus[] }>('/api/sources'));
      this.sources.set(res.sources);
    } catch {
      /* el pie de página simplemente no muestra fuentes */
    }
  }

  async loadLearning(): Promise<void> {
    try {
      this.learning.set(await firstValueFrom(this.http.get<LearningRoadmap>('/api/learning')));
    } catch {
      this.learning.set(null);
    }
  }

  async refresh(): Promise<void> {
    this.refreshing.set(true);
    try {
      await firstValueFrom(this.http.post('/api/refresh', {}));
    } catch {
      this.error.set('La actualización falló; seguimos mostrando la última edición disponible.');
    } finally {
      this.refreshing.set(false);
    }
  }
}
