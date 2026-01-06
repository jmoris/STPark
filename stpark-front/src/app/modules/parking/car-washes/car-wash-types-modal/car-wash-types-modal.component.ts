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
import { MatSnackBar } from '@angular/material/snack-bar';

import { FuseConfirmationService } from '@fuse/services/confirmation';

import { CarWashService } from 'app/core/services/car-wash.service';
import { CarWashType } from 'app/interfaces/car-wash.interface';

@Component({
  selector: 'app-car-wash-types-modal',
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
    MatProgressSpinnerModule
  ],
  templateUrl: './car-wash-types-modal.component.html',
  styleUrls: ['./car-wash-types-modal.component.scss']
})
export class CarWashTypesModalComponent implements OnInit, OnDestroy {
  private _unsubscribeAll: Subject<any> = new Subject<any>();

  loading = false;
  saving = false;

  washTypes: CarWashType[] = [];
  displayedColumns: string[] = ['name', 'price', 'duration', 'actions'];

  typeForm: FormGroup;
  editingType: CarWashType | null = null;

  constructor(
    private dialogRef: MatDialogRef<CarWashTypesModalComponent>,
    private fb: FormBuilder,
    private carWashService: CarWashService,
    private snackBar: MatSnackBar,
    private confirmationService: FuseConfirmationService
  ) {
    this.typeForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      price: [null, [Validators.required, Validators.min(0)]],
      duration_minutes: [null]
    });
  }

  ngOnInit(): void {
    this.loadTypes();
  }

  ngOnDestroy(): void {
    this._unsubscribeAll.next(null);
    this._unsubscribeAll.complete();
  }

  loadTypes(): void {
    this.loading = true;
    this.carWashService.getCarWashTypes()
      .pipe(takeUntil(this._unsubscribeAll))
      .subscribe({
        next: (resp) => {
          this.washTypes = resp.data || [];
          this.loading = false;
        },
        error: (err) => {
          console.error('Error loading types:', err);
          this.snackBar.open('Error al cargar tipos de lavado', 'Cerrar', { duration: 3000 });
          this.loading = false;
        }
      });
  }

  startCreate(): void {
    this.editingType = null;
    this.typeForm.reset({
      name: '',
      price: null,
      duration_minutes: null
    });
  }

  startEdit(type: CarWashType): void {
    this.editingType = type;
    this.typeForm.reset({
      name: type.name,
      price: type.price,
      duration_minutes: type.duration_minutes ?? null
    });
  }

  save(): void {
    if (this.typeForm.invalid) {
      this.typeForm.markAllAsTouched();
      return;
    }

    const payload = {
      name: String(this.typeForm.value.name).trim(),
      price: Number(this.typeForm.value.price),
      duration_minutes: this.typeForm.value.duration_minutes === null || this.typeForm.value.duration_minutes === ''
        ? null
        : Number(this.typeForm.value.duration_minutes)
    };

    this.saving = true;
    const request$ = this.editingType?.id
      ? this.carWashService.updateCarWashType(this.editingType.id, payload)
      : this.carWashService.createCarWashType(payload);

    request$
      .pipe(takeUntil(this._unsubscribeAll))
      .subscribe({
        next: (resp) => {
          if (resp.success) {
            this.snackBar.open(this.editingType ? 'Tipo actualizado' : 'Tipo creado', 'Cerrar', { duration: 2500 });
            this.editingType = null;
            this.typeForm.reset({ name: '', price: null, duration_minutes: null });
            this.loadTypes();
          } else {
            this.snackBar.open(resp.message || 'Error al guardar tipo', 'Cerrar', { duration: 3000 });
          }
          this.saving = false;
        },
        error: (err) => {
          console.error('Error saving type:', err);
          const msg = err?.error?.message || 'Error al guardar tipo de lavado';
          this.snackBar.open(msg, 'Cerrar', { duration: 4000 });
          this.saving = false;
        }
      });
  }

  delete(type: CarWashType): void {
    if (!type.id) return;

    const confirmation = this.confirmationService.open({
      title: 'Eliminar Tipo de Lavado',
      message: `¿Está seguro de eliminar el tipo "${type.name}"?`,
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

      this.carWashService.deleteCarWashType(type.id!)
        .pipe(takeUntil(this._unsubscribeAll))
        .subscribe({
          next: (resp) => {
            if (resp.success) {
              this.snackBar.open('Tipo eliminado', 'Cerrar', { duration: 2500 });
              this.loadTypes();
            } else {
              this.snackBar.open(resp.message || 'Error al eliminar tipo', 'Cerrar', { duration: 3000 });
            }
          },
          error: (err) => {
            console.error('Error deleting type:', err);
            const msg = err?.error?.message || 'Error al eliminar tipo';
            this.snackBar.open(msg, 'Cerrar', { duration: 4000 });
          }
        });
    });
  }

  close(): void {
    // Si llegó aquí, asumimos que pudo haber cambios; el padre refresca si recibe true
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
}


