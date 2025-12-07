import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiResponse, PaginatedResponse } from '../../interfaces/parking.interface';
import { environment } from '../../../environments/environment';

export interface Plan {
  id?: number;
  name: string;
  description?: string;
  max_price_uf: number;
  status: 'ACTIVE' | 'INACTIVE' | 'DISCONTINUED';
  feature?: PlanFeature;
  created_at?: string;
  updated_at?: string;
}

export interface PlanFeature {
  id?: number;
  plan_id?: number;
  max_operators?: number;
  max_streets?: number;
  max_sectors?: number;
  max_sessions?: number;
  max_pricing_profiles?: number;
  max_pricing_rules?: number;
  includes_debt_management?: boolean;
  report_type?: 'BASIC' | 'ADVANCED';
  support_type?: 'BASIC' | 'PRIORITY';
  created_at?: string;
  updated_at?: string;
}

export interface PlanFilters {
  name?: string;
  status?: string;
  per_page?: number;
  page?: number;
  [key: string]: string | number | undefined;
}

@Injectable({
  providedIn: 'root'
})
export class PlanService {
  private baseUrl = `${environment.authApiUrl}/api/central-admin/plans`;

  constructor(private http: HttpClient) {}

  /**
   * Obtener lista de planes
   */
  getPlans(filters: PlanFilters = {}): Observable<ApiResponse<PaginatedResponse<Plan>>> {
    return this.http.get<ApiResponse<PaginatedResponse<Plan>>>(this.baseUrl, { 
      params: filters as any 
    });
  }

  /**
   * Obtener plan por ID
   */
  getPlan(id: number): Observable<ApiResponse<Plan>> {
    return this.http.get<ApiResponse<Plan>>(`${this.baseUrl}/${id}`);
  }

  /**
   * Crear nuevo plan
   */
  createPlan(plan: Partial<Plan>): Observable<ApiResponse<Plan>> {
    return this.http.post<ApiResponse<Plan>>(this.baseUrl, plan);
  }

  /**
   * Actualizar plan
   */
  updatePlan(id: number, plan: Partial<Plan>): Observable<ApiResponse<Plan>> {
    return this.http.put<ApiResponse<Plan>>(`${this.baseUrl}/${id}`, plan);
  }

  /**
   * Eliminar plan
   */
  deletePlan(id: number): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.baseUrl}/${id}`);
  }
}

