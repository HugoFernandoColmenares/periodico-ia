import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { relativeTime } from '../format';
import { type Article, SECTION_LABELS } from '../models';

/** Nota del periódico: titular, extracto breve, crédito a la fuente y enlace al original. */
@Component({
  selector: 'app-article-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': '"card card--" + variant()' },
  template: `
    @let a = article();
    @if (showImage() && a.image && !imageFailed()) {
      <figure class="card__figure">
        <img [src]="a.image" [alt]="''" loading="lazy" referrerpolicy="no-referrer" (error)="imageFailed.set(true)" />
      </figure>
    }
    @if (showKicker()) {
      <p class="kicker">{{ sectionLabel() }}</p>
    }
    <h3 class="card__title">
      <a [href]="a.url" target="_blank" rel="noopener noreferrer">{{ a.title }}</a>
    </h3>
    @if (variant() !== 'compact' && a.excerpt) {
      <p class="card__excerpt">{{ a.excerpt }}</p>
    }
    <p class="card__meta">
      <span class="card__source">{{ a.sourceName }}</span>
      <span aria-hidden="true"> · </span>
      <time [attr.datetime]="a.publishedAt">{{ a.undated ? "visto " : "" }}{{ when() }}</time>
      @if (a.sample) {
        <span class="badge badge--sample">Muestra</span>
      }
    </p>
    @if (variant() !== 'compact') {
      <p class="card__links">
        <a class="card__read" [href]="a.url" target="_blank" rel="noopener noreferrer">Leer en {{ a.sourceName }} →</a>
        @if (a.discussionUrl && a.discussionUrl !== a.url) {
          <a [href]="a.discussionUrl" target="_blank" rel="noopener noreferrer">Debate en HN</a>
        }
      </p>
      <details class="card__why">
        <summary>¿Por qué está aquí? · {{ a.score }} pts</summary>
        <p>
          Tema {{ a.scoreBreakdown.topic }} · On-device {{ a.scoreBreakdown.onDevice }} · Recencia {{ a.scoreBreakdown.recency }} ·
          Popularidad {{ a.scoreBreakdown.popularity }}
        </p>
        @if (a.matchedKeywords.length) {
          <p class="card__tags">{{ a.matchedKeywords.join(', ') }}</p>
        }
      </details>
    }
  `,
})
export class ArticleCard {
  readonly article = input.required<Article>();
  readonly variant = input<'lead' | 'feature' | 'standard' | 'compact'>('standard');
  readonly showKicker = input(true);

  protected readonly imageFailed = signal(false);
  protected readonly showImage = computed(() => this.variant() === 'lead' || this.variant() === 'feature');
  protected readonly sectionLabel = computed(() => SECTION_LABELS[this.article().section]);
  protected readonly when = computed(() => relativeTime(this.article().publishedAt));
}
