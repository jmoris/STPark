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
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSortModule } from '@angular/material/sort';
import { MatMenuModule } from '@angular/material/menu';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { PaymentService } from '../../../core/services/payment.service';
import { Payment } from '../../../interfaces/parking.interface';
import { PaymentDetailsModalComponent } from './payment-details-modal/payment-details-modal.component';

@Component({
  selector: 'app-payments',
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
    MatSortModule,
    MatMenuModule,
    PaymentDetailsModalComponent
  ],
  templateUrl: './payments.component.html',
  styleUrls: ['./payments.component.scss']
})
export class PaymentsComponent implements OnInit, OnDestroy {
  private _unsubscribeAll: Subject<any> = new Subject<any>();

  payments: Payment[] = [];
  loading = false;
  displayedColumns: string[] = ['id', 'amount', 'method', 'status', 'created_at', 'actions'];
  
  // Paginación
  totalItems = 0;
  pageSize = 10;
  currentPage = 0;
  pageSizeOptions = [5, 10, 25, 50];
  
  // Filtros
  filters = {
    method: '',
    status: '',
    date_from: '',
    date_to: ''
  };

  // Modal de detalles
  showDetailsModal = false;
  selectedPayment: Payment | null = null;

  constructor(private paymentService: PaymentService) {}

  ngOnInit(): void {
    this.loadPayments();
  }

  ngOnDestroy(): void {
    this._unsubscribeAll.next(null);
    this._unsubscribeAll.complete();
  }

  loadPayments(): void {
    this.loading = true;
    
    const params = {
      page: this.currentPage + 1, // Backend usa 1-based indexing
      per_page: this.pageSize,
      ...this.filters
    };

    this.paymentService.getPayments(params)
      .pipe(takeUntil(this._unsubscribeAll))
      .subscribe({
        next: (response) => {
          this.payments = (response.data as any)?.data || [];
          this.totalItems = (response.data as any)?.total || 0;
          this.loading = false;
        },
        error: (error) => {
          console.error('Error loading payments:', error);
          this.loading = false;
        }
      });
  }

  formatAmount(amount: number): string {
    return this.paymentService.formatAmount(amount);
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'COMPLETED': return 'green';
      case 'PENDING': return 'orange';
      case 'FAILED': return 'red';
      default: return 'gray';
    }
  }

  getMethodIcon(method: string): string {
    switch (method) {
      case 'CASH': return 'payments';
      case 'CARD': return 'credit_card';
      case 'WEBPAY': return 'account_balance';
      default: return 'payment';
    }
  }

  // Manejo de paginación
  onPageChange(event: PageEvent): void {
    this.currentPage = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadPayments();
  }

  // Manejo de filtros
  applyFilters(): void {
    this.currentPage = 0; // Reset a la primera página
    this.loadPayments();
  }

  clearFilters(): void {
    this.filters = {
      method: '',
      status: '',
      date_from: '',
      date_to: ''
    };
    this.currentPage = 0;
    this.loadPayments();
  }

  // Métodos para el modal de detalles
  showPaymentDetails(payment: Payment): void {
    this.loading = true;
    
    // Cargar los detalles completos del pago con todas las relaciones
    this.paymentService.getPayment(payment.id!)
      .pipe(takeUntil(this._unsubscribeAll))
      .subscribe({
        next: (response) => {
          this.selectedPayment = response.data;
          this.showDetailsModal = true;
          this.loading = false;
        },
        error: (error) => {
          console.error('Error loading payment details:', error);
          this.loading = false;
        }
      });
  }

  closeDetailsModal(): void {
    this.showDetailsModal = false;
    this.selectedPayment = null;
  }

  printReceipt(payment: Payment): void {
    // Esta funcionalidad se maneja desde el modal
    this.showPaymentDetails(payment);
  }

  retryPayment(payment: Payment): void {
    // TODO: Implementar lógica de reintento de pago
    console.log('Reintentando pago:', payment.id);
  }
}
