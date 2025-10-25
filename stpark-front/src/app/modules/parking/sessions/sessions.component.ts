import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, takeUntil, debounceTime, distinctUntilChanged } from 'rxjs';
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


  constructor(
    private sessionService: ParkingSessionService,
    private sectorService: SectorService,
    private operatorService: OperatorService,
    private router: Router,
    private snackBar: MatSnackBar,
    private confirmationService: FuseConfirmationService
  ) {}

  ngOnInit(): void {
    this.loadSectors();
    this.loadOperators();
    this.loadSessions();
  }

  ngOnDestroy(): void {
    this._unsubscribeAll.next(null);
    this._unsubscribeAll.complete();
  }

  loadSessions(): void {
    this.loading = true;
    this.error = null;

    const params = {
      page: this.currentPage + 1, // Backend usa 1-based indexing
      per_page: this.pageSize,
      ...this.filters
    };

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

  formatDuration(seconds: number): string {
    return this.sessionService.formatDuration(seconds);
  }

  getStatusLabel(status: string): string {
    return this.sessionService.getStatusLabel(status);
  }

  getStatusColor(status: string): string {
    return this.sessionService.getStatusColor(status);
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
    this.filters.plate = searchTerm;
    this.applyFilters();
  }

  onSectorChange(sectorId: number): void {
    this.filters.sector_id = sectorId;
    this.applyFilters();
  }

  onOperatorChange(operatorId: number): void {
    this.filters.operator_id = operatorId;
    this.applyFilters();
  }

  onStatusChange(status: string): void {
    this.filters.status = status;
    this.applyFilters();
  }

  onDateFromChange(date: Date): void {
    this.filters.date_from = date.toISOString().split('T')[0];
    this.applyFilters();
  }

  onDateToChange(date: Date): void {
    this.filters.date_to = date.toISOString().split('T')[0];
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
    this.currentPage = 0;
    this.loadSessions();
  }
}

