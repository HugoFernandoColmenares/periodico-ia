import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { type Article, SECTION_LABELS, SECTION_ORDER, type SectionId } from '../models';
import { ArticleCard } from './article-card';

/** Elige artículos sin repetir y con máximo `perSource` notas de la misma fuente (diversidad editorial). */
export function pickDiverse(items: Article[], count: number, used: Set<string>, perSource = 2): Article[] {
  const out: Article[] = [];
  const bySource = new Map<string, number>();
  for (const a of items) {
    if (out.length >= count) break;
    if (used.has(a.id) || (bySource.get(a.source) ?? 0) >= perSource) continue;
    out.push(a);
    used.add(a.id);
    bySource.set(a.source, (bySource.get(a.source) ?? 0) + 1);
  }
  return out;
}

export interface FrontLayout {
  lead: Article | null;
  secondary: Article[];
  onDevice: Article[];
  columns: { id: SectionId; label: string; items: Article[] }[];
}

export function buildLayout(items: Article[]): FrontLayout {
  const used = new Set<string>();
  const onDeviceAll = items.filter((a) => a.section === 'on-device');
  // Nota principal: la mejor on-device (preferiblemente con imagen)
  const leadPool = onDeviceAll.length ? onDeviceAll : items;
  const lead = leadPool.slice(0, 5).find((a) => a.image) ?? leadPool[0] ?? null;
  if (lead) used.add(lead.id);
  const secondary = pickDiverse(onDeviceAll.length > 3 ? onDeviceAll : items, 2, used, 1);
  const onDevice = pickDiverse(onDeviceAll, 8, used, 2);
  const columns = SECTION_ORDER.filter((s) => s !== 'on-device').map((id) => ({
    id,
    label: SECTION_LABELS[id],
    items: pickDiverse(items.filter((a) => a.section === id), 5, used, 2),
  }));
  return { lead, secondary, onDevice, columns };
}

@Component({
  selector: 'app-front-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ArticleCard],
  host: { class: 'front' },
  template: `
    @let l = layout();
    @if (l.lead) {
      <section class="front__top" aria-label="Nota principal">
        <app-article-card class="front__lead" [article]="l.lead" variant="lead" />
        <div class="front__secondary">
          @for (a of l.secondary; track a.id) {
            <app-article-card [article]="a" variant="feature" />
          }
        </div>
      </section>
    }

    <section class="front__ondevice" aria-labelledby="sec-on-device">
      <header class="section-head section-head--main">
        <h2 id="sec-on-device">On-device e IA pequeña</h2>
        <p>Modelos que corren en teléfonos, laptops y hardware modesto: SLM, cuantización, NPUs y runtimes locales.</p>
      </header>
      <div class="columns columns--4">
        @for (a of l.onDevice; track a.id) {
          <app-article-card [article]="a" [showKicker]="false" />
        }
      </div>
      <a href="#" class="more" (click)="open($event, 'on-device')">Ver todas las notas de On-device →</a>
    </section>

    <section class="front__sections columns columns--4" aria-label="Otras secciones">
      @for (col of l.columns; track col.id) {
        <div class="front__col">
          <h2 class="section-head section-head--col">{{ col.label }}</h2>
          @for (a of col.items; track a.id; let first = $first) {
            <app-article-card [article]="a" [variant]="first ? 'standard' : 'compact'" [showKicker]="false" />
          } @empty {
            <p class="muted">Sin notas por ahora.</p>
          }
          <a href="#" class="more" (click)="open($event, col.id)">Más de {{ col.label }} →</a>
        </div>
      }
    </section>
  `,
})
export class FrontPage {
  readonly articles = input.required<Article[]>();
  readonly openSection = output<SectionId>();
  protected readonly layout = computed(() => buildLayout(this.articles()));

  protected open(event: Event, id: SectionId) {
    event.preventDefault();
    this.openSection.emit(id);
  }
}
