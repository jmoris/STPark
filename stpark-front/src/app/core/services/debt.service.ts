import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'environments/environment';
import {
  Debt,
  DebtRequest,
  SettleDebtRequest,
  DebtFilters,
  ApiResponse,
  PaginatedResponse
} from 'app/interfaces/parking.interface';

@Injectable({
  providedIn: 'root'
})
export class DebtService {
  private baseUrl = `${environment.apiUrl}/debts`;

  constructor(private http: HttpClient) {}

  /**
   * Crear deuda manual
   */
  createDebt(request: DebtRequest): Observable<ApiResponse<Debt>> {
    return this.http.post<ApiResponse<Debt>>(this.baseUrl, request);
  }

  /**
   * Listar deudas con filtros
   */
  getDebts(filters: DebtFilters = {}): Observable<ApiResponse<PaginatedResponse<Debt>>> {
    let params = new HttpParams();
    
    Object.keys(filters).forEach(key => {
      const value = filters[key as keyof DebtFilters];
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, value.toString());
      }
    });

    return this.http.get<ApiResponse<PaginatedResponse<Debt>>>(this.baseUrl, { params });
  }

  /**
   * Obtener deuda por ID
   */
  getDebt(debtId: number): Observable<ApiResponse<Debt>> {
    return this.http.get<ApiResponse<Debt>>(`${this.baseUrl}/${debtId}`);
  }

  /**
   * Buscar deudas por placa
   */
  getDebtsByPlate(plate: string): Observable<ApiResponse<Debt[]>> {
    const params = new HttpParams().set('plate', plate);
    return this.http.get<ApiResponse<Debt[]>>(`${this.baseUrl}/by-plate`, { params });
  }

  /**
   * Liquidar deuda
   */
  settleDebt(debtId: number, request: SettleDebtRequest): Observable<ApiResponse<Debt>> {
    return this.http.post<ApiResponse<Debt>>(`${this.baseUrl}/${debtId}/settle`, request);
  }

  /**
   * Obtener resumen de deudas pendientes
   */
  getPendingSummary(): Observable<ApiResponse<any>> {
    return this.http.get<ApiResponse<any>>(`${this.baseUrl}/pending-summary`);
  }

  /**
   * Obtener deudas pendientes
   */
  getPendingDebts(): Observable<ApiResponse<Debt[]>> {
    const filters: DebtFilters = {
      status: 'PENDING'
    };
    
    return new Observable(observer => {
      this.getDebts(filters).subscribe({
        next: (response) => {
          observer.next({
            success: response.success,
            data: response.data.data || [],
            message: response.message
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
   * Obtener deudas liquidadas
   */
  getSettledDebts(): Observable<ApiResponse<Debt[]>> {
    const filters: DebtFilters = {
      status: 'SETTLED'
    };
    
    return new Observable(observer => {
      this.getDebts(filters).subscribe({
        next: (response) => {
          observer.next({
            success: response.success,
            data: response.data.data || [],
            message: response.message
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
   * Obtener deudas por origen
   */
  getDebtsByOrigin(origin: 'SESSION' | 'FINE' | 'MANUAL'): Observable<ApiResponse<Debt[]>> {
    const filters: DebtFilters = {
      origin: origin
    };
    
    return new Observable(observer => {
      this.getDebts(filters).subscribe({
        next: (response) => {
          observer.next({
            success: response.success,
            data: response.data.data || [],
            message: response.message
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
   * Obtener deudas del día
   */
  getTodayDebts(): Observable<ApiResponse<Debt[]>> {
    const today = new Date().toISOString().split('T')[0];
    const filters: DebtFilters = {
      date_from: today,
      date_to: today
    };
    
    return new Observable(observer => {
      this.getDebts(filters).subscribe({
        next: (response) => {
          observer.next({
            success: response.success,
            data: response.data.data || [],
            message: response.message
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
   * Obtener etiqueta del origen de deuda
   */
  getOriginLabel(origin: string): string {
    const originLabels: Record<string, string> = {
      'SESSION': 'Sesión',
      'FINE': 'Multa',
      'MANUAL': 'Manual'
    };
    
    return originLabels[origin] || origin;
  }

  /**
   * Obtener color para origen de deuda
   */
  getOriginColor(origin: string): string {
    const originColors: Record<string, string> = {
      'SESSION': 'blue',
      'FINE': 'red',
      'MANUAL': 'orange'
    };
    
    return originColors[origin] || 'gray';
  }

  /**
   * Obtener etiqueta del estado de deuda
   */
  getStatusLabel(status: string): string {
    const statusLabels: Record<string, string> = {
      'PENDING': 'Pendiente',
      'SETTLED': 'Liquidada',
      'CANCELLED': 'Cancelada'
    };
    
    return statusLabels[status] || status;
  }

  /**
   * Obtener color para estado de deuda
   */
  getStatusColor(status: string): string {
    const statusColors: Record<string, string> = {
      'PENDING': 'orange',
      'SETTLED': 'green',
      'CANCELLED': 'red'
    };
    
    return statusColors[status] || 'gray';
  }

  /**
   * Verificar si la deuda está pendiente
   */
  isDebtPending(status: string): boolean {
    return status === 'PENDING';
  }

  /**
   * Verificar si la deuda está liquidada
   */
  isDebtSettled(status: string): boolean {
    return status === 'SETTLED';
  }

  /**
   * Verificar si la deuda está cancelada
   */
  isDebtCancelled(status: string): boolean {
    return status === 'CANCELLED';
  }

  /**
   * Obtener icono para origen de deuda
   */
  getOriginIcon(origin: string): string {
    const originIcons: Record<string, string> = {
      'SESSION': 'heroicons_solid:car',
      'FINE': 'heroicons_solid:exclamation-triangle',
      'MANUAL': 'heroicons_solid:pencil'
    };
    
    return originIcons[origin] || 'heroicons_solid:question-mark-circle';
  }

  /**
   * Calcular total de deudas
   */
  calculateTotal(debts: Debt[]): number {
    return debts.reduce((total, debt) => total + debt.principal_amount, 0);
  }

  /**
   * Calcular total de deudas pendientes
   */
  calculatePendingTotal(debts: Debt[]): number {
    return debts
      .filter(debt => debt.status === 'PENDING')
      .reduce((total, debt) => total + debt.principal_amount, 0);
  }

  /**
   * Calcular total de deudas liquidadas
   */
  calculateSettledTotal(debts: Debt[]): number {
    return debts
      .filter(debt => debt.status === 'SETTLED')
      .reduce((total, debt) => total + debt.principal_amount, 0);
  }

  /**
   * Agrupar deudas por origen
   */
  groupDebtsByOrigin(debts: Debt[]): Record<string, Debt[]> {
    return debts.reduce((groups, debt) => {
      const origin = debt.origin;
      if (!groups[origin]) {
        groups[origin] = [];
      }
      groups[origin].push(debt);
      return groups;
    }, {} as Record<string, Debt[]>);
  }

  /**
   * Agrupar deudas por estado
   */
  groupDebtsByStatus(debts: Debt[]): Record<string, Debt[]> {
    return debts.reduce((groups, debt) => {
      const status = debt.status;
      if (!groups[status]) {
        groups[status] = [];
      }
      groups[status].push(debt);
      return groups;
    }, {} as Record<string, Debt[]>);
  }

  /**
   * Agrupar deudas por placa
   */
  groupDebtsByPlate(debts: Debt[]): Record<string, Debt[]> {
    return debts.reduce((groups, debt) => {
      const plate = debt.plate;
      if (!groups[plate]) {
        groups[plate] = [];
      }
      groups[plate].push(debt);
      return groups;
    }, {} as Record<string, Debt[]>);
  }

  /**
   * Calcular días desde la creación de la deuda
   */
  getDaysSinceCreation(debt: Debt): number {
    const createdDate = new Date(debt.created_at);
    const today = new Date();
    const diffTime = Math.abs(today.getTime() - createdDate.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Obtener etiqueta de antigüedad
   */
  getAgeLabel(days: number): string {
    if (days === 0) {
      return 'Hoy';
    } else if (days === 1) {
      return 'Ayer';
    } else if (days < 7) {
      return `${days} días`;
    } else if (days < 30) {
      const weeks = Math.floor(days / 7);
      return `${weeks} semana${weeks > 1 ? 's' : ''}`;
    } else {
      const months = Math.floor(days / 30);
      return `${months} mes${months > 1 ? 'es' : ''}`;
    }
  }
}

