import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiResponse } from '../../interfaces/parking.interface';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ReportService {
  private baseUrl = `${environment.apiUrl}/reports`;

  constructor(private http: HttpClient) {}

  /**
   * Obtener datos del dashboard
   */
  getDashboard(date?: string): Observable<ApiResponse<any>> {
    const params: any = {};
    if (date) {
      params.date = date;
    }
    return this.http.get<ApiResponse<any>>(`${this.baseUrl}/dashboard`, { params });
  }

  /**
   * Obtener reporte de ventas
   */
  getSalesReport(filters: any = {}): Observable<ApiResponse<any>> {
    return this.http.get<ApiResponse<any>>(`${this.baseUrl}/sales`, { params: filters });
  }

  /**
   * Obtener reporte de pagos
   */
  getPaymentsReport(filters: any = {}): Observable<ApiResponse<any>> {
    return this.http.get<ApiResponse<any>>(`${this.baseUrl}/payments`, { params: filters });
  }

  /**
   * Obtener reporte de deudas
   */
  getDebtsReport(filters: any = {}): Observable<ApiResponse<any>> {
    return this.http.get<ApiResponse<any>>(`${this.baseUrl}/debts`, { params: filters });
  }

  /**
   * Obtener reporte por operador
   */
  getOperatorReport(filters: any = {}): Observable<ApiResponse<any>> {
    return this.http.get<ApiResponse<any>>(`${this.baseUrl}/operator`, { params: filters });
  }

  /**
   * Obtener reporte de sesiones
   */
  getSessionsReport(filters: any = {}): Observable<ApiResponse<any>> {
    return this.http.get<ApiResponse<any>>(`${this.baseUrl}/sessions`, { params: filters });
  }

  /**
   * Formatear cantidad de dinero
   */
  formatAmount(amount: number): string {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0
    }).format(amount);
  }

  /**
   * Formatear fecha
   */
  formatDate(date: string | Date): string {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return new Intl.DateTimeFormat('es-CL', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(dateObj);
  }

  /**
   * Exportar datos a CSV con formato mejorado
   */
  exportToCSV(data: any[], filename: string): void {
    if (!data || data.length === 0) {
      console.warn('No data to export');
      return;
    }

    // Convertir datos complejos a formato CSV
    const headers = ['ID', 'Placa', 'Sector', 'Operador', 'Fecha Inicio', 'Fecha Fin', 'Duración', 'Monto Total', 'Método de Pago'];
    const rows = data.map((item: any) => {
      const paymentMethod = item.payments && item.payments.length > 0 
        ? item.payments.map((p: any) => `${p.method}: $${p.amount}`).join(', ')
        : 'Sin pago';
      
      return [
        item.id || '',
        item.plate || '',
        item.sector || 'N/A',
        item.operator || 'N/A',
        item.started_at ? new Date(item.started_at).toLocaleString('es-CL') : '',
        item.ended_at ? new Date(item.ended_at).toLocaleString('es-CL') : '',
        item.duration_formatted || `${item.duration_minutes}m`,
        `$${this.formatNumber(item.amount || 0)}`,
        paymentMethod
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /**
   * Formatear número sin decimales
   */
  formatNumber(num: number): string {
    return new Intl.NumberFormat('es-CL', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(num);
  }
}