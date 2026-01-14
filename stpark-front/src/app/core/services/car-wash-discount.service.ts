import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'environments/environment';
import { ApiResponse } from 'app/interfaces/parking.interface';

export interface CarWashDiscount {
  id?: number;
  name: string;
  description?: string;
  discount_type: 'AMOUNT' | 'PERCENTAGE';
  value?: number;
  max_amount?: number;
  is_active: boolean;
  priority: number;
  valid_from?: string;
  valid_until?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CarWashDiscountRequest {
  name: string;
  description?: string;
  discount_type: 'AMOUNT' | 'PERCENTAGE';
  value?: number;
  max_amount?: number;
  is_active?: boolean;
  priority?: number;
  valid_from?: string;
  valid_until?: string;
}

export interface CarWashDiscountListResponse extends ApiResponse<CarWashDiscount[]> {
  data: CarWashDiscount[];
}

@Injectable({
  providedIn: 'root'
})
export class CarWashDiscountService {
  private baseUrl = `${environment.apiUrl}/car-wash-discounts`;

  constructor(private http: HttpClient) {}

  /**
   * Obtener lista de descuentos de lavados de autos
   */
  getCarWashDiscounts(): Observable<CarWashDiscountListResponse> {
    return this.http.get<CarWashDiscountListResponse>(this.baseUrl);
  }

  /**
   * Obtener descuento por ID
   */
  getCarWashDiscount(id: number): Observable<ApiResponse<CarWashDiscount>> {
    return this.http.get<ApiResponse<CarWashDiscount>>(`${this.baseUrl}/${id}`);
  }

  /**
   * Crear nuevo descuento
   */
  createCarWashDiscount(payload: CarWashDiscountRequest): Observable<ApiResponse<CarWashDiscount>> {
    return this.http.post<ApiResponse<CarWashDiscount>>(this.baseUrl, payload);
  }

  /**
   * Actualizar descuento
   */
  updateCarWashDiscount(id: number, payload: CarWashDiscountRequest): Observable<ApiResponse<CarWashDiscount>> {
    return this.http.put<ApiResponse<CarWashDiscount>>(`${this.baseUrl}/${id}`, payload);
  }

  /**
   * Eliminar descuento
   */
  deleteCarWashDiscount(id: number): Observable<ApiResponse<null>> {
    return this.http.delete<ApiResponse<null>>(`${this.baseUrl}/${id}`);
  }
}
