import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { OperatorService } from 'app/core/services/operator.service';
import { SectorService } from 'app/core/services/sector.service';
import { Operator, Sector } from 'app/interfaces/parking.interface';

export interface OperatorFormData {
  operator?: Operator;
  isEdit: boolean;
}

@Component({
  selector: 'app-operator-form',
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
    MatCheckboxModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './operator-form.component.html',
  styleUrls: ['./operator-form.component.scss']
})
export class OperatorFormComponent implements OnInit {
  operatorForm: FormGroup;
  loading = false;
  sectors: Sector[] = [];

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<OperatorFormComponent>,
    @Inject(MAT_DIALOG_DATA) public data: OperatorFormData,
    private operatorService: OperatorService,
    private sectorService: SectorService,
    private snackBar: MatSnackBar
  ) {
    this.operatorForm = this.createForm();
  }

  ngOnInit(): void {
    this.loadSectors();
    if (this.data.isEdit && this.data.operator) {
      this.loadOperatorData();
    }
  }

  private createForm(): FormGroup {
    return this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      rut: ['', [Validators.required, Validators.pattern(/^[0-9]+-[0-9kK]{1}$/)]],
      email: ['', [Validators.email]],
      phone: ['', [Validators.pattern(/^[+]?[\d\s-()]+$/)]],
      pin: ['', [Validators.pattern(/^[0-9]{6}$/)]],
      status: ['ACTIVE']
    });
  }

  private loadSectors(): void {
    this.sectorService.getSectors().subscribe({
      next: (response) => {
        this.sectors = (response.data as any)?.data || [];
      },
      error: (error) => {
        console.error('Error loading sectors:', error);
        this.snackBar.open('Error al cargar sectores', 'Cerrar', { duration: 3000 });
      }
    });
  }

  private loadOperatorData(): void {
    if (this.data.operator) {
      this.operatorForm.patchValue({
        name: this.data.operator.name,
        rut: this.data.operator.rut,
        email: this.data.operator.email || '',
        phone: this.data.operator.phone || '',
        pin: this.data.operator.pin || '',
        status: this.data.operator.status || 'ACTIVE'
      });
    }
  }

  onSubmit(): void {
    if (this.operatorForm.valid) {
      this.loading = true;
      const formData = this.operatorForm.value;

      if (this.data.isEdit && this.data.operator) {
        const operatorId = Number(this.data.operator.id);
        
        this.operatorService.updateOperator(operatorId, formData)
          .subscribe({
            next: (response) => {
              this.loading = false;
              this.snackBar.open('Operador actualizado correctamente', 'Cerrar', { duration: 3000 });
              this.dialogRef.close(response.data);
            },
            error: (error) => {
              this.loading = false;
              console.error('Error updating operator:', error);
              this.snackBar.open('Error al actualizar operador', 'Cerrar', { duration: 3000 });
            }
          });
      } else {
        this.operatorService.createOperator(formData)
          .subscribe({
            next: (response) => {
              this.loading = false;
              this.snackBar.open('Operador creado correctamente', 'Cerrar', { duration: 3000 });
              this.dialogRef.close(response.data);
            },
            error: (error) => {
              this.loading = false;
              console.error('Error creating operator:', error);
              
              // Mostrar mensaje específico si es un error de límite de plan
              let errorMessage = 'Error al crear operador';
              if (error.error?.error_code === 'PLAN_LIMIT_EXCEEDED' && error.error?.message) {
                errorMessage = error.error.message;
              } else if (error.error?.message) {
                errorMessage = error.error.message;
              }
              
              this.snackBar.open(errorMessage, 'Cerrar', { 
                duration: 5000,
                panelClass: ['error-snackbar']
              });
            }
          });
      }
    } else {
      this.snackBar.open('Por favor, complete todos los campos requeridos', 'Cerrar', { duration: 3000 });
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  getErrorMessage(field: string): string {
    const control = this.operatorForm.get(field);
    if (control?.hasError('required')) {
      return 'Este campo es requerido';
    }
    if (control?.hasError('email')) {
      return 'Ingrese un email válido';
    }
    if (control?.hasError('minlength')) {
      return 'Mínimo 2 caracteres';
    }
    if (control?.hasError('pattern')) {
      if (field === 'rut') {
        return 'Formato de RUT inválido (ej: 12.345.678-9)';
      }
      if (field === 'pin') {
        return 'El PIN debe tener exactamente 6 dígitos';
      }
      return 'Formato de teléfono inválido';
    }
    return '';
  }
}
