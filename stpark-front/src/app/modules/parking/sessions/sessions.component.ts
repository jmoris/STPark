import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, takeUntil, debounceTime, distinctUntilChanged } from 'rxjs';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSortModule } from '@angular/material/sort';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatCardModule } from '@angular/material/card';

import { FuseConfirmationService } from '@fuse/services/confirmation';

import { ParkingSessionService } from 'app/core/services/parking-session.service';
import { SectorService } from 'app/core/services/sector.service';
import { OperatorService } from 'app/core/services/operator.service';
import { 
  ParkingSession, 
  SessionFilters,
  CreateSessionRequest,
  Sector,
  Operator,
  SessionsApiResponse
} from 'app/interfaces/parking.interface';

@Component({
  selector: 'app-sessions',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatChipsModule,
    MatTooltipModule,
    MatMenuModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    MatCheckboxModule,
    MatCardModule
  ],
  templateUrl: './sessions.component.html',
  styleUrls: ['./sessions.component.scss']
})
export class SessionsComponent implements OnInit, OnDestroy {
  private _unsubscribeAll: Subject<any> = new Subject<any>();

  // Data
  sessions: ParkingSession[] = [];
  loading = false;
  error: string | null = null;

  // Paginación
  totalItems = 0;
  pageSize = 15;
  currentPage = 0;
  pageSizeOptions = [5, 10, 15, 25, 50];

  // Filters
  filters: SessionFilters = {
    plate: '',
    sector_id: undefined,
    operator_id: undefined,
    status: '',
    date_from: '',
    date_to: ''
  };

  // Modelos para los datepickers
  dateFromModel: Date | null = null;
  dateToModel: Date | null = null;

  // Options
  sectors: Sector[] = [];
  operators: Operator[] = [];
  statusOptions = [
    { value: '', label: 'Todos' },
    { value: 'CREATED', label: 'Creada' },
    { value: 'ACTIVE', label: 'Activa' },
    { value: 'TO_PAY', label: 'Por Pagar' },
    { value: 'PAID', label: 'Pagada' },
    { value: 'CLOSED', label: 'Cerrada' },
    { value: 'CANCELED', label: 'Cancelada' }
  ];

  // Table
  displayedColumns: string[] = [
    'plate',
    'sector',
    'street',
    'operator',
    'started_at',
    'ended_at',
    'duration',
    'amount',
    'status',
    'actions'
  ];

  // Columnas para vista móvil
  displayedColumnsMobile: string[] = [
    'plate',
    'started_at',
    'ended_at',
    'duration',
    'amount',
    'actions'
  ];

  isMobile = false;

  constructor(
    private sessionService: ParkingSessionService,
    private sectorService: SectorService,
    private operatorService: OperatorService,
    private router: Router,
    private snackBar: MatSnackBar,
    private confirmationService: FuseConfirmationService,
    private breakpointObserver: BreakpointObserver
  ) {}

  ngOnInit(): void {
    this.loadSectors();
    this.loadOperators();
    this.loadSessions();
    
    // Detectar si es pantalla móvil
    this.breakpointObserver.observe([Breakpoints.Handset])
      .pipe(takeUntil(this._unsubscribeAll))
      .subscribe(result => {
        this.isMobile = result.matches;
      });
  }

  ngOnDestroy(): void {
    this._unsubscribeAll.next(null);
    this._unsubscribeAll.complete();
  }

  loadSessions(): void {
    this.loading = true;
    this.error = null;

    // Construir objeto de parámetros limpiando valores vacíos
    const params: any = {
      page: this.currentPage + 1, // Backend usa 1-based indexing
      per_page: this.pageSize
    };

    // Agregar filtros solo si tienen valores válidos
    if (this.filters.plate && this.filters.plate.trim() !== '') {
      params.plate = this.filters.plate.trim();
    }

    if (this.filters.sector_id !== undefined && this.filters.sector_id !== null) {
      params.sector_id = this.filters.sector_id;
    }

    if (this.filters.operator_id !== undefined && this.filters.operator_id !== null) {
      params.operator_id = this.filters.operator_id;
    }

    if (this.filters.status && this.filters.status.trim() !== '') {
      params.status = this.filters.status;
    }

    if (this.filters.date_from && this.filters.date_from.trim() !== '') {
      params.date_from = this.filters.date_from;
    }

    if (this.filters.date_to && this.filters.date_to.trim() !== '') {
      params.date_to = this.filters.date_to;
    }

    this.sessionService.getSessions(params)
      .pipe(takeUntil(this._unsubscribeAll))
      .subscribe({
        next: (response: SessionsApiResponse) => {
          // El backend devuelve { success: true, data: [...], pagination: {...} }
          this.sessions = response.data || [];
          this.totalItems = response.pagination?.total || 0;
          this.loading = false;
        },
        error: (error) => {
          this.error = 'Error al cargar sesiones';
          this.loading = false;
          console.error('Error loading sessions:', error);
          this.snackBar.open('Error al cargar sesiones', 'Cerrar', { duration: 3000 });
        }
      });
  }

  loadSectors(): void {
    this.sectorService.getSectors()
      .pipe(takeUntil(this._unsubscribeAll))
      .subscribe({
        next: (response) => {
          // El backend devuelve { success: true, data: { data: [...], ... } }
          this.sectors = (response.data as any)?.data || [];
        },
        error: (error) => {
          console.error('Error loading sectors:', error);
        }
      });
  }

  loadOperators(): void {
    this.operatorService.getOperators()
      .pipe(takeUntil(this._unsubscribeAll))
      .subscribe({
        next: (response) => {
          // El backend devuelve { success: true, data: { data: [...], ... } }
          this.operators = (response.data as any)?.data || [];
        },
        error: (error) => {
          console.error('Error loading operators:', error);
        }
      });
  }



  viewSession(session: ParkingSession): void {
    // Navegar directamente a la página de detalle de la sesión
    this.router.navigate(['/parking/sessions', session.id]);
  }

  editSession(session: ParkingSession): void {
    if (session.status === 'ACTIVE') {
      this.router.navigate(['/parking/sessions', session.id, 'edit']);
    } else {
      this.snackBar.open('Solo se pueden editar sesiones activas', 'Cerrar', { duration: 3000 });
    }
  }

  cancelSession(session: ParkingSession): void {
    if (session.status !== 'ACTIVE') {
      this.snackBar.open('Solo se pueden cancelar sesiones activas', 'Cerrar', { duration: 3000 });
      return;
    }

    const confirmation = this.confirmationService.open({
      title: 'Cancelar Sesión',
      message: `¿Está seguro de cancelar la sesión de la placa ${session.plate}?`,
      icon: {
        show: true,
        name: 'heroicons_outline:exclamation-triangle',
        color: 'warn'
      },
      actions: {
        confirm: {
          show: true,
          label: 'Cancelar Sesión',
          color: 'warn'
        },
        cancel: {
          show: true,
          label: 'No'
        }
      }
    });

    confirmation.afterClosed().subscribe(result => {
      if (result === 'confirmed') {
        this.sessionService.cancelSession(session.id)
          .pipe(takeUntil(this._unsubscribeAll))
          .subscribe({
            next: (response) => {
              this.snackBar.open('Sesión cancelada exitosamente', 'Cerrar', { duration: 3000 });
              this.loadSessions();
            },
            error: (error) => {
              this.snackBar.open('Error al cancelar sesión', 'Cerrar', { duration: 3000 });
              console.error('Error canceling session:', error);
            }
          });
      }
    });
  }

  checkoutSession(session: ParkingSession): void {
    if (session.status !== 'ACTIVE') {
      this.snackBar.open('Solo se puede hacer checkout de sesiones activas', 'Cerrar', { duration: 3000 });
      return;
    }

    this.router.navigate(['/parking/sessions', session.id, 'checkout']);
  }

  paySession(session: ParkingSession): void {
    if (session.status !== 'TO_PAY') {
      this.snackBar.open('Solo se pueden pagar sesiones pendientes de pago', 'Cerrar', { duration: 3000 });
      return;
    }

    this.router.navigate(['/parking/sessions', session.id, 'payment']);
  }

  formatAmount(amount: number): string {
    return this.sessionService.formatAmount(amount);
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleString('es-CL');
  }

  formatDateTime(date: string | null): string {
    if (!date) {
      return 'N/A';
    }
    
    const dateObj = new Date(date);
    
    // Verificar si la fecha es válida
    if (isNaN(dateObj.getTime())) {
      return 'N/A';
    }
    
    const dateStr = dateObj.toLocaleDateString('es-CL', { 
      day: '2-digit', 
      month: '2-digit', 
      year: '2-digit' 
    });
    const timeStr = dateObj.toLocaleTimeString('es-CL', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
    return `${dateStr} ${timeStr}`;
  }

  formatDateTimeMobile(date: string | null): string {
    if (!date) {
      return '-';
    }
    
    const dateObj = new Date(date);
    
    // Verificar si la fecha es válida
    if (isNaN(dateObj.getTime())) {
      return '-';
    }
    
    // Formato compacto para móvil: DD/MM HH:mm
    const day = String(dateObj.getDate()).padStart(2, '0');
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const hours = String(dateObj.getHours()).padStart(2, '0');
    const minutes = String(dateObj.getMinutes()).padStart(2, '0');
    
    return `${day}/${month} ${hours}:${minutes}`;
  }

  formatDuration(seconds: number): string {
    return this.sessionService.formatDuration(seconds);
  }

  getStatusLabel(status: string): string {
    return this.sessionService.getStatusLabel(status);
  }

  getStatusColor(status: string): string {
    return this.sessionService.getStatusColor(status);
  }

  getStatusCircleColor(status: string): string {
    const colorMap: { [key: string]: string } = {
      'CREATED': '#6B7280',    // Gris
      'ACTIVE': '#3B82F6',     // Azul
      'TO_PAY': '#F59E0B',     // Naranja
      'PAID': '#10B981',       // Verde
      'CLOSED': '#10B981',      // Verde
      'CANCELED': '#EF4444'    // Rojo
    };
    return colorMap[status] || '#6B7280';
  }

  // Métodos para estadísticas
  getActiveSessionsCount(): number {
    return this.sessions.filter(session => session.status === 'ACTIVE').length;
  }

  getToPaySessionsCount(): number {
    return this.sessions.filter(session => session.status === 'TO_PAY').length;
  }

  getPaidSessionsCount(): number {
    return this.sessions.filter(session => session.status === 'PAID').length;
  }


  canEdit(session: ParkingSession): boolean {
    return session.status === 'ACTIVE';
  }

  canCancel(session: ParkingSession): boolean {
    return session.status === 'ACTIVE';
  }

  canCheckout(session: ParkingSession): boolean {
    return session.status === 'ACTIVE';
  }

  canPay(session: ParkingSession): boolean {
    return session.status === 'TO_PAY';
  }

  createNewSession(): void {
    this.router.navigate(['/parking/sessions/new']);
  }

  exportSessions(): void {
    // Implementar exportación
    this.snackBar.open('Funcionalidad de exportación en desarrollo', 'Cerrar', { duration: 3000 });
  }

  refreshSessions(): void {
    this.loadSessions();
  }

  // Search functionality
  onSearchChange(searchTerm: string): void {
    this.filters.plate = searchTerm || '';
    // No aplicar filtros automáticamente en cada tecla, solo cuando el usuario presione el botón
    // O usar debounce para evitar demasiadas peticiones
  }

  onSectorChange(sectorId: number | string): void {
    // Si es string vacío, establecer como undefined
    if (sectorId === '' || sectorId === null) {
      this.filters.sector_id = undefined;
    } else {
      this.filters.sector_id = typeof sectorId === 'number' ? sectorId : parseInt(sectorId as string, 10);
    }
    this.applyFilters();
  }

  onOperatorChange(operatorId: number | string): void {
    // Si es string vacío, establecer como undefined
    if (operatorId === '' || operatorId === null) {
      this.filters.operator_id = undefined;
    } else {
      this.filters.operator_id = typeof operatorId === 'number' ? operatorId : parseInt(operatorId as string, 10);
    }
    this.applyFilters();
  }

  onStatusChange(status: string): void {
    // Si es string vacío, establecer como string vacío (no undefined para que el backend lo ignore)
    this.filters.status = status || '';
    this.applyFilters();
  }

  /**
   * Formatea una fecha a YYYY-MM-DD usando la zona horaria local (America/Santiago)
   * Evita el problema de conversión a UTC que cambia el día después de las 21:00
   */
  private formatDateLocal(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  onDateFromChange(date: Date | null): void {
    if (date) {
      this.filters.date_from = this.formatDateLocal(date);
    } else {
      this.filters.date_from = '';
    }
    this.applyFilters();
  }

  onDateToChange(date: Date | null): void {
    if (date) {
      this.filters.date_to = this.formatDateLocal(date);
    } else {
      this.filters.date_to = '';
    }
    this.applyFilters();
  }

  // Manejo de paginación
  onPageChange(event: PageEvent): void {
    this.currentPage = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadSessions();
  }

  // Manejo de filtros
  applyFilters(): void {
    this.currentPage = 0; // Reset a la primera página
    this.loadSessions();
  }

  clearFilters(): void {
    this.filters = {
      plate: '',
      sector_id: undefined,
      operator_id: undefined,
      status: '',
      date_from: '',
      date_to: ''
    };
    this.dateFromModel = null;
    this.dateToModel = null;
    this.currentPage = 0;
    this.loadSessions();
  }
}

