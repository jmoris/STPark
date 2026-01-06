import { Component, Inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Subject, takeUntil } from 'rxjs';

import { CarWashService } from 'app/core/services/car-wash.service';
import { CarWash, CarWashStatus } from 'app/interfaces/car-wash.interface';
import { ShiftService } from 'app/core/services/shift.service';
import { AuthService } from 'app/core/services/auth.service';

export interface CarWashPaymentModalData {
  carWash: CarWash;
}

@Component({
  selector: 'app-car-wash-payment-modal',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    MatSnackBarModule
  ],
  templateUrl: './car-wash-payment-modal.component.html',
  styleUrls: ['./car-wash-payment-modal.component.scss']
})
export class CarWashPaymentModalComponent implements OnInit, OnDestroy {
  private _unsubscribeAll: Subject<any> = new Subject<any>();

  paymentForm: FormGroup;
  processing = false;
  carWash: CarWash;

  constructor(
    private dialogRef: MatDialogRef<CarWashPaymentModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: CarWashPaymentModalData,
    private fb: FormBuilder,
    private carWashService: CarWashService,
    private shiftService: ShiftService,
    private authService: AuthService,
    private snackBar: MatSnackBar
  ) {
    this.carWash = data.carWash;
    this.paymentForm = this.createForm();
  }

  ngOnInit(): void {
    this.onPaymentMethodChange();
  }

  ngOnDestroy(): void {
    this._unsubscribeAll.next(null);
    this._unsubscribeAll.complete();
  }

  private createForm(): FormGroup {
    return this.fb.group({
      payment_method: ['CASH', Validators.required],
      amount: ['', [Validators.required, Validators.min(0.01)]],
      approval_code: ['']
    });
  }

  onPaymentMethodChange(): void {
    const paymentMethod = this.paymentForm.get('payment_method')?.value;
    const washAmount = this.carWash.amount || 0;

    if (paymentMethod === 'CASH') {
      // Efectivo: campo editable, iniciar vacío
      this.paymentForm.patchValue({ amount: '' });
      this.paymentForm.get('amount')?.enable();
      this.paymentForm.get('approval_code')?.clearValidators();
      this.paymentForm.get('approval_code')?.updateValueAndValidity();
    } else if (paymentMethod === 'TRANSFER') {
      // Transferencia: campo readonly con monto exacto
      this.paymentForm.patchValue({ amount: washAmount });
      this.paymentForm.get('amount')?.disable();
      this.paymentForm.get('approval_code')?.clearValidators();
      this.paymentForm.get('approval_code')?.updateValueAndValidity();
    } else if (paymentMethod === 'CARD') {
      // Tarjeta: campo readonly con monto exacto, código de autorización opcional
      this.paymentForm.patchValue({ amount: washAmount });
      this.paymentForm.get('amount')?.disable();
      this.paymentForm.get('approval_code')?.clearValidators();
      this.paymentForm.get('approval_code')?.updateValueAndValidity();
    }
  }

  isAmountFieldDisabled(): boolean {
    const paymentMethod = this.paymentForm.get('payment_method')?.value;
    return paymentMethod !== 'CASH';
  }

  shouldShowChange(): boolean {
    const paymentMethod = this.paymentForm.get('payment_method')?.value;
    if (paymentMethod !== 'CASH') return false;

    const amountValue = this.paymentForm.get('amount')?.value;
    const amount = this.parseAmount(amountValue);
    const washAmount = this.carWash.amount || 0;
    return amount > washAmount;
  }

  calculateChange(): number {
    const amountValue = this.paymentForm.get('amount')?.value;
    const amount = this.parseAmount(amountValue);
    const washAmount = this.carWash.amount || 0;
    return amount - washAmount;
  }

  private parseAmount(value: any): number {
    if (value === '' || value === null || value === undefined) return 0;
    return typeof value === 'string' ? parseFloat(value) || 0 : Number(value) || 0;
  }

  formatAmount(amount: number): string {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount || 0);
  }

  onSubmit(): void {
    if (this.paymentForm.invalid) {
      this.paymentForm.markAllAsTouched();
      return;
    }

    this.processing = true;

    const formData = this.paymentForm.value;
    const paymentMethod = formData.payment_method;
    const amountValue = formData.amount;
    
    // Para efectivo, usar el monto ingresado; para otros métodos, usar el monto del lavado
    const amountToPay = paymentMethod === 'CASH' ? this.parseAmount(amountValue) : (this.carWash.amount || 0);

    // Obtener operador actual (del usuario autenticado)
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser || !currentUser.id) {
      this.snackBar.open('No se pudo obtener el operador actual', 'Cerrar', { duration: 3000 });
      this.processing = false;
      return;
    }

    const operatorId = currentUser.id;

    // Obtener turno actual del operador
    this.shiftService.getCurrentShift(operatorId)
      .pipe(takeUntil(this._unsubscribeAll))
      .subscribe({
        next: (shiftResponse) => {
          const shiftId = shiftResponse.data?.shift?.id || null;

          const updateData: any = {
            status: 'PAID' as CarWashStatus,
            cashier_operator_id: operatorId,
            approval_code: paymentMethod === 'CARD' ? (formData.approval_code || null) : null
          };

          if (shiftId) {
            updateData.shift_id = shiftId;
          }

          this.carWashService.updateCarWash(this.carWash.id!, updateData)
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe({
              next: (response) => {
                this.processing = false;
                if (response.success) {
                  this.snackBar.open('Pago procesado exitosamente', 'Cerrar', { duration: 3000 });
                  this.dialogRef.close({ success: true, data: response.data });
                } else {
                  this.snackBar.open(response.message || 'Error al procesar el pago', 'Cerrar', { duration: 3000 });
                }
              },
              error: (error) => {
                this.processing = false;
                console.error('Error processing payment:', error);
                const errorMessage = error.error?.message || 'Error al procesar el pago';
                this.snackBar.open(errorMessage, 'Cerrar', { duration: 3000 });
              }
            });
        },
        error: (error) => {
          this.processing = false;
          console.error('Error getting current shift:', error);
          this.snackBar.open('Error al obtener el turno actual', 'Cerrar', { duration: 3000 });
        }
      });
  }

  onClose(): void {
    this.dialogRef.close({ success: false });
  }
}

