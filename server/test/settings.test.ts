import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { setStore } from '../src/aggregator.js';
import { buildApp } from '../src/app.js';
import { readSample } from '../src/cache.js';
import { DEFAULT_SETTINGS, SettingsStore, validateSettings } from '../src/settings.js';

let dir: string;
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'periodico-settings-'));
  const sample = await readSample();
  setStore({ ...sample!, mode: 'sample' });
});
afterAll(() => rm(dir, { recursive: true, force: true }));

describe('validación de la configuración', () => {
  it('acepta los valores por defecto y los presets', () => {
    expect(validateSettings(DEFAULT_SETTINGS)).toEqual({ ok: true, settings: DEFAULT_SETTINGS });
    for (const m of [30, 60, 120, 180, 360, 720]) expect(validateSettings({ mode: 'interval', intervalMinutes: m }).ok).toBe(true);
    expect(validateSettings({ mode: 'daily', dailyTime: '23:59', timezone: 'Europe/Madrid' }).ok).toBe(true);
  });
  it('rechaza menos de 30 minutos con un mensaje claro', () => {
    const r = validateSettings({ mode: 'interval', intervalMinutes: 15 });
    expect(r).toEqual({ ok: false, errors: ['La frecuencia mínima es cada 30 minutos; 15 min no está permitido.'] });
  });
  it('rechaza intervalos fuera de las opciones, horas y zonas inválidas', () => {
    const msgs = (x: unknown) => (validateSettings(x) as { errors: string[] }).errors.join(' ');
    expect(msgs({ intervalMinutes: 45 })).toContain('Intervalo no disponible');
    expect(msgs({ intervalMinutes: 1440 })).toContain('Intervalo no disponible');
    expect(msgs({ intervalMinutes: '60' })).toContain('número entero');
    expect(msgs({ mode: 'weekly' })).toContain('La frecuencia debe ser');
    expect(msgs({ dailyTime: '7:00' })).toContain('HH:mm');
    expect(msgs({ dailyTime: '24:00' })).toContain('HH:mm');
    expect(msgs({ timezone: 'Marte/Olympus' })).toContain('Zona horaria no reconocida');
    expect(msgs({ foo: 1 })).toContain('Campos desconocidos: foo');
    expect(msgs([1])).toContain('objeto JSON');
  });
});

describe('SettingsStore', () => {
  it('crea el archivo con los valores por defecto si falta', async () => {
    const file = join(dir, 'nuevo', 'settings.json');
    const s = await new SettingsStore(file).load();
    expect(s).toEqual({ mode: 'daily', intervalMinutes: 60, dailyTime: '07:00', timezone: 'America/Bogota' });
    expect(JSON.parse(await readFile(file, 'utf8'))).toEqual(s);
  });
  it('si el archivo está dañado vuelve a los valores por defecto', async () => {
    const file = join(dir, 'roto.json');
    await writeFile(file, JSON.stringify({ mode: 'interval', intervalMinutes: 5 }));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await new SettingsStore(file).load()).toEqual(DEFAULT_SETTINGS);
    warn.mockRestore();
  });
});

describe('API /api/settings', () => {
  let app: FastifyInstance;
  const file = () => join(dir, 'api-settings.json');
  const runRefresh = vi.fn(async () => ({ store: { mode: 'live' as const, fetchedAt: new Date().toISOString(), articles: [], sources: [] }, live: true }));

  beforeAll(async () => {
    app = await buildApp({ settingsFile: file(), runRefresh, adminToken: '' });
  });
  afterAll(() => app.close());
  afterEach(() => app.scheduler.stop());

  it('GET devuelve la configuración diaria por defecto y las horas ISO', async () => {
    const res = await app.inject('/api/settings');
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toMatchObject({ mode: 'daily', dailyTime: '07:00', timezone: 'America/Bogota', adminTokenRequired: false, minIntervalMinutes: 30 });
    expect(body.allowedIntervals).toEqual([30, 60, 120, 180, 360, 720]);
    expect(body.lastRefreshAt).toBeNull(); // datos de muestra: aún no hay edición real
  });

  it('PUT guarda, persiste y reprograma', async () => {
    const res = await app.inject({ method: 'PUT', url: '/api/settings', payload: { mode: 'interval', intervalMinutes: 120 } });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ mode: 'interval', intervalMinutes: 120, timezone: 'America/Bogota' });
    expect(res.json().nextRefreshAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(JSON.parse(await readFile(file(), 'utf8')).intervalMinutes).toBe(120);

    const daily = await app.inject({ method: 'PUT', url: '/api/settings', payload: { mode: 'daily', dailyTime: '06:30' } });
    const next = new Date(daily.json().nextRefreshAt);
    expect(new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(next)).toBe('06:30');
  });

  it('PUT rechaza valores inválidos con 400 y mensaje en español', async () => {
    const res = await app.inject({ method: 'PUT', url: '/api/settings', payload: { mode: 'interval', intervalMinutes: 10 } });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toContain('La frecuencia mínima es cada 30 minutos');
    expect((await app.inject('/api/settings')).json().intervalMinutes).not.toBe(10);
  });

  it('POST /api/refresh sigue funcionando y registra la última actualización', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/refresh' });
    expect(res.statusCode).toBe(200);
    expect(runRefresh).toHaveBeenCalledWith('manual');
    expect((await app.inject('/api/settings')).json().lastRefreshAt).toMatch(/^\d{4}-/);
  });
});

describe('ADMIN_TOKEN opcional', () => {
  let app: FastifyInstance;
  beforeAll(async () => {
    app = await buildApp({ settingsFile: join(dir, 'token-settings.json'), adminToken: 's3creto', runRefresh: async () => ({ store: { mode: 'live', fetchedAt: '', articles: [], sources: [] }, live: true }) });
  });
  afterAll(() => app.close());

  it('sin token o con token incorrecto responde 401', async () => {
    expect((await app.inject('/api/settings')).json().adminTokenRequired).toBe(true);
    const noToken = await app.inject({ method: 'PUT', url: '/api/settings', payload: { mode: 'interval', intervalMinutes: 60 } });
    expect(noToken.statusCode).toBe(401);
    expect(noToken.json().error).toContain('token de administrador');
    const bad = await app.inject({ method: 'PUT', url: '/api/settings', headers: { 'x-admin-token': 'otro' }, payload: { mode: 'interval', intervalMinutes: 60 } });
    expect(bad.statusCode).toBe(401);
  });
  it('con X-Admin-Token o Bearer correcto permite guardar', async () => {
    const ok = await app.inject({ method: 'PUT', url: '/api/settings', headers: { 'x-admin-token': 's3creto' }, payload: { mode: 'interval', intervalMinutes: 60 } });
    expect(ok.statusCode).toBe(200);
    const bearer = await app.inject({ method: 'PUT', url: '/api/settings', headers: { authorization: 'Bearer s3creto' }, payload: { mode: 'daily' } });
    expect(bearer.statusCode).toBe(200);
    app.scheduler.stop();
  });
});
