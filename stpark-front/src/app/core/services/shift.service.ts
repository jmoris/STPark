import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'environments/environment';
import {
  Shift,
  ShiftFilters,
  OpenShiftRequest,
  CloseShiftRequest,
  CashAdjustmentRequest,
  ApiResponse,
  PaginatedResponse,
  ShiftReport
} from 'app/interfaces/parking.interface';

@Injectable({
  providedIn: 'root'
})
export class ShiftService {
  private baseUrl = `${environment.apiUrl}/shifts`;

  constructor(private http: HttpClient) {}

  /**
   * Abrir un nuevo turno
   */
  openShift(request: OpenShiftRequest): Observable<ApiResponse<Shift>> {
    return this.http.post<ApiResponse<Shift>>(`${this.baseUrl}/open`, request);
  }

  /**
   * Obtener turno actual del operador
   */
  getCurrentShift(operatorId: number, deviceId?: string): Observable<ApiResponse<{ shift: Shift; totals: any }>> {
    let params = new HttpParams().set('operator_id', operatorId.toString());
    if (deviceId) {
      params = params.set('device_id', deviceId);
    }
    return this.http.get<ApiResponse<{ shift: Shift; totals: any }>>(`${this.baseUrl}/current`, { params });
  }

  /**
   * Listar turnos con filtros
   */
  getShifts(filters: ShiftFilters = {}): Observable<ApiResponse<PaginatedResponse<Shift>>> {
    let params = new HttpParams();
    
    Object.keys(filters).forEach(key => {
      const value = filters[key as keyof ShiftFilters];
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, value.toString());
      }
    });

    return this.http.get<ApiResponse<PaginatedResponse<Shift>>>(this.baseUrl, { params });
  }

  /**
   * Obtener un turno por ID
   */
  getShift(shiftId: string): Observable<ApiResponse<{ shift: Shift; totals: any }>> {
    return this.http.get<ApiResponse<{ shift: Shift; totals: any }>>(`${this.baseUrl}/${shiftId}`);
  }

  /**
   * Cerrar un turno
   */
  closeShift(shiftId: string, request: CloseShiftRequest): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(`${this.baseUrl}/${shiftId}/close`, request);
  }

  /**
   * Cancelar un turno
   */
  cancelShift(shiftId: string, notes?: string): Observable<ApiResponse<Shift>> {
    return this.http.post<ApiResponse<Shift>>(`${this.baseUrl}/${shiftId}/cancel`, { notes });
  }

  /**
   * Registrar ajuste de caja (retiro o depósito)
   */
  createCashAdjustment(shiftId: string, request: CashAdjustmentRequest): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(`${this.baseUrl}/${shiftId}/adjustments`, request);
  }

  /**
   * Obtener reporte de turno
   */
  getShiftReport(shiftId: string, format: 'json' | 'pdf' | 'excel' = 'json'): Observable<ApiResponse<ShiftReport>> {
    const params = new HttpParams().set('format', format);
    return this.http.get<ApiResponse<ShiftReport>>(`${this.baseUrl}/${shiftId}/report`, { params });
  }

  /**
   * Obtener turnos del día actual
   */
  getTodayShifts(operatorId?: number): Observable<ApiResponse<Shift[]>> {
    const today = new Date().toISOString().split('T')[0];
    const filters: ShiftFilters = {
      from: today,
      to: today,
      operator_id: operatorId,
      per_page: 100
    };
    
    return new Observable(observer => {
      this.getShifts(filters).subscribe({
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
}

