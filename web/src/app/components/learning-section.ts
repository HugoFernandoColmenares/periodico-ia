import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { LearningRoadmap } from '../models';

@Component({
  selector: 'app-learning-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'learning' },
  template: `
    @if (roadmap(); as r) {
      <header class="section-head">
        <p class="kicker">Suplemento</p>
        <h2>{{ r.title }}</h2>
        <p class="learning__intro">{{ r.intro }}</p>
      </header>
      <div class="learning__grid">
        @for (t of r.topics; track t.id; let i = $index) {
          <article class="learning__topic" [class.trending]="t.trending">
            <p class="kicker">
              {{ i + 1 }}. Nivel {{ t.level }}
              @if (t.trending) {
                <span class="badge badge--trend" title="Temas más mencionados en las noticias de hoy">En tendencia · {{ t.mentions }} noticias</span>
              }
            </p>
            <h3>{{ t.title }}</h3>
            <p>{{ t.why }}</p>
            <ul>
              @for (res of t.resources; track res.url) {
                <li>
                  <a [href]="res.url" target="_blank" rel="noopener noreferrer">{{ res.title }}</a>
                  <span class="learning__type">({{ res.type }})</span>
                </li>
              }
            </ul>
          </article>
        }
      </div>
      <p class="learning__foot">Ruta actualizada el {{ r.updatedAt }}. Edita <code>content/learning.json</code> para cambiarla.</p>
    } @else {
      <p class="muted">Cargando la ruta de aprendizaje…</p>
    }
  `,
})
export class LearningSection {
  readonly roadmap = input<LearningRoadmap | null>(null);
}
