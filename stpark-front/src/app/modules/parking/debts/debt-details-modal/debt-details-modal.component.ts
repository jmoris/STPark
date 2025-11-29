import { Component, Input, Output, EventEmitter, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { Debt } from 'app/interfaces/parking.interface';

@Component({
  selector: 'app-debt-details-modal',
  standalone: true,
  imports: [
    CommonModule,
    DialogModule,
    ButtonModule
  ],
  templateUrl: './debt-details-modal.component.html',
  styleUrls: ['./debt-details-modal.component.scss']
})
export class DebtDetailsModalComponent implements OnChanges {
  @Input() visible: boolean = false;
  @Input() debt: Debt | null = null;
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

  formatDate(date: string | null | undefined): string {
    if (!date) {
      return 'N/A';
    }
    
    const dateObj = new Date(date);
    
    // Verificar si la fecha es válida
    if (isNaN(dateObj.getTime())) {
      return 'N/A';
    }
    
    const dateStr = dateObj.toLocaleDateString('es-CL', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
    });
    const timeStr = dateObj.toLocaleTimeString('es-CL', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
    return `${dateStr} ${timeStr}`;
  }

  getStatusText(status: string): string {
    switch (status) {
      case 'PENDING': return 'Pendiente';
      case 'SETTLED': return 'Liquidada';
      case 'CANCELLED': return 'Cancelada';
      default: return status;
    }
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'PENDING': return 'orange';
      case 'SETTLED': return 'green';
      case 'CANCELLED': return 'red';
      default: return 'gray';
    }
  }

  getOriginText(origin: string): string {
    switch (origin) {
      case 'SESSION': return 'Sesión de Estacionamiento';
      case 'FINE': return 'Multa';
      case 'MANUAL': return 'Manual';
      default: return origin;
    }
  }

  getOriginIcon(origin: string): string {
    switch (origin) {
      case 'SESSION': return 'pi-car';
      case 'FINE': return 'pi-exclamation-triangle';
      case 'MANUAL': return 'pi-user-edit';
      default: return 'pi-question-circle';
    }
  }

  printDebt(): void {
    if (!this.debt) return;
    
    // Crear una ventana de impresión con los detalles de la deuda
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      const receiptHtml = this.generateDebtReceiptHtml();
      printWindow.document.write(receiptHtml);
      printWindow.document.close();
      printWindow.print();
    }
  }

  private generateDebtReceiptHtml(): string {
    if (!this.debt) return '';
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Detalle de Deuda - ${this.debt.id}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .header { text-align: center; margin-bottom: 30px; }
          .receipt-title { font-size: 24px; font-weight: bold; margin-bottom: 10px; }
          .receipt-info { font-size: 14px; color: #666; }
          .section { margin-bottom: 20px; }
          .section-title { font-size: 16px; font-weight: bold; margin-bottom: 10px; border-bottom: 1px solid #ccc; }
          .detail-row { display: flex; justify-content: space-between; margin-bottom: 5px; }
          .detail-label { font-weight: bold; }
          .amount { font-size: 18px; font-weight: bold; color: #dc2626; }
          .footer { margin-top: 30px; text-align: center; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="receipt-title">DETALLE DE DEUDA</div>
          <div class="receipt-info">STPark - Sistema de Estacionamientos</div>
        </div>
        
        <div class="section">
          <div class="section-title">Información de la Deuda</div>
          <div class="detail-row">
            <span class="detail-label">ID de Deuda:</span>
            <span>${this.debt.id}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Placa:</span>
            <span>${this.debt.plate}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Monto:</span>
            <span class="amount">${this.formatAmount(this.debt.principal_amount)}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Origen:</span>
            <span>${this.getOriginText(this.debt.origin)}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Estado:</span>
            <span>${this.getStatusText(this.debt.status)}</span>
          </div>
        </div>
        
        ${this.debt.session_id ? `
        <div class="section">
          <div class="section-title">Información de la Sesión</div>
          <div class="detail-row">
            <span class="detail-label">ID de Sesión:</span>
            <span>${this.debt.session_id}</span>
          </div>
        </div>
        ` : ''}
        
        <div class="section">
          <div class="section-title">Información de Auditoría</div>
          <div class="detail-row">
            <span class="detail-label">Creada:</span>
            <span>${this.formatDate(this.debt.created_at)}</span>
          </div>
          ${this.debt.settled_at ? `
          <div class="detail-row">
            <span class="detail-label">Liquidada:</span>
            <span>${this.formatDate(this.debt.settled_at)}</span>
          </div>
          ` : ''}
        </div>
        
        <div class="footer">
          <div>Fecha de impresión: ${this.formatDate(new Date().toISOString())}</div>
          <div>Gracias por usar STPark</div>
        </div>
      </body>
      </html>
    `;
  }
}
