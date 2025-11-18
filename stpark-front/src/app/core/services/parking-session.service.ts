import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'environments/environment';
import {
  ParkingSession,
  CreateSessionRequest,
  QuoteRequest,
  CheckoutRequest,
  SessionFilters,
  ApiResponse,
  PaginatedResponse,
  SessionsApiResponse,
  QuoteResponse
} from 'app/interfaces/parking.interface';

@Injectable({
  providedIn: 'root'
})
export class ParkingSessionService {
  private baseUrl = `${environment.apiUrl}/sessions`;

  constructor(private http: HttpClient) {}

  /**
   * Crear nueva sesión de estacionamiento (check-in)
   */
  createSession(request: CreateSessionRequest): Observable<ApiResponse<ParkingSession>> {
    return this.http.post<ApiResponse<ParkingSession>>(this.baseUrl, request);
  }

  /**
   * Obtener cotización para una sesión
   */
  getQuote(sessionId: number, request: QuoteRequest): Observable<ApiResponse<QuoteResponse>> {
    return this.http.post<ApiResponse<QuoteResponse>>(`${this.baseUrl}/${sessionId}/quote`, request);
  }

  /**
   * Procesar checkout de sesión
   */
  checkoutSession(sessionId: number, request: CheckoutRequest): Observable<ApiResponse<ParkingSession>> {
    return this.http.post<ApiResponse<ParkingSession>>(`${this.baseUrl}/${sessionId}/checkout`, request);
  }

  /**
   * Obtener sesión por ID
   */
  getSession(sessionId: number): Observable<ApiResponse<ParkingSession>> {
    return this.http.get<ApiResponse<ParkingSession>>(`${this.baseUrl}/${sessionId}`);
  }

  /**
   * Listar sesiones con filtros
   */
  getSessions(filters: SessionFilters = {}): Observable<SessionsApiResponse> {
    let params = new HttpParams();
    
    Object.keys(filters).forEach(key => {
      const value = filters[key as keyof SessionFilters];
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, value.toString());
      }
    });

    return this.http.get<SessionsApiResponse>(this.baseUrl, { params });
  }

  /**
   * Cancelar sesión
   */
  cancelSession(sessionId: number): Observable<ApiResponse<ParkingSession>> {
    return this.http.post<ApiResponse<ParkingSession>>(`${this.baseUrl}/${sessionId}/cancel`, {});
  }

  /**
   * Obtener sesión activa por placa y sector
   */
  getActiveSessionByPlate(plate: string, sectorId: number): Observable<ApiResponse<ParkingSession | null>> {
    const params = new HttpParams()
      .set('plate', plate)
      .set('sector_id', sectorId.toString());

    return this.http.get<ApiResponse<ParkingSession | null>>(`${this.baseUrl}/active-by-plate`, { params });
  }

  /**
   * Obtener sesiones activas del operador
   */
  getActiveSessions(operatorId?: number): Observable<ApiResponse<ParkingSession[]>> {
    const filters: SessionFilters = {
      status: 'ACTIVE',
      operator_id: operatorId
    };
    
    return new Observable(observer => {
      this.getSessions(filters).subscribe({
        next: (response: SessionsApiResponse) => {
          observer.next({
            success: response.success,
            data: response.data || [],
            message: 'Sesiones activas obtenidas'
          });
          observer.complete();
        },
        error: (error) => {
          observer.error(error);
        }
      });
    });
  }

  /**
   * Obtener sesiones del día
   */
  getTodaySessions(operatorId?: number): Observable<ApiResponse<ParkingSession[]>> {
    const today = new Date().toISOString().split('T')[0];
    const filters: SessionFilters = {
      date_from: today,
      date_to: today,
      operator_id: operatorId
    };
    
    return new Observable(observer => {
      this.getSessions(filters).subscribe({
        next: (response: SessionsApiResponse) => {
          observer.next({
            success: response.success,
            data: response.data || [],
            message: 'Sesiones del día obtenidas'
          });
          observer.complete();
        },
        error: (error) => {
          observer.error(error);
        }
      });
    });
  }

  /**
   * Verificar si existe sesión activa para una placa
   */
  hasActiveSession(plate: string, sectorId: number): Observable<boolean> {
    return new Observable(observer => {
      this.getActiveSessionByPlate(plate, sectorId).subscribe({
        next: (response) => {
          observer.next(response.data !== null);
          observer.complete();
        },
        error: (error) => {
          observer.error(error);
        }
      });
    });
  }

  /**
   * Formatear duración en formato legible
   */
  formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }

  /**
   * Formatear monto en pesos chilenos
   */
  formatAmount(amount: number): string {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  }

  /**
   * Validar formato de patente chilena
   */
  validateChileanPlate(plate: string): boolean {
    const cleanPlate = plate.toUpperCase().replace(/\s/g, '');
    
    // Patrones de patentes chilenas
    const patterns = [
      /^[A-Z]{2}[0-9]{4}$/, // AA1234
      /^[0-9]{4}[A-Z]{2}$/, // 1234AA
      /^[A-Z]{4}[0-9]{2}$/, // ABCD12
    ];
    
    return patterns.some(pattern => pattern.test(cleanPlate));
  }

  /**
   * Obtener estado de sesión en español
   */
  getStatusLabel(status: string): string {
    const statusLabels: Record<string, string> = {
      'CREATED': 'Creada',
      'ACTIVE': 'Activa',
      'TO_PAY': 'Por Pagar',
      'PAID': 'Pagada',
      'CLOSED': 'Cerrada',
      'CANCELED': 'Cancelada',
      'CANCELLED': 'Cancelada',
      'COMPLETED': 'Completada',
      'FORCED_CHECKOUT': 'Checkout Forzado'
    };
    
    return statusLabels[status] || status;
  }

  /**
   * Obtener color para estado de sesión
   */
  getStatusColor(status: string): string {
    const statusColors: Record<string, string> = {
      'CREATED': 'blue',
      'ACTIVE': 'green',
      'TO_PAY': 'orange',
      'PAID': 'green',
      'CLOSED': 'gray',
      'CANCELED': 'red',
      'CANCELLED': 'red',
      'COMPLETED': 'green',
      'FORCED_CHECKOUT': 'orange'
    };
    
    return statusColors[status] || 'gray';
  }

}

