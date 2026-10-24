import { Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { ArticleCard } from './components/article-card';
import { FrontPage } from './components/front-page';
import { LearningSection } from './components/learning-section';
import { Masthead, type View } from './components/masthead';
import { OptionsSection } from './components/options-section';
import { SECTION_LABELS, type SectionId } from './models';
import { NewsService } from './news.service';
import { SettingsService } from './settings.service';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Masthead, FrontPage, ArticleCard, LearningSection, OptionsSection],
  templateUrl: './app.html',
})
export class App implements OnInit {
  protected readonly news = inject(NewsService);
  private readonly settings = inject(SettingsService);
  private readonly location = inject(Location);
  protected readonly view = signal<View>('portada');
  protected readonly query = signal('');
  protected readonly activeQuery = signal('');
  protected readonly page = signal(1);

  protected readonly listingTitle = computed(() => {
    const v = this.view();
    if (this.activeQuery()) return `Resultados para “${this.activeQuery()}”`;
    return v === 'portada' || v === 'aprender' || v === 'opciones' ? '' : SECTION_LABELS[v];
  });

  ngOnInit(): void {
    // /opciones tiene URL propia (enlazable y con botón “atrás”); el resto vive en la portada
    if (this.isOptionsPath(this.location.path())) this.view.set('opciones');
    this.location.onUrlChange((url) => {
      if (this.isOptionsPath(url)) this.view.set('opciones');
      else if (this.view() === 'opciones') this.view.set('portada');
    });
    void this.news.loadFrontPage();
    void this.news.loadSources();
    void this.news.loadLearning();
  }

  private isOptionsPath(url: string) {
    return /^\/?opciones\/?(\?|#|$)/.test(url);
  }

  private syncUrl(v: View) {
    const path = v === 'opciones' ? '/opciones' : '';
    if (this.location.path() !== path) this.location.go(path || '/');
  }

  protected navigate(v: View) {
    this.syncUrl(v);
    this.view.set(v);
    this.page.set(1);
    this.activeQuery.set('');
    this.query.set('');
    if (v !== 'portada' && v !== 'aprender' && v !== 'opciones') void this.news.loadListing({ section: v });
    window.scrollTo({ top: 0 });
  }

  protected search(event: Event) {
    event.preventDefault();
    const q = this.query().trim();
    if (!q) return this.navigate('portada');
    this.activeQuery.set(q);
    this.syncUrl('portada');
    this.view.set('portada');
    this.page.set(1);
    void this.news.loadListing({ q });
  }

  protected goToPage(p: number) {
    this.page.set(p);
    const v = this.view();
    const section = v === 'portada' || v === 'aprender' || v === 'opciones' ? null : (v as SectionId);
    void this.news.loadListing({ section, q: this.activeQuery() || undefined, page: p });
    window.scrollTo({ top: 0 });
  }

  protected async refresh() {
    await this.news.refresh();
    await this.reloadAfterRefresh();
  }

  protected async reloadAfterRefresh() {
    await Promise.all([this.news.loadFrontPage(), this.news.loadSources(), this.news.loadLearning(), this.settings.load()]);
    if (this.listingTitle()) this.goToPage(this.page());
  }

  protected onQueryInput(event: Event) {
    this.query.set((event.target as HTMLInputElement).value);
  }
}
