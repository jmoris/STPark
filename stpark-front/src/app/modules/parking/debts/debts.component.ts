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
import { MatMenuModule } from '@angular/material/menu';
import { MatChipsModule } from '@angular/material/chips';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { DebtService } from '../../../core/services/debt.service';
import { Debt } from '../../../interfaces/parking.interface';
import { DebtDetailsModalComponent } from './debt-details-modal/debt-details-modal.component';

@Component({
  selector: 'app-debts',
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
    MatMenuModule,
    MatChipsModule,
    MatDatepickerModule,
    MatPaginatorModule,
    DebtDetailsModalComponent
  ],
  templateUrl: './debts.component.html',
  styleUrls: ['./debts.component.scss']
})
export class DebtsComponent implements OnInit, OnDestroy {
  private _unsubscribeAll: Subject<any> = new Subject<any>();

  debts: Debt[] = [];
  loading = false;
  displayedColumns: string[] = ['plate', 'amount', 'origin', 'status', 'created_at', 'actions'];
  
  // Modal properties
  showDetailsModal = false;
  selectedDebt: Debt | null = null;
  
  // Paginación
  totalItems = 0;
  pageSize = 10;
  currentPage = 0;
  pageSizeOptions = [5, 10, 25, 50];
  
  // Filtros
  filters = {
    plate: '',
    origin: '',
    status: '',
    date_from: ''
  };

  constructor(private debtService: DebtService) {}

  ngOnInit(): void {
    this.loadDebts();
  }

  ngOnDestroy(): void {
    this._unsubscribeAll.next(null);
    this._unsubscribeAll.complete();
  }

  loadDebts(): void {
    this.loading = true;
    
    const params = {
      page: this.currentPage + 1, // Backend usa 1-based indexing
      per_page: this.pageSize,
      ...this.filters
    };

    this.debtService.getDebts(params)
      .pipe(takeUntil(this._unsubscribeAll))
      .subscribe({
        next: (response) => {
          this.debts = (response.data as any)?.data || [];
          this.totalItems = (response.data as any)?.total || 0;
          this.loading = false;
        },
        error: (error) => {
          console.error('Error loading debts:', error);
          this.loading = false;
        }
      });
  }

  formatAmount(amount: number): string {
    return this.debtService.formatAmount(amount);
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'PENDING': return 'orange';
      case 'SETTLED': return 'green';
      default: return 'gray';
    }
  }

  getOriginColor(origin: string): string {
    switch (origin) {
      case 'SESSION': return 'blue';
      case 'FINE': return 'red';
      case 'MANUAL': return 'purple';
      default: return 'gray';
    }
  }

  getOriginLabel(origin: string): string {
    switch (origin) {
      case 'SESSION': return 'Sesión';
      case 'FINE': return 'Multa';
      case 'MANUAL': return 'Manual';
      default: return origin;
    }
  }

  getPendingCount(): number {
    return this.debts.filter(debt => debt.status === 'PENDING').length;
  }

  getSettledCount(): number {
    return this.debts.filter(debt => debt.status === 'SETTLED').length;
  }

  getTotalPending(): number {
    return this.debts
      .filter(debt => debt.status === 'PENDING')
      .reduce((total, debt) => total + debt.principal_amount, 0);
  }

  settleDebt(debt: Debt): void {
    // Implementar lógica para liquidar deuda
    console.log('Settling debt:', debt);
  }

  showDebtDetails(debt: Debt): void {
    this.loading = true;
    
    // Cargar los detalles completos de la deuda con todas las relaciones
    this.debtService.getDebt(debt.id!)
      .pipe(takeUntil(this._unsubscribeAll))
      .subscribe({
        next: (response) => {
          this.selectedDebt = response.data;
          this.showDetailsModal = true;
          this.loading = false;
        },
        error: (error) => {
          console.error('Error loading debt details:', error);
          this.loading = false;
        }
      });
  }

  closeDetailsModal(): void {
    this.showDetailsModal = false;
    this.selectedDebt = null;
  }

  printDebt(debt: Debt): void {
    // Implementar lógica para imprimir deuda
    console.log('Printing debt:', debt);
  }

  // Manejo de paginación
  onPageChange(event: PageEvent): void {
    this.currentPage = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadDebts();
  }

  // Manejo de filtros
  applyFilters(): void {
    this.currentPage = 0; // Reset a la primera página
    this.loadDebts();
  }

  clearFilters(): void {
    this.filters = {
      plate: '',
      origin: '',
      status: '',
      date_from: ''
    };
    this.currentPage = 0;
    this.loadDebts();
  }
}