import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { Debt } from 'app/interfaces/parking.interface';

@Component({
  selector: 'app-debt-alert-modal',
  standalone: true,
  imports: [
    CommonModule,
    DialogModule,
    ButtonModule
  ],
  templateUrl: './debt-alert-modal.component.html',
  styleUrls: ['./debt-alert-modal.component.scss']
})
export class DebtAlertModalComponent {
  @Input() visible: boolean = false;
  @Input() debts: Debt[] = [];
  @Input() plate: string = '';
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() payDebts = new EventEmitter<void>();
  @Output() continueWithoutPayment = new EventEmitter<void>();

  closeModal(): void {
    this.visible = false;
    this.visibleChange.emit(false);
  }

  onPayDebts(): void {
    this.payDebts.emit();
    this.closeModal();
  }

  onContinueWithoutPayment(): void {
    this.continueWithoutPayment.emit();
    this.closeModal();
  }

  formatAmount(amount: number): string {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount).replace('CLP', '$');
  }

  getTotalDebtAmount(): number {
    return this.debts.reduce((total, debt) => total + debt.principal_amount, 0);
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

  getDebtAge(debt: Debt): string {
    const createdDate = new Date(debt.created_at!);
    const today = new Date();
    const diffTime = Math.abs(today.getTime() - createdDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Hoy';
    if (diffDays === 1) return 'Ayer';
    if (diffDays < 7) return `${diffDays} días`;
    if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7);
      return `${weeks} semana${weeks > 1 ? 's' : ''}`;
    }
    const months = Math.floor(diffDays / 30);
    return `${months} mes${months > 1 ? 'es' : ''}`;
  }
}
