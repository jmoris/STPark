import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiResponse, Sector, PaginatedResponse } from '../../interfaces/parking.interface';
import { environment } from '../../../environments/environment';

export interface SectorFilters {
  name?: string;
  is_private?: boolean;
  per_page?: number;
  page?: number;
  [key: string]: string | number | boolean | undefined;
}

@Injectable({
  providedIn: 'root'
})
export class SectorService {
  private baseUrl = `${environment.apiUrl}/sectors`;

  constructor(private http: HttpClient) {}

  /**
   * Obtener lista de sectores
   */
  getSectors(filters: SectorFilters = {}): Observable<ApiResponse<PaginatedResponse<Sector>>> {
    return this.http.get<ApiResponse<PaginatedResponse<Sector>>>(this.baseUrl, { 
      params: filters as any 
    });
  }

  /**
   * Obtener sector por ID
   */
  getSector(id: number): Observable<ApiResponse<Sector>> {
    return this.http.get<ApiResponse<Sector>>(`${this.baseUrl}/${id}`);
  }

  /**
   * Crear nuevo sector
   */
  createSector(sector: Partial<Sector>): Observable<ApiResponse<Sector>> {
    return this.http.post<ApiResponse<Sector>>(this.baseUrl, sector);
  }

  /**
   * Actualizar sector
   */
  updateSector(id: number, sector: Partial<Sector>): Observable<ApiResponse<Sector>> {
    return this.http.put<ApiResponse<Sector>>(`${this.baseUrl}/${id}`, sector);
  }

  /**
   * Eliminar sector
   */
  deleteSector(id: number): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.baseUrl}/${id}`);
  }

  /**
   * Obtener calles de un sector
   */
  getSectorStreets(id: number): Observable<ApiResponse<any>> {
    return this.http.get<ApiResponse<any>>(`${this.baseUrl}/${id}/streets`);
  }

  /**
   * Obtener operadores de un sector
   */
  getSectorOperators(id: number): Observable<ApiResponse<any>> {
    return this.http.get<ApiResponse<any>>(`${this.baseUrl}/${id}/operators`);
  }
}