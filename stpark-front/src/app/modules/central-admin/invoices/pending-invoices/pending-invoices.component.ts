import { Component, OnInit, OnDestroy, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatSelectModule } from '@angular/material/select';
import { MatMenuModule } from '@angular/material/menu';
import { MatChipsModule } from '@angular/material/chips';
import { MatPaginatorModule, PageEvent, MatPaginatorIntl } from '@angular/material/paginator';
import { MatSortModule, MatSort } from '@angular/material/sort';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { InvoiceService } from 'app/core/services/invoice.service';
import { Invoice, InvoiceFilters } from 'app/interfaces/parking.interface';
import { getSpanishPaginatorIntl } from 'app/core/providers/spanish-paginator-intl';

@Component({
  selector: 'app-pending-invoices',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatTableModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatSelectModule,
    MatMenuModule,
    MatChipsModule,
    MatPaginatorModule,
    MatSortModule,
    MatDialogModule,
    MatSnackBarModule
  ],
  providers: [
    { provide: MatPaginatorIntl, useValue: getSpanishPaginatorIntl() }
  ],
  templateUrl: './pending-invoices.component.html',
  styleUrls: ['./pending-invoices.component.scss']
})
export class PendingInvoicesComponent implements OnInit, OnDestroy, AfterViewInit {
  private _unsubscribeAll: Subject<any> = new Subject<any>();

  @ViewChild(MatSort) sort!: MatSort;
  
  invoices: Invoice[] = [];
  loading = false;
  displayedColumns: string[] = ['folio', 'tenant_name', 'client_name', 'client_rut', 'emission_date', 'total_amount', 'status', 'actions'];
  
  // Modal properties
  showDetailsModal = false;
  showRejectModal = false;
  selectedInvoice: Invoice | null = null;
  loadingDetails = false;
  rejectReason = '';
  
  // Paginación
  totalItems = 0;
  pageSize = 10;
  currentPage = 0;
  pageSizeOptions = [5, 10, 25, 50];

  // Ordenamiento
  sortBy: string = 'created_at';
  sortOrder: 'asc' | 'desc' = 'desc';
  
  // Filtros
  filters: InvoiceFilters = {
    folio: '',
    client_name: '',
    client_rut: '',
    emission_date_from: '',
    emission_date_to: ''
  };

  constructor(
    private invoiceService: InvoiceService,
    private router: Router,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadPendingInvoices();
  }

  ngAfterViewInit(): void {
    if (this.sort) {
      this.sort.sortChange
        .pipe(takeUntil(this._unsubscribeAll))
        .subscribe(sort => {
          this.sortBy = sort.active;
          this.sortOrder = sort.direction === 'asc' ? 'asc' : 'desc';
          this.currentPage = 0;
          this.loadPendingInvoices();
        });
    }
  }

  ngOnDestroy(): void {
    this._unsubscribeAll.next(null);
    this._unsubscribeAll.complete();
  }

  loadPendingInvoices(): void {
    this.loading = true;
    
    const params: InvoiceFilters = {
      page: this.currentPage + 1,
      per_page: this.pageSize,
      sort_by: this.sortBy,
      sort_order: this.sortOrder,
      ...this.filters
    };

    this.invoiceService.getPendingInvoices(params)
      .pipe(takeUntil(this._unsubscribeAll))
      .subscribe({
        next: (response) => {
          this.invoices = (response.data as any)?.data || [];
          this.totalItems = (response.data as any)?.total || 0;
          this.loading = false;
        },
        error: (error) => {
          console.error('Error loading pending invoices:', error);
          this.snackBar.open('Error al cargar facturas pendientes', 'Cerrar', { duration: 3000 });
          this.loading = false;
        }
      });
  }

  formatAmount(amount: number): string {
    return this.invoiceService.formatAmount(amount);
  }

  formatDate(date: string | null | undefined): string {
    return this.invoiceService.formatDate(date);
  }

  formatRut(rut: string): string {
    return this.invoiceService.formatRut(rut);
  }

  getStatusColor(status: string): string {
    return this.invoiceService.getStatusColor(status);
  }

  getStatusLabel(status: string): string {
    return this.invoiceService.getStatusLabel(status);
  }

  onPageChange(event: PageEvent): void {
    this.currentPage = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadPendingInvoices();
  }

  applyFilters(): void {
    this.currentPage = 0;
    this.loadPendingInvoices();
  }

  clearFilters(): void {
    this.filters = {
      folio: '',
      client_name: '',
      client_rut: '',
      emission_date_from: '',
      emission_date_to: ''
    };
    this.currentPage = 0;
    this.loadPendingInvoices();
  }

  showInvoiceDetails(invoice: Invoice): void {
    this.showDetailsModal = true;
    this.loadingDetails = true;
    this.selectedInvoice = null;
    
    this.invoiceService.getInvoice(invoice.id!)
      .pipe(takeUntil(this._unsubscribeAll))
      .subscribe({
        next: (response) => {
          this.selectedInvoice = response.data;
          this.loadingDetails = false;
        },
        error: (error) => {
          console.error('Error loading invoice details:', error);
          this.loadingDetails = false;
          this.closeDetailsModal();
        }
      });
  }

  closeDetailsModal(): void {
    this.showDetailsModal = false;
    this.selectedInvoice = null;
    this.loadingDetails = false;
  }

  openRejectModal(invoice: Invoice): void {
    this.selectedInvoice = invoice;
    this.rejectReason = '';
    this.showRejectModal = true;
  }

  closeRejectModal(): void {
    this.showRejectModal = false;
    this.selectedInvoice = null;
    this.rejectReason = '';
  }

  acceptInvoice(invoice: Invoice): void {
    if (!confirm('¿Está seguro de que desea aceptar y emitir esta factura en el SII?')) {
      return;
    }

    this.loading = true;
    this.invoiceService.acceptInvoice(invoice.id!)
      .pipe(takeUntil(this._unsubscribeAll))
      .subscribe({
        next: (response) => {
          this.snackBar.open('Factura aceptada y emitida exitosamente', 'Cerrar', { duration: 3000 });
          this.loadPendingInvoices();
        },
        error: (error) => {
          console.error('Error accepting invoice:', error);
          this.snackBar.open('Error al aceptar factura: ' + (error.error?.message || 'Error desconocido'), 'Cerrar', { duration: 5000 });
          this.loading = false;
        }
      });
  }

  rejectInvoice(): void {
    if (!this.selectedInvoice) return;
    
    if (!this.rejectReason || this.rejectReason.trim().length === 0) {
      this.snackBar.open('Debe ingresar un motivo para rechazar la factura', 'Cerrar', { duration: 3000 });
      return;
    }

    this.loading = true;
    this.invoiceService.rejectInvoice(this.selectedInvoice.id!, this.rejectReason)
      .pipe(takeUntil(this._unsubscribeAll))
      .subscribe({
        next: (response) => {
          this.snackBar.open('Factura rechazada exitosamente', 'Cerrar', { duration: 3000 });
          this.closeRejectModal();
          this.loadPendingInvoices();
        },
        error: (error) => {
          console.error('Error rejecting invoice:', error);
          this.snackBar.open('Error al rechazar factura: ' + (error.error?.message || 'Error desconocido'), 'Cerrar', { duration: 5000 });
          this.loading = false;
        }
      });
  }

  goToInvoices(): void {
    this.router.navigate(['/central-admin/invoices']);
  }
}

