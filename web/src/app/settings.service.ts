import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { RefreshSettings, SettingsResponse } from './models';

/** Opciones de actualización (GET/PUT /api/settings) con signals. */
@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly http = inject(HttpClient);

  readonly settings = signal<SettingsResponse | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      this.settings.set(await firstValueFrom(this.http.get<SettingsResponse>('/api/settings')));
      this.error.set(null);
    } catch {
      this.error.set('No pudimos leer las opciones del servidor.');
    } finally {
      this.loading.set(false);
    }
  }

  /** Guarda y devuelve `null` si salió bien o el mensaje de error del servidor. */
  async save(body: Partial<RefreshSettings>, adminToken?: string): Promise<string | null> {
    const headers = adminToken ? new HttpHeaders({ 'X-Admin-Token': adminToken }) : undefined;
    try {
      this.settings.set(await firstValueFrom(this.http.put<SettingsResponse>('/api/settings', body, { headers })));
      return null;
    } catch (e) {
      const msg = e instanceof HttpErrorResponse ? (e.error as { error?: string } | null)?.error : undefined;
      return msg ?? 'No pudimos guardar las opciones. Intenta de nuevo.';
    }
  }
}
