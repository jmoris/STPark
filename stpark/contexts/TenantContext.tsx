import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { tenantConfigService, TenantConfig } from '../services/tenantConfig';
import { useAuth } from './AuthContext';

interface TenantContextType {
  tenantConfig: TenantConfig;
  isLoading: boolean;
  setTenant: (tenant: string) => Promise<boolean>;
  clearTenant: () => Promise<void>;
  refreshTenantConfig: () => Promise<void>;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export const useTenant = () => {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
};

interface TenantProviderProps {
  children: ReactNode;
}

export const TenantProvider: React.FC<TenantProviderProps> = ({ children }) => {
  const [tenantConfig, setTenantConfig] = useState<TenantConfig>({
    tenant: '',
    isValid: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const { logout } = useAuth();

  // Cargar configuración del tenant al inicializar
  useEffect(() => {
    loadTenantConfig();
  }, []);

  const loadTenantConfig = async () => {
    try {
      setIsLoading(true);
      const config = await tenantConfigService.getTenantConfig();
      setTenantConfig(config);
    } catch (error) {
      console.error('Error cargando configuración del tenant:', error);
      setTenantConfig({ tenant: '', isValid: false });
    } finally {
      setIsLoading(false);
    }
  };

  const setTenant = async (tenant: string): Promise<boolean> => {
    try {
      // Verificar si el tenant está cambiando
      const currentTenant = tenantConfig.tenant;
      const isChangingTenant = currentTenant !== tenant.trim();
      
      if (isChangingTenant) {
        console.log('TenantContext: Cambiando tenant, cerrando sesión del operador');
        // Cerrar sesión del operador cuando se cambia el tenant
        await logout();
      }
      
      await tenantConfigService.setTenant(tenant);
      await loadTenantConfig();
      return true;
    } catch (error) {
      console.error('Error estableciendo tenant:', error);
      return false;
    }
  };

  const clearTenant = async (): Promise<void> => {
    try {
      // Cerrar sesión del operador cuando se limpia el tenant
      console.log('TenantContext: Limpiando tenant, cerrando sesión del operador');
      await logout();
      
      await tenantConfigService.clearTenant();
      await loadTenantConfig();
    } catch (error) {
      console.error('Error limpiando tenant:', error);
    }
  };

  const refreshTenantConfig = async (): Promise<void> => {
    await loadTenantConfig();
  };

  const value: TenantContextType = {
    tenantConfig,
    isLoading,
    setTenant,
    clearTenant,
    refreshTenantConfig,
  };

  return (
    <TenantContext.Provider value={value}>
      {children}
    </TenantContext.Provider>
  );
};
