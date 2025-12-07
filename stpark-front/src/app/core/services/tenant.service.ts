import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiResponse, PaginatedResponse } from '../../interfaces/parking.interface';
import { environment } from '../../../environments/environment';

export interface Tenant {
  id: string;
  name?: string;
  plan_id?: number;
  plan?: {
    id: number;
    name: string;
  };
  rut?: string;
  razon_social?: string;
  giro?: string;
  direccion?: string;
  comuna?: string;
  dias_credito?: number;
  correo_intercambio?: string;
  created_at?: string;
  updated_at?: string;
  users_count?: number;
  settings?: {
    name?: string;
    pos_tuu?: boolean;
    max_capacity?: number;
    language?: string;
    currency?: string;
    timezone?: string;
    [key: string]: any;
  };
}

export interface CreateTenantRequest {
  id: string;
  name: string;
  plan_id: number;
  rut?: string | null;
  razon_social?: string | null;
  giro?: string | null;
  direccion?: string | null;
  comuna?: string | null;
  dias_credito?: number;
  correo_intercambio?: string | null;
  user: {
    name: string;
    email: string;
    password: string;
  };
}

export interface TenantFilters {
  name?: string;
  plan_id?: number;
  per_page?: number;
  page?: number;
  sort_by?: string;
  sort_order?: string;
  [key: string]: string | number | undefined;
}

@Injectable({
  providedIn: 'root'
})
export class TenantService {
  private baseUrl = `${environment.authApiUrl}/api/central-admin/tenants`;

  constructor(private http: HttpClient) {}

  /**
   * Obtener lista de tenants
   */
  getTenants(filters: TenantFilters = {}): Observable<ApiResponse<PaginatedResponse<Tenant>>> {
    return this.http.get<ApiResponse<PaginatedResponse<Tenant>>>(this.baseUrl, { 
      params: filters as any 
    });
  }

  /**
   * Obtener tenant por ID
   */
  getTenant(id: string): Observable<ApiResponse<Tenant>> {
    return this.http.get<ApiResponse<Tenant>>(`${this.baseUrl}/${id}`);
  }

  /**
   * Crear nuevo tenant
   */
  createTenant(tenant: CreateTenantRequest): Observable<ApiResponse<Tenant>> {
    return this.http.post<ApiResponse<Tenant>>(this.baseUrl, tenant);
  }

  /**
   * Actualizar tenant
   */
  updateTenant(id: string, tenant: Partial<Tenant>): Observable<ApiResponse<Tenant>> {
    return this.http.put<ApiResponse<Tenant>>(`${this.baseUrl}/${id}`, tenant);
  }

  /**
   * Eliminar tenant
   */
  deleteTenant(id: string): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.baseUrl}/${id}`);
  }
}

