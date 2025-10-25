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
      
      const response = await fetch(fullUrl, {
        method: 'GET',
        headers: await this.getHeaders(),
      });

      console.log('API: Status de respuesta:', response.status);
      console.log('API: Status OK:', response.ok);
      
      const result = await response.json();
      console.log('API: Respuesta de operadores:', result);
      console.log('API: Cantidad de operadores recibidos:', result.data?.length || 0);
      
      return result;
    } catch (error) {
      console.error('API: Error obteniendo operadores:', error);
      console.error('API: Tipo de error:', typeof error);
      console.error('API: Mensaje de error:', (error as Error).message);
      return {
        success: false,
        message: 'Error de conexión con el servidor',
      };
    }
  }
}

export const apiService = new ApiService();
