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
import { CarWashDiscountService, CarWashDiscount } from 'app/core/services/car-wash-discount.service';

export interface CarWashPaymentModalData {
  carWash?: CarWash;
  // Para crear un nuevo lavado desde el formulario
  newCarWashData?: {
    plate: string;
    car_wash_type_id: number;
  };
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
  calculating = false;
  availableDiscounts: CarWashDiscount[] = [];
  selectedDiscount: CarWashDiscount | null = null;
  loadingDiscounts = false;
  quote: any = null;
  isNewCarWash = false;
  newCarWashData: { plate: string; car_wash_type_id: number } | null = null;

  constructor(
    private dialogRef: MatDialogRef<CarWashPaymentModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: CarWashPaymentModalData,
    private fb: FormBuilder,
    private carWashService: CarWashService,
    private shiftService: ShiftService,
    private authService: AuthService,
    private discountService: CarWashDiscountService,
    private snackBar: MatSnackBar
  ) {
    // Si viene con datos de nuevo lavado, crear un objeto temporal
    if (data.newCarWashData) {
      this.isNewCarWash = true;
      this.newCarWashData = data.newCarWashData;
      // Crear un objeto CarWash temporal para el formulario
      this.carWash = {
        id: undefined,
        plate: data.newCarWashData.plate,
        car_wash_type_id: data.newCarWashData.car_wash_type_id,
        status: 'PENDING',
        amount: 0,
        discount_id: null,
        discount_amount: 0,
        performed_at: new Date().toISOString(),
        paid_at: null,
        duration_minutes: null,
        operator_id: null,
        cashier_operator_id: null,
        shift_id: null,
        approval_code: null,
        payment_type: null,
        cash_amount_received: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      } as CarWash;
    } else if (data.carWash) {
      this.carWash = data.carWash;
    } else {
      throw new Error('CarWashPaymentModal requires either carWash or newCarWashData');
    }
    this.paymentForm = this.createForm();
  }

  ngOnInit(): void {
    this.loadDiscounts();
    this.loadQuote();
    this.onPaymentMethodChange();
  }

  loadDiscounts(): void {
    this.loadingDiscounts = true;
    this.discountService.getCarWashDiscounts()
      .pipe(takeUntil(this._unsubscribeAll))
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            const now = new Date();
            this.availableDiscounts = response.data.filter((discount: CarWashDiscount) => {
              if (!discount.is_active) return false;
              if (discount.valid_from && new Date(discount.valid_from) > now) return false;
              if (discount.valid_until && new Date(discount.valid_until) < now) return false;
              return true;
            });
          }
          this.loadingDiscounts = false;
        },
        error: () => {
          this.loadingDiscounts = false;
        }
      });
  }

  loadQuote(): void {
    // Si es un nuevo lavado, calcular el precio basado en el tipo
    if (this.isNewCarWash && !this.carWash?.id) {
      this.calculateQuoteForNewCarWash();
      return;
    }

    if (!this.carWash?.id) return;

    this.calculating = true;
    const discountId = this.paymentForm.get('discount_id')?.value;
    const discountCode = this.paymentForm.get('discount_code')?.value;
    const quoteParams: any = {};
    
    if (discountId) {
      quoteParams.discount_id = discountId;
    } else if (discountCode) {
      quoteParams.discount_code = discountCode;
    }

    this.carWashService.getCarWashQuote(this.carWash.id, quoteParams)
      .pipe(takeUntil(this._unsubscribeAll))
      .subscribe({
        next: (response) => {
          this.quote = response.data;
          this.calculating = false;
          // Actualizar el monto del lavado con el net_amount
          if (this.quote) {
            this.carWash.amount = this.quote.net_amount;
            this.onPaymentMethodChange();
          }
        },
        error: () => {
          this.calculating = false;
        }
      });
  }

  private calculateQuoteForNewCarWash(): void {
    this.calculating = true;
    
    // Obtener el tipo de lavado para obtener el precio base
    this.carWashService.getCarWashTypes()
      .pipe(takeUntil(this._unsubscribeAll))
      .subscribe({
        next: (resp) => {
          const washType = resp.data?.find(t => t.id === this.newCarWashData!.car_wash_type_id);
          if (washType) {
            const grossAmount = washType.price;
            const discountId = this.paymentForm.get('discount_id')?.value;
            const discountCode = this.paymentForm.get('discount_code')?.value;
            
            // Calcular descuento manualmente si hay uno seleccionado
            let discountAmount = 0;
            if (discountId) {
              const discount = this.availableDiscounts.find(d => d.id === discountId);
              if (discount) {
                if (discount.discount_type === 'AMOUNT') {
                  discountAmount = Math.min(discount.value || 0, grossAmount);
                } else if (discount.discount_type === 'PERCENTAGE') {
                  const percentage = (discount.value || 0) / 100;
                  discountAmount = grossAmount * percentage;
                  if (discount.max_amount && discountAmount > discount.max_amount) {
                    discountAmount = discount.max_amount;
                  }
                }
              }
            }
            
            const netAmount = Math.max(0, grossAmount - discountAmount);
            
            this.quote = {
              gross_amount: grossAmount,
              discount_amount: discountAmount,
              net_amount: netAmount,
              discount_id: discountId || null
            };
            
            this.carWash.amount = netAmount;
            this.calculating = false;
            this.onPaymentMethodChange();
          } else {
            this.calculating = false;
          }
        },
        error: () => {
          this.calculating = false;
        }
      });
  }

  ngOnDestroy(): void {
    this._unsubscribeAll.next(null);
    this._unsubscribeAll.complete();
  }

  private createForm(): FormGroup {
    return this.fb.group({
      discount_id: [null],
      discount_code: [''],
      payment_method: ['CASH', Validators.required],
      amount: ['', [Validators.required, Validators.min(0.01)]],
      approval_code: ['']
    });
  }

  onDiscountChange(): void {
    const discountId = this.paymentForm.get('discount_id')?.value;
    
    if (discountId) {
      this.selectedDiscount = this.availableDiscounts.find(d => d.id === discountId) || null;
      this.paymentForm.patchValue({ discount_code: '' });
    } else {
      this.selectedDiscount = null;
    }
    
    if (this.isNewCarWash) {
      this.calculateQuoteForNewCarWash();
    } else {
      this.loadQuote();
    }
  }

  onApplyDiscountCode(): void {
    const discountCode = this.paymentForm.get('discount_code')?.value;
    if (discountCode) {
      this.paymentForm.patchValue({ discount_id: null });
      this.selectedDiscount = null;
      if (this.isNewCarWash) {
        this.calculateQuoteForNewCarWash();
      } else {
        this.loadQuote();
      }
    }
  }

  onRemoveDiscount(): void {
    this.paymentForm.patchValue({ discount_id: null, discount_code: '' });
    this.selectedDiscount = null;
    if (this.isNewCarWash) {
      this.calculateQuoteForNewCarWash();
    } else {
      this.loadQuote();
    }
  }

  onPaymentMethodChange(): void {
    const paymentMethod = this.paymentForm.get('payment_method')?.value;
    const washAmount = this.quote?.net_amount || this.carWash.amount || 0;

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
    const washAmount = this.quote?.net_amount || this.carWash.amount || 0;
    return amount > washAmount;
  }

  calculateChange(): number {
    const amountValue = this.paymentForm.get('amount')?.value;
    const amount = this.parseAmount(amountValue);
    const washAmount = this.quote?.net_amount || this.carWash.amount || 0;
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
    
    // Para efectivo, usar el monto ingresado; para otros métodos, usar el monto del lavado con descuento
    const finalAmount = this.quote?.net_amount || this.carWash.amount || 0;
    const amountToPay = paymentMethod === 'CASH' ? this.parseAmount(amountValue) : finalAmount;

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
            payment_type: paymentMethod === 'CASH' ? 'cash' : 'card',
          };

          // Incluir descuento si está seleccionado
          if (this.paymentForm.get('discount_id')?.value) {
            updateData.discount_id = this.paymentForm.get('discount_id')?.value;
          } else if (this.paymentForm.get('discount_code')?.value) {
            updateData.discount_code = this.paymentForm.get('discount_code')?.value;
          }

          if (paymentMethod === 'CASH') {
            // Para efectivo, guardar el monto entregado
            updateData.cash_amount_received = amountToPay;
          } else if (paymentMethod === 'CARD') {
            // Para tarjeta, guardar el código de aprobación si existe
            if (formData.approval_code) {
              updateData.approval_code = formData.approval_code;
            }
          }

          if (shiftId) {
            updateData.shift_id = shiftId;
          }

          // Si es un nuevo lavado, crearlo con estado PAID
          if (this.isNewCarWash && this.newCarWashData) {
            const createData: any = {
              plate: this.newCarWashData.plate,
              car_wash_type_id: this.newCarWashData.car_wash_type_id,
              status: 'PAID' as CarWashStatus,
              ...updateData
            };

            this.carWashService.createCarWash(createData)
              .pipe(takeUntil(this._unsubscribeAll))
              .subscribe({
                next: (response) => {
                  this.processing = false;
                  if (response.success) {
                    this.snackBar.open('Lavado creado y pagado exitosamente', 'Cerrar', { duration: 3000 });
                    this.dialogRef.close({ success: true, data: response.data });
                  } else {
                    this.snackBar.open(response.message || 'Error al crear el lavado', 'Cerrar', { duration: 3000 });
                  }
                },
                error: (error) => {
                  this.processing = false;
                  console.error('Error creating car wash:', error);
                  const errorMessage = error.error?.message || 'Error al crear el lavado';
                  this.snackBar.open(errorMessage, 'Cerrar', { duration: 3000 });
                }
              });
          } else {
            // Actualizar lavado existente
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
          }
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

