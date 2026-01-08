import { Component, OnInit, OnDestroy, ViewChild, AfterViewInit, ChangeDetectorRef, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
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
import { MatDialogModule } from '@angular/material/dialog';
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
    MatDialogModule,
    MatSnackBarModule,
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
    private cdr: ChangeDetectorRef,
    private dialog: MatDialog,
    private route: ActivatedRoute,
    private router: Router,
    private snackBar: MatSnackBar
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
    
    // Verificar parámetros de query string para mostrar mensajes de pago
    this.checkPaymentStatus();
    
    this.loadInvoices();
  }

  /**
   * Verificar parámetros de query string relacionados con el pago de WebPay
   */
  private checkPaymentStatus(): void {
    this.route.queryParams
      .pipe(takeUntil(this._unsubscribeAll))
      .subscribe(params => {
        const paymentStatus = params['payment'];
        const invoiceId = params['invoice_id'];

        if (paymentStatus && invoiceId) {
          // Limpiar parámetros de la URL
          this.router.navigate([], {
            relativeTo: this.route,
            queryParams: {},
            replaceUrl: true
          });

          // Mostrar mensaje según el estado del pago
          switch (paymentStatus) {
            case 'success':
              this.snackBar.open(
                `¡Pago realizado exitosamente! La factura ha sido actualizada.`,
                'Cerrar',
                {
                  duration: 5000,
                  panelClass: ['success-snackbar'],
                  horizontalPosition: 'end',
                  verticalPosition: 'top'
                }
              );
              // Recargar las facturas para mostrar el estado actualizado
              this.loadInvoices();
              break;

            case 'failed':
              this.snackBar.open(
                `El pago no pudo ser procesado. Por favor, intente nuevamente.`,
                'Cerrar',
                {
                  duration: 5000,
                  panelClass: ['error-snackbar'],
                  horizontalPosition: 'end',
                  verticalPosition: 'top'
                }
              );
              break;

            case 'cancelled':
              this.snackBar.open(
                `El pago fue cancelado.`,
                'Cerrar',
                {
                  duration: 4000,
                  panelClass: ['warning-snackbar'],
                  horizontalPosition: 'end',
                  verticalPosition: 'top'
                }
              );
              break;

            case 'error':
              this.snackBar.open(
                `Ocurrió un error al procesar el pago. Por favor, contacte con soporte si el problema persiste.`,
                'Cerrar',
                {
                  duration: 6000,
                  panelClass: ['error-snackbar'],
                  horizontalPosition: 'end',
                  verticalPosition: 'top'
                }
              );
              break;
          }
        }
      });
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
    if (!invoice.id) {
      console.error('La factura no tiene ID');
      return;
    }

    // Abrir diálogo de confirmación
    const dialogRef = this.dialog.open(WebPayConfirmDialogComponent, {
      width: '500px',
      maxWidth: '90vw',
      disableClose: true,
      data: {
        folio: invoice.folio,
        amount: this.formatAmount(invoice.total_amount)
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.initiateWebPayPayment(invoice);
      }
    });
  }

  private initiateWebPayPayment(invoice: Invoice): void {
    if (!invoice.id) {
      return;
    }

    this.loading = true;

    // Iniciar pago con WebPay
    this.invoiceService.initiateWebPayPayment(invoice.id)
      .pipe(takeUntil(this._unsubscribeAll))
      .subscribe({
        next: (response) => {
          this.loading = false;
          
          if (response.success && response.data) {
            // Crear y enviar formulario dinámicamente para cumplir con CSP
            this.submitWebPayForm(response.data.url, response.data.token);
          } else {
            this.showError('Error al iniciar el pago. Por favor, intente nuevamente.');
          }
        },
        error: (error) => {
          this.loading = false;
          console.error('Error al iniciar pago:', error);
          
          const errorMessage = error.error?.message || 'Error al iniciar el pago. Por favor, intente nuevamente.';
          this.showError(errorMessage);
        }
      });
  }

  /**
   * Crear y enviar formulario para WebPay sin violar CSP
   * WebPay requiere un POST con el token_ws
   */
  private submitWebPayForm(url: string, token: string): void {
    // Crear formulario dinámicamente
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = url;
    form.style.display = 'none';

    // Crear campo oculto con el token
    const tokenInput = document.createElement('input');
    tokenInput.type = 'hidden';
    tokenInput.name = 'token_ws';
    tokenInput.value = token;

    // Agregar al formulario
    form.appendChild(tokenInput);
    document.body.appendChild(form);

    // Enviar formulario
    form.submit();
  }

  /**
   * Mostrar error usando diálogo en lugar de alert
   */
  private showError(message: string): void {
    this.dialog.open(WebPayErrorDialogComponent, {
      width: '500px',
      maxWidth: '90vw',
      disableClose: false,
      data: { message }
    });
  }
}

/**
 * Componente de diálogo para confirmación de pago WebPay
 */
@Component({
  selector: 'app-webpay-confirm-dialog',
  template: `
    <div class="p-6">
      <div class="flex items-center mb-4">
        <mat-icon class="text-blue-600 text-5xl mr-4">payment</mat-icon>
        <h2 mat-dialog-title class="text-2xl font-bold text-gray-900 m-0">Confirmar Pago</h2>
      </div>
      <mat-dialog-content class="mb-6">
        <div class="bg-blue-50 p-4 rounded-lg">
          <p class="text-gray-700 mb-2">
            <span class="font-semibold">Factura:</span> {{ data.folio }}
          </p>
          <p class="text-gray-700">
            <span class="font-semibold">Monto a pagar:</span> 
            <span class="text-blue-600 font-bold text-xl">{{ data.amount }}</span>
          </p>
        </div>
        <p class="text-gray-600 mt-4">
          Serás redirigido a WebPay para completar el pago de forma segura.
        </p>
      </mat-dialog-content>
      <mat-dialog-actions align="end" class="gap-2">
        <button mat-stroked-button (click)="onNoClick()" class="rounded-sm">
          <mat-icon>close</mat-icon>
          Cancelar
        </button>
        <button mat-raised-button color="primary" (click)="onYesClick()" cdkFocusInitial class="rounded-sm">
          <mat-icon>payment</mat-icon>
          Continuar con el Pago
        </button>
      </mat-dialog-actions>
    </div>
  `,
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule]
})
export class WebPayConfirmDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<WebPayConfirmDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { folio: string; amount: string }
  ) {}

  onNoClick(): void {
    this.dialogRef.close(false);
  }

  onYesClick(): void {
    this.dialogRef.close(true);
  }
}

/**
 * Componente de diálogo para mostrar errores
 */
@Component({
  selector: 'app-webpay-error-dialog',
  template: `
    <div class="p-6">
      <div class="flex items-center mb-4">
        <mat-icon class="text-red-600 text-5xl mr-4">error</mat-icon>
        <h2 mat-dialog-title class="text-2xl font-bold text-gray-900 m-0">Error en el Pago</h2>
      </div>
      <mat-dialog-content class="mb-6">
        <div class="bg-red-50 p-4 rounded-lg border border-red-200">
          <p class="text-red-800">{{ data.message }}</p>
        </div>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-raised-button color="primary" (click)="onClose()" cdkFocusInitial class="rounded-sm">
          <mat-icon>check</mat-icon>
          Aceptar
        </button>
      </mat-dialog-actions>
    </div>
  `,
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule]
})
export class WebPayErrorDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<WebPayErrorDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { message: string }
  ) {}

  onClose(): void {
    this.dialogRef.close();
  }
}
