import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject, takeUntil } from 'rxjs';
import { OperatorService } from 'app/core/services/operator.service';
import { SectorService } from 'app/core/services/sector.service';
import { Operator, Sector, Street } from 'app/interfaces/parking.interface';

export interface OperatorAssignmentData {
  operator: Operator;
  isEdit: boolean;
  assignment?: any;
}

@Component({
  selector: 'app-operator-assignment',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatDatepickerModule,
    MatNativeDateModule
  ],
  templateUrl: './operator-assignment.component.html',
  styleUrls: ['./operator-assignment.component.scss']
})
export class OperatorAssignmentComponent implements OnInit {
  private _unsubscribeAll: Subject<any> = new Subject<any>();

  assignmentForm: FormGroup;
  loading = false;
  sectors: Sector[] = [];
  streets: Street[] = [];
  loadingStreets = false;

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<OperatorAssignmentComponent>,
    @Inject(MAT_DIALOG_DATA) public data: OperatorAssignmentData,
    private operatorService: OperatorService,
    private sectorService: SectorService,
    private snackBar: MatSnackBar
  ) {
    this.assignmentForm = this.createForm();
  }

  ngOnInit(): void {
    this.loadSectors();
    if (this.data.isEdit && this.data.assignment) {
      this.loadAssignmentData();
    }
  }

  ngOnDestroy(): void {
    this._unsubscribeAll.next(null);
    this._unsubscribeAll.complete();
  }

  private createForm(): FormGroup {
    return this.fb.group({
      sector_id: ['', [Validators.required]],
      street_id: [''],
      valid_from: ['', [Validators.required]],
      valid_to: ['']
    });
  }

  private loadSectors(): void {
    this.sectorService.getSectors()
      .pipe(takeUntil(this._unsubscribeAll))
      .subscribe({
        next: (response) => {
          this.sectors = (response.data as any)?.data || [];
        },
        error: (error) => {
          console.error('Error loading sectors:', error);
          this.snackBar.open('Error al cargar sectores', 'Cerrar', { duration: 3000 });
        }
      });
  }

  onSectorChange(sectorId: number): void {
    this.streets = [];
    this.assignmentForm.patchValue({ street_id: '' });
    
    if (sectorId) {
      this.loadStreetsBySector(sectorId);
    }
  }

  private loadStreetsBySector(sectorId: number): void {
    this.loadingStreets = true;
    this.sectorService.getSectorStreets(sectorId)
      .pipe(takeUntil(this._unsubscribeAll))
      .subscribe({
        next: (response) => {
          this.streets = response.data || [];
          this.loadingStreets = false;
        },
        error: (error) => {
          console.error('Error loading streets:', error);
          this.snackBar.open('Error al cargar calles', 'Cerrar', { duration: 3000 });
          this.loadingStreets = false;
        }
      });
  }

  private loadAssignmentData(): void {
    if (this.data.assignment) {
      this.assignmentForm.patchValue({
        sector_id: this.data.assignment.sector_id,
        street_id: this.data.assignment.street_id,
        valid_from: this.data.assignment.valid_from,
        valid_to: this.data.assignment.valid_to
      });

      // Cargar calles del sector seleccionado
      if (this.data.assignment.sector_id) {
        this.loadStreetsBySector(this.data.assignment.sector_id);
      }
    }
  }

  onSubmit(): void {
    if (this.assignmentForm.valid) {
      this.loading = true;
      const formData = this.assignmentForm.value;

      // Convertir fechas a formato ISO
      if (formData.valid_from) {
        formData.valid_from = new Date(formData.valid_from).toISOString().split('T')[0];
      }
      if (formData.valid_to) {
        formData.valid_to = new Date(formData.valid_to).toISOString().split('T')[0];
      }

      this.operatorService.assignOperator(this.data.operator.id, formData)
        .pipe(takeUntil(this._unsubscribeAll))
        .subscribe({
          next: (response) => {
            const message = response.message || 'Asignación realizada exitosamente';
            this.snackBar.open(message, 'Cerrar', { duration: 4000 });
            this.dialogRef.close(true);
          },
          error: (error) => {
            console.error('Error assigning operator:', error);
            this.snackBar.open('Error al asignar operador', 'Cerrar', { duration: 3000 });
            this.loading = false;
          }
        });
    } else {
      this.snackBar.open('Por favor, complete todos los campos requeridos', 'Cerrar', { duration: 3000 });
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  getErrorMessage(field: string): string {
    const control = this.assignmentForm.get(field);
    if (control?.hasError('required')) {
      return 'Este campo es requerido';
    }
    return '';
  }
}