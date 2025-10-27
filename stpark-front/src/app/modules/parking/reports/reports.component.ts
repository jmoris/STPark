import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatNativeDateModule } from '@angular/material/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subject, takeUntil } from 'rxjs';
import { ReportService } from '../../../core/services/report.service';
import { SectorService } from '../../../core/services/sector.service';
import { OperatorService } from '../../../core/services/operator.service';
import { Sector } from '../../../interfaces/parking.interface';
import { Operator } from '../../../interfaces/parking.interface';

interface ReportFilters {
  date_from: string;
  date_to: string;
  sector_id?: number;
  operator_id?: number;
  method?: string;
  status?: string;
}

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatSelectModule,
    MatTableModule,
    MatNativeDateModule,
    MatTooltipModule
  ],
  templateUrl: './reports.component.html',
  styleUrls: ['./reports.component.scss']
})
export class ReportsComponent implements OnInit, OnDestroy {
  private _unsubscribeAll: Subject<any> = new Subject<any>();

  loading = false;
  dashboardData: any = null;
  
  // Filtros
  filters: ReportFilters = {
    date_from: new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().split('T')[0],
    date_to: new Date().toISOString().split('T')[0],
    sector_id: undefined,
    operator_id: undefined
  };

  // Tipo de reporte seleccionado
  selectedReportType: string = 'sales';

  // Datos para filtros
  sectors: Sector[] = [];
  operators: Operator[] = [];

  // Datos del reporte actual
  currentReport: any = null;
  currentReportType: string = '';
  displayedColumns: string[] = ['plate', 'started_at', 'ended_at', 'sector', 'operator', 'duration', 'amount'];

  constructor(
    private reportService: ReportService,
    private sectorService: SectorService,
    private operatorService: OperatorService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadDashboardData();
    this.loadFiltersData();
  }

  ngOnDestroy(): void {
    this._unsubscribeAll.next(null);
    this._unsubscribeAll.complete();
  }

  loadDashboardData(): void {
    this.loading = true;
    this.reportService.getDashboard()
      .pipe(takeUntil(this._unsubscribeAll))
      .subscribe({
        next: (response) => {
          this.dashboardData = response.data;
          this.loading = false;
        },
        error: (error) => {
          console.error('Error loading dashboard data:', error);
          this.loading = false;
        }
      });
  }

  loadFiltersData(): void {
    // Cargar sectores
    this.sectorService.getSectors().subscribe({
      next: (response) => {
        this.sectors = response.data.data || [];
      },
      error: (error) => console.error('Error loading sectors:', error)
    });

    // Cargar operadores
    this.operatorService.getAllOperators().subscribe({
      next: (response) => {
        this.operators = response.data || [];
      },
      error: (error) => console.error('Error loading operators:', error)
    });
  }

  onCardClick(type: string): void {
    this.selectedReportType = type;
  }

  generateReportFromFilters(): void {
    this.generateReport(this.selectedReportType);
  }

  generateReport(type: string): void {
    this.currentReportType = type;
    this.loading = true;

    const filters: any = {
      date_from: this.filters.date_from,
      date_to: this.filters.date_to
    };

    // Solo agregar filtros opcionales si tienen valores
    if (this.filters.sector_id) {
      filters.sector_id = this.filters.sector_id;
    }
    if (this.filters.operator_id) {
      filters.operator_id = this.filters.operator_id;
    }

    let reportObservable;
    switch(type) {
      case 'sales':
        reportObservable = this.reportService.getSalesReport(filters);
        break;
      case 'debts':
        reportObservable = this.reportService.getDebtsReport(filters);
        break;
      case 'operator':
        if (!filters.operator_id) {
          alert('Debe seleccionar un operador');
          this.loading = false;
          return;
        }
        reportObservable = this.reportService.getOperatorReport(filters);
        break;
      default:
        this.loading = false;
        return;
    }

    reportObservable.pipe(takeUntil(this._unsubscribeAll)).subscribe({
      next: (response) => {
        this.currentReport = response.data;
        this.loading = false;
        this.cdr.detectChanges(); // Forzar actualización de la vista
      },
      error: (error) => {
        console.error('Error generating report:', error);
        this.loading = false;
      }
    });
  }

  exportReport(type: string): void {
    // Si ya hay un reporte generado para este tipo, exportarlo
    if (this.currentReport && this.currentReportType === type) {
      this.exportCurrentReport();
      return;
    }
    
    // Si no hay reporte o es un tipo diferente, generarlo primero
    this.currentReportType = type;
    this.loading = true;

    const filters: any = {
      date_from: this.filters.date_from,
      date_to: this.filters.date_to
    };

    // Solo agregar filtros opcionales si tienen valores
    if (this.filters.sector_id) {
      filters.sector_id = this.filters.sector_id;
    }
    if (this.filters.operator_id) {
      filters.operator_id = this.filters.operator_id;
    }

    let reportObservable;
    switch(type) {
      case 'sales':
        reportObservable = this.reportService.getSalesReport(filters);
        break;
      case 'debts':
        reportObservable = this.reportService.getDebtsReport(filters);
        break;
      case 'operator':
        if (!filters.operator_id) {
          alert('Debe seleccionar un operador');
          this.loading = false;
          return;
        }
        reportObservable = this.reportService.getOperatorReport(filters);
        break;
      default:
        this.loading = false;
        return;
    }

    reportObservable.pipe(takeUntil(this._unsubscribeAll)).subscribe({
      next: (response) => {
        this.currentReport = response.data;
        this.loading = false;
        this.cdr.detectChanges(); // Forzar actualización de la vista
        // Exportar después de cargar los datos
        this.exportCurrentReport();
      },
      error: (error) => {
        console.error('Error generating report:', error);
        this.loading = false;
      }
    });
  }

  exportCurrentReport(): void {
    if (!this.currentReport) return;

    // Construir filtros para enviar al backend
    const filters: any = {
      date_from: this.filters.date_from,
      date_to: this.filters.date_to
    };

    // Solo agregar filtros opcionales si tienen valores
    if (this.filters.sector_id) {
      filters.sector_id = this.filters.sector_id;
    }
    if (this.filters.operator_id) {
      filters.operator_id = this.filters.operator_id;
    }

    // Enviar la petición al backend para generar el PDF
    this.reportService.exportToPdf(this.currentReportType, filters);
  }

  clearFilters(): void {
    this.filters = {
      date_from: new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().split('T')[0],
      date_to: new Date().toISOString().split('T')[0],
      sector_id: undefined,
      operator_id: undefined
    };
    this.currentReport = null;
    this.currentReportType = '';
  }

  getTotalSales(): string {
    // Si hay un reporte actual, usar esos datos
    if (this.currentReport && this.currentReportType === 'sales') {
      return this.reportService.formatAmount(this.currentReport.total_amount || 0);
    }
    // Si no, usar datos del dashboard
    if (this.dashboardData?.today_sales?.total_amount) {
      return this.reportService.formatAmount(this.dashboardData.today_sales.total_amount);
    }
    return '$0';
  }

  getTotalPayments(): number {
    // Si hay un reporte actual, usar esos datos
    if (this.currentReport && this.currentReportType === 'payments') {
      return this.currentReport.total_payments || 0;
    }
    // Si no, usar datos del dashboard
    return this.dashboardData?.today_payments?.count || 0;
  }

  getTotalDebts(): number {
    // Si hay un reporte actual, usar esos datos
    if (this.currentReport && this.currentReportType === 'debts') {
      return this.currentReport.total_debts || 0;
    }
    // Si no, usar datos del dashboard
    return this.dashboardData?.pending_debts?.count || 0;
  }

  getTotalDebtsAmount(): string {
    // Si hay un reporte actual, usar esos datos
    if (this.currentReport && this.currentReportType === 'debts') {
      return this.reportService.formatAmount(this.currentReport.total_amount || 0);
    }
    // Si no, usar datos del dashboard
    if (this.dashboardData?.pending_debts?.total_amount) {
      return this.reportService.formatAmount(this.dashboardData.pending_debts.total_amount);
    }
    return '$0';
  }

  getOperatorCount(): number {
    if (this.currentReport && this.currentReportType === 'operator') {
      return this.currentReport.sessions?.total || 0;
    }
    return 0;
  }

  getSessionsCount(): string {
    // Si hay un reporte actual de tipo sessions, mostrar ese total
    if (this.currentReport && this.currentReportType === 'sessions') {
      return (this.currentReport.total_sessions || 0).toString();
    }
    
    // Si no hay reporte, mostrar las sesiones activas del dashboard
    if (this.dashboardData?.active_sessions?.count !== undefined) {
      return this.dashboardData.active_sessions.count.toString();
    }
    
    return '0';
  }

  getPaymentMethodLabel(method: string): string {
    const methods: Record<string, string> = {
      'CASH': 'Efectivo',
      'CARD': 'Tarjeta',
      'WEBPAY': 'Webpay',
      'TRANSFER': 'Transferencia'
    };
    return methods[method] || method;
  }
}
