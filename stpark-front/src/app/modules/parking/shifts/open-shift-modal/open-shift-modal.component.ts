import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { FormsModule } from '@angular/forms';
import { ShiftService } from '../../../../core/services/shift.service';
import { Operator, Sector, OpenShiftRequest } from '../../../../interfaces/parking.interface';

@Component({
  selector: 'app-open-shift-modal',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule
  ],
  templateUrl: './open-shift-modal.component.html',
  styleUrls: ['./open-shift-modal.component.scss']
})
export class OpenShiftModalComponent {
  request: OpenShiftRequest = {
    operator_id: 0,
    opening_float: 0,
    sector_id: undefined,
    device_id: undefined,
    notes: ''
  };
  loading = false;

  constructor(
    public dialogRef: MatDialogRef<OpenShiftModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { operators: Operator[]; sectors: Sector[] },
    private shiftService: ShiftService
  ) {}

  onCancel(): void {
    this.dialogRef.close();
  }

  onSave(): void {
    if (!this.request.operator_id || this.request.opening_float <= 0) {
      alert('Por favor complete todos los campos requeridos');
      return;
    }

    this.loading = true;
    this.shiftService.openShift(this.request)
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.dialogRef.close(true);
          } else {
            alert(response.message || 'Error al abrir el turno');
            this.loading = false;
          }
        },
        error: (error) => {
          console.error('Error opening shift:', error);
          alert('Error al abrir el turno');
          this.loading = false;
        }
      });
  }
}

