import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Router } from '@angular/router';
import { environment } from 'environments/environment';

export interface User {
  id: number;
  name: string;
  email: string;
  role: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: User;
  token: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private baseUrl = `${environment.apiUrl}/auth`;
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  private tokenSubject = new BehaviorSubject<string | null>(null);

  public currentUser$ = this.currentUserSubject.asObservable();
  public token$ = this.tokenSubject.asObservable();

  constructor(
    private http: HttpClient,
    private router: Router
  ) {
    // Verificar si hay token guardado al inicializar
    this.loadStoredAuth();
  }

  login(credentials: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.baseUrl}/login`, credentials)
      .pipe(
        tap(response => {
          this.setAuth(response.user, response.token);
        })
      );
  }

  logout(): void {
    this.clearAuth();
    this.router.navigate(['/sign-in']);
  }

  isAuthenticated(): boolean {
    return !!this.tokenSubject.value;
  }

  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  getToken(): string | null {
    return this.tokenSubject.value;
  }

  hasRole(role: string): boolean {
    const user = this.getCurrentUser();
    return user?.role === role;
  }

  hasAnyRole(roles: string[]): boolean {
    const user = this.getCurrentUser();
    return user ? roles.includes(user.role) : false;
  }

  private setAuth(user: User, token: string): void {
    this.currentUserSubject.next(user);
    this.tokenSubject.next(token);
    
    // Guardar en localStorage
    localStorage.setItem('auth_token', token);
    localStorage.setItem('current_user', JSON.stringify(user));
  }

  private clearAuth(): void {
    this.currentUserSubject.next(null);
    this.tokenSubject.next(null);
    
    // Limpiar localStorage
    localStorage.removeItem('auth_token');
    localStorage.removeItem('current_user');
  }

  private loadStoredAuth(): void {
    const token = localStorage.getItem('auth_token');
    const userStr = localStorage.getItem('current_user');
    
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        this.tokenSubject.next(token);
        this.currentUserSubject.next(user);
      } catch (error) {
        console.error('Error parsing stored user:', error);
        this.clearAuth();
      }
    }
  }

  // Métodos para verificar permisos específicos del sistema de estacionamientos
  canManageSessions(): boolean {
    return this.hasAnyRole(['admin', 'operator', 'supervisor']);
  }

  canManagePayments(): boolean {
    return this.hasAnyRole(['admin', 'cashier', 'supervisor']);
  }

  canManageDebts(): boolean {
    return this.hasAnyRole(['admin', 'supervisor']);
  }

  canManageSectors(): boolean {
    return this.hasAnyRole(['admin', 'supervisor']);
  }

  canManageOperators(): boolean {
    return this.hasAnyRole(['admin', 'supervisor']);
  }

  canViewReports(): boolean {
    return this.hasAnyRole(['admin', 'supervisor', 'manager']);
  }

  canManageSettings(): boolean {
    return this.hasRole('admin');
  }
}

