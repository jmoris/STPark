import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';

import { CarWashService } from 'app/core/services/car-wash.service';
import { CarWashStatus, CarWashType, CarWash } from 'app/interfaces/car-wash.interface';

export interface CarWashFormData {
  carWash?: CarWash;
  washTypes: CarWashType[];
  isEdit: boolean;
}

@Component({
  selector: 'app-car-wash-form-modal',
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
    MatProgressSpinnerModule
  ],
  templateUrl: './car-wash-form-modal.component.html',
  styleUrls: ['./car-wash-form-modal.component.scss']
})
export class CarWashFormModalComponent {
  saving = false;
  form: FormGroup;

  statusOptions: { value: CarWashStatus; label: string }[] = [
    { value: 'PENDING', label: 'Pendiente' },
    { value: 'PAID', label: 'Pagado' }
  ];

  washTypes: CarWashType[] = [];
  isEdit: boolean;

  constructor(
    private dialogRef: MatDialogRef<CarWashFormModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: CarWashFormData,
    private fb: FormBuilder,
    private carWashService: CarWashService,
    private snackBar: MatSnackBar
  ) {
    this.isEdit = data?.isEdit || false;
    this.washTypes = (data?.washTypes || []).filter(t => t.is_active !== false);

    // Crear el formulario con validaciones condicionales
    if (this.isEdit) {
      // En modo edición, solo status es requerido
      this.form = this.fb.group({
        plate: [''], // No se usa pero lo necesitamos para compatibilidad
        car_wash_type_id: [null], // No se usa pero lo necesitamos para compatibilidad
        status: ['PENDING', [Validators.required]]
      });
      if (data?.carWash) {
        this.loadCarWashData(data.carWash);
      }
    } else {
      // En modo creación, todos los campos son requeridos
      this.form = this.fb.group({
        plate: ['', [Validators.required, Validators.minLength(4), Validators.maxLength(10)]],
        car_wash_type_id: [null, [Validators.required]],
        status: ['PENDING', [Validators.required]]
      });
    }
  }

  private loadCarWashData(carWash: CarWash): void {
    this.form.patchValue({
      plate: carWash.plate,
      car_wash_type_id: carWash.car_wash_type_id,
      status: carWash.status
    });
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const payload: any = {
      status: this.form.value.status as CarWashStatus
    };

    // Solo incluir plate y car_wash_type_id si no es edición
    if (!this.isEdit) {
      payload.plate = String(this.form.value.plate).trim().toUpperCase();
      payload.car_wash_type_id = Number(this.form.value.car_wash_type_id);
    }

    this.saving = true;

    if (this.isEdit && this.data?.carWash?.id) {
      // Actualizar
      this.carWashService.updateCarWash(this.data.carWash.id, payload).subscribe({
        next: (resp) => {
          if (resp.success) {
            this.snackBar.open('Lavado actualizado', 'Cerrar', { duration: 2500 });
            this.dialogRef.close(true);
          } else {
            this.snackBar.open(resp.message || 'Error al actualizar lavado', 'Cerrar', { duration: 3000 });
          }
          this.saving = false;
        },
        error: (err) => {
          console.error('Error updating car wash:', err);
          const msg = err?.error?.message || 'Error al actualizar lavado';
          this.snackBar.open(msg, 'Cerrar', { duration: 4000 });
          this.saving = false;
        }
      });
    } else {
      // Crear
      this.carWashService.createCarWash(payload).subscribe({
        next: (resp) => {
          if (resp.success) {
            this.snackBar.open('Lavado creado', 'Cerrar', { duration: 2500 });
            this.dialogRef.close(true);
          } else {
            this.snackBar.open(resp.message || 'Error al crear lavado', 'Cerrar', { duration: 3000 });
          }
          this.saving = false;
        },
        error: (err) => {
          console.error('Error creating car wash:', err);
          const msg = err?.error?.message || 'Error al crear lavado';
          this.snackBar.open(msg, 'Cerrar', { duration: 4000 });
          this.saving = false;
        }
      });
    }
  }

  cancel(): void {
    this.dialogRef.close(false);
  }
}


