import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiService, Operator } from '../services/api';
import { tenantConfigService } from '../services/tenantConfig';
import { systemConfigService } from '../services/systemConfig';

interface AuthContextType {
  operator: Operator | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (operatorId: number, pin: string) => Promise<boolean>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [operator, setOperator] = useState<Operator | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = !!operator;

  // Verificar si hay una sesión válida al cargar la app
  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      console.log('AuthContext: Verificando estado de autenticación');
      console.log('AuthContext: Iniciando verificación...');
      
      // Verificar que el tenant esté configurado antes de hacer la verificación
      const hasTenant = await tenantConfigService.hasTenant();
      if (!hasTenant) {
        console.log('AuthContext: No hay tenant configurado, saltando verificación de auth');
        setOperator(null);
        setIsLoading(false);
        return;
      }
      
      const response = await apiService.verifyToken();
      console.log('AuthContext: Respuesta recibida:', response);
      
      if (response.success && response.data) {
        console.log('AuthContext: Operador autenticado:', response.data.name);
        setOperator(response.data);
      } else {
        console.log('AuthContext: No hay sesión válida');
        setOperator(null);
      }
    } catch (error:any) {
      console.error('AuthContext: Error verificando auth:', error);
      console.error('AuthContext: Error details:', error.message);
      setOperator(null);
    } finally {
      console.log('AuthContext: Finalizando verificación, estableciendo isLoading = false');
      setIsLoading(false);
    }
  };

  const login = async (operatorId: number, pin: string): Promise<boolean> => {
    try {
      console.log('AuthContext: Iniciando login para operador ID:', operatorId);
      
      // Verificar que el tenant esté configurado antes de hacer login
      const hasTenant = await tenantConfigService.hasTenant();
      if (!hasTenant) {
        console.log('AuthContext: No hay tenant configurado, no se puede hacer login');
        return false;
      }
      
      const response = await apiService.login(operatorId, pin);
      if (response.success && response.data) {
        console.log('AuthContext: Login exitoso, operador:', response.data.operator.name);
        
        // Cargar configuración del sistema después del login exitoso
        console.log('AuthContext: Cargando configuración del sistema...');
        try {
          await systemConfigService.loadFromServer();
          console.log('AuthContext: Configuración del sistema cargada exitosamente');
        } catch (error) {
          console.error('AuthContext: Error cargando configuración del sistema:', error);
        }
        
        // Cargar datos adicionales del operador
        const operatorWithData = await loadOperatorAdditionalData(response.data.operator);
        setOperator(operatorWithData);
        
        return true;
      }
      console.log('AuthContext: Login fallido:', response.message);
      return false;
    } catch (error) {
      console.error('AuthContext: Error en login:', error);
      return false;
    }
  };

  const loadOperatorAdditionalData = async (operator: Operator): Promise<Operator> => {
    try {
      console.log('AuthContext: Cargando datos adicionales del operador');
      
      // Si el operador tiene sectores, cargar las calles del sector activo
      if (operator.sectors && operator.sectors.length > 0) {
        const activeSector = operator.sectors[0]; // Solo debe tener un sector activo
        console.log('AuthContext: Sector activo:', activeSector.name);
        
        // Cargar calles del sector
        const streetsResponse = await apiService.getStreetsBySector(activeSector.id);
        if (streetsResponse.success && streetsResponse.data) {
          console.log('AuthContext: Calles cargadas:', streetsResponse.data.length);
          
          return {
            ...operator,
            activeSector: activeSector,
            sectorStreets: streetsResponse.data,
          };
        }
      }
      
      return operator;
    } catch (error) {
      console.error('AuthContext: Error cargando datos adicionales:', error);
      return operator; // Retornar operador sin datos adicionales en caso de error
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await apiService.logout();
    } catch (error) {
      // Ignorar errores de logout
    } finally {
      setOperator(null);
    }
  };

  const value: AuthContextType = {
    operator,
    isAuthenticated,
    isLoading,
    login,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
