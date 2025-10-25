import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { ParkingSession, QuoteResponse } from 'app/interfaces/parking.interface';

export interface PrintTicketResponse {
  success: boolean;
  message: string;
  printed: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class PrinterService {

  constructor() {}

  /**
   * Imprimir ticket de entrada
   */
  printEntryTicket(session: ParkingSession): Observable<PrintTicketResponse> {
    return new Observable(observer => {
      // Verificar si estamos en el móvil (React Native)
      if (this.isMobileApp()) {
        this.printEntryTicketMobile(session)
          .then(result => observer.next(result))
          .catch(error => observer.next({
            success: false,
            message: 'Error al imprimir: ' + error.message,
            printed: false
          }));
      } else {
        // En el navegador web, simular impresión
        observer.next({
          success: true,
          message: 'Ticket de entrada generado (modo web)',
          printed: false
        });
      }
    });
  }

  /**
   * Imprimir ticket de salida/pago
   */
  printExitTicket(session: ParkingSession, quote: QuoteResponse, paymentData: any): Observable<PrintTicketResponse> {
    return new Observable(observer => {
      if (this.isMobileApp()) {
        this.printExitTicketMobile(session, quote, paymentData)
          .then(result => observer.next(result))
          .catch(error => observer.next({
            success: false,
            message: 'Error al imprimir: ' + error.message,
            printed: false
          }));
      } else {
        // En el navegador web, simular impresión
        observer.next({
          success: true,
          message: 'Ticket de salida generado (modo web)',
          printed: false
        });
      }
    });
  }

  /**
   * Imprimir recibo de pago
   */
  printPaymentReceipt(session: ParkingSession, paymentData: any): Observable<PrintTicketResponse> {
    return new Observable(observer => {
      if (this.isMobileApp()) {
        this.printPaymentReceiptMobile(session, paymentData)
          .then(result => observer.next(result))
          .catch(error => observer.next({
            success: false,
            message: 'Error al imprimir: ' + error.message,
            printed: false
          }));
      } else {
        // En el navegador web, simular impresión
        observer.next({
          success: true,
          message: 'Recibo de pago generado (modo web)',
          printed: false
        });
      }
    });
  }

  /**
   * Verificar estado de la impresora
   */
  checkPrinterStatus(): Observable<{ connected: boolean; device_name?: string }> {
    return new Observable(observer => {
      if (this.isMobileApp()) {
        this.checkPrinterStatusMobile()
          .then(result => observer.next(result))
          .catch(error => observer.next({
            connected: false,
            device_name: undefined
          }));
      } else {
        observer.next({
          connected: false,
          device_name: undefined
        });
      }
    });
  }

  /**
   * Conectar a impresora
   */
  connectPrinter(): Observable<{ success: boolean; message: string }> {
    return new Observable(observer => {
      if (this.isMobileApp()) {
        this.connectPrinterMobile()
          .then(result => observer.next(result))
          .catch(error => observer.next({
            success: false,
            message: 'Error al conectar: ' + error.message
          }));
      } else {
        observer.next({
          success: false,
          message: 'No disponible en modo web'
        });
      }
    });
  }

  /**
   * Desconectar impresora
   */
  disconnectPrinter(): Observable<{ success: boolean; message: string }> {
    return new Observable(observer => {
      if (this.isMobileApp()) {
        this.disconnectPrinterMobile()
          .then(result => observer.next(result))
          .catch(error => observer.next({
            success: false,
            message: 'Error al desconectar: ' + error.message
          }));
      } else {
        observer.next({
          success: false,
          message: 'No disponible en modo web'
        });
      }
    });
  }

  /**
   * Verificar si estamos en la app móvil
   */
  private isMobileApp(): boolean {
    // Verificar si estamos en React Native
    return typeof (window as any).ReactNativeWebView !== 'undefined' || 
           typeof (window as any).ReactNative !== 'undefined' ||
           navigator.userAgent.includes('ReactNative');
  }

  /**
   * Imprimir ticket de entrada en móvil
   */
  private async printEntryTicketMobile(session: ParkingSession): Promise<PrintTicketResponse> {
    try {
      // Llamar al servicio de Bluetooth del móvil
      const result = await (window as any).bluetoothPrinterService.printParkingTicket({
        plate: session.plate,
        sector: session.sector?.name || 'N/A',
        street: session.street?.name || 'N/A',
        operator: session.operator?.name || 'N/A',
        time: this.formatDateTime(session.started_at),
        session_id: session.id
      });

      return {
        success: result,
        message: result ? 'Ticket de entrada impreso exitosamente' : 'Error al imprimir ticket de entrada',
        printed: result
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error al imprimir ticket de entrada: ' + error.message,
        printed: false
      };
    }
  }

  /**
   * Imprimir ticket de salida en móvil
   */
  private async printExitTicketMobile(session: ParkingSession, quote: QuoteResponse, paymentData: any): Promise<PrintTicketResponse> {
    try {
      const result = await (window as any).bluetoothPrinterService.printPaymentReceipt({
        plate: session.plate,
        sector: session.sector?.name || 'N/A',
        street: session.street?.name || 'N/A',
        operator: session.operator?.name || 'N/A',
        started_at: session.started_at,
        ended_at: session.ended_at,
        duration: this.calculateDuration(session.started_at, session.ended_at),
        total_amount: quote.net_amount,
        payment_method: paymentData.payment_method,
        amount_paid: paymentData.amount,
        change: paymentData.change || 0,
        session_id: session.id
      });

      return {
        success: result,
        message: result ? 'Ticket de salida impreso exitosamente' : 'Error al imprimir ticket de salida',
        printed: result
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error al imprimir ticket de salida: ' + error.message,
        printed: false
      };
    }
  }

  /**
   * Imprimir recibo de pago en móvil
   */
  private async printPaymentReceiptMobile(session: ParkingSession, paymentData: any): Promise<PrintTicketResponse> {
    try {
      const result = await (window as any).bluetoothPrinterService.printPaymentReceipt({
        plate: session.plate,
        amount: paymentData.amount,
        payment_method: paymentData.payment_method,
        payment_date: new Date().toISOString(),
        session_id: session.id
      });

      return {
        success: result,
        message: result ? 'Recibo de pago impreso exitosamente' : 'Error al imprimir recibo de pago',
        printed: result
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error al imprimir recibo de pago: ' + error.message,
        printed: false
      };
    }
  }

  /**
   * Verificar estado de impresora en móvil
   */
  private async checkPrinterStatusMobile(): Promise<{ connected: boolean; device_name?: string }> {
    try {
      const isConnected = await (window as any).bluetoothPrinterService.isConnected();
      const device = await (window as any).bluetoothPrinterService.getConnectedDevice();
      
      return {
        connected: isConnected,
        device_name: device?.device_name
      };
    } catch (error) {
      return {
        connected: false,
        device_name: undefined
      };
    }
  }

  /**
   * Conectar impresora en móvil
   */
  private async connectPrinterMobile(): Promise<{ success: boolean; message: string }> {
    try {
      // Por ahora, simular conexión exitosa
      return {
        success: true,
        message: 'Impresora conectada exitosamente'
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error al conectar impresora: ' + error.message
      };
    }
  }

  /**
   * Desconectar impresora en móvil
   */
  private async disconnectPrinterMobile(): Promise<{ success: boolean; message: string }> {
    try {
      const result = await (window as any).bluetoothPrinterService.disconnect();
      return {
        success: result,
        message: result ? 'Impresora desconectada exitosamente' : 'Error al desconectar impresora'
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error al desconectar impresora: ' + error.message
      };
    }
  }

  /**
   * Calcular duración en formato legible
   */
  private calculateDuration(startedAt: string, endedAt: string | null): string {
    if (!endedAt) return 'N/A';
    
    const start = new Date(startedAt);
    const end = new Date(endedAt);
    const diffMs = end.getTime() - start.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    
    if (diffMinutes < 60) {
      return `${diffMinutes} minutos`;
    } else {
      const hours = Math.floor(diffMinutes / 60);
      const minutes = diffMinutes % 60;
      return `${hours}h ${minutes}m`;
    }
  }

  /**
   * Formatear monto en pesos chilenos
   */
  formatAmount(amount: number): string {
    return `$${amount.toLocaleString('es-CL')}`;
  }

  /**
   * Formatear fecha y hora
   */
  formatDateTime(dateTime: string): string {
    return new Date(dateTime).toLocaleString('es-CL');
  }
}
