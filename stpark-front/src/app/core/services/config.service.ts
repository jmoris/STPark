import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from 'environments/environment';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap, catchError, map } from 'rxjs/operators';
import { of } from 'rxjs';

export interface SystemConfig {
  name: string;
  currency: string;
  timezone: string;
  language: string;
}

@Injectable({ providedIn: 'root' })
export class ConfigService {
  private _httpClient = inject(HttpClient);
  private _systemConfig = new BehaviorSubject<SystemConfig>({
    name: 'STPark - Sistema de Gestión de Estacionamientos',
    currency: 'CLP',
    timezone: 'America/Santiago',
    language: 'es'
  });
  private _configLoaded = false;

  /**
   * Load system configuration from backend
   * This method should be called when user logs in
   */
  loadConfig(): Observable<SystemConfig> {
    return this._httpClient.get<SystemConfig>(`${environment.apiUrl}/settings/general`)
      .pipe(
        tap(config => {
          this._systemConfig.next(config);
          this._configLoaded = true;
          console.log('Configuración del sistema cargada:', config);
        }),
        catchError(error => {
          console.error('Error al cargar configuración del sistema:', error);
          // Return default config if error
          return of(this._systemConfig.value);
        })
      );
  }

  /**
   * Refresh system configuration
   */
  refreshConfig(): void {
    this.loadConfig().subscribe();
  }

  /**
   * Check if config has been loaded
   */
  isConfigLoaded(): boolean {
    return this._configLoaded;
  }

  /**
   * Get system configuration observable
   */
  get systemConfig$(): Observable<SystemConfig> {
    return this._systemConfig.asObservable();
  }

  /**
   * Get current system configuration
   */
  getSystemConfig(): SystemConfig {
    return this._systemConfig.value;
  }

  /**
   * Get system name
   */
  getSystemName(): string {
    return this._systemConfig.value.name;
  }

  /**
   * Get system name observable
   */
  getSystemName$(): Observable<string> {
    return this._systemConfig.asObservable().pipe(
      map(config => config.name)
    );
  }

  /**
   * Get currency
   */
  getCurrency(): string {
    return this._systemConfig.value.currency;
  }

  /**
   * Get timezone
   */
  getTimezone(): string {
    return this._systemConfig.value.timezone;
  }

  /**
   * Get language
   */
  getLanguage(): string {
    return this._systemConfig.value.language;
  }
}
