import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiResponse, PaginatedResponse } from '../../interfaces/parking.interface';
import { environment } from '../../../environments/environment';

export interface User {
  id: number;
  name: string;
  email: string;
  is_central_admin?: boolean;
  created_at?: string;
  updated_at?: string;
  tenants_count?: number;
  tenants?: Tenant[];
}

export interface Tenant {
  id: string;
  name?: string;
}

export interface CreateUserRequest {
  name: string;
  email: string;
  password: string;
  is_central_admin?: boolean;
}

export interface UpdateUserRequest {
  name?: string;
  email?: string;
  password?: string;
  is_central_admin?: boolean;
}

export interface UserFilters {
  name?: string;
  email?: string;
  is_central_admin?: boolean;
  per_page?: number;
  page?: number;
  sort_by?: string;
  sort_order?: string;
  [key: string]: string | number | boolean | undefined;
}

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private baseUrl = `${environment.authApiUrl}/api/central-admin/users`;

  constructor(private http: HttpClient) {}

  /**
   * Obtener lista de usuarios
   */
  getUsers(filters: UserFilters = {}): Observable<ApiResponse<PaginatedResponse<User>>> {
    return this.http.get<ApiResponse<PaginatedResponse<User>>>(this.baseUrl, { 
      params: filters as any 
    });
  }

  /**
   * Obtener usuario por ID
   */
  getUser(id: number): Observable<ApiResponse<User>> {
    return this.http.get<ApiResponse<User>>(`${this.baseUrl}/${id}`);
  }

  /**
   * Crear nuevo usuario
   */
  createUser(user: CreateUserRequest): Observable<ApiResponse<User>> {
    return this.http.post<ApiResponse<User>>(this.baseUrl, user);
  }

  /**
   * Actualizar usuario
   */
  updateUser(id: number, user: UpdateUserRequest): Observable<ApiResponse<User>> {
    return this.http.put<ApiResponse<User>>(`${this.baseUrl}/${id}`, user);
  }

  /**
   * Eliminar usuario
   */
  deleteUser(id: number): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.baseUrl}/${id}`);
  }

  /**
   * Asignar usuario a estacionamiento(s)
   */
  assignToTenants(id: number, tenantIds: string[]): Observable<ApiResponse<User>> {
    return this.http.post<ApiResponse<User>>(`${this.baseUrl}/${id}/assign-tenants`, {
      tenant_ids: tenantIds
    });
  }

  /**
   * Remover usuario de estacionamiento(s)
   */
  removeFromTenants(id: number, tenantIds: string[]): Observable<ApiResponse<User>> {
    return this.http.post<ApiResponse<User>>(`${this.baseUrl}/${id}/remove-tenants`, {
      tenant_ids: tenantIds
    });
  }
}
