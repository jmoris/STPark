// Servicio de autenticación y API
import { CONFIG } from '../config/app';

const API_BASE_URL = CONFIG.API_BASE_URL;

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
  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    return headers;
  }

  // Login del operador
  async login(email: string, pin: string): Promise<LoginResponse> {
    try {
      console.log('API: Enviando login request a:', `${API_BASE_URL}/auth/login`);
      console.log('API: Datos:', { email, pin });
      
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ email, pin }),
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
      console.log('API: URL base:', API_BASE_URL);
      console.log('API: URL completa:', `${API_BASE_URL}/auth/verify`);
      console.log('API: Headers:', this.getHeaders());
      
      // Agregar timeout para evitar que se cuelgue
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 segundos timeout
      
      const response = await fetch(`${API_BASE_URL}/auth/verify`, {
        method: 'POST',
        headers: this.getHeaders(),
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
      const response = await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        headers: this.getHeaders(),
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
      const response = await fetch(`${API_BASE_URL}/sessions`, {
        method: 'POST',
        headers: this.getHeaders(),
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
      const response = await fetch(`${API_BASE_URL}/sessions/active-by-plate?plate=${plate}`, {
        method: 'GET',
        headers: this.getHeaders(),
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
      const response = await fetch(`${API_BASE_URL}/sessions/${sessionId}/checkout`, {
        method: 'POST',
        headers: this.getHeaders(),
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
      const response = await fetch(`${API_BASE_URL}/sessions/${sessionId}/quote`, {
        method: 'POST',
        headers: this.getHeaders(),
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
      const response = await fetch(`${API_BASE_URL}/debts/by-plate?plate=${plate}`, {
        method: 'GET',
        headers: this.getHeaders(),
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
      const response = await fetch(`${API_BASE_URL}/debts/${debtId}/settle`, {
        method: 'POST',
        headers: this.getHeaders(),
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
      const response = await fetch(`${API_BASE_URL}/sessions?plate=${plate}`, {
        method: 'GET',
        headers: this.getHeaders(),
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
      const response = await fetch(`${API_BASE_URL}/sectors`, {
        method: 'GET',
        headers: this.getHeaders(),
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
      const response = await fetch(`${API_BASE_URL}/sectors/${sectorId}/streets`, {
        method: 'GET',
        headers: this.getHeaders(),
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
      const response = await fetch(`${API_BASE_URL}/stats/daily`, {
        method: 'GET',
        headers: this.getHeaders(),
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
      const response = await fetch(`${API_BASE_URL}/sessions/${sessionId}/quote`, {
        method: 'POST',
        headers: this.getHeaders(),
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
      const response = await fetch(`${API_BASE_URL}/sessions/${sessionId}/checkout`, {
        method: 'POST',
        headers: this.getHeaders(),
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
      
      const response = await fetch(`${API_BASE_URL}/sessions/active-by-operator?operator_id=${operatorId}`, {
        method: 'GET',
        headers: this.getHeaders(),
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
}

export const apiService = new ApiService();
