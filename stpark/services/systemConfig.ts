import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiService } from './api';

const SYSTEM_CONFIG_KEY = 'stpark_system_config';

export interface SystemConfig {
  name: string;
  currency: string;
  timezone: string;
  language: string;
  pos_tuu: boolean; // Configuración de POS TUU (solo lectura para usuarios)
  car_wash_enabled?: boolean; // Configuración de módulo de lavado de autos
}

class SystemConfigService {
  private currentConfig: SystemConfig | null = null;

  /**
   * Cargar configuración del sistema desde el servidor
   */
  async loadFromServer(): Promise<SystemConfig | null> {
    try {
      console.log('SystemConfig: Cargando configuración del servidor...');
      const response = await apiService.getSystemConfig();
      
      if (response.success && response.data) {
        await this.setConfig(response.data);
        console.log('SystemConfig: Configuración cargada desde servidor:', response.data);
        return response.data;
      }
      
      console.warn('SystemConfig: No se pudo cargar la configuración del servidor');
      return null;
    } catch (error) {
      console.error('SystemConfig: Error cargando configuración:', error);
      return null;
    }
  }

  /**
   * Obtener configuración actual
   */
  async getConfig(): Promise<SystemConfig> {
    // Si ya está en memoria, devolverla
    if (this.currentConfig) {
      return this.currentConfig;
    }

    try {
      // Intentar cargar desde AsyncStorage
      const storedConfig = await AsyncStorage.getItem(SYSTEM_CONFIG_KEY);
      if (storedConfig) {
        this.currentConfig = JSON.parse(storedConfig);
        console.log('SystemConfig: Configuración cargada desde storage:', this.currentConfig);
        return this.currentConfig!;
      }
    } catch (error) {
      console.error('SystemConfig: Error leyendo configuración:', error);
    }

    // Si no hay configuración guardada, devolver valores por defecto
    const defaultConfig: SystemConfig = {
      name: 'STPark - Sistema de Gestión de Estacionamientos',
      currency: 'CLP',
      timezone: 'America/Santiago',
      language: 'es',
      pos_tuu: false,
      car_wash_enabled: false
    };
    
    return defaultConfig;
  }

  /**
   * Establecer configuración
   */
  private async setConfig(config: SystemConfig): Promise<void> {
    try {
      this.currentConfig = config;
      await AsyncStorage.setItem(SYSTEM_CONFIG_KEY, JSON.stringify(config));
      console.log('SystemConfig: Configuración guardada');
    } catch (error) {
      console.error('SystemConfig: Error guardando configuración:', error);
    }
  }

  /**
   * Obtener nombre del sistema
   */
  async getSystemName(): Promise<string> {
    const config = await this.getConfig();
    return config.name;
  }

  /**
   * Obtener moneda
   */
  async getCurrency(): Promise<string> {
    const config = await this.getConfig();
    return config.currency;
  }

  /**
   * Obtener zona horaria
   */
  async getTimezone(): Promise<string> {
    const config = await this.getConfig();
    return config.timezone;
  }

  /**
   * Obtener idioma
   */
  async getLanguage(): Promise<string> {
    const config = await this.getConfig();
    return config.language;
  }

  /**
   * Verificar si el módulo de lavado de autos está habilitado
   */
  async isCarWashEnabled(): Promise<boolean> {
    const config = await this.getConfig();
    return config.car_wash_enabled === true;
  }

  /**
   * Limpiar configuración
   */
  async clearConfig(): Promise<void> {
    try {
      this.currentConfig = null;
      await AsyncStorage.removeItem(SYSTEM_CONFIG_KEY);
      console.log('SystemConfig: Configuración eliminada');
    } catch (error) {
      console.error('SystemConfig: Error eliminando configuración:', error);
    }
  }
}

export const systemConfigService = new SystemConfigService();
