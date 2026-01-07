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
  car_wash_enabled?: boolean; // Configuración de módulo de lavado de autos (solo lectura para usuarios, solo administradores pueden cambiar)
  car_wash_payment_deferred?: boolean; // Permitir pago posterior del lavado de autos (solo visible si car_wash_enabled está activo)
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
      max_capacity: 0,
      car_wash_enabled: false,
      car_wash_payment_deferred: false
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
      max_capacity: 0,
      car_wash_enabled: false,
      car_wash_payment_deferred: false
    };

    return this._httpClient.get<{ success: boolean; data: SystemConfig }>(`${environment.apiUrl}/settings/general`)
      .pipe(
        map(response => {
          // El backend devuelve { success: true, data: {...} }
          let config: SystemConfig;
          
          if (response && response.success && response.data) {
            // Validar que todos los campos estén presentes
            config = {
              ...defaultConfig,
              ...response.data
            };
            
            // Validar que el nombre no esté vacío
            if (!config.name || config.name.trim() === '') {
              config.name = defaultConfig.name;
            }
          } else {
            // Si la respuesta no tiene el formato esperado, usar valores por defecto
            config = defaultConfig;
          }
          
          // Actualizar BehaviorSubject
          this._systemConfig.next(config);
          this._configLoaded = true;
          
          // Guardar en sessionStorage de forma SÍNCRONA antes de retornar
          // Esto asegura que esté disponible cuando se evalúen las funciones hidden()
          try {
            sessionStorage.setItem('system_config', JSON.stringify(config));
            console.log('ConfigService: Configuración guardada en sessionStorage:', {
              name: config.name,
              car_wash_enabled: config.car_wash_enabled
            });
          } catch (e) {
            console.warn('ConfigService: No se pudo guardar en sessionStorage:', e);
          }
          
          return config;
        }),
        catchError(error => {
          console.error('ConfigService: Error al cargar configuración:', error);
          // Return default config if error
          this._systemConfig.next(defaultConfig);
          this._configLoaded = true;
          // Guardar también el default en sessionStorage
          try {
            sessionStorage.setItem('system_config', JSON.stringify(defaultConfig));
          } catch (e) {
            // Ignorar
          }
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
