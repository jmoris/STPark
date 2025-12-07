import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'environments/environment';

export interface FacturAPIConfig {
  environment: 'dev' | 'prod';
  dev_token: string;
  prod_token: string;
}

export interface FacturAPIConfigResponse {
  success: boolean;
  data: FacturAPIConfig;
  message?: string;
}

@Injectable({
  providedIn: 'root'
})
export class FacturAPIConfigService {
  private _httpClient = inject(HttpClient);
  private baseUrl = `${environment.authApiUrl}/api/central-admin/facturapi-config`;

  /**
   * Obtener configuración de FacturAPI
   */
  getConfig(): Observable<FacturAPIConfigResponse> {
    return this._httpClient.get<FacturAPIConfigResponse>(this.baseUrl);
  }

  /**
   * Guardar configuración de FacturAPI
   */
  saveConfig(config: FacturAPIConfig): Observable<FacturAPIConfigResponse> {
    return this._httpClient.post<FacturAPIConfigResponse>(this.baseUrl, config);
  }
}
