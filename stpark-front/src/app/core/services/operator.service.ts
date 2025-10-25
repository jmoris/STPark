import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiResponse, Operator, PaginatedResponse } from '../../interfaces/parking.interface';
import { environment } from '../../../environments/environment';

export interface OperatorFilters {
  name?: string;
  email?: string;
  status?: string;
  per_page?: number;
  page?: number;
  [key: string]: string | number | undefined;
}

@Injectable({
  providedIn: 'root'
})
export class OperatorService {
  private baseUrl = `${environment.apiUrl}/operators`;

  constructor(private http: HttpClient) {}

  /**
   * Obtener todos los operadores (sin paginación)
   */
  getAllOperators(): Observable<ApiResponse<Operator[]>> {
    return this.http.get<ApiResponse<Operator[]>>(`${this.baseUrl}/all`);
  }

  /**
   * Obtener lista de operadores
   */
  getOperators(filters: OperatorFilters = {}): Observable<ApiResponse<PaginatedResponse<Operator>>> {
    return this.http.get<ApiResponse<PaginatedResponse<Operator>>>(this.baseUrl, { 
      params: filters as any 
    });
  }

  /**
   * Obtener operador por ID
   */
  getOperator(id: number): Observable<ApiResponse<Operator>> {
    return this.http.get<ApiResponse<Operator>>(`${this.baseUrl}/${id}`);
  }

  /**
   * Crear nuevo operador
   */
  createOperator(operator: Partial<Operator>): Observable<ApiResponse<Operator>> {
    return this.http.post<ApiResponse<Operator>>(this.baseUrl, operator);
  }

  /**
   * Actualizar operador
   */
  updateOperator(id: number, operator: Partial<Operator>): Observable<ApiResponse<Operator>> {
    return this.http.put<ApiResponse<Operator>>(`${this.baseUrl}/${id}`, operator);
  }

  /**
   * Eliminar operador
   */
  deleteOperator(id: number): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.baseUrl}/${id}`);
  }

  /**
   * Asignar operador a sector/calle
   */
  assignOperator(id: number, assignment: any): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(`${this.baseUrl}/${id}/assign`, assignment);
  }

  /**
   * Eliminar todas las asignaciones del operador
   */
  removeAllAssignments(id: number): Observable<ApiResponse<any>> {
    return this.http.delete<ApiResponse<any>>(`${this.baseUrl}/${id}/assignments`);
  }

  /**
   * Obtener asignaciones del operador
   */
  getOperatorAssignments(id: number): Observable<ApiResponse<any>> {
    return this.http.get<ApiResponse<any>>(`${this.baseUrl}/${id}/assignments`);
  }
}