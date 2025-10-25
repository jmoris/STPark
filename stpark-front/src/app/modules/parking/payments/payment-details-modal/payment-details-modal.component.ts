import { Component, Input, Output, EventEmitter, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { Payment } from 'app/interfaces/parking.interface';

@Component({
  selector: 'app-payment-details-modal',
  standalone: true,
  imports: [
    CommonModule,
    DialogModule,
    ButtonModule
  ],
  templateUrl: './payment-details-modal.component.html',
  styleUrls: ['./payment-details-modal.component.scss']
})
export class PaymentDetailsModalComponent implements OnChanges {
  @Input() visible: boolean = false;
  @Input() payment: Payment | null = null;
  @Output() visibleChange = new EventEmitter<boolean>();

  ngOnChanges(): void {
    // Component ready
  }

  closeModal(): void {
    this.visible = false;
    this.visibleChange.emit(false);
  }

  formatAmount(amount: number): string {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount).replace('CLP', '$');
  }

  getStatusText(status: string): string {
    switch (status) {
      case 'COMPLETED': return 'Completado';
      case 'PENDING': return 'Pendiente';
      case 'FAILED': return 'Fallido';
      case 'REFUNDED': return 'Reembolsado';
      default: return status;
    }
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'COMPLETED': return 'green';
      case 'PENDING': return 'orange';
      case 'FAILED': return 'red';
      case 'REFUNDED': return 'blue';
      default: return 'gray';
    }
  }

  getMethodText(method: string): string {
    switch (method) {
      case 'CASH': return 'Efectivo';
      case 'CARD': return 'Tarjeta';
      case 'WEBPAY': return 'Webpay';
      case 'TRANSFER': return 'Transferencia';
      default: return method;
    }
  }

  getMethodIcon(method: string): string {
    switch (method) {
      case 'CASH': return 'pi-money-bill';
      case 'CARD': return 'pi-credit-card';
      case 'WEBPAY': return 'pi-globe';
      case 'TRANSFER': return 'pi-send';
      default: return 'pi-money-bill';
    }
  }

  getSessionDuration(session: any): string | null {
    if (!session || !session.started_at || !session.ended_at) {
      return null;
    }

    const startTime = new Date(session.started_at);
    const endTime = new Date(session.ended_at);
    const diffMs = endTime.getTime() - startTime.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    
    if (diffMinutes < 60) {
      return `${diffMinutes} minutos`;
    }
    
    const hours = Math.floor(diffMinutes / 60);
    const minutes = diffMinutes % 60;
    
    if (minutes === 0) {
      return `${hours} hora${hours > 1 ? 's' : ''}`;
    }
    
    return `${hours}h ${minutes}m`;
  }

  getSessionStatusText(status: string): string {
    switch (status) {
      case 'CREATED': return 'Creada';
      case 'ACTIVE': return 'Activa';
      case 'TO_PAY': return 'Por Pagar';
      case 'PAID': return 'Pagada';
      case 'CLOSED': return 'Cerrada';
      case 'CANCELED': return 'Cancelada';
      default: return status;
    }
  }

  printReceipt(): void {
    if (!this.payment) return;
    
    // Crear una ventana de impresión con los detalles del pago
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      const receiptHtml = this.generateReceiptHtml();
      printWindow.document.write(receiptHtml);
      printWindow.document.close();
      printWindow.print();
    }
  }

  private generateReceiptHtml(): string {
    if (!this.payment) return '';
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Recibo de Pago - ${this.payment.id}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .header { text-align: center; margin-bottom: 30px; }
          .receipt-title { font-size: 24px; font-weight: bold; margin-bottom: 10px; }
          .receipt-info { font-size: 14px; color: #666; }
          .section { margin-bottom: 20px; }
          .section-title { font-size: 16px; font-weight: bold; margin-bottom: 10px; border-bottom: 1px solid #ccc; }
          .detail-row { display: flex; justify-content: space-between; margin-bottom: 5px; }
          .detail-label { font-weight: bold; }
          .amount { font-size: 18px; font-weight: bold; color: #059669; }
          .footer { margin-top: 30px; text-align: center; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="receipt-title">RECIBO DE PAGO</div>
          <div class="receipt-info">STPark - Sistema de Estacionamientos</div>
        </div>
        
        <div class="section">
          <div class="section-title">Información del Pago</div>
          <div class="detail-row">
            <span class="detail-label">ID de Pago:</span>
            <span>${this.payment.id}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Monto:</span>
            <span class="amount">${this.formatAmount(this.payment.amount)}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Método:</span>
            <span>${this.getMethodText(this.payment.method)}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Estado:</span>
            <span>${this.getStatusText(this.payment.status)}</span>
          </div>
          ${this.payment.transaction_id ? `
          <div class="detail-row">
            <span class="detail-label">ID Transacción:</span>
            <span>${this.payment.transaction_id}</span>
          </div>
          ` : ''}
        </div>
        
        ${this.payment.parking_session ? `
        <div class="section">
          <div class="section-title">Información de la Sesión</div>
          <div class="detail-row">
            <span class="detail-label">Patente:</span>
            <span>${this.payment.parking_session.plate}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Inicio:</span>
            <span>${new Date(this.payment.parking_session.started_at).toLocaleString('es-CL')}</span>
          </div>
          ${this.payment.parking_session.ended_at ? `
          <div class="detail-row">
            <span class="detail-label">Fin:</span>
            <span>${new Date(this.payment.parking_session.ended_at).toLocaleString('es-CL')}</span>
          </div>
          ` : ''}
          ${this.getSessionDuration(this.payment.parking_session) ? `
          <div class="detail-row">
            <span class="detail-label">Duración:</span>
            <span>${this.getSessionDuration(this.payment.parking_session)}</span>
          </div>
          ` : ''}
        </div>
        ` : ''}
        
        <div class="footer">
          <div>Fecha de impresión: ${new Date().toLocaleString('es-CL')}</div>
          <div>Gracias por usar STPark</div>
        </div>
      </body>
      </html>
    `;
  }
}
