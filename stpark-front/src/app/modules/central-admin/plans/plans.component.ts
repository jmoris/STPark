import { Component, OnInit, OnDestroy, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatChipsModule } from '@angular/material/chips';
import { MatSelectModule } from '@angular/material/select';
import { MatPaginatorModule, PageEvent, MatPaginatorIntl } from '@angular/material/paginator';
import { MatSortModule, MatSort } from '@angular/material/sort';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject, takeUntil } from 'rxjs';
import { PlanService, Plan, PlanFilters } from 'app/core/services/plan.service';
import { UFService } from 'app/core/services/uf.service';
import { PlanFormComponent, PlanFormData } from './plan-form/plan-form.component';
import { ViewModalComponent, ViewModalData, ViewModalField } from 'app/shared/components/view-modal/view-modal.component';
import { getSpanishPaginatorIntl } from 'app/core/providers/spanish-paginator-intl';

@Component({
  selector: 'app-plans',
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
    MatMenuModule,
    MatChipsModule,
    MatSelectModule,
    MatPaginatorModule,
    MatSortModule
  ],
  providers: [
    { provide: MatPaginatorIntl, useValue: getSpanishPaginatorIntl() }
  ],
  templateUrl: './plans.component.html',
  styleUrls: ['./plans.component.scss']
})
export class PlansComponent implements OnInit, OnDestroy, AfterViewInit {
  private _unsubscribeAll: Subject<any> = new Subject<any>();

  @ViewChild(MatSort) sort!: MatSort;
  
  plans: Plan[] = [];
  loading = false;
  displayedColumns: string[] = ['name', 'max_price_uf', 'status', 'feature_summary', 'actions'];
  
  // Valor UF del día
  currentUFValue: number | null = null;
  
  // Paginación
  totalItems = 0;
  pageSize = 10;
  currentPage = 0;
  pageSizeOptions = [5, 10, 25, 50];

  // Ordenamiento
  sortBy: string = 'name';
  sortOrder: 'asc' | 'desc' = 'asc';
  
  // Filtros
  filters: PlanFilters = {
    name: '',
    status: ''
  };

  constructor(
    private planService: PlanService,
    private ufService: UFService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadPlans();
    this.loadCurrentUFValue();
  }

  ngAfterViewInit(): void {
    // Suscribirse a cambios de ordenamiento
    if (this.sort) {
      this.sort.sortChange
        .pipe(takeUntil(this._unsubscribeAll))
        .subscribe(sort => {
          this.sortBy = sort.active;
          this.sortOrder = sort.direction === 'asc' ? 'asc' : 'desc';
          this.currentPage = 0;
          this.loadPlans();
        });
    }
  }

  ngOnDestroy(): void {
    this._unsubscribeAll.next(null);
    this._unsubscribeAll.complete();
  }

  loadPlans(): void {
    this.loading = true;
    
    const params = {
      page: this.currentPage + 1,
      per_page: this.pageSize,
      sort_by: this.sortBy,
      sort_order: this.sortOrder,
      ...this.filters
    };

    this.planService.getPlans(params)
      .pipe(takeUntil(this._unsubscribeAll))
      .subscribe({
        next: (response) => {
          this.plans = (response.data as any)?.data || [];
          this.totalItems = (response.data as any)?.total || 0;
          this.loading = false;
        },
        error: (error) => {
          console.error('Error loading plans:', error);
          this.loading = false;
          if (error.status === 403) {
            this.snackBar.open('No tiene permisos para acceder a esta funcionalidad', 'Cerrar', { duration: 5000 });
          } else {
            this.snackBar.open('Error al cargar planes', 'Cerrar', { duration: 3000 });
          }
        }
      });
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'ACTIVE':
        return 'success';
      case 'INACTIVE':
        return 'warn';
      case 'DISCONTINUED':
        return 'error';
      default:
        return '';
    }
  }

  getStatusText(status: string): string {
    switch (status) {
      case 'ACTIVE':
        return 'Activo';
      case 'INACTIVE':
        return 'Inactivo';
      case 'DISCONTINUED':
        return 'Descontinuado';
      default:
        return status;
    }
  }

  getFeatureSummary(plan: Plan): string {
    if (!plan.feature) return 'Sin características';
    
    const features: string[] = [];
    if (plan.feature.max_operators) features.push(`${plan.feature.max_operators} operadores`);
    if (plan.feature.max_sectors) features.push(`${plan.feature.max_sectors} sectores`);
    if (plan.feature.max_streets) features.push(`${plan.feature.max_streets} calles`);
    if (plan.feature.includes_debt_management) features.push('Gestión de deudas');
    if (plan.feature.report_type === 'ADVANCED') features.push('Reportes avanzados');
    
    return features.length > 0 ? features.join(', ') : 'Sin límites específicos';
  }

  /**
   * Cargar el valor UF del día actual
   */
  loadCurrentUFValue(): void {
    this.ufService.getCurrentValue()
      .pipe(takeUntil(this._unsubscribeAll))
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.currentUFValue = response.data.value;
          }
        },
        error: (error) => {
          console.error('Error loading UF value:', error);
          // No mostrar error al usuario, solo log
        }
      });
  }

  /**
   * Calcular el valor en pesos chilenos basado en el valor UF
   */
  getPriceInCLP(ufValue: number): number | null {
    if (!this.currentUFValue || !ufValue) {
      return null;
    }
    return ufValue * this.currentUFValue;
  }

  /**
   * Formatear el precio en pesos chilenos
   */
  formatPriceInCLP(ufValue: number): string {
    const clpValue = this.getPriceInCLP(ufValue);
    if (clpValue === null) {
      return '';
    }
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(Math.round(clpValue));
  }

  get activePlansCount(): number {
    return this.plans.filter(p => p.status === 'ACTIVE').length;
  }

  get inactivePlansCount(): number {
    return this.plans.filter(p => p.status !== 'ACTIVE').length;
  }

  createPlan(): void {
    const dialogRef = this.dialog.open(PlanFormComponent, {
      width: '800px',
      maxWidth: '90vw',
      data: { isEdit: false } as PlanFormData
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loadPlans();
      }
    });
  }

  editPlan(plan: Plan): void {
    const dialogRef = this.dialog.open(PlanFormComponent, {
      width: '800px',
      maxWidth: '90vw',
      data: { isEdit: true, plan } as PlanFormData
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loadPlans();
      }
    });
  }

  deletePlan(plan: Plan): void {
    if (confirm(`¿Está seguro de eliminar el plan ${plan.name}?`)) {
      this.planService.deletePlan(plan.id!).subscribe({
        next: () => {
          this.snackBar.open('Plan eliminado correctamente', 'Cerrar', { duration: 3000 });
          this.loadPlans();
        },
        error: (error) => {
          this.snackBar.open('Error al eliminar plan', 'Cerrar', { duration: 3000 });
        }
      });
    }
  }

  viewPlan(plan: Plan): void {
    const fields: ViewModalField[] = [
      {
        label: 'Nombre',
        key: 'name',
        icon: 'label',
        type: 'text'
      },
      {
        label: 'Descripción',
        key: 'description',
        icon: 'description',
        type: 'text'
      },
      {
        label: 'Precio Máximo (UF)',
        key: 'max_price_uf',
        icon: 'attach_money',
        type: 'text',
        format: (value) => {
          const clpValue = this.getPriceInCLP(value);
          if (clpValue !== null) {
            return `${value} UF (${this.formatPriceInCLP(value)})`;
          }
          return `${value} UF`;
        }
      },
      {
        label: 'Estado',
        key: 'status',
        icon: 'toggle_on',
        type: 'badge',
        badgeColor: (value) => this.getStatusColor(value)
      },
      {
        label: 'Características',
        key: 'feature',
        icon: 'settings',
        type: 'text',
        format: (feature) => {
          if (!feature) return 'Sin características';
          const parts: string[] = [];
          if (feature.max_operators) parts.push(`Máx. Operadores: ${feature.max_operators}`);
          if (feature.max_sectors) parts.push(`Máx. Sectores: ${feature.max_sectors}`);
          if (feature.max_streets) parts.push(`Máx. Calles: ${feature.max_streets}`);
          if (feature.max_sessions) parts.push(`Máx. Sesiones: ${feature.max_sessions}`);
          if (feature.max_pricing_profiles) parts.push(`Máx. Perfiles de Precio: ${feature.max_pricing_profiles}`);
          if (feature.max_pricing_rules) parts.push(`Máx. Reglas de Precio: ${feature.max_pricing_rules}`);
          if (feature.includes_debt_management) parts.push('Gestión de Deudas: Sí');
          if (feature.report_type) parts.push(`Tipo de Reporte: ${feature.report_type}`);
          if (feature.support_type) parts.push(`Tipo de Soporte: ${feature.support_type}`);
          return parts.length > 0 ? parts.join('\n') : 'Sin límites específicos';
        }
      },
      {
        label: 'Fecha de Creación',
        key: 'created_at',
        icon: 'schedule',
        type: 'date'
      }
    ];

    const dialogRef = this.dialog.open(ViewModalComponent, {
      width: '600px',
      data: {
        title: 'Detalles del Plan',
        data: plan,
        fields: fields,
        actions: [
          {
            label: 'Editar',
            icon: 'edit',
            color: 'primary',
            action: () => {
              dialogRef.close();
              this.editPlan(plan);
            }
          }
        ]
      } as ViewModalData
    });
  }

  applyFilters(): void {
    this.currentPage = 0;
    this.loadPlans();
  }

  clearFilters(): void {
    this.filters = {
      name: '',
      status: ''
    };
    this.currentPage = 0;
    this.loadPlans();
  }

  onPageChange(event: PageEvent): void {
    this.currentPage = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadPlans();
  }
}
