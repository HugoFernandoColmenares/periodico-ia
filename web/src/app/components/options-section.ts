import { ChangeDetectionStrategy, Component, computed, inject, OnInit, output, signal } from '@angular/core';
import { friendlySchedule, zoneLabel } from '../format';
import type { RefreshSettings } from '../models';
import { NewsService } from '../news.service';
import { SettingsService } from '../settings.service';

export interface FrequencyPreset {
  value: string;
  label: string;
  minutes?: number;
}

/** Del más frecuente (30 min) al menos frecuente (una vez al día a una hora). */
export const FREQUENCY_PRESETS: FrequencyPreset[] = [
  { value: '30', label: 'Cada 30 minutos', minutes: 30 },
  { value: '60', label: 'Cada hora', minutes: 60 },
  { value: '120', label: 'Cada 2 horas', minutes: 120 },
  { value: '180', label: 'Cada 3 horas', minutes: 180 },
  { value: '360', label: 'Cada 6 horas', minutes: 360 },
  { value: '720', label: 'Cada 12 horas', minutes: 720 },
  { value: 'daily', label: 'Diaria a una hora' },
];

const COMMON_ZONES = ['America/Bogota', 'America/Mexico_City', 'America/Lima', 'America/Caracas', 'America/Santiago', 'America/Argentina/Buenos_Aires', 'America/New_York', 'Europe/Madrid', 'UTC'];
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

@Component({
  selector: 'app-options-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="section-head section-head--main">
      <h2>Opciones</h2>
      <p>Elige cada cuánto la redacción sale a buscar noticias nuevas.</p>
    </header>

    <div class="options__layout">
      <form class="options__form" (submit)="save($event)" novalidate>
        <fieldset class="options__fieldset">
          <legend>Frecuencia de actualización</legend>
          @for (p of presets; track p.value) {
            <label class="options__choice" [class.selected]="frequency() === p.value">
              <input type="radio" name="frequency" [value]="p.value" [checked]="frequency() === p.value" (change)="frequency.set(p.value)" />
              <span>{{ p.label }}</span>
            </label>
          }
          <p class="options__hint">Mínimo cada 30 minutos; máximo una vez al día.</p>
        </fieldset>

        @if (frequency() === 'daily') {
          <div class="options__field">
            <label for="dailyTime">Hora de la edición diaria</label>
            <input id="dailyTime" type="time" step="60" required [value]="dailyTime()" (input)="dailyTime.set(value($event))" />
          </div>
        }

        <div class="options__field">
          <label for="timezone">Zona horaria</label>
          <select id="timezone" [value]="timezone()" (change)="timezone.set(value($event))">
            <optgroup label="Frecuentes">
              @for (z of commonZones; track z) {
                <option [value]="z" [selected]="z === timezone()">{{ z }}</option>
              }
            </optgroup>
            <optgroup label="Todas">
              @for (z of allZones; track z) {
                <option [value]="z" [selected]="z === timezone() && !commonZones.includes(z)">{{ z }}</option>
              }
            </optgroup>
          </select>
          <span class="options__zone">{{ zoneName() }}</span>
        </div>

        @if (svc.settings()?.adminTokenRequired) {
          <div class="options__field">
            <label for="adminToken">Token de administrador</label>
            <input id="adminToken" type="password" autocomplete="off" [value]="adminToken()" (input)="adminToken.set(value($event))" />
          </div>
        }

        @if (error(); as err) {
          <p class="notice notice--error options__msg" role="alert">{{ err }}</p>
        }
        @if (saved()) {
          <p class="notice options__msg" role="status">Opciones guardadas. {{ nextLabel() }}</p>
        }

        <div class="options__actions">
          <button type="submit" [disabled]="saving() || !svc.settings()">{{ saving() ? 'Guardando…' : 'Guardar opciones' }}</button>
        </div>
      </form>

      <aside class="options__status" aria-live="polite">
        <p class="kicker">Estado de la rotativa</p>
        @if (svc.settings(); as s) {
          <p><strong>Frecuencia actual:</strong> {{ currentLabel() }}</p>
          <p><strong>Última actualización:</strong> {{ lastLabel() }}</p>
          <p class="options__next"><strong>{{ nextLabel() }}</strong></p>
        } @else if (svc.error(); as err) {
          <p class="notice notice--error" role="alert">{{ err }}</p>
        } @else {
          <p class="muted">Cargando opciones…</p>
        }
        <button type="button" class="options__refresh" (click)="refreshNow()" [disabled]="news.refreshing()">
          {{ news.refreshing() ? 'Actualizando…' : 'Actualizar ahora' }}
        </button>
      </aside>
    </div>
  `,
  host: { class: 'options' },
})
export class OptionsSection implements OnInit {
  protected readonly svc = inject(SettingsService);
  protected readonly news = inject(NewsService);
  /** Avisa al contenedor para recargar la portada tras “Actualizar ahora”. */
  readonly refreshed = output<void>();

  protected readonly presets = FREQUENCY_PRESETS;
  protected readonly commonZones = COMMON_ZONES;
  protected readonly allZones: string[] = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : COMMON_ZONES;

  protected readonly frequency = signal('daily');
  protected readonly dailyTime = signal('07:00');
  protected readonly timezone = signal('America/Bogota');
  protected readonly adminToken = signal('');
  protected readonly saving = signal(false);
  protected readonly saved = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly zoneName = computed(() => zoneLabel(this.timezone()));
  protected readonly currentLabel = computed(() => {
    const s = this.svc.settings();
    if (!s) return '';
    if (s.mode === 'daily') return `diaria a las ${s.dailyTime} (${zoneLabel(s.timezone)})`;
    return FREQUENCY_PRESETS.find((p) => p.minutes === s.intervalMinutes)?.label.toLowerCase() ?? `cada ${s.intervalMinutes} min`;
  });
  protected readonly lastLabel = computed(() => {
    const s = this.svc.settings();
    return s?.lastRefreshAt ? friendlySchedule(s.lastRefreshAt, s.timezone) : 'todavía no hay una edición en vivo';
  });
  protected readonly nextLabel = computed(() => {
    const s = this.svc.settings();
    if (!s?.nextRefreshAt) return 'Próxima actualización: por programar';
    return `Próxima actualización: ${friendlySchedule(s.nextRefreshAt, s.timezone)}`;
  });

  async ngOnInit(): Promise<void> {
    await this.svc.load();
    this.syncForm();
  }

  protected value(event: Event): string {
    return (event.target as HTMLInputElement | HTMLSelectElement).value;
  }

  protected async save(event: Event) {
    event.preventDefault();
    this.saved.set(false);
    const body = this.buildBody();
    if (typeof body === 'string') return this.error.set(body);
    this.error.set(null);
    this.saving.set(true);
    const err = await this.svc.save(body, this.adminToken() || undefined);
    this.saving.set(false);
    if (err) this.error.set(err);
    else {
      this.saved.set(true);
      this.syncForm();
    }
  }

  protected async refreshNow() {
    await this.news.refresh();
    await this.svc.load();
    this.refreshed.emit();
  }

  /** Validación en el cliente (el servidor vuelve a validar). */
  private buildBody(): Partial<RefreshSettings> | string {
    const f = this.frequency();
    if (f === 'daily') {
      if (!TIME_RE.test(this.dailyTime())) return 'Escribe una hora válida para la edición diaria (por ejemplo, 07:00).';
      return { mode: 'daily', dailyTime: this.dailyTime(), timezone: this.timezone() };
    }
    const preset = FREQUENCY_PRESETS.find((p) => p.value === f);
    if (!preset?.minutes || preset.minutes < 30) return 'Elige una de las frecuencias disponibles (mínimo cada 30 minutos).';
    return { mode: 'interval', intervalMinutes: preset.minutes, timezone: this.timezone() };
  }

  private syncForm() {
    const s = this.svc.settings();
    if (!s) return;
    this.frequency.set(s.mode === 'daily' ? 'daily' : String(s.intervalMinutes));
    this.dailyTime.set(s.dailyTime);
    this.timezone.set(s.timezone);
  }
}
