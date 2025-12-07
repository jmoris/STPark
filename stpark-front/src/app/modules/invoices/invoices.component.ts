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
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { InvoiceService } from '../../core/services/invoice.service';
import { Invoice, InvoiceFilters } from '../../interfaces/parking.interface';
import { getSpanishPaginatorIntl } from 'app/core/providers/spanish-paginator-intl';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-invoices',
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
  ],
  providers: [
    { provide: MatPaginatorIntl, useValue: getSpanishPaginatorIntl() }
  ],
  templateUrl: './invoices.component.html',
  styleUrls: ['./invoices.component.scss']
})
export class InvoicesComponent implements OnInit, OnDestroy, AfterViewInit {
  private _unsubscribeAll: Subject<any> = new Subject<any>();

  @ViewChild(MatSort, { static: false }) sort!: MatSort;
  private sortInitialized = false;
  
  invoices: Invoice[] = [];
  loading = false;
  isCentralAdminMode = false;
  displayedColumns: string[] = [];
  
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

  constructor(
    private invoiceService: InvoiceService,
    private authService: AuthService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // Detectar si está en modo Administración Central
    this.isCentralAdminMode = this.authService.isCentralAdminMode();
    
    // Configurar columnas según el modo
    if (this.isCentralAdminMode) {
      this.displayedColumns = ['folio', 'tenant_name', 'client_name', 'client_rut', 'emission_date', 'payment_date', 'total_amount', 'status', 'actions'];
    } else {
      this.displayedColumns = ['folio', 'client_name', 'client_rut', 'emission_date', 'payment_date', 'total_amount', 'status', 'actions'];
    }
    
    this.loadInvoices();
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
      this.currentPage = 0; // Reset a la primera página al cambiar ordenamiento
      this.loadInvoices();
    }
  }

  ngOnDestroy(): void {
    this._unsubscribeAll.next(null);
    this._unsubscribeAll.complete();
  }

  loadInvoices(): void {
    this.loading = true;
    
    const params: InvoiceFilters = {
      page: this.currentPage + 1, // Backend usa 1-based indexing
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

  // Manejo de paginación
  onPageChange(event: PageEvent): void {
    this.currentPage = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadInvoices();
  }

  // Manejo de filtros
  applyFilters(): void {
    this.currentPage = 0; // Reset a la primera página
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

  showInvoiceDetails(invoice: Invoice): void {
    this.showDetailsModal = true;
    this.loadingDetails = true;
    this.selectedInvoice = null;
    
    // Cargar los detalles completos de la factura con todas las relaciones
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
          // Cerrar el modal si hay error
          this.closeDetailsModal();
        }
      });
  }

  closeDetailsModal(): void {
    this.showDetailsModal = false;
    this.selectedInvoice = null;
    this.loadingDetails = false;
  }

  payInvoice(invoice: Invoice): void {
    // TODO: Implementar lógica de pago
    console.log('Pagar factura:', invoice);
    // Aquí se puede abrir un modal de pago o redirigir a una página de pago
    // Por ahora solo mostramos un mensaje
    alert(`Función de pago para factura ${invoice.folio} - Próximamente`);
  }
}

