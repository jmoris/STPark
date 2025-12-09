import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'environments/environment';
import {
  Invoice,
  InvoiceFilters,
  ApiResponse,
  PaginatedResponse
} from 'app/interfaces/parking.interface';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class InvoiceService {
  // Todas las facturas están en la base de datos central
  // El backend filtra automáticamente según el contexto (tenant vs central admin)
  private baseUrlTenant = `${environment.apiUrl}/invoices`;
  private baseUrlCentral = `${environment.authApiUrl}/api/invoices`;

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  /**
   * Listar facturas con filtros
   * - Si está en modo Administración Central: obtiene todas las facturas del sistema
   * - Si está en modo tenant: obtiene solo las facturas del tenant actual
   * Ambas consultan la base de datos central pero con filtros diferentes
   */
  getInvoices(filters: InvoiceFilters = {}): Observable<ApiResponse<PaginatedResponse<Invoice>>> {
    let params = new HttpParams();
    
    Object.keys(filters).forEach(key => {
      const value = filters[key as keyof InvoiceFilters];
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, value.toString());
      }
    });

    // Determinar la URL según el modo
    const isCentralAdmin = this.authService.isCentralAdminMode();
    const url = isCentralAdmin ? this.baseUrlCentral : this.baseUrlTenant;

    return this.http.get<ApiResponse<PaginatedResponse<Invoice>>>(url, { params });
  }

  /**
   * Obtener factura por ID
   * El backend filtra automáticamente según el contexto
   */
  getInvoice(invoiceId: number): Observable<ApiResponse<Invoice>> {
    const isCentralAdmin = this.authService.isCentralAdminMode();
    const baseUrl = isCentralAdmin ? this.baseUrlCentral : this.baseUrlTenant;
    return this.http.get<ApiResponse<Invoice>>(`${baseUrl}/${invoiceId}`);
  }

  /**
   * Crear factura
   */
  createInvoice(invoice: Partial<Invoice>): Observable<ApiResponse<Invoice>> {
    const isCentralAdmin = this.authService.isCentralAdminMode();
    const baseUrl = isCentralAdmin ? this.baseUrlCentral : this.baseUrlTenant;
    return this.http.post<ApiResponse<Invoice>>(baseUrl, invoice);
  }

  /**
   * Actualizar factura
   */
  updateInvoice(invoiceId: number, invoice: Partial<Invoice>): Observable<ApiResponse<Invoice>> {
    const isCentralAdmin = this.authService.isCentralAdminMode();
    const baseUrl = isCentralAdmin ? this.baseUrlCentral : this.baseUrlTenant;
    return this.http.put<ApiResponse<Invoice>>(`${baseUrl}/${invoiceId}`, invoice);
  }

  /**
   * Eliminar factura
   */
  deleteInvoice(invoiceId: number): Observable<ApiResponse<void>> {
    const isCentralAdmin = this.authService.isCentralAdminMode();
    const baseUrl = isCentralAdmin ? this.baseUrlCentral : this.baseUrlTenant;
    return this.http.delete<ApiResponse<void>>(`${baseUrl}/${invoiceId}`);
  }

  /**
   * Registrar pago de factura
   * Solo disponible para administradores centrales
   */
  payInvoice(invoiceId: number, paymentData: {
    paymentMethod: string;
    paymentDate: string;
    reference?: string;
    notes?: string;
  }): Observable<ApiResponse<Invoice>> {
    const url = `${this.baseUrlCentral}/${invoiceId}/pay`;
    return this.http.post<ApiResponse<Invoice>>(url, paymentData);
  }

  /**
   * Iniciar pago de factura con WebPay Plus
   * Disponible para tenants
   */
  initiateWebPayPayment(invoiceId: number): Observable<ApiResponse<{token: string, url: string, buy_order: string}>> {
    const url = `${this.baseUrlTenant}/${invoiceId}/webpay/initiate`;
    return this.http.post<ApiResponse<{token: string, url: string, buy_order: string}>>(url, {});
  }

  /**
   * Formatear monto en pesos chilenos
   */
  formatAmount(amount: number): string {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  }

  /**
   * Formatear fecha
   */
  formatDate(date: string | null | undefined): string {
    if (!date) {
      return 'N/A';
    }
    
    const dateObj = new Date(date);
    
    if (isNaN(dateObj.getTime())) {
      return 'N/A';
    }
    
    return dateObj.toLocaleDateString('es-CL', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
    });
  }

  /**
   * Obtener facturas pendientes de revisión
   * Solo disponible para administradores centrales
   */
  getPendingInvoices(filters: InvoiceFilters = {}): Observable<ApiResponse<PaginatedResponse<Invoice>>> {
    let params = new HttpParams();
    
    Object.keys(filters).forEach(key => {
      const value = filters[key as keyof InvoiceFilters];
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, value.toString());
      }
    });

    const url = `${this.baseUrlCentral}/pending`;
    return this.http.get<ApiResponse<PaginatedResponse<Invoice>>>(url, { params });
  }

  /**
   * Aceptar factura pendiente de revisión
   * Solo disponible para administradores centrales
   */
  acceptInvoice(invoiceId: number): Observable<ApiResponse<Invoice>> {
    const url = `${this.baseUrlCentral}/${invoiceId}/accept`;
    return this.http.post<ApiResponse<Invoice>>(url, {});
  }

  /**
   * Rechazar factura pendiente de revisión
   * Solo disponible para administradores centrales
   */
  rejectInvoice(invoiceId: number, reason: string): Observable<ApiResponse<Invoice>> {
    const url = `${this.baseUrlCentral}/${invoiceId}/reject`;
    return this.http.post<ApiResponse<Invoice>>(url, { reason });
  }

  /**
   * Obtener etiqueta del estado de factura
   */
  getStatusLabel(status: string): string {
    const statusLabels: Record<string, string> = {
      'PENDING_REVIEW': 'Pendiente de Revisión',
      'UNPAID': 'Sin pago registrado',
      'PAID': 'Pago registrado',
      'OVERDUE': 'Factura vencida',
      'CANCELLED': 'Cancelada'
    };
    
    return statusLabels[status] || status;
  }

  /**
   * Obtener color para estado de factura
   */
  getStatusColor(status: string): string {
    const statusColors: Record<string, string> = {
      'PENDING_REVIEW': 'orange',
      'UNPAID': 'blue',
      'PAID': 'green',
      'OVERDUE': 'red',
      'CANCELLED': 'red'
    };
    
    return statusColors[status] || 'gray';
  }

  /**
   * Formatear RUT chileno
   */
  formatRut(rut: string): string {
    if (!rut) return '';
    
    // Remover puntos y guiones
    const cleanRut = rut.replace(/\./g, '').replace(/-/g, '');
    
    if (cleanRut.length < 2) return rut;
    
    // Separar número y dígito verificador
    const number = cleanRut.slice(0, -1);
    const dv = cleanRut.slice(-1).toUpperCase();
    
    // Formatear número con puntos
    const formattedNumber = number.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    
    return `${formattedNumber}-${dv}`;
  }
}




