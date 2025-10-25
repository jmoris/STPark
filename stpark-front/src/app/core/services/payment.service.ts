import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'environments/environment';
import {
  Payment,
  PaymentRequest,
  WebpayWebhookRequest,
  PaymentFilters,
  ApiResponse,
  PaginatedResponse
} from 'app/interfaces/parking.interface';

@Injectable({
  providedIn: 'root'
})
export class PaymentService {
  private baseUrl = `${environment.apiUrl}/payments`;

  constructor(private http: HttpClient) {}

  /**
   * Procesar pago desde caja
   */
  processPayment(request: PaymentRequest): Observable<ApiResponse<Payment>> {
    return this.http.post<ApiResponse<Payment>>(this.baseUrl, request);
  }

  /**
   * Crear pago para una sesión
   */
  createPayment(paymentData: any): Observable<ApiResponse<Payment>> {
    return this.http.post<ApiResponse<Payment>>(this.baseUrl, paymentData);
  }

  /**
   * Webhook para pagos de Webpay
   */
  processWebpayWebhook(request: WebpayWebhookRequest): Observable<ApiResponse<Payment>> {
    return this.http.post<ApiResponse<Payment>>(`${this.baseUrl}/webhook`, request);
  }

  /**
   * Listar pagos con filtros
   */
  getPayments(filters: PaymentFilters = {}): Observable<ApiResponse<PaginatedResponse<Payment>>> {
    let params = new HttpParams();
    
    Object.keys(filters).forEach(key => {
      const value = filters[key as keyof PaymentFilters];
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, value.toString());
      }
    });

    return this.http.get<ApiResponse<PaginatedResponse<Payment>>>(this.baseUrl, { params });
  }

  /**
   * Obtener pago por ID
   */
  getPayment(paymentId: number): Observable<ApiResponse<Payment>> {
    return this.http.get<ApiResponse<Payment>>(`${this.baseUrl}/${paymentId}`);
  }

  /**
   * Obtener resumen de pagos por operador
   */
  getOperatorSummary(operatorId: number, dateFrom: string, dateTo: string): Observable<ApiResponse<any>> {
    const params = new HttpParams()
      .set('operator_id', operatorId.toString())
      .set('date_from', dateFrom)
      .set('date_to', dateTo);

    return this.http.get<ApiResponse<any>>(`${this.baseUrl}/summary-by-operator`, { params });
  }

  /**
   * Obtener pagos del día
   */
  getTodayPayments(operatorId?: number): Observable<ApiResponse<Payment[]>> {
    const today = new Date().toISOString().split('T')[0];
    const filters: PaymentFilters = {
      date_from: today,
      date_to: today,
      operator_id: operatorId
    };
    
    return new Observable(observer => {
      this.getPayments(filters).subscribe({
        next: (response) => {
          observer.next({
            success: response.success,
            data: response.data.data || [],
            message: response.message
          });
          observer.complete();
        },
        error: (error) => {
          observer.error(error);
        }
      });
    });
  }

  /**
   * Obtener pagos por sesión
   */
  getPaymentsBySession(sessionId: number): Observable<ApiResponse<Payment[]>> {
    const filters: PaymentFilters = {
      session_id: sessionId
    };
    
    return new Observable(observer => {
      this.getPayments(filters).subscribe({
        next: (response) => {
          observer.next({
            success: response.success,
            data: response.data.data || [],
            message: response.message
          });
          observer.complete();
        },
        error: (error) => {
          observer.error(error);
        }
      });
    });
  }

  /**
   * Obtener pagos por venta
   */
  getPaymentsBySale(saleId: number): Observable<ApiResponse<Payment[]>> {
    const filters: PaymentFilters = {
      sale_id: saleId
    };
    
    return new Observable(observer => {
      this.getPayments(filters).subscribe({
        next: (response) => {
          observer.next({
            success: response.success,
            data: response.data.data || [],
            message: response.message
          });
          observer.complete();
        },
        error: (error) => {
          observer.error(error);
        }
      });
    });
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
   * Obtener etiqueta del método de pago
   */
  getPaymentMethodLabel(method: string): string {
    const methodLabels: Record<string, string> = {
      'CASH': 'Efectivo',
      'CARD': 'Tarjeta',
      'WEBPAY': 'Webpay',
      'TRANSFER': 'Transferencia'
    };
    
    return methodLabels[method] || method;
  }

  /**
   * Obtener color para método de pago
   */
  getPaymentMethodColor(method: string): string {
    const methodColors: Record<string, string> = {
      'CASH': 'green',
      'CARD': 'blue',
      'WEBPAY': 'purple',
      'TRANSFER': 'orange'
    };
    
    return methodColors[method] || 'gray';
  }

  /**
   * Obtener etiqueta del estado de pago
   */
  getPaymentStatusLabel(status: string): string {
    const statusLabels: Record<string, string> = {
      'PENDING': 'Pendiente',
      'COMPLETED': 'Completado',
      'FAILED': 'Fallido',
      'CANCELLED': 'Cancelado'
    };
    
    return statusLabels[status] || status;
  }

  /**
   * Obtener color para estado de pago
   */
  getPaymentStatusColor(status: string): string {
    const statusColors: Record<string, string> = {
      'PENDING': 'orange',
      'COMPLETED': 'green',
      'FAILED': 'red',
      'CANCELLED': 'gray'
    };
    
    return statusColors[status] || 'gray';
  }

  /**
   * Verificar si el pago está completado
   */
  isPaymentCompleted(status: string): boolean {
    return status === 'COMPLETED';
  }

  /**
   * Verificar si el pago está pendiente
   */
  isPaymentPending(status: string): boolean {
    return status === 'PENDING';
  }

  /**
   * Verificar si el pago falló
   */
  isPaymentFailed(status: string): boolean {
    return status === 'FAILED';
  }

  /**
   * Obtener icono para método de pago
   */
  getPaymentMethodIcon(method: string): string {
    const methodIcons: Record<string, string> = {
      'CASH': 'heroicons_solid:currency-dollar',
      'CARD': 'heroicons_solid:credit-card',
      'WEBPAY': 'heroicons_solid:globe-alt',
      'TRANSFER': 'heroicons_solid:arrow-right-left'
    };
    
    return methodIcons[method] || 'heroicons_solid:question-mark-circle';
  }

  /**
   * Calcular total de pagos
   */
  calculateTotal(payments: Payment[]): number {
    return payments
      .filter(payment => payment.status === 'COMPLETED')
      .reduce((total, payment) => total + payment.amount, 0);
  }

  /**
   * Agrupar pagos por método
   */
  groupPaymentsByMethod(payments: Payment[]): Record<string, Payment[]> {
    return payments.reduce((groups, payment) => {
      const method = payment.method;
      if (!groups[method]) {
        groups[method] = [];
      }
      groups[method].push(payment);
      return groups;
    }, {} as Record<string, Payment[]>);
  }

  /**
   * Agrupar pagos por estado
   */
  groupPaymentsByStatus(payments: Payment[]): Record<string, Payment[]> {
    return payments.reduce((groups, payment) => {
      const status = payment.status;
      if (!groups[status]) {
        groups[status] = [];
      }
      groups[status].push(payment);
      return groups;
    }, {} as Record<string, Payment[]>);
  }
}

