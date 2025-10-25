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
import { SectorService } from 'app/core/services/sector.service';
import { Sector } from 'app/interfaces/parking.interface';

export interface SectorFormData {
  sector?: Sector;
  isEdit: boolean;
}

@Component({
  selector: 'app-sector-form',
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
  templateUrl: './sector-form.component.html',
  styleUrls: ['./sector-form.component.scss']
})
export class SectorFormComponent implements OnInit {
  sectorForm: FormGroup;
  loading = false;

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<SectorFormComponent>,
    @Inject(MAT_DIALOG_DATA) public data: SectorFormData,
    private sectorService: SectorService,
    private snackBar: MatSnackBar
  ) {
    this.sectorForm = this.createForm();
  }

  ngOnInit(): void {
    if (this.data.isEdit && this.data.sector) {
      this.loadSectorData();
    }
  }

  private createForm(): FormGroup {
    return this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      description: [''],
      is_private: [false],
      is_active: [true]
    });
  }

  private loadSectorData(): void {
    if (this.data.sector) {
      this.sectorForm.patchValue({
        name: this.data.sector.name,
        description: this.data.sector.description || '',
        is_private: this.data.sector.is_private,
        is_active: this.data.sector.is_active
      });
    }
  }

  onSubmit(): void {
    if (this.sectorForm.valid) {
      this.loading = true;
      const formData = this.sectorForm.value;

      if (this.data.isEdit && this.data.sector) {
        this.sectorService.updateSector(this.data.sector.id, formData)
          .subscribe({
            next: (response) => {
              this.loading = false;
              this.snackBar.open('Sector actualizado correctamente', 'Cerrar', { duration: 3000 });
              this.dialogRef.close(response.data);
            },
            error: (error) => {
              this.loading = false;
              this.snackBar.open('Error al actualizar sector', 'Cerrar', { duration: 3000 });
            }
          });
      } else {
        this.sectorService.createSector(formData)
          .subscribe({
            next: (response) => {
              this.loading = false;
              this.snackBar.open('Sector creado correctamente', 'Cerrar', { duration: 3000 });
              this.dialogRef.close(response.data);
            },
            error: (error) => {
              this.loading = false;
              this.snackBar.open('Error al crear sector', 'Cerrar', { duration: 3000 });
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
    const control = this.sectorForm.get(field);
    if (control?.hasError('required')) {
      return 'Este campo es requerido';
    }
    if (control?.hasError('minlength')) {
      return 'Mínimo 2 caracteres';
    }
    return '';
  }
}
