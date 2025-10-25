import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiResponse, Street, PaginatedResponse } from '../../interfaces/parking.interface';
import { environment } from '../../../environments/environment';

export interface StreetFilters {
  sector_id?: number;
  name?: string;
  per_page?: number;
  page?: number;
  [key: string]: string | number | undefined;
}

@Injectable({
  providedIn: 'root'
})
export class StreetService {
  private baseUrl = `${environment.apiUrl}/streets`;

  constructor(private http: HttpClient) {}

  /**
   * Obtener lista de calles
   */
  getStreets(filters: StreetFilters = {}): Observable<ApiResponse<PaginatedResponse<Street>>> {
    return this.http.get<ApiResponse<PaginatedResponse<Street>>>(this.baseUrl, { 
      params: filters as any 
    });
  }

  /**
   * Obtener calle por ID
   */
  getStreet(id: number): Observable<ApiResponse<Street>> {
    return this.http.get<ApiResponse<Street>>(`${this.baseUrl}/${id}`);
  }

  /**
   * Crear nueva calle
   */
  createStreet(street: Partial<Street>): Observable<ApiResponse<Street>> {
    return this.http.post<ApiResponse<Street>>(this.baseUrl, street);
  }

  /**
   * Actualizar calle
   */
  updateStreet(id: number, street: Partial<Street>): Observable<ApiResponse<Street>> {
    return this.http.put<ApiResponse<Street>>(`${this.baseUrl}/${id}`, street);
  }

  /**
   * Eliminar calle
   */
  deleteStreet(id: number): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.baseUrl}/${id}`);
  }
}
