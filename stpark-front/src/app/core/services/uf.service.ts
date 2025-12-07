import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiResponse } from '../../interfaces/parking.interface';
import { environment } from '../../../environments/environment';

export interface UFValue {
  value: number;
  date: string;
  series_id?: string;
}

@Injectable({
  providedIn: 'root'
})
export class UFService {
  private baseUrl = `${environment.authApiUrl}/api/uf`;

  constructor(private http: HttpClient) {}

  /**
   * Obtener el valor actual de la UF
   */
  getCurrentValue(): Observable<ApiResponse<UFValue>> {
    return this.http.get<ApiResponse<UFValue>>(`${this.baseUrl}/current`);
  }

  /**
   * Obtener el valor de la UF para una fecha específica
   */
  getValueByDate(date: string): Observable<ApiResponse<UFValue>> {
    const params = new HttpParams().set('date', date);
    return this.http.get<ApiResponse<UFValue>>(`${this.baseUrl}/date`, { params });
  }
}





