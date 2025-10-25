import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'environments/environment';
import { ApiResponse, PaginatedResponse } from 'app/interfaces/parking.interface';
import { PricingProfile, PricingRule } from 'app/interfaces/parking.interface';

@Injectable({
  providedIn: 'root'
})
export class PricingProfileService {
  private baseUrl = `${environment.apiUrl}/pricing-profiles`;

  constructor(private http: HttpClient) {}

  /**
   * Listar perfiles de precios con filtros
   */
  getPricingProfiles(filters: any = {}): Observable<ApiResponse<PaginatedResponse<PricingProfile>>> {
    let params = new HttpParams();
    
    Object.keys(filters).forEach(key => {
      if (filters[key] !== null && filters[key] !== undefined && filters[key] !== '') {
        params = params.set(key, filters[key].toString());
      }
    });

    return this.http.get<ApiResponse<PaginatedResponse<PricingProfile>>>(this.baseUrl, { params });
  }

  /**
   * Obtener perfil de precios por ID
   */
  getPricingProfile(id: number): Observable<ApiResponse<PricingProfile>> {
    return this.http.get<ApiResponse<PricingProfile>>(`${this.baseUrl}/${id}`);
  }

  /**
   * Crear perfil de precios
   */
  createPricingProfile(profile: any): Observable<ApiResponse<PricingProfile>> {
    return this.http.post<ApiResponse<PricingProfile>>(this.baseUrl, profile);
  }

  /**
   * Actualizar perfil de precios
   */
  updatePricingProfile(id: number, profile: any): Observable<ApiResponse<PricingProfile>> {
    return this.http.put<ApiResponse<PricingProfile>>(`${this.baseUrl}/${id}`, profile);
  }

  /**
   * Eliminar perfil de precios
   */
  deletePricingProfile(id: number): Observable<ApiResponse<any>> {
    return this.http.delete<ApiResponse<any>>(`${this.baseUrl}/${id}`);
  }

  /**
   * Activar/desactivar perfil de precios
   */
  togglePricingProfile(id: number, isActive: boolean): Observable<ApiResponse<PricingProfile>> {
    return this.http.post<ApiResponse<PricingProfile>>(`${this.baseUrl}/${id}/toggle-status`, { is_active: isActive });
  }

  /**
   * Obtener reglas de precios de un perfil
   */
  getPricingRules(profileId: number): Observable<ApiResponse<PricingRule[]>> {
    return this.http.get<ApiResponse<PricingRule[]>>(`${this.baseUrl}/${profileId}/rules`);
  }

  /**
   * Crear regla de precios
   */
  createPricingRule(rule: any): Observable<ApiResponse<PricingRule>> {
    return this.http.post<ApiResponse<PricingRule>>(`${environment.apiUrl}/pricing-rules`, rule);
  }

  /**
   * Actualizar regla de precios
   */
  updatePricingRule(ruleId: number, rule: any): Observable<ApiResponse<PricingRule>> {
    return this.http.put<ApiResponse<PricingRule>>(`${environment.apiUrl}/pricing-rules/${ruleId}`, rule);
  }

  /**
   * Eliminar regla de precios
   */
  deletePricingRule(ruleId: number): Observable<ApiResponse<any>> {
    return this.http.delete<ApiResponse<any>>(`${environment.apiUrl}/pricing-rules/${ruleId}`);
  }

  /**
   * Activar/desactivar regla de precios
   */
  togglePricingRule(ruleId: number, isActive: boolean): Observable<ApiResponse<PricingRule>> {
    return this.http.post<ApiResponse<PricingRule>>(`${environment.apiUrl}/pricing-rules/${ruleId}/toggle-status`, { is_active: isActive });
  }
}
