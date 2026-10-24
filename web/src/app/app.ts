import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { ArticleCard } from './components/article-card';
import { FrontPage } from './components/front-page';
import { LearningSection } from './components/learning-section';
import { Masthead, type View } from './components/masthead';
import { SECTION_LABELS, type SectionId } from './models';
import { NewsService } from './news.service';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Masthead, FrontPage, ArticleCard, LearningSection],
  templateUrl: './app.html',
})
export class App implements OnInit {
  protected readonly news = inject(NewsService);
  protected readonly view = signal<View>('portada');
  protected readonly query = signal('');
  protected readonly activeQuery = signal('');
  protected readonly page = signal(1);

  protected readonly listingTitle = computed(() => {
    const v = this.view();
    if (this.activeQuery()) return `Resultados para “${this.activeQuery()}”`;
    return v === 'portada' || v === 'aprender' ? '' : SECTION_LABELS[v];
  });

  ngOnInit(): void {
    void this.news.loadFrontPage();
    void this.news.loadSources();
    void this.news.loadLearning();
  }

  protected navigate(v: View) {
    this.view.set(v);
    this.page.set(1);
    this.activeQuery.set('');
    this.query.set('');
    if (v !== 'portada' && v !== 'aprender') void this.news.loadListing({ section: v });
    window.scrollTo({ top: 0 });
  }

  protected search(event: Event) {
    event.preventDefault();
    const q = this.query().trim();
    if (!q) return this.navigate('portada');
    this.activeQuery.set(q);
    this.view.set('portada');
    this.page.set(1);
    void this.news.loadListing({ q });
  }

  protected goToPage(p: number) {
    this.page.set(p);
    const v = this.view();
    const section = v === 'portada' || v === 'aprender' ? null : (v as SectionId);
    void this.news.loadListing({ section, q: this.activeQuery() || undefined, page: p });
    window.scrollTo({ top: 0 });
  }

  protected async refresh() {
    await this.news.refresh();
    await Promise.all([this.news.loadFrontPage(), this.news.loadSources(), this.news.loadLearning()]);
    if (this.listingTitle()) this.goToPage(this.page());
  }

  protected onQueryInput(event: Event) {
    this.query.set((event.target as HTMLInputElement).value);
  }
}
