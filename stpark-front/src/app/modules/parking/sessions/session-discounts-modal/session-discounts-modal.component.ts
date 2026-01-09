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

import { DiscountService } from 'app/core/services/discount.service';
import { SessionDiscount } from 'app/interfaces/discount.interface';

@Component({
  selector: 'app-session-discounts-modal',
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
  templateUrl: './session-discounts-modal.component.html',
  styleUrls: ['./session-discounts-modal.component.scss']
})
export class SessionDiscountsModalComponent implements OnInit, OnDestroy {
  private _unsubscribeAll: Subject<any> = new Subject<any>();

  loading = false;
  saving = false;

  discounts: SessionDiscount[] = [];
  displayedColumns: string[] = ['name', 'type', 'value', 'status', 'actions'];

  discountForm: FormGroup;
  editingDiscount: SessionDiscount | null = null;

  discountTypes = [
    { value: 'AMOUNT', label: 'Por Monto' },
    { value: 'PERCENTAGE', label: 'Por Porcentaje' },
    { value: 'PRICING_PROFILE', label: 'Perfil de Precio' }
  ];

  constructor(
    private dialogRef: MatDialogRef<SessionDiscountsModalComponent>,
    private fb: FormBuilder,
    private discountService: DiscountService,
    private snackBar: MatSnackBar,
    private confirmationService: FuseConfirmationService
  ) {
    this.discountForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      description: [''],
      discount_type: ['AMOUNT', [Validators.required]],
      value: [null],
      max_amount: [null],
      minute_value: [null],
      min_amount: [null],
      minimum_duration: [null],
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
    const minuteValueControl = this.discountForm.get('minute_value');
    const minAmountControl = this.discountForm.get('min_amount');

    // Reset validators
    valueControl?.clearValidators();
    maxAmountControl?.clearValidators();
    minuteValueControl?.clearValidators();
    minAmountControl?.clearValidators();

    if (type === 'AMOUNT') {
      valueControl?.setValidators([Validators.required, Validators.min(0)]);
      maxAmountControl?.clearValidators();
      minuteValueControl?.clearValidators();
      minAmountControl?.clearValidators();
    } else if (type === 'PERCENTAGE') {
      valueControl?.setValidators([Validators.required, Validators.min(0), Validators.max(100)]);
      maxAmountControl?.setValidators([Validators.min(0)]);
      minuteValueControl?.clearValidators();
      minAmountControl?.clearValidators();
    } else if (type === 'PRICING_PROFILE') {
      minuteValueControl?.setValidators([Validators.required, Validators.min(0)]);
      minAmountControl?.setValidators([Validators.min(0)]);
      valueControl?.clearValidators();
      maxAmountControl?.clearValidators();
    }

    valueControl?.updateValueAndValidity();
    maxAmountControl?.updateValueAndValidity();
    minuteValueControl?.updateValueAndValidity();
    minAmountControl?.updateValueAndValidity();
  }

  loadDiscounts(): void {
    this.loading = true;
    this.discountService.getSessionDiscounts()
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
      minute_value: null,
      min_amount: null,
      minimum_duration: null,
      is_active: true,
      priority: 0,
      valid_from: null,
      valid_until: null
    });
    this.updateFormValidations('AMOUNT');
  }

  startEdit(discount: SessionDiscount): void {
    this.editingDiscount = discount;
    const formData: any = {
      name: discount.name,
      description: discount.description || '',
      discount_type: discount.discount_type,
      is_active: discount.is_active,
      priority: discount.priority || 0
    };

    if (discount.discount_type === 'AMOUNT' || discount.discount_type === 'PERCENTAGE') {
      formData.value = discount.value || null;
      formData.max_amount = discount.max_amount || null;
    } else if (discount.discount_type === 'PRICING_PROFILE') {
      formData.minute_value = discount.minute_value || null;
      formData.min_amount = discount.min_amount || null;
      formData.minimum_duration = discount.minimum_duration || null;
    }

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
    } else if (formValue.discount_type === 'PRICING_PROFILE') {
      payload.minute_value = formValue.minute_value ? Number(formValue.minute_value) : undefined;
      payload.min_amount = formValue.min_amount ? Number(formValue.min_amount) : undefined;
      payload.minimum_duration = formValue.minimum_duration ? Number(formValue.minimum_duration) : undefined;
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
      ? this.discountService.updateSessionDiscount(this.editingDiscount.id, payload)
      : this.discountService.createSessionDiscount(payload);

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

  delete(discount: SessionDiscount): void {
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

      this.discountService.deleteSessionDiscount(discount.id!)
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

  getDiscountDisplayValue(discount: SessionDiscount): string {
    if (discount.discount_type === 'AMOUNT') {
      return this.formatAmount(discount.value || 0);
    } else if (discount.discount_type === 'PERCENTAGE') {
      return `${discount.value || 0}%`;
    } else if (discount.discount_type === 'PRICING_PROFILE') {
      const parts: string[] = [];
      if (discount.minute_value) {
        parts.push(`Min: ${this.formatAmount(discount.minute_value)}`);
      }
      if (discount.min_amount) {
        parts.push(`Mín: ${this.formatAmount(discount.min_amount)}`);
      }
      if (discount.minimum_duration) {
        parts.push(`Duración mín: ${discount.minimum_duration} min`);
      }
      return parts.length > 0 ? parts.join(', ') : 'Perfil personalizado';
    }
    return '-';
  }
}


