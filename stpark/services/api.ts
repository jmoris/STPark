// Servicio de autenticación y API
import { CONFIG } from '../config/app';
import { tenantConfigService } from './tenantConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Función para obtener la URL base del servidor dinámicamente
const getApiBaseUrl = async (): Promise<string> => {
  try {
    const customUrl = await AsyncStorage.getItem('custom_server_url');
    return customUrl || CONFIG.API_BASE_URL;
  } catch (error) {
    console.error('Error obteniendo URL del servidor:', error);
    return CONFIG.API_BASE_URL;
  }
};

// Función helper para hacer requests con URL dinámica
const makeRequest = async (endpoint: string, options: RequestInit = {}) => {
  const apiBaseUrl = await getApiBaseUrl();
  const fullUrl = `${apiBaseUrl}${endpoint}`;
  console.log('API: URL base del servidor:', apiBaseUrl);
  console.log('API: URL completa:', fullUrl);
  
  return fetch(fullUrl, {
    ...options,
    headers: {
      ...options.headers,
    },
  });
};

export interface Operator {
  id: number;
  name: string;
  email: string;
  phone?: string;
  status: 'ACTIVE' | 'INACTIVE';
  sectors?: any[];
  streets?: any[];
  activeSector?: any;
  sectorStreets?: any[];
}

export interface LoginResponse {
  success: boolean;
  message: string;
  data?: {
    operator: Operator;
    token: string;
  };
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: any;
}

class ApiService {
  private token: string | null = null;

  // Función de diagnóstico de conectividad
  async diagnoseConnectivity(): Promise<{
    serverReachable: boolean;
    sslValid: boolean;
    endpointWorking: boolean;
    errorDetails: string[];
  }> {
    const errors: string[] = [];
    let serverReachable = false;
    let sslValid = false;
    let endpointWorking = false;

    try {
      const apiBaseUrl = await getApiBaseUrl();
      console.log('DIAGNÓSTICO: Iniciando pruebas de conectividad');
      console.log('DIAGNÓSTICO: URL base:', apiBaseUrl);

      // Test 1: Conectividad básica
      try {
        const testUrl = `${apiBaseUrl}/operators/all`;
        console.log('DIAGNÓSTICO: Probando endpoint:', testUrl);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        const response = await fetch(testUrl, {
          method: 'GET',
          headers: await this.getHeaders(),
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        
        console.log('DIAGNÓSTICO: Status:', response.status);
        console.log('DIAGNÓSTICO: OK:', response.ok);
        
        serverReachable = true;
        
        if (response.ok) {
          endpointWorking = true;
          console.log('DIAGNÓSTICO: ✅ Endpoint funcionando correctamente');
        } else {
          const errorText = await response.text();
          errors.push(`HTTP ${response.status}: ${errorText}`);
          console.log('DIAGNÓSTICO: ❌ Error HTTP:', response.status, errorText);
        }
        
      } catch (fetchError) {
        if (fetchError instanceof Error) {
          if (fetchError.name === 'AbortError') {
            errors.push('Timeout: El servidor tardó demasiado en responder');
          } else if (fetchError.message.includes('Network request failed')) {
            errors.push('Error de red: No se puede conectar al servidor');
          } else if (fetchError.message.includes('SSL')) {
            errors.push('Error SSL: Problema con el certificado');
            sslValid = false;
          } else {
            errors.push(`Error de conexión: ${fetchError.message}`);
          }
        }
        console.log('DIAGNÓSTICO: ❌ Error de fetch:', fetchError);
      }

    } catch (error) {
      errors.push(`Error general: ${error}`);
      console.log('DIAGNÓSTICO: ❌ Error general:', error);
    }

    console.log('DIAGNÓSTICO: Resultado final:', {
      serverReachable,
      sslValid,
      endpointWorking,
      errors
    });

    return {
      serverReachable,
      sslValid,
      endpointWorking,
      errorDetails: errors
    };
  }

  // Configurar token de autenticación
  setToken(token: string) {
    this.token = token;
  }

  // Obtener headers con autenticación
  private async getHeaders(): Promise<HeadersInit> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    // Agregar header X-Tenant
    const tenant = await tenantConfigService.getCurrentTenant();
    if (tenant) {
      headers['X-Tenant'] = tenant;
      console.log('API: Header X-Tenant agregado:', tenant);
    } else {
      console.warn('API: No hay tenant configurado, header X-Tenant no se incluirá');
    }

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
      console.log('API: Header Authorization agregado');
    }

    console.log('API: Headers completos:', headers);
    return headers;
  }

  // Login del operador
  async login(operatorId: number, pin: string): Promise<LoginResponse> {
    try {
      console.log('API: Enviando login request');
      console.log('API: Datos:', { operator_id: operatorId, pin });
      
      const response = await makeRequest('/operators/login', {
        method: 'POST',
        headers: await this.getHeaders(),
        body: JSON.stringify({ operator_id: operatorId, pin }),
      });

      console.log('API: Response status:', response.status);
      const data = await response.json();
      console.log('API: Response data:', data);
      
      if (data.success && data.data?.token) {
        this.setToken(data.data.token);
        console.log('API: Token guardado:', data.data.token);
      }

      return data;
    } catch (error) {
      console.error('API: Error en login:', error);
      return {
        success: false,
        message: 'Error de conexión con el servidor',
      };
    }
  }

  // Verificar token
  async verifyToken(): Promise<ApiResponse<Operator>> {
    try {
      console.log('API: Verificando token:', this.token);
      console.log('API: Headers:', await this.getHeaders());
      
      // Agregar timeout para evitar que se cuelgue
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 segundos timeout
      
      const response = await makeRequest('/auth/verify', {
        method: 'POST',
        headers: await this.getHeaders(),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      
      console.log('API: Verify response status:', response.status);
      console.log('API: Verify response ok:', response.ok);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('API: Verify response data:', data);
      
      return data;
    } catch (error) {
      console.error('API: Error en verify token:', error);
      return {
        success: false,
        message: 'Error de conexión con el servidor',
      };
    }
  }

  // Logout
  async logout(): Promise<ApiResponse<null>> {
    try {
      const response = await makeRequest('/auth/logout', {
        method: 'POST',
        headers: await this.getHeaders(),
      });

      this.token = null;
      return await response.json();
    } catch (error) {
      this.token = null;
      return {
        success: false,
        message: 'Error de conexión con el servidor',
      };
    }
  }

  // Crear nueva sesión de estacionamiento
  async createParkingSession(data: {
    plate: string;
    sector_id: number;
    street_id?: number;
    operator_id: number;
  }): Promise<ApiResponse<any>> {
    try {
      const response = await makeRequest('/sessions', {
        method: 'POST',
        headers: await this.getHeaders(),
        body: JSON.stringify(data),
      });

      return await response.json();
    } catch (error) {
      return {
        success: false,
        message: 'Error de conexión con el servidor',
      };
    }
  }

  // Buscar sesión activa por placa
  async getActiveSessionByPlate(plate: string): Promise<ApiResponse<any>> {
    try {
      const response = await makeRequest(`/sessions/active-by-plate?plate=${plate}`, {
        method: 'GET',
        headers: await this.getHeaders(),
      });

      return await response.json();
    } catch (error) {
      return {
        success: false,
        message: 'Error de conexión con el servidor',
      };
    }
  }

  // Hacer checkout de sesión
  async checkoutSession(sessionId: number, paymentData?: {
    payment_method: 'CASH' | 'CARD' | 'TRANSFER';
    amount: number;
    approval_code?: string;
  }): Promise<ApiResponse<any>> {
    try {
      const response = await makeRequest(`/sessions/${sessionId}/checkout`, {
        method: 'POST',
        headers: await this.getHeaders(),
        body: paymentData ? JSON.stringify(paymentData) : undefined,
      });

      return await response.json();
    } catch (error) {
      return {
        success: false,
        message: 'Error de conexión con el servidor',
      };
    }
  }

  // Obtener cotización de sesión
  async getSessionQuote(sessionId: number): Promise<ApiResponse<any>> {
    try {
      const response = await makeRequest(`/sessions/${sessionId}/quote`, {
        method: 'POST',
        headers: await this.getHeaders(),
      });

      return await response.json();
    } catch (error) {
      return {
        success: false,
        message: 'Error de conexión con el servidor',
      };
    }
  }

  // Buscar deudas por placa
  async getDebtsByPlate(plate: string): Promise<ApiResponse<any[]>> {
    try {
      const response = await makeRequest(`/debts/by-plate?plate=${plate}`, {
        method: 'GET',
        headers: await this.getHeaders(),
      });

      return await response.json();
    } catch (error) {
      return {
        success: false,
        message: 'Error de conexión con el servidor',
      };
    }
  }

  // Pagar deuda
  async payDebt(debtId: number, data: {
    amount: number;
    method: 'CASH' | 'CARD' | 'TRANSFER';
    cashier_operator_id: number;
    approval_code?: string;
  }): Promise<ApiResponse<any>> {
    try {
      console.log('API: Pagando deuda:', debtId, data);
      const response = await makeRequest(`/debts/${debtId}/settle`, {
        method: 'POST',
        headers: await this.getHeaders(),
        body: JSON.stringify(data),
      });
      
      console.log('API: Response status:', response.status);
      
      // Verificar si la respuesta es HTML (error del servidor)
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('text/html')) {
        console.error('API: El servidor devolvió HTML en lugar de JSON');
        return {
          success: false,
          message: 'Error del servidor. Por favor, verifica que el backend esté funcionando correctamente.',
        };
      }
      
      const result = await response.json();
      console.log('API: Response data:', result);
      
      return result;
    } catch (error) {
      console.error('API: Error pagando deuda:', error);
      
      // Si es un error de parsing JSON, probablemente el servidor devolvió HTML
      if (error instanceof SyntaxError && error.message.includes('JSON')) {
        return {
          success: false,
          message: 'Error del servidor. El backend no está respondiendo correctamente.',
        };
      }
      
      return {
        success: false,
        message: 'Error de conexión con el servidor',
      };
    }
  }

  // Obtener sesiones por placa
  async getSessionsByPlate(plate: string): Promise<ApiResponse<any[]>> {
    try {
      const response = await makeRequest(`/sessions?plate=${plate}`, {
        method: 'GET',
        headers: await this.getHeaders(),
      });

      return await response.json();
    } catch (error) {
      return {
        success: false,
        message: 'Error de conexión con el servidor',
      };
    }
  }

  // Obtener sectores
  async getSectors(): Promise<ApiResponse<any[]>> {
    try {
      const response = await makeRequest('/sectors', {
        method: 'GET',
        headers: await this.getHeaders(),
      });

      return await response.json();
    } catch (error) {
      return {
        success: false,
        message: 'Error de conexión con el servidor',
      };
    }
  }

  // Obtener calles por sector
  async getStreetsBySector(sectorId: number): Promise<ApiResponse<any[]>> {
    try {
      const response = await makeRequest(`/sectors/${sectorId}/streets`, {
        method: 'GET',
        headers: await this.getHeaders(),
      });

      return await response.json();
    } catch (error) {
      return {
        success: false,
        message: 'Error de conexión con el servidor',
      };
    }
  }

  // Obtener estadísticas del día
  async getDailyStats(): Promise<ApiResponse<any>> {
    try {
      const response = await makeRequest('/stats/daily', {
        method: 'GET',
        headers: await this.getHeaders(),
      });

      return await response.json();
    } catch (error) {
      return {
        success: false,
        message: 'Error de conexión con el servidor',
      };
    }
  }

  // Obtener cotización para una sesión
  async getQuote(sessionId: number, data: any): Promise<ApiResponse<any>> {
    try {
      const response = await makeRequest(`/sessions/${sessionId}/quote`, {
        method: 'POST',
        headers: await this.getHeaders(),
        body: JSON.stringify(data),
      });

      return await response.json();
    } catch (error) {
      return {
        success: false,
        message: 'Error de conexión con el servidor',
      };
    }
  }

  // Procesar checkout de una sesión
  async checkout(sessionId: number, data: any): Promise<ApiResponse<any>> {
    try {
      const response = await makeRequest(`/sessions/${sessionId}/checkout`, {
        method: 'POST',
        headers: await this.getHeaders(),
        body: JSON.stringify(data),
      });

      return await response.json();
    } catch (error) {
      return {
        success: false,
        message: 'Error de conexión con el servidor',
      };
    }
  }

  // Obtener sesiones activas por operador
  async getActiveSessionsByOperator(operatorId: number): Promise<ApiResponse<any[]>> {
    try {
      console.log('API: Obteniendo sesiones activas para operador:', operatorId);
      
      const response = await makeRequest(`/sessions/active-by-operator?operator_id=${operatorId}`, {
        method: 'GET',
        headers: await this.getHeaders(),
      });

      const result = await response.json();
      console.log('API: Respuesta del nuevo endpoint:', result);
      console.log('API: Debug info:', result.debug);
      console.log('API: Cantidad de sesiones recibidas:', result.data?.length || 0);
      
      return result;
    } catch (error) {
      console.error('API: Error obteniendo sesiones activas:', error);
      return {
        success: false,
        message: 'Error de conexión con el servidor',
      };
    }
  }

  // Obtener todos los operadores activos
  async getAllOperators(): Promise<ApiResponse<Operator[]>> {
    try {
      const apiBaseUrl = await getApiBaseUrl();
      const fullUrl = `${apiBaseUrl}/operators/all`;
      console.log('API: Obteniendo lista de operadores activos');
      console.log('API: URL base del servidor:', apiBaseUrl);
      console.log('API: URL completa:', fullUrl);
      console.log('API: Headers:', await this.getHeaders());
      
      // Agregar timeout para evitar que se cuelgue
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 segundos timeout
      
      const response = await fetch(fullUrl, {
        method: 'GET',
        headers: await this.getHeaders(),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      
      console.log('API: Status de respuesta:', response.status);
      console.log('API: Status OK:', response.ok);
      console.log('API: Response headers:', Object.fromEntries(response.headers.entries()));
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API: Error response body:', errorText);
        throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
      }
      
      const result = await response.json();
      console.log('API: Respuesta de operadores:', result);
      console.log('API: Cantidad de operadores recibidos:', result.data?.length || 0);
      
      return result;
    } catch (error) {
      console.error('API: Error obteniendo operadores:', error);
      console.error('API: Tipo de error:', typeof error);
      console.error('API: Mensaje de error:', (error as Error).message);
      
      // Proporcionar mensajes de error más específicos
      let errorMessage = 'Error de conexión con el servidor';
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          errorMessage = 'Timeout: El servidor tardó demasiado en responder';
        } else if (error.message.includes('Network request failed')) {
          errorMessage = 'Error de red: Verifica tu conexión a internet y la configuración del servidor';
        } else if (error.message.includes('HTTP error')) {
          errorMessage = `Error del servidor: ${error.message}`;
        }
      }
      
      return {
        success: false,
        message: errorMessage,
      };
    }
  }

  // Obtener configuración general del sistema
  async getSystemConfig(): Promise<ApiResponse<{
    name: string;
    currency: string;
    timezone: string;
    language: string;
  }>> {
    try {
      const response = await makeRequest('/settings/general', {
        method: 'GET',
        headers: await this.getHeaders(),
      });

      const result = await response.json();
      console.log('API: Configuración del sistema obtenida:', result);
      
      return result;
    } catch (error) {
      console.error('API: Error obteniendo configuración del sistema:', error);
      return {
        success: false,
        message: 'Error al obtener configuración del sistema',
        data: {
          name: 'STPark - Sistema de Gestión de Estacionamientos',
          currency: 'CLP',
          timezone: 'America/Santiago',
          language: 'es'
        }
      };
    }
  }

  // Actualizar perfil del operador
  async updateOperatorProfile(operatorId: number, data: {
    name?: string;
    pin?: string;
  }): Promise<ApiResponse<Operator>> {
    try {
      const response = await makeRequest(`/operators/${operatorId}/profile`, {
        method: 'PUT',
        headers: await this.getHeaders(),
        body: JSON.stringify(data),
      });

      const result = await response.json();
      console.log('API: Perfil actualizado:', result);
      
      return result;
    } catch (error) {
      console.error('API: Error actualizando perfil:', error);
      return {
        success: false,
        message: 'Error al actualizar perfil',
      };
    }
  }

  // Obtener deudas pendientes agrupadas por placa
  async getPendingDebtsGroupedByPlate(): Promise<ApiResponse<any[]>> {
    try {
      const response = await makeRequest('/debts?status=PENDING&per_page=9999', {
        method: 'GET',
        headers: await this.getHeaders(),
      });

      const result = await response.json();
      console.log('API: Respuesta de deudas:', result);
      
      if (result.success && result.data) {
        // Si viene paginado, obtener los datos de la paginación
        const debts = result.data.data ? result.data.data : result.data;
        
        console.log('API: Deudas recibidas del backend:', debts);
        console.log('API: Primera deuda completa:', debts[0]);
        console.log('API: ¿Primera deuda tiene parkingSession?', debts[0]?.parking_session);
        console.log('API: ¿Primera deuda tiene sector?', debts[0]?.parking_session?.sector);
        
        const debtsByPlate: any = {};
        
        // Agrupar deudas por placa
        debts.forEach((debt: any) => {
          if (!debtsByPlate[debt.plate]) {
            debtsByPlate[debt.plate] = {
              plate: debt.plate,
              debts: [],
              total_amount: 0,
            };
          }
          
          debtsByPlate[debt.plate].debts.push(debt);
          debtsByPlate[debt.plate].total_amount += parseFloat(debt.principal_amount);
        });
        
        // Convertir objeto a array
        const resultArray = Object.values(debtsByPlate);
        
        return {
          success: true,
          data: resultArray,
        };
      }
      
      return {
        success: false,
        message: result.message || 'Error obteniendo deudas',
      };
    } catch (error) {
      console.error('API: Error obteniendo deudas agrupadas:', error);
      return {
        success: false,
        message: 'Error de conexión con el servidor',
      };
    }
  }
}

export const apiService = new ApiService();
