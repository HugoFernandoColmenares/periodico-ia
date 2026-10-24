import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  computeNextRun,
  isDue,
  nextDailyRun,
  previousDailySlot,
  RefreshScheduler,
  zonedTimeToUtc,
} from '../src/scheduler.js';
import { DEFAULT_SETTINGS, type RefreshSettings } from '../src/settings.js';

const daily = (dailyTime = '07:00', timezone = 'America/Bogota'): RefreshSettings => ({ ...DEFAULT_SETTINGS, mode: 'daily', dailyTime, timezone });
const every = (intervalMinutes: number): RefreshSettings => ({ ...DEFAULT_SETTINGS, mode: 'interval', intervalMinutes });

describe('próxima ejecución diaria', () => {
  it('antes de la hora: hoy a las 07:00 de Bogotá (12:00 UTC)', () => {
    const now = new Date('2026-10-24T10:00:00Z'); // 05:00 en Bogotá
    expect(nextDailyRun(now, '07:00', 'America/Bogota').toISOString()).toBe('2026-10-24T12:00:00.000Z');
  });
  it('después de la hora: mañana a las 07:00', () => {
    const now = new Date('2026-10-24T15:23:00Z'); // 10:23 en Bogotá
    expect(nextDailyRun(now, '07:00', 'America/Bogota').toISOString()).toBe('2026-10-25T12:00:00.000Z');
  });
  it('justo a la hora: pasa al día siguiente (estrictamente posterior)', () => {
    const now = new Date('2026-10-24T12:00:00Z');
    expect(nextDailyRun(now, '07:00', 'America/Bogota').toISOString()).toBe('2026-10-25T12:00:00.000Z');
  });
  it('respeta el día local aunque en UTC ya sea otro día', () => {
    const now = new Date('2026-10-25T03:30:00Z'); // 24 oct 22:30 en Bogotá
    expect(nextDailyRun(now, '23:15', 'America/Bogota').toISOString()).toBe('2026-10-25T04:15:00.000Z');
  });
  it('usa la zona horaria configurada', () => {
    const now = new Date('2026-07-01T00:00:00Z');
    expect(nextDailyRun(now, '07:00', 'Europe/Madrid').toISOString()).toBe('2026-07-01T05:00:00.000Z'); // CEST +2
    expect(nextDailyRun(now, '07:00', 'Asia/Tokyo').toISOString()).toBe('2026-07-01T22:00:00.000Z'); // ya pasó en Tokio (09:00)
  });
  it('es seguro ante cambios de horario (Nueva York, DST)', () => {
    // Antes del cambio de otoño (EDT −4) y después (EST −5)
    expect(nextDailyRun(new Date('2026-10-31T20:00:00Z'), '07:00', 'America/New_York').toISOString()).toBe('2026-11-01T12:00:00.000Z');
    expect(nextDailyRun(new Date('2026-11-01T13:00:00Z'), '07:00', 'America/New_York').toISOString()).toBe('2026-11-02T12:00:00.000Z');
    // Primavera: 07:00 del 8 de marzo ya es EDT
    expect(nextDailyRun(new Date('2026-03-08T03:00:00Z'), '07:00', 'America/New_York').toISOString()).toBe('2026-03-08T11:00:00.000Z');
  });
  it('una hora inexistente (salto de primavera) se corre hacia adelante', () => {
    expect(zonedTimeToUtc(2026, 3, 8, 2, 30, 'America/New_York').toISOString()).toBe('2026-03-08T07:30:00.000Z'); // 03:30 EDT
  });
  it('una hora repetida (otoño) usa la primera ocurrencia', () => {
    expect(zonedTimeToUtc(2026, 11, 1, 1, 30, 'America/New_York').toISOString()).toBe('2026-11-01T05:30:00.000Z'); // 01:30 EDT
  });
  it('franja anterior: hoy si ya pasó, ayer si no', () => {
    expect(previousDailySlot(new Date('2026-10-24T15:00:00Z'), '07:00', 'America/Bogota').toISOString()).toBe('2026-10-24T12:00:00.000Z');
    expect(previousDailySlot(new Date('2026-10-24T11:00:00Z'), '07:00', 'America/Bogota').toISOString()).toBe('2026-10-23T12:00:00.000Z');
  });
});

describe('intervalos y arranque', () => {
  const now = new Date('2026-10-24T15:00:00Z');
  it('intervalo: última + N minutos, o ya mismo si está vencido o no hay datos', () => {
    expect(computeNextRun(every(30), new Date('2026-10-24T14:50:00Z'), now).toISOString()).toBe('2026-10-24T15:20:00.000Z');
    expect(computeNextRun(every(120), new Date('2026-10-24T14:00:00Z'), now).toISOString()).toBe('2026-10-24T16:00:00.000Z');
    expect(computeNextRun(every(60), new Date('2026-10-24T10:00:00Z'), now)).toEqual(now);
    expect(computeNextRun(every(60), null, now)).toEqual(now);
  });
  it('isDue: caché vacía o vieja → actualizar; reciente → esperar', () => {
    expect(isDue(every(30), null, now)).toBe(true);
    expect(isDue(every(30), new Date('2026-10-24T14:20:00Z'), now)).toBe(true);
    expect(isDue(every(30), new Date('2026-10-24T14:45:00Z'), now)).toBe(false);
  });
  it('isDue diario: solo si se perdió la última franja', () => {
    expect(isDue(daily(), new Date('2026-10-24T12:05:00Z'), now)).toBe(false); // ya se actualizó después de las 7:00
    expect(isDue(daily(), new Date('2026-10-24T11:00:00Z'), now)).toBe(true); // 06:00 Bogotá: se perdió la de 7:00
    expect(isDue(daily(), new Date('2026-10-23T20:00:00Z'), new Date('2026-10-24T11:00:00Z'))).toBe(false); // aún no son las 7:00
  });
});

describe('RefreshScheduler', () => {
  afterEach(() => vi.useRealTimers());

  it('al arrancar actualiza si toca y luego programa la siguiente franja diaria', async () => {
    vi.useFakeTimers({ now: new Date('2026-10-24T15:00:00Z') });
    const run = vi.fn(async () => 'ok');
    const s = new RefreshScheduler({ getSettings: () => daily(), run, lastRun: null });
    await s.start();
    expect(run).toHaveBeenCalledWith('inicio');
    expect(s.nextRunAt?.toISOString()).toBe('2026-10-25T12:00:00.000Z');
    await vi.advanceTimersByTimeAsync(21 * 3600_000);
    expect(run).toHaveBeenLastCalledWith('programado');
    expect(run).toHaveBeenCalledTimes(2);
    expect(s.nextRunAt?.toISOString()).toBe('2026-10-26T12:00:00.000Z');
    s.stop();
  });

  it('con caché reciente no actualiza al arrancar; espera', async () => {
    vi.useFakeTimers({ now: new Date('2026-10-24T15:00:00Z') });
    const run = vi.fn(async () => 'ok');
    const s = new RefreshScheduler({ getSettings: () => every(60), run, lastRun: new Date('2026-10-24T14:40:00Z') });
    await s.start();
    expect(run).not.toHaveBeenCalled();
    expect(s.nextRunAt?.toISOString()).toBe('2026-10-24T15:40:00.000Z');
    await vi.advanceTimersByTimeAsync(40 * 60_000);
    expect(run).toHaveBeenCalledTimes(1);
    s.stop();
  });

  it('se reprograma de inmediato al cambiar la configuración', async () => {
    vi.useFakeTimers({ now: new Date('2026-10-24T15:00:00Z') });
    let settings = daily();
    const run = vi.fn(async () => 'ok');
    const s = new RefreshScheduler({ getSettings: () => settings, run, lastRun: new Date('2026-10-24T14:50:00Z') });
    await s.start();
    expect(s.nextRunAt?.toISOString()).toBe('2026-10-25T12:00:00.000Z');
    settings = every(30);
    s.reschedule();
    expect(s.nextRunAt?.toISOString()).toBe('2026-10-24T15:20:00.000Z');
    await vi.advanceTimersByTimeAsync(20 * 60_000);
    expect(run).toHaveBeenCalledTimes(1);
    s.stop();
  });

  it('un fallo también cuenta como intento (no entra en bucle)', async () => {
    vi.useFakeTimers({ now: new Date('2026-10-24T15:00:00Z') });
    const run = vi.fn(async () => {
      throw new Error('sin red');
    });
    const s = new RefreshScheduler({ getSettings: () => every(30), run, lastRun: null });
    await expect(s.runNow('manual')).rejects.toThrow('sin red');
    expect(s.lastRunAt?.toISOString()).toBe('2026-10-24T15:00:00.000Z');
    expect(s.nextRunAt?.toISOString()).toBe('2026-10-24T15:30:00.000Z');
    s.stop();
  });
});
