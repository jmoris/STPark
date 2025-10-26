import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Router } from '@angular/router';
import { environment } from 'environments/environment';

export interface Tenant {
  id: string;
  name: string;
  domains: string[];
}

export interface User {
  id: number;
  name: string;
  email: string;
  role?: string;
  avatar?: string;
  status?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  message: string;
  data: {
    user: User;
    tenants: Tenant[];
    token: string;
  };
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private baseUrl = `${environment.authApiUrl}/api/auth`;
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  private tokenSubject = new BehaviorSubject<string | null>(null);
  private tenantsSubject = new BehaviorSubject<Tenant[]>([]);
  private currentTenantSubject = new BehaviorSubject<Tenant | null>(null);

  public currentUser$ = this.currentUserSubject.asObservable();
  public token$ = this.tokenSubject.asObservable();
  public tenants$ = this.tenantsSubject.asObservable();
  public currentTenant$ = this.currentTenantSubject.asObservable();

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
          console.log('Login response:', response);
          if (response.success) {
            console.log('Setting auth for user:', response.data.user);
            console.log('Tenants received:', response.data.tenants);
            this.setAuth(
              response.data.user, 
              response.data.token, 
              response.data.tenants
            );
            console.log('Auth set successfully. Current tenant:', this.getCurrentTenant());
          }
        })
      );
  }

  logout(): void {
    console.log('Logging out...');
    this.clearAuth();
    // Limpiar también el accessToken del sistema anterior si existe
    localStorage.removeItem('accessToken');
    console.log('Auth data cleared');
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

  getTenants(): Tenant[] {
    return this.tenantsSubject.value;
  }

  getCurrentTenant(): Tenant | null {
    return this.currentTenantSubject.value;
  }

  setCurrentTenant(tenant: Tenant | null): void {
    this.currentTenantSubject.next(tenant);
    if (tenant) {
      localStorage.setItem('current_tenant', JSON.stringify(tenant));
    } else {
      localStorage.removeItem('current_tenant');
    }
  }

  private setAuth(user: User, token: string, tenants: Tenant[]): void {
    console.log('setAuth called with:', { user, tenants });
    this.currentUserSubject.next(user);
    this.tokenSubject.next(token);
    this.tenantsSubject.next(tenants);
    
    // Si hay tenants, establecer el primero como default
    if (tenants && tenants.length > 0) {
      console.log('Setting first tenant:', tenants[0]);
      this.setCurrentTenant(tenants[0]);
    }
    
    // Guardar en localStorage
    localStorage.setItem('auth_token', token);
    localStorage.setItem('current_user', JSON.stringify(user));
    localStorage.setItem('tenants', JSON.stringify(tenants));
    
    console.log('Current tenant after setAuth:', this.getCurrentTenant());
  }

  private clearAuth(): void {
    this.currentUserSubject.next(null);
    this.tokenSubject.next(null);
    this.tenantsSubject.next([]);
    this.currentTenantSubject.next(null);
    
    // Limpiar localStorage
    localStorage.removeItem('auth_token');
    localStorage.removeItem('current_user');
    localStorage.removeItem('tenants');
    localStorage.removeItem('current_tenant');
  }

  private loadStoredAuth(): void {
    // Limpiar tokens viejos del sistema anterior
    const oldToken = localStorage.getItem('accessToken');
    if (oldToken) {
      console.log('Clearing old accessToken from previous auth system');
      localStorage.removeItem('accessToken');
    }
    
    const token = localStorage.getItem('auth_token');
    const userStr = localStorage.getItem('current_user');
    const tenantsStr = localStorage.getItem('tenants');
    const tenantStr = localStorage.getItem('current_tenant');
    
    console.log('Loading stored auth data:', { hasToken: !!token, hasUser: !!userStr });
    
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        this.tokenSubject.next(token);
        this.currentUserSubject.next(user);
        
        if (tenantsStr) {
          const tenants = JSON.parse(tenantsStr);
          this.tenantsSubject.next(tenants);
          
          if (tenantStr) {
            this.currentTenantSubject.next(JSON.parse(tenantStr));
          }
        }
        console.log('Stored auth data loaded successfully');
      } catch (error) {
        console.error('Error parsing stored user:', error);
        this.clearAuth();
      }
    } else {
      console.log('No stored auth data found');
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

