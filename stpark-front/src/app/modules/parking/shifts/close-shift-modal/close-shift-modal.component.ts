import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { FormsModule } from '@angular/forms';
import { ShiftService } from '../../../../core/services/shift.service';
import { Shift, CloseShiftRequest } from '../../../../interfaces/parking.interface';

@Component({
  selector: 'app-close-shift-modal',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule
  ],
  templateUrl: './close-shift-modal.component.html',
  styleUrls: ['./close-shift-modal.component.scss']
})
export class CloseShiftModalComponent {
  request: CloseShiftRequest = {
    closing_declared_cash: 0,
    notes: ''
  };
  loading = false;
  expectedCash: number = 0;

  constructor(
    public dialogRef: MatDialogRef<CloseShiftModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { shift: Shift },
    private shiftService: ShiftService
  ) {
    // Cargar totales del turno
    this.shiftService.getShift(data.shift.id)
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.expectedCash = response.data.totals?.cash_expected || data.shift.opening_float || 0;
            this.request.closing_declared_cash = this.expectedCash;
          }
        }
      });
  }

  formatAmount(amount: number): string {
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(amount);
  }

  getDifference(): number {
    return (this.request.closing_declared_cash || 0) - this.expectedCash;
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  onSave(): void {
    if (this.request.closing_declared_cash < 0) {
      alert('El monto declarado no puede ser negativo');
      return;
    }

    this.loading = true;
    this.shiftService.closeShift(this.data.shift.id, this.request)
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.dialogRef.close(true);
          } else {
            alert(response.message || 'Error al cerrar el turno');
            this.loading = false;
          }
        },
        error: (error) => {
          console.error('Error closing shift:', error);
          alert('Error al cerrar el turno');
          this.loading = false;
        }
      });
  }
}

