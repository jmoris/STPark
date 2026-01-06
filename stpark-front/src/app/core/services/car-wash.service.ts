import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'environments/environment';
import { ApiResponse } from 'app/interfaces/parking.interface';
import {
  CarWash,
  CarWashesApiResponse,
  CarWashType,
  CarWashTypeListResponse,
  CarWashStatus
} from 'app/interfaces/car-wash.interface';

export interface CarWashFilters {
  plate?: string;
  status?: CarWashStatus | '';
  date_from?: string;
  date_to?: string;
  page?: number;
  per_page?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

export interface CarWashTypeRequest {
  name: string;
  price: number;
  duration_minutes?: number | null;
  is_active?: boolean;
}

export interface CreateCarWashRequest {
  plate: string;
  car_wash_type_id: number;
  status?: CarWashStatus;
}

export interface UpdateCarWashRequest {
  status?: CarWashStatus;
  cashier_operator_id?: number;
  shift_id?: string;
  approval_code?: string;
}

@Injectable({
  providedIn: 'root'
})
export class CarWashService {
  private baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // ===== Tipos de lavado =====
  getCarWashTypes(): Observable<CarWashTypeListResponse> {
    return this.http.get<CarWashTypeListResponse>(`${this.baseUrl}/car-wash-types`);
  }

  createCarWashType(payload: CarWashTypeRequest): Observable<ApiResponse<CarWashType>> {
    return this.http.post<ApiResponse<CarWashType>>(`${this.baseUrl}/car-wash-types`, payload);
  }

  updateCarWashType(id: number, payload: CarWashTypeRequest): Observable<ApiResponse<CarWashType>> {
    return this.http.put<ApiResponse<CarWashType>>(`${this.baseUrl}/car-wash-types/${id}`, payload);
  }

  deleteCarWashType(id: number): Observable<ApiResponse<null>> {
    return this.http.delete<ApiResponse<null>>(`${this.baseUrl}/car-wash-types/${id}`);
  }

  // ===== Lavados (registros) =====
  getCarWashes(filters: CarWashFilters = {}): Observable<CarWashesApiResponse> {
    let params = new HttpParams();

    Object.entries(filters).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') {
        return;
      }
      params = params.set(key, String(value));
    });

    return this.http.get<CarWashesApiResponse>(`${this.baseUrl}/car-washes`, { params });
  }

  createCarWash(payload: CreateCarWashRequest): Observable<ApiResponse<CarWash>> {
    return this.http.post<ApiResponse<CarWash>>(`${this.baseUrl}/car-washes`, payload);
  }

  updateCarWash(id: number, payload: UpdateCarWashRequest): Observable<ApiResponse<CarWash>> {
    return this.http.put<ApiResponse<CarWash>>(`${this.baseUrl}/car-washes/${id}`, payload);
  }
}


