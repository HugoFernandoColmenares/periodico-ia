import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { friendlySchedule, zoneLabel } from '../format';
import type { SettingsResponse } from '../models';
import { FREQUENCY_PRESETS, OptionsSection } from './options-section';

const settings = (partial: Partial<SettingsResponse> = {}): SettingsResponse => ({
  mode: 'daily',
  intervalMinutes: 60,
  dailyTime: '07:00',
  timezone: 'America/Bogota',
  lastRefreshAt: null,
  nextRefreshAt: new Date(Date.now() + 3600_000).toISOString(),
  allowedIntervals: [30, 60, 120, 180, 360, 720],
  minIntervalMinutes: 30,
  adminTokenRequired: false,
  ...partial,
});

const tick = () => new Promise((r) => setTimeout(r));

describe('OptionsSection', () => {
  let http: HttpTestingController;

  async function setup(initial = settings()) {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(OptionsSection);
    fixture.detectChanges();
    http.expectOne({ method: 'GET', url: '/api/settings' }).flush(initial);
    await tick();
    await fixture.whenStable();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  afterEach(() => http.verify());

  it('ofrece los presets de 30 min a diaria y marca la diaria por defecto', async () => {
    const { el } = await setup();
    const labels = [...el.querySelectorAll('.options__choice')].map((l) => l.textContent?.trim());
    expect(labels).toEqual(FREQUENCY_PRESETS.map((p) => p.label));
    expect(labels[0]).toBe('Cada 30 minutos');
    expect(labels.at(-1)).toBe('Diaria a una hora');
    expect(el.querySelector<HTMLInputElement>('input[value="daily"]')!.checked).toBe(true);
    expect(el.querySelector<HTMLInputElement>('#dailyTime')!.value).toBe('07:00');
    expect(el.querySelector('.options__zone')?.textContent).toContain('hora de Bogotá');
    expect(el.querySelector('.options__next')?.textContent).toMatch(/Próxima actualización: (hoy|mañana) \d{1,2}:\d{2} [ap]\. m\. \(hora de Bogotá\)/);
  });

  it('guarda un intervalo con PUT y oculta el selector de hora', async () => {
    const { fixture, el } = await setup();
    el.querySelector<HTMLInputElement>('input[value="120"]')!.click();
    await fixture.whenStable();
    expect(el.querySelector('#dailyTime')).toBeNull();
    el.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    const req = http.expectOne({ method: 'PUT', url: '/api/settings' });
    expect(req.request.body).toEqual({ mode: 'interval', intervalMinutes: 120, timezone: 'America/Bogota' });
    req.flush(settings({ mode: 'interval', intervalMinutes: 120 }));
    await tick();
    await fixture.whenStable();
    expect(el.querySelector('[role="status"]')?.textContent).toContain('Opciones guardadas');
    expect(el.textContent).toContain('Frecuencia actual: cada 2 horas');
  });

  it('muestra el error en español que devuelve el servidor', async () => {
    const { fixture, el } = await setup();
    const time = el.querySelector<HTMLInputElement>('#dailyTime')!;
    time.value = '06:30';
    time.dispatchEvent(new Event('input'));
    el.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    const req = http.expectOne({ method: 'PUT', url: '/api/settings' });
    expect(req.request.body).toMatchObject({ mode: 'daily', dailyTime: '06:30' });
    req.flush({ error: 'La frecuencia mínima es cada 30 minutos.' }, { status: 400, statusText: 'Bad Request' });
    await tick();
    await fixture.whenStable();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('La frecuencia mínima es cada 30 minutos.');
  });

  it('valida la hora en el cliente antes de enviar', async () => {
    const { fixture, el } = await setup();
    const time = el.querySelector<HTMLInputElement>('#dailyTime')!;
    time.value = '';
    time.dispatchEvent(new Event('input'));
    el.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    await fixture.whenStable();
    http.expectNone({ method: 'PUT', url: '/api/settings' });
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('hora válida');
  });

  it('“Actualizar ahora” llama a POST /api/refresh y recarga el estado', async () => {
    const { fixture, el } = await setup();
    let emitted = 0;
    fixture.componentInstance.refreshed.subscribe(() => emitted++);
    [...el.querySelectorAll('button')].find((b) => b.textContent?.includes('Actualizar ahora'))!.click();
    http.expectOne({ method: 'POST', url: '/api/refresh' }).flush({ ok: true });
    await tick();
    http.expectOne({ method: 'GET', url: '/api/settings' }).flush(settings({ lastRefreshAt: new Date().toISOString() }));
    await tick();
    await fixture.whenStable();
    expect(emitted).toBe(1);
    expect(el.textContent).toMatch(/Última actualización: hoy/);
  });

  it('pide el token de administrador cuando el servidor lo exige', async () => {
    const { el } = await setup(settings({ adminTokenRequired: true }));
    expect(el.querySelector('#adminToken')).not.toBeNull();
  });
});

describe('formato de horarios', () => {
  it('usa hoy/mañana y la etiqueta de la zona', () => {
    const now = new Date('2026-10-24T15:23:00Z'); // 10:23 a. m. en Bogotá
    expect(friendlySchedule('2026-10-25T12:00:00Z', 'America/Bogota', now)).toBe('mañana 7:00 a. m. (hora de Bogotá)');
    expect(friendlySchedule('2026-10-24T22:30:00Z', 'America/Bogota', now)).toBe('hoy 5:30 p. m. (hora de Bogotá)');
    expect(friendlySchedule('2026-10-28T12:00:00Z', 'America/Bogota', now)).toBe('miércoles, 28 de octubre, 7:00 a. m. (hora de Bogotá)');
    expect(zoneLabel('Europe/Madrid')).toBe('hora de Madrid');
  });
});
