import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { FuseCardComponent } from '@fuse/components/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule, DateAdapter, MAT_DATE_FORMATS, MAT_DATE_LOCALE, NativeDateAdapter } from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs';
import { MatBadgeModule } from '@angular/material/badge';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { NgApexchartsModule } from 'ng-apexcharts';

import { ReportService } from 'app/core/services/report.service';
import { ParkingSessionService } from 'app/core/services/parking-session.service';
import { PaymentService } from 'app/core/services/payment.service';
import { DebtService } from 'app/core/services/debt.service';
import { DashboardData } from 'app/interfaces/parking.interface';
import { HttpClient } from '@angular/common/http';
import { environment } from 'environments/environment';

// Configuración de formato de fecha para dd/mm/yyyy
export const DATE_FORMATS = {
  parse: {
    dateInput: 'DD/MM/YYYY',
  },
  display: {
    dateInput: 'DD/MM/YYYY',
    monthYearLabel: 'MMM YYYY',
    dateA11yLabel: 'LL',
    monthYearA11yLabel: 'MMMM YYYY',
  },
};

// DateAdapter personalizado para formato dd/mm/yyyy
export class CustomDateAdapter extends NativeDateAdapter {
  override format(date: Date, displayFormat: Object): string {
    if (displayFormat === 'DD/MM/YYYY') {
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    }
    return super.format(date, displayFormat);
  }

  override parse(value: string): Date | null {
    if (value && value.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
      const [day, month, year] = value.split('/');
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }
    return super.parse(value);
  }
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    FuseCardComponent,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatTabsModule,
    MatBadgeModule,
    MatTooltipModule,
    MatMenuModule,
    NgApexchartsModule
  ],
  providers: [
    { provide: DateAdapter, useClass: CustomDateAdapter, deps: [MAT_DATE_LOCALE] },
    { provide: MAT_DATE_FORMATS, useValue: DATE_FORMATS },
    { provide: MAT_DATE_LOCALE, useValue: 'es-CL' }
  ],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit, OnDestroy {
  private _unsubscribeAll: Subject<any> = new Subject<any>();

  // Data
  dashboardData: DashboardData | null = null;
  loading = false;
  error: string | null = null;

  // Date picker
  selectedDate = new Date();

  // Charts
  salesChart: any = {};
  paymentsChart: any = {};
  sessionsChart: any = {};

  // Stats
  stats = {
    totalRevenue: 0,
    totalSessions: 0,
    averageTicket: 0,
    pendingDebts: 0,
    activeSessions: 0
  };

  // Occupancy
  maxCapacity = 0;
  occupancyPercentage = 0;

  constructor(
    private reportService: ReportService,
    private sessionService: ParkingSessionService,
    private paymentService: PaymentService,
    private debtService: DebtService,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    this.loadDashboardData();
    this.loadMaxCapacity();
    this.initializeCharts();
  }

  ngOnDestroy(): void {
    this._unsubscribeAll.next(null);
    this._unsubscribeAll.complete();
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

  loadDashboardData(): void {
    this.loading = true;
    this.error = null;

    const dateStr = this.formatDateLocal(this.selectedDate);

    this.reportService.getDashboard(dateStr)
      .pipe(takeUntil(this._unsubscribeAll))
      .subscribe({
        next: (response) => {
          this.dashboardData = response.data;
          this.updateStats();
          this.updateCharts();
          this.loading = false;
        },
        error: (error) => {
          this.error = 'Error al cargar datos del dashboard';
          this.loading = false;
          console.error('Error loading dashboard:', error);
        }
      });
  }

  onDateChange(): void {
    this.loadDashboardData();
  }

  private updateStats(): void {
    if (!this.dashboardData) return;

    this.stats = {
      totalRevenue: this.dashboardData.today_sales.total_amount,
      totalSessions: this.dashboardData.today_sales.count,
      averageTicket: this.dashboardData.today_sales.count > 0 
        ? this.dashboardData.today_sales.total_amount / this.dashboardData.today_sales.count 
        : 0,
      pendingDebts: this.dashboardData.pending_debts.total_amount,
      activeSessions: this.dashboardData.active_sessions.count
    };

    // Calcular porcentaje de ocupación
    this.calculateOccupancy();
  }

  private loadMaxCapacity(): void {
    this.http.get<{ success: boolean; data: any }>(`${environment.apiUrl}/settings/general`)
      .pipe(takeUntil(this._unsubscribeAll))
      .subscribe({
        next: (response) => {
          if (response && response.success && response.data) {
            this.maxCapacity = response.data.max_capacity || 0;
            this.calculateOccupancy();
          }
        },
        error: (error) => {
          console.error('Error al cargar máxima capacidad:', error);
          this.maxCapacity = 0;
        }
      });
  }

  private calculateOccupancy(): void {
    if (this.maxCapacity > 0) {
      this.occupancyPercentage = Math.round((this.stats.activeSessions / this.maxCapacity) * 100);
    } else {
      this.occupancyPercentage = 0;
    }
  }

  getOccupancyColor(): string {
    if (this.occupancyPercentage >= 90) return 'text-red-600';
    if (this.occupancyPercentage >= 70) return 'text-orange-600';
    if (this.occupancyPercentage >= 50) return 'text-yellow-600';
    return 'text-green-600';
  }

  getOccupancyBgColor(): string {
    if (this.occupancyPercentage >= 90) return 'bg-red-100';
    if (this.occupancyPercentage >= 70) return 'bg-orange-100';
    if (this.occupancyPercentage >= 50) return 'bg-yellow-100';
    return 'bg-green-100';
  }

  getOccupancyIconColor(): string {
    if (this.occupancyPercentage >= 90) return 'text-red-600';
    if (this.occupancyPercentage >= 70) return 'text-orange-600';
    if (this.occupancyPercentage >= 50) return 'text-yellow-600';
    return 'text-green-600';
  }

  private updateCharts(): void {
    if (!this.dashboardData) return;

    this.updateSalesChart();
    this.updatePaymentsChart();
    this.updateSessionsChart();
  }

  private updateSalesChart(): void {
    const salesBySector = this.dashboardData!.today_sales.by_sector;
    const chartData = Object.entries(salesBySector).map(([sector, data]) => ({
      x: sector,
      y: (data as any).total
    }));

    this.salesChart = {
      series: [{
        name: 'Ventas',
        data: chartData
      }],
      chart: {
        type: 'bar',
        height: 400,
        toolbar: { show: false }
      },
      plotOptions: {
        bar: {
          horizontal: false,
          columnWidth: '55%',
          borderRadius: 4
        }
      },
      dataLabels: {
        enabled: false
      },
      xaxis: {
        categories: Object.keys(salesBySector)
      },
      yaxis: {
        labels: {
          formatter: (value: number) => this.formatAmount(value)
        }
      },
      colors: ['#3B82F6'],
      tooltip: {
        y: {
          formatter: (value: number) => this.formatAmount(value)
        }
      }
    };
  }

  private updatePaymentsChart(): void {
    const paymentsByMethod = this.dashboardData!.today_payments.by_method;
    const chartData = Object.entries(paymentsByMethod).map(([method, data]) => ({
      x: this.paymentService.getPaymentMethodLabel(method),
      y: (data as any).total
    }));

    this.paymentsChart = {
        series: Object.values(paymentsByMethod).map(data => (data as any).total),
      chart: {
        type: 'donut',
        height: 400
      },
      labels: Object.keys(paymentsByMethod).map(method => 
        this.paymentService.getPaymentMethodLabel(method)
      ),
      colors: ['#10B981', '#3B82F6', '#8B5CF6', '#F59E0B'],
      legend: {
        position: 'bottom'
      },
      tooltip: {
        y: {
          formatter: (value: number) => this.formatAmount(value)
        }
      }
    };
  }

  private updateSessionsChart(): void {
    // Gráfico de sesiones activas por hora usando datos reales del backend
    const hourlyData = this.dashboardData!.sessions_by_hour || [];
    const sessionData = hourlyData.map(item => ({
      x: `${item.hour.toString().padStart(2, '0')}:00`,
      y: item.count
    }));

    this.sessionsChart = {
      series: [{
        name: 'Sesiones Activas',
        data: sessionData
      }],
      chart: {
        type: 'area',
        height: 400,
        toolbar: { show: false },
        zoom: {
          enabled: false
        }
      },
      stroke: {
        curve: 'smooth',
        width: 3
      },
      fill: {
        type: 'gradient',
        gradient: {
          shadeIntensity: 1,
          opacityFrom: 0.4,
          opacityTo: 0.1,
          stops: [0, 90, 100]
        }
      },
      xaxis: {
        categories: hourlyData.map(item => `${item.hour.toString().padStart(2, '0')}:00`),
        labels: {
          rotate: -45,
          rotateAlways: false
        }
      },
      yaxis: {
        title: {
          text: 'Sesiones'
        },
        min: 0
      },
      colors: ['#3B82F6'],
      markers: {
        size: 4,
        hover: {
          size: 6
        },
        strokeWidth: 2,
        strokeColors: ['#3B82F6'],
        fillOpacity: 1
      },
      grid: {
        borderColor: '#e5e7eb',
        strokeDashArray: 4
      },
      tooltip: {
        y: {
          formatter: (value: number) => `${value} sesiones`
        }
      }
    };
  }

  private initializeCharts(): void {
    // Configuración inicial de los gráficos
    this.salesChart = { series: [], chart: { type: 'bar' } };
    this.paymentsChart = { series: [], chart: { type: 'donut' } };
    this.sessionsChart = { series: [], chart: { type: 'area' } };
  }

  formatAmount(amount: number): string {
    return this.reportService.formatAmount(amount);
  }

  formatDate(date: string): string {
    return this.reportService.formatDate(date);
  }

  refreshData(): void {
    this.loadDashboardData();
  }

  exportReport(): void {
    // Exportar como PDF usando el dashboard de ventas del día seleccionado
    const dateStr = this.formatDateLocal(this.selectedDate);
    const filters = {
      date_from: dateStr,
      date_to: dateStr
    };
    
    this.reportService.exportToPdf('sales', filters);
  }

  getStatusColor(status: string): string {
    return this.sessionService.getStatusColor(status);
  }

  getStatusLabel(status: string): string {
    return this.sessionService.getStatusLabel(status);
  }

  getPaymentMethodColor(method: string): string {
    return this.paymentService.getPaymentMethodColor(method);
  }

  getPaymentMethodLabel(method: string): string {
    return this.paymentService.getPaymentMethodLabel(method);
  }

  /**
   * Calcular tiempo transcurrido desde el inicio de la sesión
   */
  getElapsedTime(startedAt: string): string {
    const startTime = new Date(startedAt);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - startTime.getTime()) / 1000);
    
    return this.sessionService.formatDuration(diffInSeconds);
  }

}

