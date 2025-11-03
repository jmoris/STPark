import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatRadioModule } from '@angular/material/radio';
import { FormsModule } from '@angular/forms';
import { ShiftService } from '../../../../core/services/shift.service';
import { Shift, CashAdjustmentRequest } from '../../../../interfaces/parking.interface';

@Component({
  selector: 'app-cash-adjustment-modal',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatRadioModule
  ],
  templateUrl: './cash-adjustment-modal.component.html',
  styleUrls: ['./cash-adjustment-modal.component.scss']
})
export class CashAdjustmentModalComponent {
  request: CashAdjustmentRequest = {
    type: 'WITHDRAWAL',
    amount: 0,
    reason: '',
    receipt_number: ''
  };
  loading = false;

  constructor(
    public dialogRef: MatDialogRef<CashAdjustmentModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { shift: Shift },
    private shiftService: ShiftService
  ) {}

  onCancel(): void {
    this.dialogRef.close();
  }

  onSave(): void {
    if (!this.request.amount || this.request.amount <= 0) {
      alert('El monto debe ser mayor a 0');
      return;
    }

    this.loading = true;
    this.shiftService.createCashAdjustment(this.data.shift.id, this.request)
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.dialogRef.close(true);
          } else {
            alert(response.message || 'Error al registrar el ajuste');
            this.loading = false;
          }
        },
        error: (error) => {
          console.error('Error creating cash adjustment:', error);
          alert('Error al registrar el ajuste');
          this.loading = false;
        }
      });
  }
}

