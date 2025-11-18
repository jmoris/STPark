import { Component, Inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';

import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

import { ParkingSessionService } from 'app/core/services/parking-session.service';
import { ParkingSession } from 'app/interfaces/parking.interface';

export interface CheckoutModalData {
  session: ParkingSession;
  quote?: any;
}

@Component({
  selector: 'app-checkout-modal',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    MatSnackBarModule
  ],
  templateUrl: './checkout-modal.component.html',
  styleUrls: ['./checkout-modal.component.scss']
})
export class CheckoutModalComponent implements OnInit, OnDestroy {
  private _unsubscribeAll: Subject<any> = new Subject<any>();

  session: ParkingSession;
  quote: any = null;
  checkoutForm: FormGroup;
  processing = false;

  constructor(
    public dialogRef: MatDialogRef<CheckoutModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: CheckoutModalData,
    private fb: FormBuilder,
    private sessionService: ParkingSessionService,
    private snackBar: MatSnackBar
  ) {
    this.session = data.session;
    this.quote = data.quote;
    this.checkoutForm = this.createForm();
  }

  ngOnInit(): void {
    // Si no se pasó la cotización, cargarla
    if (!this.quote) {
      this.loadQuote();
    } else {
      this.initializeForm();
    }
  }

  ngOnDestroy(): void {
    this._unsubscribeAll.next(null);
    this._unsubscribeAll.complete();
  }

  private createForm(): FormGroup {
    return this.fb.group({
      payment_method: ['CASH', Validators.required],
      amount: ['', [Validators.required, Validators.min(0)]],
      notes: ['']
    });
  }

  private initializeForm(): void {
    if (this.quote) {
      const paymentMethod = this.checkoutForm.get('payment_method')?.value;
      if (paymentMethod === 'CASH') {
        this.checkoutForm.patchValue({ amount: '' });
      } else {
        this.checkoutForm.patchValue({ amount: this.quote.net_amount });
      }
    }
  }

  private loadQuote(): void {
    if (!this.session) return;

    const endedAt = new Date().toISOString();
    this.sessionService.getQuote(this.session.id, { ended_at: endedAt })
      .pipe(takeUntil(this._unsubscribeAll))
      .subscribe({
        next: (response) => {
          this.quote = response.data;
          this.initializeForm();
        },
        error: (error) => {
          console.error('Error loading quote:', error);
          this.snackBar.open('Error al cargar la cotización', 'Cerrar', { duration: 3000 });
        }
      });
  }

  onPaymentMethodChange(): void {
    const paymentMethod = this.checkoutForm.get('payment_method')?.value;
    if (paymentMethod === 'CASH') {
      this.checkoutForm.patchValue({ amount: '' });
    } else {
      this.checkoutForm.patchValue({ amount: this.quote?.net_amount || 0 });
    }
  }

  isAmountFieldDisabled(): boolean {
    const paymentMethod = this.checkoutForm.get('payment_method')?.value;
    return paymentMethod !== 'CASH';
  }

  shouldShowChange(): boolean {
    const paymentMethod = this.checkoutForm.get('payment_method')?.value;
    const amountValue = this.checkoutForm.get('amount')?.value;
    const amount = amountValue === '' || amountValue === null || amountValue === undefined 
      ? 0 
      : (typeof amountValue === 'string' ? parseFloat(amountValue) || 0 : Number(amountValue) || 0);
    return paymentMethod === 'CASH' && amount > (this.quote?.net_amount || 0);
  }

  shouldShowMissingAmount(): boolean {
    const paymentMethod = this.checkoutForm.get('payment_method')?.value;
    const amountValue = this.checkoutForm.get('amount')?.value;
    const amount = amountValue === '' || amountValue === null || amountValue === undefined 
      ? 0 
      : (typeof amountValue === 'string' ? parseFloat(amountValue) || 0 : Number(amountValue) || 0);
    return paymentMethod === 'CASH' && amount < (this.quote?.net_amount || 0);
  }

  calculateChange(): number {
    const amountValue = this.checkoutForm.get('amount')?.value;
    const amount = amountValue === '' || amountValue === null || amountValue === undefined 
      ? 0 
      : (typeof amountValue === 'string' ? parseFloat(amountValue) || 0 : Number(amountValue) || 0);
    return amount - (this.quote?.net_amount || 0);
  }

  calculateAmountMissing(): number {
    const amountValue = this.checkoutForm.get('amount')?.value;
    const amount = amountValue === '' || amountValue === null || amountValue === undefined 
      ? 0 
      : (typeof amountValue === 'string' ? parseFloat(amountValue) || 0 : Number(amountValue) || 0);
    return (this.quote?.net_amount || 0) - amount;
  }

  formatAmount(amount: number): string {
    return this.sessionService.formatAmount(amount);
  }

  onSubmit(): void {
    if (this.checkoutForm.invalid || !this.quote) {
      return;
    }

    this.processing = true;

    const formData = this.checkoutForm.value;
    // Convertir amount vacío o string a número
    let amountValue = 0;
    if (formData.amount !== '' && formData.amount !== null && formData.amount !== undefined) {
      amountValue = typeof formData.amount === 'string' 
        ? parseFloat(formData.amount) || 0 
        : Number(formData.amount) || 0;
    }
    
    const paymentData = {
      amount: amountValue,
      payment_method: formData.payment_method,
      notes: formData.notes || null,
      operator_id: this.session.operator_in_id // Operador que cierra (mismo que abrió)
    };

    this.sessionService.checkoutSession(this.session.id, paymentData)
      .pipe(takeUntil(this._unsubscribeAll))
      .subscribe({
        next: (response) => {
          this.processing = false;
          this.snackBar.open('Pago procesado exitosamente', 'Cerrar', { duration: 3000 });
          this.dialogRef.close({ success: true, data: response.data });
        },
        error: (error) => {
          this.processing = false;
          console.error('Error processing payment:', error);
          this.snackBar.open('Error al procesar el pago', 'Cerrar', { duration: 3000 });
        }
      });
  }

  onClose(): void {
    this.dialogRef.close({ success: false });
  }
}