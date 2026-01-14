import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';

import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';

import { FuseConfirmationService } from '@fuse/services/confirmation';

import { CarWashDiscountService, CarWashDiscount } from 'app/core/services/car-wash-discount.service';

@Component({
  selector: 'app-car-wash-discounts-modal',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatCheckboxModule,
    MatDatepickerModule,
    MatNativeDateModule
  ],
  templateUrl: './car-wash-discounts-modal.component.html',
  styleUrls: ['./car-wash-discounts-modal.component.scss']
})
export class CarWashDiscountsModalComponent implements OnInit, OnDestroy {
  private _unsubscribeAll: Subject<any> = new Subject<any>();

  loading = false;
  saving = false;

  discounts: CarWashDiscount[] = [];
  displayedColumns: string[] = ['name', 'type', 'value', 'status', 'actions'];

  discountForm: FormGroup;
  editingDiscount: CarWashDiscount | null = null;

  discountTypes = [
    { value: 'AMOUNT', label: 'Por Monto' },
    { value: 'PERCENTAGE', label: 'Por Porcentaje' }
  ];

  constructor(
    private dialogRef: MatDialogRef<CarWashDiscountsModalComponent>,
    private fb: FormBuilder,
    private discountService: CarWashDiscountService,
    private snackBar: MatSnackBar,
    private confirmationService: FuseConfirmationService
  ) {
    this.discountForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      description: [''],
      discount_type: ['AMOUNT', [Validators.required]],
      value: [null],
      max_amount: [null],
      is_active: [true],
      priority: [0],
      valid_from: [null],
      valid_until: [null]
    });

    // Actualizar validaciones cuando cambia el tipo de descuento
    this.discountForm.get('discount_type')?.valueChanges
      .pipe(takeUntil(this._unsubscribeAll))
      .subscribe(type => {
        this.updateFormValidations(type);
      });
  }

  ngOnInit(): void {
    this.loadDiscounts();
  }

  ngOnDestroy(): void {
    this._unsubscribeAll.next(null);
    this._unsubscribeAll.complete();
  }

  updateFormValidations(type: string): void {
    const valueControl = this.discountForm.get('value');
    const maxAmountControl = this.discountForm.get('max_amount');

    // Reset validators
    valueControl?.clearValidators();
    maxAmountControl?.clearValidators();

    if (type === 'AMOUNT') {
      valueControl?.setValidators([Validators.required, Validators.min(0)]);
      maxAmountControl?.clearValidators();
    } else if (type === 'PERCENTAGE') {
      valueControl?.setValidators([Validators.required, Validators.min(0), Validators.max(100)]);
      maxAmountControl?.setValidators([Validators.min(0)]);
    }

    valueControl?.updateValueAndValidity();
    maxAmountControl?.updateValueAndValidity();
  }

  loadDiscounts(): void {
    this.loading = true;
    this.discountService.getCarWashDiscounts()
      .pipe(takeUntil(this._unsubscribeAll))
      .subscribe({
        next: (resp) => {
          this.discounts = resp.data || [];
          this.loading = false;
        },
        error: (err) => {
          console.error('Error loading discounts:', err);
          this.snackBar.open('Error al cargar descuentos', 'Cerrar', { duration: 3000 });
          this.loading = false;
        }
      });
  }

  startCreate(): void {
    this.editingDiscount = null;
    this.discountForm.reset({
      name: '',
      description: '',
      discount_type: 'AMOUNT',
      value: null,
      max_amount: null,
      is_active: true,
      priority: 0,
      valid_from: null,
      valid_until: null
    });
    this.updateFormValidations('AMOUNT');
  }

  startEdit(discount: CarWashDiscount): void {
    this.editingDiscount = discount;
    const formData: any = {
      name: discount.name,
      description: discount.description || '',
      discount_type: discount.discount_type,
      is_active: discount.is_active,
      priority: discount.priority || 0,
      value: discount.value || null,
      max_amount: discount.max_amount || null
    };

    if (discount.valid_from) {
      formData.valid_from = new Date(discount.valid_from);
    }
    if (discount.valid_until) {
      formData.valid_until = new Date(discount.valid_until);
    }

    this.discountForm.reset(formData);
    this.updateFormValidations(discount.discount_type);
  }

  save(): void {
    if (this.discountForm.invalid) {
      this.discountForm.markAllAsTouched();
      return;
    }

    const formValue = this.discountForm.value;
    const payload: any = {
      name: String(formValue.name).trim(),
      description: formValue.description ? String(formValue.description).trim() : undefined,
      discount_type: formValue.discount_type,
      is_active: formValue.is_active !== false,
      priority: Number(formValue.priority) || 0
    };

    // Agregar campos según el tipo de descuento
    if (formValue.discount_type === 'AMOUNT' || formValue.discount_type === 'PERCENTAGE') {
      payload.value = formValue.value ? Number(formValue.value) : undefined;
      payload.max_amount = formValue.max_amount ? Number(formValue.max_amount) : undefined;
    }

    // Fechas de validez
    if (formValue.valid_from) {
      payload.valid_from = new Date(formValue.valid_from).toISOString().split('T')[0];
    }
    if (formValue.valid_until) {
      payload.valid_until = new Date(formValue.valid_until).toISOString().split('T')[0];
    }

    this.saving = true;
    const request$ = this.editingDiscount?.id
      ? this.discountService.updateCarWashDiscount(this.editingDiscount.id, payload)
      : this.discountService.createCarWashDiscount(payload);

    request$
      .pipe(takeUntil(this._unsubscribeAll))
      .subscribe({
        next: (resp) => {
          if (resp.success) {
            this.snackBar.open(
              this.editingDiscount ? 'Descuento actualizado' : 'Descuento creado',
              'Cerrar',
              { duration: 2500 }
            );
            this.editingDiscount = null;
            this.startCreate();
            this.loadDiscounts();
          } else {
            this.snackBar.open(resp.message || 'Error al guardar descuento', 'Cerrar', { duration: 3000 });
          }
          this.saving = false;
        },
        error: (err) => {
          console.error('Error saving discount:', err);
          const msg = err?.error?.message || 'Error al guardar descuento';
          this.snackBar.open(msg, 'Cerrar', { duration: 4000 });
          this.saving = false;
        }
      });
  }

  delete(discount: CarWashDiscount): void {
    if (!discount.id) return;

    const confirmation = this.confirmationService.open({
      title: 'Eliminar Descuento',
      message: `¿Está seguro de eliminar el descuento "${discount.name}"?`,
      icon: {
        show: true,
        name: 'heroicons_outline:exclamation-triangle',
        color: 'warn'
      },
      actions: {
        confirm: {
          show: true,
          label: 'Eliminar',
          color: 'warn'
        },
        cancel: {
          show: true,
          label: 'Cancelar'
        }
      }
    });

    confirmation.afterClosed().subscribe(result => {
      if (result !== 'confirmed') return;

      this.discountService.deleteCarWashDiscount(discount.id!)
        .pipe(takeUntil(this._unsubscribeAll))
        .subscribe({
          next: (resp) => {
            if (resp.success) {
              this.snackBar.open('Descuento eliminado', 'Cerrar', { duration: 2500 });
              this.loadDiscounts();
            } else {
              this.snackBar.open(resp.message || 'Error al eliminar descuento', 'Cerrar', { duration: 3000 });
            }
          },
          error: (err) => {
            console.error('Error deleting discount:', err);
            const msg = err?.error?.message || 'Error al eliminar descuento';
            this.snackBar.open(msg, 'Cerrar', { duration: 4000 });
          }
        });
    });
  }

  close(): void {
    this.dialogRef.close(true);
  }

  formatAmount(amount: number): string {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount || 0);
  }

  getDiscountTypeLabel(type: string): string {
    const typeObj = this.discountTypes.find(t => t.value === type);
    return typeObj?.label || type;
  }

  getDiscountDisplayValue(discount: CarWashDiscount): string {
    if (discount.discount_type === 'AMOUNT') {
      return this.formatAmount(discount.value || 0);
    } else if (discount.discount_type === 'PERCENTAGE') {
      return `${discount.value || 0}%`;
    }
    return '-';
  }
}
