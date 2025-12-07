import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';
import { Invoice } from 'app/interfaces/parking.interface';

export interface InvoicePaymentData {
  invoice: Invoice;
}

export type PaymentMethod = 'CASH' | 'TRANSFER' | 'CARD';

@Component({
  selector: 'app-invoice-payment',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatDatepickerModule,
    MatIconModule
  ],
  templateUrl: './invoice-payment.component.html',
  styleUrls: ['./invoice-payment.component.scss']
})
export class InvoicePaymentComponent implements OnInit {
  paymentMethod: PaymentMethod = 'CASH';
  paymentDate: string = new Date().toISOString().split('T')[0];
  reference: string = '';
  notes: string = '';

  constructor(
    public dialogRef: MatDialogRef<InvoicePaymentComponent>,
    @Inject(MAT_DIALOG_DATA) public data: InvoicePaymentData
  ) {}

  ngOnInit(): void {
    // La fecha de pago por defecto es hoy
  }

  getPaymentMethodLabel(method: PaymentMethod): string {
    const labels: Record<PaymentMethod, string> = {
      'CASH': 'Efectivo',
      'TRANSFER': 'Transferencia',
      'CARD': 'Tarjeta'
    };
    return labels[method];
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  onConfirm(): void {
    if (!this.paymentMethod || !this.paymentDate) {
      return;
    }

    this.dialogRef.close({
      paymentMethod: this.paymentMethod,
      paymentDate: this.paymentDate,
      reference: this.reference,
      notes: this.notes
    });
  }

  formatAmount(amount: number): string {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  }
}

