import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { FuseCardComponent } from '@fuse/components/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { NgApexchartsModule } from 'ng-apexcharts';
import { HttpClient } from '@angular/common/http';
import { environment } from 'environments/environment';
import { FacturAPIConfigModalComponent } from '../facturapi-config/facturapi-config-modal.component';

interface TenantStats {
  total: number;
  registeredThisMonth: number;
  monthlyData: { month: string; count: number }[];
}

@Component({
  selector: 'app-central-admin-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    FuseCardComponent,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    NgApexchartsModule
  ],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class CentralAdminDashboardComponent implements OnInit, OnDestroy {
  private _unsubscribeAll: Subject<any> = new Subject<any>();
  private baseUrl = `${environment.authApiUrl}/api`;

  // Data
  loading = false;
  error: string | null = null;
  totalTenants = 0;
  tenantsThisMonth = 0;

  // Month filter
  selectedMonth: string = '';
  availableMonths: { value: string; label: string }[] = [];

  // Chart
  tenantsChart: any = {};

  constructor(private http: HttpClient) {
    this.initializeMonths();
    this.selectedMonth = this.getCurrentMonth();
  }

  ngOnInit(): void {
    this.loadDashboardData();
    this.initializeChart();
  }

  ngOnDestroy(): void {
    this._unsubscribeAll.next(null);
    this._unsubscribeAll.complete();
  }

  /**
   * Initialize available months (last 12 months)
   */
  private initializeMonths(): void {
    const months: { value: string; label: string }[] = [];
    const currentDate = new Date();
    
    for (let i = 11; i >= 0; i--) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      const monthValue = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthLabel = date.toLocaleDateString('es-CL', { year: 'numeric', month: 'long' });
      months.push({ value: monthValue, label: monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1) });
    }
    
    this.availableMonths = months;
  }

  /**
   * Get current month in YYYY-MM format
   */
  private getCurrentMonth(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  /**
   * Load dashboard data
   */
  loadDashboardData(): void {
    this.loading = true;
    this.error = null;

    const [year, month] = this.selectedMonth.split('-');
    const params = { year, month };

    this.http.get<{ success: boolean; data: TenantStats }>(`${this.baseUrl}/central-admin/dashboard`, { params })
      .pipe(takeUntil(this._unsubscribeAll))
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.totalTenants = response.data.total;
            this.tenantsThisMonth = response.data.registeredThisMonth;
            this.updateChart(response.data.monthlyData);
          }
          this.loading = false;
        },
        error: (error) => {
          console.error('Error loading dashboard data:', error);
          this.error = 'Error al cargar los datos del dashboard';
          this.loading = false;
        }
      });
  }

  /**
   * Initialize chart
   */
  private initializeChart(): void {
    this.tenantsChart = {
      series: [{
        name: 'Tenants Registrados',
        data: []
      }],
      chart: {
        type: 'line',
        height: 350,
        toolbar: {
          show: false
        }
      },
      dataLabels: {
        enabled: true
      },
      stroke: {
        curve: 'smooth',
        width: 3
      },
      xaxis: {
        categories: []
      },
      yaxis: {
        title: {
          text: 'Cantidad de Tenants'
        }
      },
      colors: ['#043476'],
      grid: {
        borderColor: '#e7e7e7',
        row: {
          colors: ['#f3f3f3', 'transparent'],
          opacity: 0.5
        }
      },
      tooltip: {
        y: {
          formatter: (val: number) => `${val} tenants`
        }
      }
    };
  }

  /**
   * Update chart with new data
   */
  private updateChart(monthlyData: { month: string; count: number }[]): void {
    const categories = monthlyData.map(item => {
      const [year, month] = item.month.split('-');
      const date = new Date(parseInt(year), parseInt(month) - 1, 1);
      return date.toLocaleDateString('es-CL', { month: 'short', year: 'numeric' });
    });
    
    const data = monthlyData.map(item => item.count);

    this.tenantsChart = {
      ...this.tenantsChart,
      series: [{
        name: 'Tenants Registrados',
        data: data
      }],
      xaxis: {
        categories: categories
      }
    };
  }

  /**
   * On month change
   */
  onMonthChange(): void {
    this.loadDashboardData();
  }

  /**
   * Refresh data
   */
  refreshData(): void {
    this.loadDashboardData();
  }
}
