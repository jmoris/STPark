import AsyncStorage from '@react-native-async-storage/async-storage';

const TENANT_STORAGE_KEY = 'stpark_tenant';

export interface TenantConfig {
  tenant: string;
  isValid: boolean;
}

class TenantConfigService {
  private currentTenant: string | null = null;

  /**
   * Obtiene el tenant actual
   */
  async getCurrentTenant(): Promise<string | null> {
    if (this.currentTenant) {
      return this.currentTenant;
    }

    try {
      const storedTenant = await AsyncStorage.getItem(TENANT_STORAGE_KEY);
      this.currentTenant = storedTenant;
      return storedTenant;
    } catch (error) {
      console.error('Error obteniendo tenant:', error);
      return null;
    }
  }

  /**
   * Establece un nuevo tenant
   */
  async setTenant(tenant: string): Promise<boolean> {
    if (!tenant || tenant.trim() === '') {
      throw new Error('El tenant no puede estar vacío');
    }

    try {
      const cleanTenant = tenant.trim();
      await AsyncStorage.setItem(TENANT_STORAGE_KEY, cleanTenant);
      this.currentTenant = cleanTenant;
      console.log('Tenant configurado:', cleanTenant);
      return true;
    } catch (error) {
      console.error('Error guardando tenant:', error);
      throw new Error('Error al guardar el tenant');
    }
  }

  /**
   * Verifica si hay un tenant configurado
   */
  async hasTenant(): Promise<boolean> {
    const tenant = await this.getCurrentTenant();
    return tenant !== null && tenant.trim() !== '';
  }

  /**
   * Elimina el tenant configurado
   */
  async clearTenant(): Promise<void> {
    try {
      await AsyncStorage.removeItem(TENANT_STORAGE_KEY);
      this.currentTenant = null;
      console.log('Tenant eliminado');
    } catch (error) {
      console.error('Error eliminando tenant:', error);
    }
  }

  /**
   * Valida que el tenant esté configurado
   */
  async validateTenant(): Promise<boolean> {
    return await this.hasTenant();
  }

  /**
   * Obtiene la configuración completa del tenant
   */
  async getTenantConfig(): Promise<TenantConfig> {
    const tenant = await this.getCurrentTenant();
    return {
      tenant: tenant || '',
      isValid: await this.hasTenant()
    };
  }
}

export const tenantConfigService = new TenantConfigService();
