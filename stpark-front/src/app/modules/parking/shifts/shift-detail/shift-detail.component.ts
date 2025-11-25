import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatTableModule } from '@angular/material/table';
import { Subject, takeUntil } from 'rxjs';
import { ShiftService } from '../../../../core/services/shift.service';
import { Shift, ShiftTotals, ShiftReport } from '../../../../interfaces/parking.interface';

@Component({
  selector: 'app-shift-detail',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    MatTableModule
  ],
  templateUrl: './shift-detail.component.html',
  styleUrls: ['./shift-detail.component.scss']
})
export class ShiftDetailComponent implements OnInit, OnDestroy {
  private _unsubscribeAll: Subject<any> = new Subject<any>();

  shift: Shift | null = null;
  totals: ShiftTotals | null = null;
  report: ShiftReport | null = null;
  loading = false;
  shiftId: string = '';

  displayedColumns: string[] = ['method', 'collected', 'count'];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private shiftService: ShiftService
  ) {}

  ngOnInit(): void {
    this.shiftId = this.route.snapshot.paramMap.get('id') || '';
    if (this.shiftId) {
      this.loadShift();
    }
  }

  ngOnDestroy(): void {
    this._unsubscribeAll.next(null);
    this._unsubscribeAll.complete();
  }

  loadShift(): void {
    this.loading = true;
    this.shiftService.getShift(this.shiftId)
      .pipe(takeUntil(this._unsubscribeAll))
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.shift = response.data.shift;
            this.totals = response.data.totals;
            this.loadReport();
          }
          this.loading = false;
        },
        error: (error) => {
          console.error('Error loading shift:', error);
          this.loading = false;
        }
      });
  }

  loadReport(): void {
    this.shiftService.getShiftReport(this.shiftId)
      .pipe(takeUntil(this._unsubscribeAll))
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.report = response.data;
          }
        },
        error: (error) => console.error('Error loading report:', error)
      });
  }

  formatAmount(amount: number): string {
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(amount);
  }

  formatDate(date: string | null | undefined): string {
    if (!date) return '-';
    const dateObj = new Date(date);
    
    // Verificar si la fecha es válida
    if (isNaN(dateObj.getTime())) {
      return '-';
    }
    
    // Formatear fecha en formato DD/MM/YYYY
    const dateStr = dateObj.toLocaleDateString('es-CL', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
    });
    
    // Formatear hora en formato 24 horas HH:mm
    const timeStr = dateObj.toLocaleTimeString('es-CL', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
    
    return `${dateStr} ${timeStr}`;
  }

  getMethodIcon(method: string): string {
    switch (method) {
      case 'CASH': return 'payments';
      case 'CARD': return 'credit_card';
      case 'WEBPAY': return 'account_balance';
      case 'TRANSFER': return 'account_balance_wallet';
      default: return 'payment';
    }
  }

  getMethodText(method: string): string {
    switch (method) {
      case 'CASH': return 'Efectivo';
      case 'CARD': return 'Tarjeta';
      case 'WEBPAY': return 'Webpay';
      case 'TRANSFER': return 'Transferencia';
      default: return method;
    }
  }

  goBack(): void {
    this.router.navigate(['/parking/shifts']);
  }

  downloadReport(format: 'json' | 'pdf' | 'excel' = 'json'): void {
    this.shiftService.getShiftReport(this.shiftId, format)
      .subscribe({
        next: (response) => {
          if (response.success) {
            // TODO: Implementar descarga
            console.log('Report:', response.data);
          }
        },
        error: (error) => console.error('Error downloading report:', error)
      });
  }
}

