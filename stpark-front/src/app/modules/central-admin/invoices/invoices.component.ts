import { Component, OnInit, OnDestroy, ViewChild, AfterViewInit, ChangeDetectorRef } from '@angular/core';
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
import { MatSortModule, MatSort, Sort } from '@angular/material/sort';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { Router } from '@angular/router';
import { InvoiceService } from 'app/core/services/invoice.service';
import { TenantService, Tenant } from 'app/core/services/tenant.service';
import { AuthService } from 'app/core/services/auth.service';
import { Invoice, InvoiceFilters } from 'app/interfaces/parking.interface';
import { InvoiceFormComponent, InvoiceFormData } from './invoice-form/invoice-form.component';
import { InvoicePaymentComponent, InvoicePaymentData } from './invoice-payment/invoice-payment.component';
import { getSpanishPaginatorIntl } from 'app/core/providers/spanish-paginator-intl';

@Component({
  selector: 'app-central-admin-invoices',
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
  templateUrl: './invoices.component.html',
  styleUrls: ['./invoices.component.scss']
})
export class CentralAdminInvoicesComponent implements OnInit, OnDestroy, AfterViewInit {
  private _unsubscribeAll: Subject<any> = new Subject<any>();

  @ViewChild(MatSort, { static: false }) sort!: MatSort;
  private sortInitialized = false;
  
  invoices: Invoice[] = [];
  loading = false;
  displayedColumns: string[] = ['folio', 'tenant_name', 'client_name', 'client_rut', 'emission_date', 'payment_date', 'total_amount', 'status', 'actions'];
  
  // Modal properties
  showDetailsModal = false;
  selectedInvoice: Invoice | null = null;
  loadingDetails = false;
  
  // Paginación
  totalItems = 0;
  pageSize = 10;
  currentPage = 0;
  pageSizeOptions = [5, 10, 25, 50];

  // Ordenamiento
  sortBy: string = 'folio';
  sortOrder: 'asc' | 'desc' = 'desc';
  
  // Filtros
  filters: InvoiceFilters = {
    folio: '',
    client_name: '',
    client_rut: '',
    status: '',
    emission_date_from: '',
    emission_date_to: ''
  };

  // Tenants para el formulario
  tenants: Tenant[] = [];
  
  // Verificar si es administrador central
  isCentralAdmin = false;

  constructor(
    private invoiceService: InvoiceService,
    private tenantService: TenantService,
    private authService: AuthService,
    private router: Router,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef
  ) {
    this.isCentralAdmin = this.authService.isCentralAdminMode();
  }

  ngOnInit(): void {
    this.loadInvoices();
    this.loadTenants();
  }

  ngAfterViewInit(): void {
    this.initializeSort();
  }

  private initializeSort(): void {
    // Sincronizar el estado inicial del sort cuando la tabla esté renderizada
    const tryInitialize = () => {
      if (!this.loading && this.sort && !this.sortInitialized) {
        try {
          // Sincronizar el estado inicial del sort
          this.sort.active = this.sortBy;
          this.sort.direction = this.sortOrder;
          this.sortInitialized = true;
          this.cdr.detectChanges();
        } catch (error) {
          console.error('Error initializing sort:', error);
          // Reintentar si hay error
          if (!this.sortInitialized) {
            setTimeout(tryInitialize, 100);
          }
        }
      } else if (!this.sortInitialized && !this.loading) {
        // Reintentar después de un breve delay si la tabla aún no está renderizada
        setTimeout(tryInitialize, 100);
      }
    };
    
    setTimeout(tryInitialize, 0);
  }

  onSortChange(event: Sort): void {
    if (event.active) {
      this.sortBy = event.active;
      this.sortOrder = event.direction === 'asc' ? 'asc' : 'desc';
      this.currentPage = 0;
      this.loadInvoices();
    }
  }

  ngOnDestroy(): void {
    this._unsubscribeAll.next(null);
    this._unsubscribeAll.complete();
  }

  loadTenants(): void {
    this.tenantService.getTenants({ per_page: 1000 })
      .pipe(takeUntil(this._unsubscribeAll))
      .subscribe({
        next: (response) => {
          this.tenants = (response.data as any)?.data || [];
        },
        error: (error) => {
          console.error('Error loading tenants:', error);
        }
      });
  }

  loadInvoices(): void {
    this.loading = true;
    
    const params: InvoiceFilters = {
      page: this.currentPage + 1,
      per_page: this.pageSize,
      sort_by: this.sortBy,
      sort_order: this.sortOrder,
      ...this.filters
    };

    this.invoiceService.getInvoices(params)
      .pipe(takeUntil(this._unsubscribeAll))
      .subscribe({
        next: (response) => {
          this.invoices = (response.data as any)?.data || [];
          this.totalItems = (response.data as any)?.total || 0;
          this.loading = false;
          // Inicializar el sort después de que los datos se carguen y la tabla se renderice
          // Usar un pequeño delay para asegurar que Angular haya renderizado la tabla
          setTimeout(() => {
            if (!this.sortInitialized) {
              this.initializeSort();
            } else if (this.sort) {
              // Sincronizar el estado del sort con los valores actuales
              this.sort.active = this.sortBy;
              this.sort.direction = this.sortOrder;
            }
          }, 50);
        },
        error: (error) => {
          console.error('Error loading invoices:', error);
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
    this.loadInvoices();
  }

  applyFilters(): void {
    this.currentPage = 0;
    this.loadInvoices();
  }

  clearFilters(): void {
    this.filters = {
      folio: '',
      client_name: '',
      client_rut: '',
      status: '',
      emission_date_from: '',
      emission_date_to: ''
    };
    this.currentPage = 0;
    this.loadInvoices();
  }

  createInvoice(): void {
    const dialogRef = this.dialog.open(InvoiceFormComponent, {
      width: '900px',
      maxWidth: '95vw',
      maxHeight: '95vh',
      data: { isEdit: false, tenants: this.tenants } as InvoiceFormData
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loadInvoices();
      }
    });
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

  goToPendingInvoices(): void {
    this.router.navigate(['/central-admin/invoices/pending']);
  }

  openPaymentModal(invoice: Invoice): void {
    const dialogRef = this.dialog.open(InvoicePaymentComponent, {
      width: '600px',
      maxWidth: '95vw',
      data: { invoice } as InvoicePaymentData
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.processPayment(invoice.id!, result);
      }
    });
  }

  processPayment(invoiceId: number, paymentData: any): void {
    this.loading = true;
    this.invoiceService.payInvoice(invoiceId, paymentData)
      .pipe(takeUntil(this._unsubscribeAll))
      .subscribe({
        next: (response) => {
          this.snackBar.open('Pago registrado exitosamente', 'Cerrar', { duration: 3000 });
          this.loadInvoices();
        },
        error: (error) => {
          console.error('Error processing payment:', error);
          this.snackBar.open('Error al registrar pago: ' + (error.error?.message || 'Error desconocido'), 'Cerrar', { duration: 5000 });
          this.loading = false;
        }
      });
  }
}

