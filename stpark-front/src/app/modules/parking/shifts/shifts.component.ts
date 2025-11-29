import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatSelectModule } from '@angular/material/select';
import { MatPaginatorModule, PageEvent, MatPaginatorIntl } from '@angular/material/paginator';
import { MatChipsModule } from '@angular/material/chips';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { ShiftService } from '../../../core/services/shift.service';
import { OperatorService } from '../../../core/services/operator.service';
import { SectorService } from '../../../core/services/sector.service';
import { Shift, ShiftFilters, Operator, Sector } from '../../../interfaces/parking.interface';
import { Router } from '@angular/router';
import { OpenShiftModalComponent } from './open-shift-modal/open-shift-modal.component';
import { CloseShiftModalComponent } from './close-shift-modal/close-shift-modal.component';
import { CashAdjustmentModalComponent } from './cash-adjustment-modal/cash-adjustment-modal.component';
import { getSpanishPaginatorIntl } from 'app/core/providers/spanish-paginator-intl';

@Component({
  selector: 'app-shifts',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatTableModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatToolbarModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatSelectModule,
    MatPaginatorModule,
    MatChipsModule,
    MatMenuModule,
    MatDialogModule,
    MatSnackBarModule
  ],
  providers: [
    { provide: MatPaginatorIntl, useValue: getSpanishPaginatorIntl() }
  ],
  templateUrl: './shifts.component.html',
  styleUrls: ['./shifts.component.scss']
})
export class ShiftsComponent implements OnInit, OnDestroy {
  private _unsubscribeAll: Subject<any> = new Subject<any>();

  shifts: Shift[] = [];
  loading = false;
  displayedColumns: string[] = ['id', 'operator', 'sector', 'opened_at', 'closed_at', 'status', 'totals', 'actions'];
  
  // Paginación
  totalItems = 0;
  pageSize = 15;
  currentPage = 0;
  pageSizeOptions = [10, 15, 25, 50];
  
  // Filtros
  filters: ShiftFilters = {
    from: '',
    to: '',
    operator_id: undefined,
    sector_id: undefined,
    status: undefined,
    per_page: 15
  };

  // Listas para filtros
  operators: Operator[] = [];
  sectors: Sector[] = [];

  // Turno actual
  currentShift: Shift | null = null;
  currentShiftTotals: any = null;
  loadingCurrentShift = false;

  constructor(
    private shiftService: ShiftService,
    private operatorService: OperatorService,
    private sectorService: SectorService,
    private router: Router,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadOperators();
    this.loadSectors();
    this.loadShifts();
    this.loadCurrentShift();
  }

  ngOnDestroy(): void {
    this._unsubscribeAll.next(null);
    this._unsubscribeAll.complete();
  }

  loadOperators(): void {
    this.operatorService.getOperators()
      .pipe(takeUntil(this._unsubscribeAll))
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.operators = (response.data as any)?.data || response.data || [];
          }
        },
        error: (error) => console.error('Error loading operators:', error)
      });
  }

  loadSectors(): void {
    this.sectorService.getSectors()
      .pipe(takeUntil(this._unsubscribeAll))
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.sectors = (response.data as any)?.data || response.data || [];
          }
        },
        error: (error) => console.error('Error loading sectors:', error)
      });
  }

  loadShifts(): void {
    this.loading = true;
    
    const params = {
      ...this.filters,
      page: this.currentPage + 1, // Backend usa 1-based indexing
      per_page: this.pageSize
    };

    // Limpiar valores undefined
    Object.keys(params).forEach(key => {
      if (params[key as keyof ShiftFilters] === undefined) {
        delete params[key as keyof ShiftFilters];
      }
    });
    
    this.shiftService.getShifts(params)
      .pipe(takeUntil(this._unsubscribeAll))
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            const paginatedData = response.data as any;
            if (paginatedData.data) {
              // Respuesta paginada
              this.shifts = paginatedData.data || [];
              this.totalItems = paginatedData.total || 0;
            } else {
              // Respuesta simple array
              this.shifts = Array.isArray(response.data) ? response.data : [];
              this.totalItems = this.shifts.length;
            }
          }
          this.loading = false;
        },
        error: (error) => {
          console.error('Error loading shifts:', error);
          this.loading = false;
        }
      });
  }

  loadCurrentShift(): void {
    // Obtener el operador actual del almacenamiento o servicio de auth
    // Por ahora asumimos que hay un operador seleccionado
    const operatorId = this.getCurrentOperatorId();
    if (operatorId) {
      this.loadingCurrentShift = true;
      this.shiftService.getCurrentShift(operatorId)
        .pipe(takeUntil(this._unsubscribeAll))
        .subscribe({
          next: (response) => {
            if (response.success && response.data) {
              this.currentShift = response.data.shift || null;
              this.currentShiftTotals = response.data.totals || null;
            } else {
              this.currentShift = null;
              this.currentShiftTotals = null;
            }
            this.loadingCurrentShift = false;
          },
          error: (error) => {
            console.error('Error loading current shift:', error);
            this.currentShift = null;
            this.loadingCurrentShift = false;
          }
        });
    }
  }

  getCurrentOperatorId(): number | null {
    // TODO: Obtener del servicio de autenticación
    // Por ahora retornamos null para permitir selección manual
    return null;
  }

  // Métodos de utilidad
  formatAmount(amount: number): string {
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(amount);
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'OPEN': return 'green';
      case 'CLOSED': return 'blue';
      case 'CANCELED': return 'red';
      default: return 'gray';
    }
  }

  getStatusText(status: string): string {
    switch (status) {
      case 'OPEN': return 'Abierto';
      case 'CLOSED': return 'Cerrado';
      case 'CANCELED': return 'Cancelado';
      default: return status;
    }
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

  abs(value: number | null | undefined): number {
    if (value === null || value === undefined) return 0;
    return Math.abs(value);
  }

  // Manejo de paginación
  onPageChange(event: PageEvent): void {
    this.currentPage = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadShifts();
  }

  // Manejo de filtros
  applyFilters(): void {
    this.currentPage = 0;
    this.loadShifts();
  }

  clearFilters(): void {
    this.filters = {
      from: '',
      to: '',
      operator_id: undefined,
      sector_id: undefined,
      status: undefined,
      per_page: 15
    };
    this.currentPage = 0;
    this.loadShifts();
  }

  // Acciones de turno
  openShiftModal(): void {
    const dialogRef = this.dialog.open(OpenShiftModalComponent, {
      width: '500px',
      data: {
        operators: this.operators,
        sectors: this.sectors
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loadShifts();
        this.loadCurrentShift();
      }
    });
  }

  closeShiftModal(shift: Shift): void {
    const dialogRef = this.dialog.open(CloseShiftModalComponent, {
      width: '500px',
      data: { shift }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loadShifts();
        this.loadCurrentShift();
      }
    });
  }

  cashAdjustmentModal(shift: Shift): void {
    const dialogRef = this.dialog.open(CashAdjustmentModalComponent, {
      width: '500px',
      data: { shift }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loadShifts();
        this.loadCurrentShift();
      }
    });
  }

  viewShiftDetails(shift: Shift): void {
    this.router.navigate(['/parking/shifts', shift.id]);
  }

  cancelShift(shift: Shift): void {
    if (confirm(`¿Está seguro de cancelar el turno #${shift.id}?`)) {
      this.loading = true;
      this.shiftService.cancelShift(shift.id)
        .pipe(takeUntil(this._unsubscribeAll))
        .subscribe({
          next: (response) => {
            if (response.success) {
              this.loadShifts();
              this.loadCurrentShift();
            }
            this.loading = false;
          },
          error: (error) => {
            console.error('Error canceling shift:', error);
            this.loading = false;
          }
        });
    }
  }

  downloadReport(shift: Shift): void {
    this.shiftService.downloadShiftReportPdf(shift.id)
      .pipe(takeUntil(this._unsubscribeAll))
      .subscribe({
        next: (blob: Blob) => {
          // Crear un enlace temporal para descargar el archivo
          const downloadUrl = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = downloadUrl;
          
          // Generar nombre de archivo con ID del turno y fecha
          const shiftIdShort = shift.id.substring(0, 8);
          const dateStr = new Date().toISOString().split('T')[0];
          link.download = `reporte-turno-${shiftIdShort}-${dateStr}.pdf`;
          
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(downloadUrl);
          
          this.snackBar.open('Reporte descargado exitosamente', 'Cerrar', { duration: 3000 });
        },
        error: (error) => {
          console.error('Error downloading report:', error);
          this.snackBar.open('Error al descargar el reporte', 'Cerrar', { duration: 3000 });
        }
      });
  }
}

