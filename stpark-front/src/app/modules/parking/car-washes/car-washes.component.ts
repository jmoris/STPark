import { AfterViewInit, Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil, forkJoin } from 'rxjs';

import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatPaginatorModule, PageEvent, MatPaginatorIntl } from '@angular/material/paginator';
import { MatSortModule, MatSort, Sort } from '@angular/material/sort';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';

import { FuseConfirmationService } from '@fuse/services/confirmation';
import { getSpanishPaginatorIntl } from 'app/core/providers/spanish-paginator-intl';

import { CarWashService } from 'app/core/services/car-wash.service';
import { CarWash, CarWashStatus, CarWashType, CarWashesApiResponse } from 'app/interfaces/car-wash.interface';
import { CarWashTypesModalComponent } from './car-wash-types-modal/car-wash-types-modal.component';
import { CarWashFormModalComponent, CarWashFormData } from './car-wash-form-modal/car-wash-form-modal.component';
import { ViewModalComponent, ViewModalData, ViewModalField } from 'app/shared/components/view-modal/view-modal.component';
import { CarWashPaymentModalComponent, CarWashPaymentModalData } from './car-wash-payment-modal/car-wash-payment-modal.component';

@Component({
  selector: 'app-car-washes',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatTableModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatPaginatorModule,
    MatSortModule,
    MatChipsModule,
    MatTooltipModule,
    MatMenuModule,
    MatDialogModule
  ],
  providers: [
    { provide: MatPaginatorIntl, useValue: getSpanishPaginatorIntl() }
  ],
  templateUrl: './car-washes.component.html',
  styleUrls: ['./car-washes.component.scss']
})
export class CarWashesComponent implements OnInit, OnDestroy, AfterViewInit {
  private _unsubscribeAll: Subject<any> = new Subject<any>();

  @ViewChild(MatSort) sort!: MatSort;

  // Data
  carWashes: CarWash[] = [];
  washTypes: CarWashType[] = [];
  loading = false;
  error: string | null = null;

  // Métricas
  totalCarWashes = 0;
  pendingCarWashes = 0;
  paidCarWashes = 0;
  totalRevenue = 0;
  loadingMetrics = false;

  // Paginación
  totalItems = 0;
  pageSize = 15;
  currentPage = 0;
  pageSizeOptions = [5, 10, 15, 25, 50];

  // Ordenamiento
  sortBy: string = 'performed_at';
  sortOrder: 'asc' | 'desc' = 'desc';

  // Filtros
  filters: { plate: string; status: CarWashStatus | '' } = {
    plate: '',
    status: ''
  };

  statusOptions: { value: CarWashStatus | ''; label: string }[] = [
    { value: '', label: 'Todos' },
    { value: 'PENDING', label: 'Pendiente' },
    { value: 'PAID', label: 'Pagado' }
  ];

  displayedColumns: string[] = [
    'plate',
    'type',
    'amount',
    'duration',
    'performed_at',
    'status',
    'actions'
  ];

  constructor(
    private carWashService: CarWashService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
    private confirmationService: FuseConfirmationService
  ) {}

  ngOnInit(): void {
    this.loadWashTypes();
    this.loadCarWashes();
    this.loadMetrics();
  }

  ngAfterViewInit(): void {
    if (this.sort) {
      setTimeout(() => {
        this.sort.active = this.sortBy;
        this.sort.direction = this.sortOrder;
      }, 0);
    }
  }

  ngOnDestroy(): void {
    this._unsubscribeAll.next(null);
    this._unsubscribeAll.complete();
  }

  loadWashTypes(): void {
    this.carWashService.getCarWashTypes()
      .pipe(takeUntil(this._unsubscribeAll))
      .subscribe({
        next: (resp) => {
          this.washTypes = resp.data || [];
        },
        error: (err) => {
          console.error('Error loading car wash types:', err);
          this.snackBar.open('Error al cargar tipos de lavado', 'Cerrar', { duration: 3000 });
        }
      });
  }

  loadCarWashes(): void {
    this.loading = true;
    this.error = null;

    const params: any = {
      page: this.currentPage + 1,
      per_page: this.pageSize,
      sort_by: this.sortBy,
      sort_order: this.sortOrder
    };

    if (this.filters.plate && this.filters.plate.trim() !== '') {
      params.plate = this.filters.plate.trim();
    }
    if (this.filters.status !== '') {
      params.status = this.filters.status;
    }

    this.carWashService.getCarWashes(params)
      .pipe(takeUntil(this._unsubscribeAll))
      .subscribe({
        next: (response: CarWashesApiResponse) => {
          this.carWashes = response.data || [];
          this.totalItems = response.pagination?.total || 0;
          this.loading = false;
        },
        error: (error) => {
          console.error('Error loading car washes:', error);
          this.error = 'Error al cargar lavados';
          this.loading = false;
          this.snackBar.open('Error al cargar lavados', 'Cerrar', { duration: 3000 });
        }
      });
  }

  onSortChange(event: Sort): void {
    if (event.active === this.sortBy) {
      this.sortOrder = this.sortOrder === 'desc' ? 'asc' : 'desc';
    } else {
      this.sortBy = event.active;
      this.sortOrder = event.direction === 'asc' ? 'asc' : 'desc';
    }
    this.currentPage = 0;
    this.loadCarWashes();
  }

  onPageChange(event: PageEvent): void {
    this.currentPage = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadCarWashes();
  }

  applyFilters(): void {
    this.currentPage = 0;
    this.loadCarWashes();
    this.loadMetrics();
  }

  clearFilters(): void {
    this.filters = { plate: '', status: '' };
    this.currentPage = 0;
    this.loadCarWashes();
    this.loadMetrics();
  }

  /**
   * Cargar métricas de lavados de autos (total, pendientes, pagados, recaudado)
   * Usa los mismos filtros que la tabla pero sin paginación para obtener conteos reales
   */
  loadMetrics(): void {
    this.loadingMetrics = true;

    // Construir filtros base (sin paginación ni ordenamiento)
    const baseFilters: any = {};

    if (this.filters.plate && this.filters.plate.trim() !== '') {
      baseFilters.plate = this.filters.plate.trim();
    }

    // Hacer consultas paralelas para obtener conteos
    const totalQuery = { ...baseFilters, page: 1, per_page: 1 };
    const pendingQuery = { ...baseFilters, status: 'PENDING', page: 1, per_page: 1 };
    const paidQuery = { ...baseFilters, status: 'PAID', page: 1, per_page: 1 };

    // Si hay un filtro de estado, solo consultar ese estado
    if (this.filters.status && this.filters.status.trim() !== '') {
      const statusQuery = { ...baseFilters, status: this.filters.status, page: 1, per_page: 1 };
      
      this.carWashService.getCarWashes(statusQuery)
        .pipe(takeUntil(this._unsubscribeAll))
        .subscribe({
          next: (response: CarWashesApiResponse) => {
            this.totalCarWashes = response.pagination?.total || 0;
            
            // Si hay filtro de estado, las métricas específicas dependen del estado filtrado
            if (this.filters.status === 'PENDING') {
              this.pendingCarWashes = response.pagination?.total || 0;
              this.paidCarWashes = 0;
              this.totalRevenue = 0;
            } else if (this.filters.status === 'PAID') {
              this.pendingCarWashes = 0;
              this.paidCarWashes = response.pagination?.total || 0;
              // Para calcular el total recaudado, necesitamos obtener todos los pagados
              this.calculateTotalRevenue(baseFilters);
            } else {
              this.pendingCarWashes = 0;
              this.paidCarWashes = 0;
              this.totalRevenue = 0;
            }
            this.loadingMetrics = false;
          },
          error: (error) => {
            console.error('Error loading metrics:', error);
            this.loadingMetrics = false;
          }
        });
    } else {
      // Sin filtro de estado, hacer consultas paralelas usando forkJoin
      forkJoin({
        total: this.carWashService.getCarWashes(totalQuery),
        pending: this.carWashService.getCarWashes(pendingQuery),
        paid: this.carWashService.getCarWashes(paidQuery)
      })
        .pipe(takeUntil(this._unsubscribeAll))
        .subscribe({
          next: (responses) => {
            this.totalCarWashes = responses.total?.pagination?.total || 0;
            this.pendingCarWashes = responses.pending?.pagination?.total || 0;
            this.paidCarWashes = responses.paid?.pagination?.total || 0;
            // Calcular total recaudado
            this.calculateTotalRevenue(baseFilters);
            this.loadingMetrics = false;
          },
          error: (error) => {
            console.error('Error loading metrics:', error);
            this.loadingMetrics = false;
          }
        });
    }
  }

  /**
   * Calcular el total recaudado de lavados pagados
   */
  private calculateTotalRevenue(baseFilters: any): void {
    // Obtener todos los lavados pagados sin paginación para calcular el total
    const paidQuery = { ...baseFilters, status: 'PAID', page: 1, per_page: 1000 };
    
    this.carWashService.getCarWashes(paidQuery)
      .pipe(takeUntil(this._unsubscribeAll))
      .subscribe({
        next: (response: CarWashesApiResponse) => {
          const paidWashes = response.data || [];
          this.totalRevenue = paidWashes.reduce((sum, wash) => sum + (wash.amount || 0), 0);
        },
        error: (error) => {
          console.error('Error calculating total revenue:', error);
          this.totalRevenue = 0;
        }
      });
  }

  // Métodos para estadísticas
  getTotalCarWashesCount(): number {
    return this.loadingMetrics ? 0 : this.totalCarWashes;
  }

  getPendingCarWashesCount(): number {
    return this.loadingMetrics ? 0 : this.pendingCarWashes;
  }

  getPaidCarWashesCount(): number {
    return this.loadingMetrics ? 0 : this.paidCarWashes;
  }

  getTotalRevenue(): number {
    return this.loadingMetrics ? 0 : this.totalRevenue;
  }

  openWashTypesModal(): void {
    const dialogRef = this.dialog.open(CarWashTypesModalComponent, {
      width: '900px',
      maxWidth: '95vw'
    });

    dialogRef.afterClosed().subscribe((changed) => {
      if (changed) {
        this.loadWashTypes();
      }
    });
  }

  openNewCarWashModal(): void {
    const dialogRef = this.dialog.open(CarWashFormModalComponent, {
      width: '520px',
      maxWidth: '95vw',
      data: {
        washTypes: this.washTypes,
        isEdit: false
      } as CarWashFormData
    });

    dialogRef.afterClosed().subscribe((created) => {
      if (created) {
        this.loadCarWashes();
        this.loadMetrics();
      }
    });
  }

  viewCarWash(carWash: CarWash): void {
    const typeName = this.getTypeName(carWash);
    const fields: ViewModalField[] = [
      {
        label: 'Placa',
        key: 'plate',
        icon: 'confirmation_number',
        type: 'text'
      },
      {
        label: 'Tipo de Lavado',
        key: 'car_wash_type',
        icon: 'local_car_wash',
        type: 'text',
        format: (value: any) => {
          if (value) {
            return value.name || typeName;
          }
          return typeName;
        }
      },
      {
        label: 'Monto',
        key: 'amount',
        icon: 'attach_money',
        type: 'text',
        format: (value: number) => this.formatAmount(value)
      },
      {
        label: 'Duración',
        key: 'duration_minutes',
        icon: 'schedule',
        type: 'text',
        format: (value: number | null) => value ? `${value} minutos` : 'No especificado'
      },
      {
        label: 'Estado',
        key: 'status',
        icon: 'info',
        type: 'badge',
        format: (value: CarWashStatus) => this.getStatusLabel(value),
        badgeColor: (value: CarWashStatus) => value === 'PAID' ? 'success' : 'warn'
      },
      {
        label: 'Fecha de Realización',
        key: 'performed_at',
        icon: 'event',
        type: 'text',
        format: (value: string | null) => value ? this.formatDateTime(value) : 'No especificado'
      },
      {
        label: 'Fecha de Pago',
        key: 'paid_at',
        icon: 'payment',
        type: 'text',
        format: (value: string | null) => value ? this.formatDateTime(value) : 'No especificado'
      },
      {
        label: 'Fecha de Creación',
        key: 'created_at',
        icon: 'schedule',
        type: 'text',
        format: (value: string | null) => value ? this.formatDateTime(value) : 'No especificado'
      }
    ];

    const dialogRef = this.dialog.open(ViewModalComponent, {
      width: '600px',
      data: {
        title: 'Detalles del Lavado',
        data: carWash,
        fields: fields,
        actions: [
          {
            label: 'Editar',
            icon: 'edit',
            color: 'primary',
            action: () => {
              dialogRef.close();
              this.editCarWash(carWash);
            }
          }
        ]
      } as ViewModalData
    });
  }

  editCarWash(carWash: CarWash): void {
    const dialogRef = this.dialog.open(CarWashFormModalComponent, {
      width: '520px',
      maxWidth: '95vw',
      data: {
        carWash: carWash,
        washTypes: this.washTypes,
        isEdit: true
      } as CarWashFormData
    });

    dialogRef.afterClosed().subscribe((updated) => {
      if (updated) {
        this.loadCarWashes();
        this.loadMetrics();
      }
    });
  }

  payCarWash(carWash: CarWash): void {
    if (carWash.status !== 'PENDING') {
      this.snackBar.open('Solo se pueden pagar lavados pendientes', 'Cerrar', { duration: 3000 });
      return;
    }

    const dialogRef = this.dialog.open(CarWashPaymentModalComponent, {
      width: '520px',
      maxWidth: '95vw',
      data: {
        carWash: carWash
      } as CarWashPaymentModalData
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result?.success) {
        this.loadCarWashes();
        this.loadMetrics();
      }
    });
  }

  getTypeName(wash: CarWash): string {
    // Laravel devuelve relaciones en camelCase
    const name = (wash as any).car_wash_type?.name || (wash as any).carWashType?.name;
    if (name) return name;
    const t = this.washTypes.find(x => x.id === wash.car_wash_type_id);
    return t?.name || 'N/A';
  }

  formatAmount(amount: number): string {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount || 0);
  }

  formatDateTime(date: string | null | undefined): string {
    if (!date) return 'N/A';
    const d = new Date(date);
    if (isNaN(d.getTime())) return 'N/A';
    
    const dateStr = d.toLocaleDateString('es-CL', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
    });
    const timeStr = d.toLocaleTimeString('es-CL', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
    return `${dateStr} ${timeStr}`;
  }

  getStatusLabel(status: CarWashStatus): string {
    return status === 'PAID' ? 'Pagado' : 'Pendiente';
  }

  getStatusColor(status: CarWashStatus): 'primary' | 'warn' | 'accent' {
    return status === 'PAID' ? 'accent' : 'warn';
  }
}


