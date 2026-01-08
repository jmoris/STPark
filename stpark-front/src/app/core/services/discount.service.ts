import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'environments/environment';
import { ApiResponse } from 'app/interfaces/parking.interface';
import {
  SessionDiscount,
  SessionDiscountRequest,
  SessionDiscountListResponse
} from 'app/interfaces/discount.interface';

@Injectable({
  providedIn: 'root'
})
export class DiscountService {
  private baseUrl = `${environment.apiUrl}/session-discounts`;

  constructor(private http: HttpClient) {}

  /**
   * Obtener lista de descuentos de sesiones
   */
  getSessionDiscounts(): Observable<SessionDiscountListResponse> {
    return this.http.get<SessionDiscountListResponse>(this.baseUrl);
  }

  /**
   * Obtener descuento por ID
   */
  getSessionDiscount(id: number): Observable<ApiResponse<SessionDiscount>> {
    return this.http.get<ApiResponse<SessionDiscount>>(`${this.baseUrl}/${id}`);
  }

  /**
   * Crear nuevo descuento
   */
  createSessionDiscount(payload: SessionDiscountRequest): Observable<ApiResponse<SessionDiscount>> {
    return this.http.post<ApiResponse<SessionDiscount>>(this.baseUrl, payload);
  }

  /**
   * Actualizar descuento
   */
  updateSessionDiscount(id: number, payload: SessionDiscountRequest): Observable<ApiResponse<SessionDiscount>> {
    return this.http.put<ApiResponse<SessionDiscount>>(`${this.baseUrl}/${id}`, payload);
  }

  /**
   * Eliminar descuento
   */
  deleteSessionDiscount(id: number): Observable<ApiResponse<null>> {
    return this.http.delete<ApiResponse<null>>(`${this.baseUrl}/${id}`);
  }
}


