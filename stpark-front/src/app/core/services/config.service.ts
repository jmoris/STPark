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
  pos_tuu: boolean; // Configuración de POS TUU (solo lectura para usuarios, solo administradores pueden cambiar)
  boleta_electronica: boolean; // Configuración de Boleta Electrónica (solo lectura para usuarios, solo administradores pueden cambiar)
  max_capacity?: number; // Capacidad máxima de vehículos en el estacionamiento
}

@Injectable({ providedIn: 'root' })
export class ConfigService {
  private _httpClient = inject(HttpClient);
  private _systemConfig = new BehaviorSubject<SystemConfig>({
    name: 'STPark - Sistema de Gestión de Estacionamientos',
    currency: 'CLP',
    timezone: 'America/Santiago',
    language: 'es',
    pos_tuu: false,
    boleta_electronica: false,
    max_capacity: 0
  });
  private _configLoaded = false;

  /**
   * Load system configuration from backend
   * This method should be called when user logs in
   */
  loadConfig(): Observable<SystemConfig> {
    const defaultConfig: SystemConfig = {
      name: 'STPark - Sistema de Gestión de Estacionamientos',
      currency: 'CLP',
      timezone: 'America/Santiago',
      language: 'es',
      pos_tuu: false,
      boleta_electronica: false,
      max_capacity: 0
    };

    return this._httpClient.get<{ success: boolean; data: SystemConfig }>(`${environment.apiUrl}/settings/general`)
      .pipe(
        map(response => {
          // El backend devuelve { success: true, data: {...} }
          if (response && response.success && response.data) {
            // Validar que todos los campos estén presentes
            const config: SystemConfig = {
              ...defaultConfig,
              ...response.data
            };
            
            // Validar que el nombre no esté vacío
            if (!config.name || config.name.trim() === '') {
              console.warn('ConfigService: El nombre del sistema está vacío, usando valor por defecto');
              config.name = defaultConfig.name;
            }
            
            return config;
          }
          
          // Si la respuesta no tiene el formato esperado, usar valores por defecto
          console.warn('ConfigService: La respuesta no tiene el formato esperado:', response);
          return defaultConfig;
        }),
        tap(config => {
          this._systemConfig.next(config);
          this._configLoaded = true;
          console.log('Configuración del sistema cargada:', config);
        }),
        catchError(error => {
          console.error('Error al cargar configuración del sistema:', error);
          // Return default config if error
          this._systemConfig.next(defaultConfig);
          return of(defaultConfig);
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
