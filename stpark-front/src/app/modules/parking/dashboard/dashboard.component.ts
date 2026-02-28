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
import { ConfigService } from 'app/core/services/config.service';

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

type KpiDeltaPct = Partial<{
  revenue: number;
  sessions: number;
  occupancy: number;
  debts: number;
  activeSessions: number;
  avgTicket: number;
  carWashRevenue: number;
  carWashCount: number;
  carWashAvgTicket: number;
}>;

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
  carWashEnabled = false;

  // Resumen financiero: pagos por método con alcance
  paymentScope: 'TOTAL' | 'PARKING' | 'WASH' = 'TOTAL';
  private parkingPaymentsByMethod: Record<string, { total: number }> = {};
  private washPaymentsByMethod: Record<string, { total: number }> = {};
  private totalPaymentsByMethod: Record<string, { total: number }> = {};

  // Date picker
  selectedDate = new Date();
  isSelectedToday = true;
  selectedDateLabel = '';
  comparisonDateLabel = '';

  // Charts
  salesChart: any = {};
  paymentsChart: any = {};
  sessionsChart: any = {};

  // Stats
  stats = {
    totalRevenue: 0,
    totalSessions: 0,
    pendingDebts: 0,
    activeSessions: 0,
    carWashesTotal: 0,
    carWashesCount: 0,
    carWashesPendingCount: 0,
    averageTicket: 0, // Parking
    carWashAverageTicket: 0,
  };

  // Deltas KPI (% vs día anterior) SOLO desde backend (kpi_compare)
  kpiDeltaPct: KpiDeltaPct = {};

  // Sesiones por hora: contexto de hora pico
  peakSessions: { hourLabel: string; count: number } | null = null;

  // Occupancy
  maxCapacity = 0;
  occupancyPercentage = 0;

  constructor(
    private reportService: ReportService,
    private sessionService: ParkingSessionService,
    private paymentService: PaymentService,
    private debtService: DebtService,
    private http: HttpClient,
    private configService: ConfigService
  ) {}

  ngOnInit(): void {
    this.updateDateContext();
    this.loadDashboardData();
    this.loadMaxCapacity();
    this.loadConfig();
    this.initializeCharts();
  }

  private loadConfig(): void {
    this.configService.systemConfig$.pipe(takeUntil(this._unsubscribeAll)).subscribe(config => {
      this.carWashEnabled = config?.car_wash_enabled === true;
    });
    this.configService.loadConfig();
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

  private isSameLocalDay(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear()
      && a.getMonth() === b.getMonth()
      && a.getDate() === b.getDate();
  }

  private formatDateLabel(date: Date): string {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }

  private updateDateContext(): void {
    const selected = (this.selectedDate instanceof Date) ? this.selectedDate : new Date(this.selectedDate);
    const safeSelected = Number.isNaN(selected.getTime()) ? new Date() : selected;

    const today = new Date();
    this.isSelectedToday = this.isSameLocalDay(safeSelected, today);
    this.selectedDateLabel = this.formatDateLabel(safeSelected);

    const comparison = new Date(safeSelected);
    comparison.setDate(comparison.getDate() - 1);
    this.comparisonDateLabel = this.formatDateLabel(comparison);
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
          this.kpiDeltaPct = this.mapKpiCompare((this.dashboardData as any)?.kpi_compare);
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
    this.updateDateContext();
    this.loadDashboardData();
  }

  private updateStats(): void {
    if (!this.dashboardData) return;

    const averageTicket = this.safeDivide(
      this.dashboardData.today_sales.total_amount,
      this.dashboardData.today_sales.count
    );

    const carWashesTotal = this.dashboardData.car_washes?.total_amount || 0;
    const carWashesCount = this.dashboardData.car_washes?.count || 0;
    const carWashAverageTicket = this.safeDivide(carWashesTotal, carWashesCount);

    this.stats = {
      totalRevenue: this.dashboardData.today_sales.total_amount,
      totalSessions: this.dashboardData.today_sales.count,
      pendingDebts: this.dashboardData.pending_debts.total_amount,
      activeSessions: this.dashboardData.active_sessions.count,
      carWashesTotal,
      carWashesCount,
      carWashesPendingCount: this.dashboardData.car_washes?.pending_count || 0,
      averageTicket: averageTicket,
      carWashAverageTicket,
    };

    // Calcular porcentaje de ocupación
    this.calculateOccupancy();
  }

  private safeDivide(numerator: number, denominator: number): number {
    if (!denominator || denominator <= 0) return 0;
    return numerator / denominator;
  }

  get currentDayLabel(): string {
    return this.isSelectedToday ? '(hoy)' : `(${this.selectedDateLabel})`;
  }

  get comparisonText(): string {
    return this.isSelectedToday ? 'vs ayer' : `vs ${this.comparisonDateLabel}`;
  }

  get deltaTooltip(): string {
    return this.isSelectedToday
      ? 'Variación vs ayer'
      : `Variación vs ${this.comparisonDateLabel}`;
  }

  private round1(value: number): number {
    return Math.round(value * 10) / 10;
  }

  private mapKpiCompare(compare: any): KpiDeltaPct {
    if (!compare) return {};

    const safePct = (todayRaw: any, yesterdayRaw: any): number => {
      const today = Number(todayRaw || 0);
      const yesterday = Number(yesterdayRaw || 0);
      if (!Number.isFinite(today) || !Number.isFinite(yesterday)) return 0;

      if (!yesterday && !today) return 0;
      if (!yesterday && today > 0) return 100;
      if (yesterday > 0 && !today) return -100;
      return ((today - yesterday) / yesterday) * 100;
    };

    // Soporta ambos formatos:
    // A) compare.current / compare.previous (backend actual)
    // B) compare.revenue.today / compare.revenue.yesterday (si backend cambia)
    const current = compare?.current;
    const previous = compare?.previous;

    const revenueToday = current ? current.total_amount_parking : compare?.revenue?.today;
    const revenueYesterday = previous ? previous.total_amount_parking : compare?.revenue?.yesterday;

    const sessionsToday = current ? current.total_sessions_parking : compare?.sessions?.today;
    const sessionsYesterday = previous ? previous.total_sessions_parking : compare?.sessions?.yesterday;

    const debtsToday = current ? current.pending_debts_total_amount : compare?.debts?.today;
    const debtsYesterday = previous ? previous.pending_debts_total_amount : compare?.debts?.yesterday;

    const activeToday = current ? current.active_sessions_count : compare?.active_sessions?.today;
    const activeYesterday = previous ? previous.active_sessions_count : compare?.active_sessions?.yesterday;

    const avgTicketToday = current ? this.safeDivide(Number(revenueToday || 0), Number(sessionsToday || 0)) : compare?.avg_ticket?.today;
    const avgTicketYesterday = previous ? this.safeDivide(Number(revenueYesterday || 0), Number(sessionsYesterday || 0)) : compare?.avg_ticket?.yesterday;

    const occToday = this.maxCapacity > 0 ? this.round1((Number(activeToday || 0) / this.maxCapacity) * 100) : (compare?.occupancy?.today ?? 0);
    const occYesterday = this.maxCapacity > 0 ? this.round1((Number(activeYesterday || 0) / this.maxCapacity) * 100) : (compare?.occupancy?.yesterday ?? 0);

    const carWashRevenueToday = current ? current.car_wash_total_amount : compare?.car_wash_revenue?.today;
    const carWashRevenueYesterday = previous ? previous.car_wash_total_amount : compare?.car_wash_revenue?.yesterday;

    const carWashCountToday = current ? current.car_wash_count : compare?.car_wash_count?.today;
    const carWashCountYesterday = previous ? previous.car_wash_count : compare?.car_wash_count?.yesterday;

    const carWashAvgToday = current
      ? this.safeDivide(Number(carWashRevenueToday || 0), Number(carWashCountToday || 0))
      : (compare?.car_wash_avg_ticket?.today ?? 0);
    const carWashAvgYesterday = previous
      ? this.safeDivide(Number(carWashRevenueYesterday || 0), Number(carWashCountYesterday || 0))
      : (compare?.car_wash_avg_ticket?.yesterday ?? 0);

    // Si no hay current/previous y tampoco campos del formato B, devolvemos vacío (no fake deltas)
    const hasAny =
      compare?.revenue || compare?.sessions || compare?.occupancy || compare?.debts || compare?.active_sessions || compare?.avg_ticket
      || compare?.car_wash_revenue || compare?.car_wash_count || compare?.car_wash_avg_ticket
      || (current && previous);
    if (!hasAny) return {};

    return {
      revenue: this.round1(safePct(revenueToday, revenueYesterday)),
      sessions: this.round1(safePct(sessionsToday, sessionsYesterday)),
      occupancy: this.round1(safePct(occToday, occYesterday)),
      debts: this.round1(safePct(debtsToday, debtsYesterday)),
      activeSessions: this.round1(safePct(activeToday, activeYesterday)),
      avgTicket: this.round1(safePct(avgTicketToday, avgTicketYesterday)),
      carWashRevenue: this.round1(safePct(carWashRevenueToday ?? 0, carWashRevenueYesterday ?? 0)),
      carWashCount: this.round1(safePct(carWashCountToday ?? 0, carWashCountYesterday ?? 0)),
      carWashAvgTicket: this.round1(safePct(carWashAvgToday ?? 0, carWashAvgYesterday ?? 0)),
    };
  }

  formatCount(value: number): string {
    return this.reportService.formatNumber(value || 0);
  }

  hasDelta(value: number | undefined | null): boolean {
    return value !== undefined && value !== null;
  }

  formatDeltaPct(value: number | undefined | null): string {
    if (value === undefined || value === null) return '';
    if (value === 0) return '0%';
    return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
  }

  getDeltaIcon(value: number | undefined | null): string {
    if (value === undefined || value === null) return 'remove';
    if (value > 0) return 'arrow_upward';
    if (value < 0) return 'arrow_downward';
    return 'remove';
  }

  getDeltaBadgeClass(value: number | undefined | null): string {
    if (value === undefined || value === null) return 'delta-neutral';
    if (value === 0) return 'bg-gray-100 text-gray-700';
    if (value > 0) return 'delta-positive';
    if (value < 0) return 'delta-negative';
    return 'delta-neutral';
  }

  private loadMaxCapacity(): void {
    this.http.get<{ success: boolean; data: any }>(`${environment.apiUrl}/settings/general`)
      .pipe(takeUntil(this._unsubscribeAll))
      .subscribe({
        next: (response) => {
          if (response && response.success && response.data) {
            this.maxCapacity = response.data.max_capacity || 0;
            this.calculateOccupancy();
            // Recalcular deltas (ocupación depende de la capacidad)
            this.kpiDeltaPct = this.mapKpiCompare((this.dashboardData as any)?.kpi_compare);
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
    this.rebuildPaymentsByMethod();
    this.refreshPaymentsChart();
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

  private rebuildPaymentsByMethod(): void {
    if (!this.dashboardData) {
      this.parkingPaymentsByMethod = {};
      this.washPaymentsByMethod = {};
      this.totalPaymentsByMethod = {};
      return;
    }

    // Estacionamiento: viene del backend (solo sesiones de parking)
    const parkingByMethodRaw = (this.dashboardData as any)?.today_payments?.by_method ?? {};
    this.parkingPaymentsByMethod = this.normalizeByMethod(parkingByMethodRaw);

    // Autolavado: split por efectivo/tarjeta (si hay)
    const washByMethod: Record<string, { total: number }> = {};
    const carWashes = (this.dashboardData as any)?.car_washes;
    if (carWashes) {
      const cash = Number(carWashes.cash_total || 0);
      const card = Number(carWashes.card_total || 0);
      if (cash > 0) washByMethod['CASH'] = { total: cash };
      if (card > 0) washByMethod['CARD'] = { total: card };
      // TODO: if backend provides wash count by method in future, include it.
    }
    this.washPaymentsByMethod = washByMethod;

    // Total: merge sumando totales por método
    this.totalPaymentsByMethod = this.mergeByMethodTotals(this.parkingPaymentsByMethod, this.washPaymentsByMethod);
  }

  onPaymentScopeChange(scope: 'TOTAL' | 'PARKING' | 'WASH'): void {
    this.paymentScope = scope;
    this.refreshPaymentsChart();
  }

  private refreshPaymentsChart(): void {
    switch (this.paymentScope) {
      case 'PARKING':
        this.updatePaymentsChart(this.parkingPaymentsByMethod);
        return;
      case 'WASH':
        this.updatePaymentsChart(this.washPaymentsByMethod);
        return;
      default:
        this.updatePaymentsChart(this.totalPaymentsByMethod);
        return;
    }
  }

  get paymentScopeLabel(): string {
    switch (this.paymentScope) {
      case 'PARKING':
        return 'Estacionamiento';
      case 'WASH':
        return 'Autolavado';
      default:
        return 'Total';
    }
  }

  // KPIs mini (siempre desde TOTAL para mantener consistencia)
  get totalRevenueToday(): number {
    const parking = this.dashboardData?.today_sales?.total_amount || 0;
    const wash = this.dashboardData?.car_washes?.total_amount || 0;
    return (parking || 0) + (wash || 0);
  }

  get topMethodTotalText(): string {
    const { label, pct, total } = this.getTopMethodFrom(this.totalPaymentsByMethod);
    if (!total || total <= 0) return 'Sin pagos';
    if (!label) return '—';
    return `${label} (${pct.toFixed(1)}%)`;
  }

  get debtText(): string {
    const debt = this.dashboardData?.pending_debts?.total_amount || 0;
    if (!debt || debt <= 0) return 'Sin deuda';
    return this.formatAmount(debt);
  }

  private normalizeByMethod(input: any): Record<string, { total: number }> {
    const out: Record<string, { total: number }> = {};
    if (!input || typeof input !== 'object') return out;
    for (const [k, v] of Object.entries(input)) {
      const total = Number((v as any)?.total ?? 0);
      if (!Number.isFinite(total)) continue;
      out[String(k)] = { total: total || 0 };
    }
    return out;
  }

  private mergeByMethodTotals(...sources: Array<Record<string, { total: number }>>): Record<string, { total: number }> {
    const out: Record<string, { total: number }> = {};
    for (const src of sources) {
      for (const [method, data] of Object.entries(src || {})) {
        const prev = out[method]?.total || 0;
        const add = Number((data as any)?.total || 0);
        out[method] = { total: prev + (Number.isFinite(add) ? add : 0) };
      }
    }
    return out;
  }

  private getTopMethodFrom(byMethod: Record<string, { total: number }>): { label: string; pct: number; total: number } {
    const entries = Object.entries(byMethod || {}).map(([k, v]) => [k, Number(v?.total || 0)] as const);
    const total = entries.reduce((acc, [, v]) => acc + (Number.isFinite(v) ? v : 0), 0);
    if (!total || total <= 0) return { label: '', pct: 0, total: 0 };

    let topKey = '';
    let topVal = -Infinity;
    for (const [k, v] of entries) {
      if (!Number.isFinite(v)) continue;
      if (v > topVal) {
        topVal = v;
        topKey = k;
      }
    }
    const label = topKey ? this.paymentService.getPaymentMethodLabel(topKey) : '';
    const pct = topVal > 0 ? (topVal / total) * 100 : 0;
    return { label, pct, total };
  }

  private getMethodOrder(methodKeys: string[]): string[] {
    const uniq = Array.from(new Set((methodKeys || []).filter(Boolean)));
    const priority = ['CASH', 'CARD'];
    const prioritized = priority.filter(k => uniq.includes(k));
    const rest = uniq.filter(k => !priority.includes(k)).sort((a, b) => a.localeCompare(b));
    return [...prioritized, ...rest];
  }

  private getMethodColors(orderedKeys: string[]): string[] {
    const fallback = ['#8B5CF6', '#F59E0B'];
    let fi = 0;
    return orderedKeys.map((k) => {
      if (k === 'CASH') return '#10B981';
      if (k === 'CARD') return '#3B82F6';
      const c = fallback[fi % fallback.length];
      fi++;
      return c;
    });
  }

  private updatePaymentsChart(byMethod: Record<string, { total: number }>): void {
    const orderedKeys = this.getMethodOrder(Object.keys(byMethod || {}));
    const series = orderedKeys.map(k => Number(byMethod?.[k]?.total || 0));
    const total = series.reduce((acc, v) => acc + (Number.isFinite(v) ? v : 0), 0);

    const hasPayments = total > 0;

    const labels = orderedKeys.map(method => this.paymentService.getPaymentMethodLabel(method));
    const colors = this.getMethodColors(orderedKeys);

    this.paymentsChart = {
      // Mantener render estable aunque total=0
      series: orderedKeys.length > 0 ? series : [0],
      chart: {
        type: 'donut',
        height: 400
      },
      labels: orderedKeys.length > 0 ? labels : ['Sin pagos'],
      colors: orderedKeys.length > 0 ? colors : ['#9CA3AF'],
      legend: {
        show: hasPayments,
        position: 'bottom',
        fontSize: '13px',
        formatter: (seriesName: string, opts: any) => {
          const value = opts?.w?.globals?.series?.[opts.seriesIndex] ?? 0;
          const pct = total > 0 ? (value / total) * 100 : 0;
          return `${seriesName}: ${this.formatAmount(value)} (${pct.toFixed(1)}%)`;
        }
      },
      dataLabels: {
        enabled: hasPayments,
        formatter: (val: number) => `${val.toFixed(1)}%`
      },
      plotOptions: {
        pie: {
          donut: {
            labels: {
              show: true,
              total: {
                show: true,
                label: hasPayments ? 'Total' : 'Sin pagos',
                formatter: () => hasPayments ? this.formatAmount(total) : 'Sin pagos'
              }
            }
          }
        }
      },
      tooltip: {
        y: {
          formatter: (value: number) => this.formatAmount(value)
        }
      },
      noData: {
        text: 'Sin datos'
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

    const maxCount = hourlyData.length > 0
      ? Math.max(...hourlyData.map(h => h.count || 0))
      : 0;
    const peakIndexes = hourlyData
      .map((h, idx) => ((h.count || 0) === maxCount && maxCount > 0 ? idx : -1))
      .filter(idx => idx >= 0);
    const peakHour = peakIndexes.length > 0
      ? `${hourlyData[peakIndexes[0]].hour.toString().padStart(2, '0')}:00`
      : null;
    this.peakSessions = peakHour
      ? { hourLabel: peakHour, count: maxCount }
      : null;

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
        title: {
          text: 'Hora'
        },
        labels: {
          rotate: -45,
          rotateAlways: false
        }
      },
      yaxis: {
        title: {
          text: 'Sesiones'
        },
        min: 0,
        labels: {
          formatter: (value: number) => `${Math.round(value)}`
        }
      },
      colors: ['#3B82F6'],
      markers: {
        size: 4,
        discrete: peakIndexes.map(idx => ({
          seriesIndex: 0,
          dataPointIndex: idx,
          fillColor: '#F59E0B',
          strokeColor: '#F59E0B',
          size: 7
        })),
        hover: {
          size: 6
        },
        strokeWidth: 2,
        strokeColors: ['#3B82F6'],
        fillOpacity: 1
      },
      annotations: peakHour ? {
        xaxis: [{
          x: peakHour,
          borderColor: '#F59E0B',
          strokeDashArray: 2,
          label: {
            text: 'Hora pico',
            style: { background: '#F59E0B', color: '#111827', fontSize: '12px' }
          }
        }]
      } : {},
      grid: {
        borderColor: '#e5e7eb',
        strokeDashArray: 4
      },
      tooltip: {
        y: {
          formatter: (value: number) => `${value} sesiones`
        }
      },
      noData: {
        text: 'Sin datos'
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

