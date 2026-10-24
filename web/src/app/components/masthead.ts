import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { dateTime, longDate } from '../format';
import { type DataMode, SECTION_LABELS, SECTION_ORDER, type SectionId } from '../models';

export type View = 'portada' | SectionId | 'aprender' | 'opciones';

@Component({
  selector: 'app-masthead',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="masthead__top">
      <span>{{ today }}</span>
      <span class="masthead__edition">Bogotá · Edición digital</span>
      <span>
        @if (fetchedAt(); as f) {
          Actualizado: {{ updated() }}
        }
      </span>
    </div>
    <h1 class="masthead__title"><a href="#" (click)="go($event, 'portada')">El Periódico de la IA</a></h1>
    <p class="masthead__tagline">Noticias de inteligencia artificial, con foco en modelos pequeños y en el dispositivo</p>
    <nav class="masthead__nav" aria-label="Secciones">
      <a href="#" [class.active]="view() === 'portada'" (click)="go($event, 'portada')">Portada</a>
      @for (id of sections; track id) {
        <a href="#" [class.active]="view() === id" [class.main]="id === 'on-device'" (click)="go($event, id)">{{ labels[id] }}</a>
      }
      <a href="#" [class.active]="view() === 'aprender'" (click)="go($event, 'aprender')">Qué aprender</a>
      <a href="/opciones" [class.active]="view() === 'opciones'" (click)="go($event, 'opciones')">Opciones</a>
    </nav>
    @if (mode() === 'sample') {
      <p class="notice notice--sample" role="status">
        Estás viendo <strong>datos de muestra</strong>: no fue posible obtener noticias en vivo ni hay una edición en caché.
      </p>
    } @else if (mode() === 'cache') {
      <p class="notice" role="status">Mostrando la última edición guardada; se renueva según la frecuencia elegida en Opciones.</p>
    }
  `,
  host: { class: 'masthead' },
})
export class Masthead {
  readonly view = input<View>('portada');
  readonly mode = input<DataMode | null>(null);
  readonly fetchedAt = input<string | null>(null);
  readonly navigate = output<View>();

  protected readonly today = longDate(new Date());
  protected readonly sections = SECTION_ORDER;
  protected readonly labels = SECTION_LABELS;
  protected readonly updated = computed(() => (this.fetchedAt() ? dateTime(this.fetchedAt()!) : ''));

  protected go(event: Event, v: View) {
    event.preventDefault();
    this.navigate.emit(v);
  }
}
