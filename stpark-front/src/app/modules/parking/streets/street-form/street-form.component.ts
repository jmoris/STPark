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
import { StreetService } from 'app/core/services/street.service';
import { SectorService } from 'app/core/services/sector.service';
import { Street, Sector } from 'app/interfaces/parking.interface';

export interface StreetFormData {
  street?: Street;
  isEdit: boolean;
}

@Component({
  selector: 'app-street-form',
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
  templateUrl: './street-form.component.html',
  styleUrls: ['./street-form.component.scss']
})
export class StreetFormComponent implements OnInit {
  streetForm: FormGroup;
  loading = false;
  sectors: Sector[] = [];
  selectedSector: Sector | null = null;

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<StreetFormComponent>,
    @Inject(MAT_DIALOG_DATA) public data: StreetFormData,
    private streetService: StreetService,
    private sectorService: SectorService,
    private snackBar: MatSnackBar
  ) {
    this.streetForm = this.createForm();
  }

  ngOnInit(): void {
    this.loadSectors();
    if (this.data.isEdit && this.data.street) {
      this.loadStreetData();
    }
  }

  private createForm(): FormGroup {
    return this.fb.group({
      sector_id: ['', [Validators.required]],
      name: ['', [Validators.required, Validators.minLength(2)]],
      address_number: [''],
      address_type: ['STREET'],
      block_range: [''],
      is_specific_address: [false],
      notes: ['']
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

  private loadStreetData(): void {
    if (this.data.street) {
      this.streetForm.patchValue({
        sector_id: this.data.street.sector_id,
        name: this.data.street.name,
        address_number: this.data.street.address_number || '',
        address_type: this.data.street.address_type || 'STREET',
        block_range: this.data.street.block_range || '',
        is_specific_address: this.data.street.is_specific_address || false,
        notes: this.data.street.notes || ''
      });

      // Cargar información del sector seleccionado
      this.onSectorChange(this.data.street.sector_id);
    }
  }

  onSectorChange(sectorId: number): void {
    this.selectedSector = this.sectors.find(s => s.id === sectorId) || null;
    
    // Si es un sector privado, sugerir dirección específica
    if (this.selectedSector?.is_private) {
      this.streetForm.patchValue({
        is_specific_address: true,
        address_type: 'ADDRESS'
      });
    } else {
      this.streetForm.patchValue({
        is_specific_address: false,
        address_type: 'STREET'
      });
    }
  }

  onAddressTypeChange(): void {
    const isSpecific = this.streetForm.get('is_specific_address')?.value;
    
    if (isSpecific) {
      this.streetForm.patchValue({
        address_type: 'ADDRESS',
        block_range: ''
      });
    } else {
      this.streetForm.patchValue({
        address_type: 'STREET',
        address_number: ''
      });
    }
  }

  onSubmit(): void {
    if (this.streetForm.valid) {
      this.loading = true;
      const formData = this.streetForm.value;

      if (this.data.isEdit && this.data.street) {
        this.streetService.updateStreet(this.data.street.id, formData)
          .subscribe({
            next: (response) => {
              this.loading = false;
              this.snackBar.open('Calle actualizada correctamente', 'Cerrar', { duration: 3000 });
              this.dialogRef.close(response.data);
            },
            error: (error) => {
              this.loading = false;
              this.snackBar.open('Error al actualizar calle', 'Cerrar', { duration: 3000 });
            }
          });
      } else {
        this.streetService.createStreet(formData)
          .subscribe({
            next: (response) => {
              this.loading = false;
              this.snackBar.open('Calle creada correctamente', 'Cerrar', { duration: 3000 });
              this.dialogRef.close(response.data);
            },
            error: (error) => {
              this.loading = false;
              console.error('Error creating street:', error);
              
              // Mostrar mensaje específico si es un error de límite de plan
              let errorMessage = 'Error al crear calle';
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
    const control = this.streetForm.get(field);
    if (control?.hasError('required')) {
      return 'Este campo es requerido';
    }
    if (control?.hasError('minlength')) {
      return 'Mínimo 2 caracteres';
    }
    return '';
  }

  getSectorTypeText(sector: Sector): string {
    return sector.is_private ? 'Privado' : 'Público';
  }

  getSectorTypeColor(sector: Sector): string {
    return sector.is_private ? 'purple' : 'blue';
  }
}
