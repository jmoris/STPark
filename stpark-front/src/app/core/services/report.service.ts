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
   * Exportar datos a CSV
   */
  exportToCSV(data: any[], filename: string): void {
    if (!data || data.length === 0) {
      console.warn('No data to export');
      return;
    }

    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(header => `"${row[header] || ''}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}