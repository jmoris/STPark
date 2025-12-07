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
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Subject, takeUntil } from 'rxjs';
import { TenantService, Tenant, TenantFilters } from 'app/core/services/tenant.service';
import { PlanService, Plan } from 'app/core/services/plan.service';
import { TenantFormComponent, TenantFormData } from './tenant-form/tenant-form.component';
import { ViewModalComponent, ViewModalData, ViewModalField } from 'app/shared/components/view-modal/view-modal.component';
import { getSpanishPaginatorIntl } from 'app/core/providers/spanish-paginator-intl';

@Component({
  selector: 'app-tenants',
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
    MatSortModule,
    MatDialogModule,
    MatSnackBarModule
  ],
  providers: [
    { provide: MatPaginatorIntl, useValue: getSpanishPaginatorIntl() }
  ],
  templateUrl: './tenants.component.html',
  styleUrls: ['./tenants.component.scss']
})
export class TenantsComponent implements OnInit, OnDestroy, AfterViewInit {
  private _unsubscribeAll: Subject<any> = new Subject<any>();

  @ViewChild(MatSort) sort!: MatSort;
  
  tenants: Tenant[] = [];
  loading = false;
  displayedColumns: string[] = ['id', 'name', 'plan', 'created_at', 'users_count', 'actions'];
  
  // Paginación
  totalItems = 0;
  pageSize = 10;
  currentPage = 0;
  pageSizeOptions = [5, 10, 25, 50];

  // Ordenamiento
  sortBy: string = 'created_at';
  sortOrder: 'asc' | 'desc' = 'desc';
  
  // Filtros
  filters: TenantFilters = {
    name: ''
  };

  // Planes para el filtro
  plans: Plan[] = [];

  constructor(
    private tenantService: TenantService,
    private planService: PlanService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadTenants();
    this.loadPlans();
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
          this.loadTenants();
        });
    }
  }

  ngOnDestroy(): void {
    this._unsubscribeAll.next(null);
    this._unsubscribeAll.complete();
  }

  loadTenants(): void {
    this.loading = true;
    
    const params = {
      page: this.currentPage + 1,
      per_page: this.pageSize,
      sort_by: this.sortBy,
      sort_order: this.sortOrder,
      ...this.filters
    };

    this.tenantService.getTenants(params)
      .pipe(takeUntil(this._unsubscribeAll))
      .subscribe({
        next: (response) => {
          this.tenants = (response.data as any)?.data || [];
          this.totalItems = (response.data as any)?.total || 0;
          this.loading = false;
        },
        error: (error) => {
          console.error('Error loading tenants:', error);
          this.loading = false;
          if (error.status === 403) {
            this.snackBar.open('No tiene permisos para acceder a esta funcionalidad', 'Cerrar', { duration: 5000 });
          } else {
            this.snackBar.open('Error al cargar estacionamientos', 'Cerrar', { duration: 3000 });
          }
        }
      });
  }

  loadPlans(): void {
    this.planService.getPlans({ status: 'ACTIVE', per_page: 100 })
      .pipe(takeUntil(this._unsubscribeAll))
      .subscribe({
        next: (response) => {
          this.plans = (response.data as any)?.data || [];
        },
        error: (error) => {
          console.error('Error loading plans:', error);
        }
      });
  }

  formatDate(dateString: string | undefined): string {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('es-CL', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(date);
  }

  getPlanName(tenant: Tenant): string {
    return tenant.plan?.name || '-';
  }

  get totalUsers(): number {
    return this.tenants.reduce((sum, t) => sum + (t.users_count || 0), 0);
  }

  get tenantsThisMonth(): number {
    const now = new Date();
    return this.tenants.filter(t => {
      if (!t.created_at) return false;
      const created = new Date(t.created_at);
      return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
    }).length;
  }

  createTenant(): void {
    const dialogRef = this.dialog.open(TenantFormComponent, {
      width: '800px',
      maxWidth: '90vw',
      data: { isEdit: false, plans: this.plans } as TenantFormData
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loadTenants();
      }
    });
  }

  viewTenant(tenant: Tenant): void {
    // Cargar el tenant completo desde el servidor para asegurar que tenemos todos los datos incluyendo settings
    this.tenantService.getTenant(tenant.id).subscribe({
      next: (response) => {
        const fullTenant = response.data;
        
        const fields: ViewModalField[] = [
          {
            label: 'ID',
            key: 'id',
            icon: 'tag',
            type: 'text'
          },
          {
            label: 'Nombre',
            key: 'name',
            icon: 'business',
            type: 'text'
          },
          {
            label: 'Plan de Servicio',
            key: 'plan.name',
            icon: 'card_membership',
            type: 'chip',
            chipColor: () => 'primary'
          },
          {
            label: 'Cantidad de Usuarios',
            key: 'users_count',
            icon: 'people',
            type: 'text',
            format: (value) => value ? `${value} usuarios` : '0 usuarios'
          },
          {
            label: 'Fecha de Inicio de Servicio',
            key: 'created_at',
            icon: 'calendar_today',
            type: 'date'
          },
          {
            label: 'Última Actualización',
            key: 'updated_at',
            icon: 'update',
            type: 'date'
          },
          {
            label: 'Nombre del Sistema',
            key: 'settings.name',
            icon: 'label',
            type: 'text'
          },
          {
            label: 'Capacidad Máxima',
            key: 'settings.max_capacity',
            icon: 'directions_car',
            type: 'text',
            format: (value) => value ? `${value} vehículos` : 'No especificado'
          },
          {
            label: 'POS TUU Habilitado',
            key: 'settings.pos_tuu',
            icon: 'point_of_sale',
            type: 'boolean'
          },
          {
            label: 'Idioma',
            key: 'settings.language',
            icon: 'language',
            type: 'text',
            format: (value) => {
              const languages: { [key: string]: string } = {
                'es': 'Español',
                'en': 'English',
                'pt': 'Português'
              };
              return value ? languages[value] || value : 'No especificado';
            }
          },
          {
            label: 'Moneda',
            key: 'settings.currency',
            icon: 'attach_money',
            type: 'text'
          },
          {
            label: 'Zona Horaria',
            key: 'settings.timezone',
            icon: 'schedule',
            type: 'text'
          }
        ];

        const dialogRef = this.dialog.open(ViewModalComponent, {
          width: '700px',
          data: {
            title: 'Detalles del Estacionamiento',
            data: fullTenant,
            fields: fields,
            actions: [
              {
                label: 'Editar',
                icon: 'edit',
                color: 'primary',
                action: () => {
                  dialogRef.close();
                  this.editTenant(tenant);
                }
              }
            ]
          } as ViewModalData
        });
      },
      error: (error) => {
        console.error('Error loading tenant:', error);
        this.snackBar.open('Error al cargar los datos del estacionamiento', 'Cerrar', { duration: 3000 });
      }
    });
  }

  editTenant(tenant: Tenant): void {
    // Cargar el tenant completo desde el servidor para asegurar que tenemos todos los datos
    this.tenantService.getTenant(tenant.id).subscribe({
      next: (response) => {
        const fullTenant = response.data;
        console.log('Tenant loaded for edit:', fullTenant);
        console.log('Settings:', fullTenant.settings);
        
        const dialogRef = this.dialog.open(TenantFormComponent, {
          width: '800px',
          maxWidth: '90vw',
          data: { isEdit: true, tenant: fullTenant, plans: this.plans } as TenantFormData
        });

        dialogRef.afterClosed().subscribe(result => {
          if (result) {
            this.loadTenants();
          }
        });
      },
      error: (error) => {
        console.error('Error loading tenant:', error);
        this.snackBar.open('Error al cargar los datos del estacionamiento', 'Cerrar', { duration: 3000 });
      }
    });
  }

  deleteTenant(tenant: Tenant): void {
    if (confirm(`¿Está seguro de eliminar el estacionamiento ${tenant.name || tenant.id}? Esta acción no se puede deshacer.`)) {
      this.tenantService.deleteTenant(tenant.id).subscribe({
        next: () => {
          this.snackBar.open('Estacionamiento eliminado correctamente', 'Cerrar', { duration: 3000 });
          this.loadTenants();
        },
        error: (error) => {
          console.error('Error deleting tenant:', error);
          const errorMessage = error.error?.message || 'Error al eliminar estacionamiento';
          this.snackBar.open(errorMessage, 'Cerrar', { duration: 5000 });
        }
      });
    }
  }

  applyFilters(): void {
    this.currentPage = 0;
    this.loadTenants();
  }

  clearFilters(): void {
    this.filters = {
      name: ''
    };
    this.currentPage = 0;
    this.loadTenants();
  }

  onPageChange(event: PageEvent): void {
    this.currentPage = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadTenants();
  }
}

