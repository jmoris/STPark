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
import { UserService, User, UserFilters } from 'app/core/services/user.service';
import { TenantService } from 'app/core/services/tenant.service';
import { UserFormComponent, UserFormData } from './user-form/user-form.component';
import { ViewModalComponent, ViewModalData, ViewModalField } from 'app/shared/components/view-modal/view-modal.component';
import { getSpanishPaginatorIntl } from 'app/core/providers/spanish-paginator-intl';

@Component({
  selector: 'app-users',
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
  templateUrl: './users.component.html',
  styleUrls: ['./users.component.scss']
})
export class UsersComponent implements OnInit, OnDestroy, AfterViewInit {
  private _unsubscribeAll: Subject<any> = new Subject<any>();

  @ViewChild(MatSort) sort!: MatSort;
  
  users: User[] = [];
  loading = false;
  displayedColumns: string[] = ['id', 'name', 'email', 'is_central_admin', 'tenants_count', 'created_at', 'actions'];
  
  // Paginación
  totalItems = 0;
  pageSize = 10;
  currentPage = 0;
  pageSizeOptions = [5, 10, 25, 50];

  // Ordenamiento
  sortBy: string = 'created_at';
  sortOrder: 'asc' | 'desc' = 'desc';
  
  // Filtros
  filters: UserFilters = {
    name: '',
    email: ''
  };

  constructor(
    private userService: UserService,
    private tenantService: TenantService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadUsers();
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
          this.loadUsers();
        });
    }
  }

  ngOnDestroy(): void {
    this._unsubscribeAll.next(null);
    this._unsubscribeAll.complete();
  }

  loadUsers(): void {
    this.loading = true;
    
    const params = {
      page: this.currentPage + 1,
      per_page: this.pageSize,
      sort_by: this.sortBy,
      sort_order: this.sortOrder,
      ...this.filters
    };

    this.userService.getUsers(params)
      .pipe(takeUntil(this._unsubscribeAll))
      .subscribe({
        next: (response) => {
          this.users = (response.data as any)?.data || [];
          this.totalItems = (response.data as any)?.total || 0;
          this.loading = false;
        },
        error: (error) => {
          console.error('Error loading users:', error);
          this.loading = false;
          if (error.status === 403) {
            this.snackBar.open('No tiene permisos para acceder a esta funcionalidad', 'Cerrar', { duration: 5000 });
          } else {
            this.snackBar.open('Error al cargar usuarios', 'Cerrar', { duration: 3000 });
          }
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

  get totalUsers(): number {
    return this.users.length;
  }

  get centralAdmins(): number {
    return this.users.filter(u => u.is_central_admin).length;
  }

  get usersThisMonth(): number {
    const now = new Date();
    return this.users.filter(u => {
      if (!u.created_at) return false;
      const created = new Date(u.created_at);
      return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
    }).length;
  }

  createUser(): void {
    const dialogRef = this.dialog.open(UserFormComponent, {
      width: '800px',
      maxWidth: '90vw',
      data: { isEdit: false } as UserFormData
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loadUsers();
      }
    });
  }

  viewUser(user: User): void {
    // Cargar el usuario completo desde el servidor
    this.userService.getUser(user.id).subscribe({
      next: (response) => {
        const fullUser = response.data;
        
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
            icon: 'person',
            type: 'text'
          },
          {
            label: 'Email',
            key: 'email',
            icon: 'email',
            type: 'text'
          },
          {
            label: 'Administrador Central',
            key: 'is_central_admin',
            icon: 'admin_panel_settings',
            type: 'boolean'
          },
          {
            label: 'Cantidad de Estacionamientos',
            key: 'tenants_count',
            icon: 'local_parking',
            type: 'text',
            format: (value) => value ? `${value} estacionamiento(s)` : '0 estacionamientos'
          },
          {
            label: 'Fecha de Registro',
            key: 'created_at',
            icon: 'calendar_today',
            type: 'date'
          },
          {
            label: 'Última Actualización',
            key: 'updated_at',
            icon: 'update',
            type: 'date'
          }
        ];

        const dialogRef = this.dialog.open(ViewModalComponent, {
          width: '700px',
          data: {
            title: 'Detalles del Usuario',
            data: fullUser,
            fields: fields,
            actions: [
              {
                label: 'Editar',
                icon: 'edit',
                color: 'primary',
                action: () => {
                  dialogRef.close();
                  this.editUser(user);
                }
              }
            ]
          } as ViewModalData
        });
      },
      error: (error) => {
        console.error('Error loading user:', error);
        this.snackBar.open('Error al cargar los datos del usuario', 'Cerrar', { duration: 3000 });
      }
    });
  }

  editUser(user: User): void {
    // Cargar el usuario completo desde el servidor
    this.userService.getUser(user.id).subscribe({
      next: (response) => {
        const fullUser = response.data;
        
        const dialogRef = this.dialog.open(UserFormComponent, {
          width: '800px',
          maxWidth: '90vw',
          data: { isEdit: true, user: fullUser } as UserFormData
        });

        dialogRef.afterClosed().subscribe(result => {
          if (result) {
            this.loadUsers();
          }
        });
      },
      error: (error) => {
        console.error('Error loading user:', error);
        this.snackBar.open('Error al cargar los datos del usuario', 'Cerrar', { duration: 3000 });
      }
    });
  }

  deleteUser(user: User): void {
    if (confirm(`¿Está seguro de eliminar el usuario ${user.name || user.email}? Esta acción no se puede deshacer.`)) {
      this.userService.deleteUser(user.id).subscribe({
        next: () => {
          this.snackBar.open('Usuario eliminado correctamente', 'Cerrar', { duration: 3000 });
          this.loadUsers();
        },
        error: (error) => {
          console.error('Error deleting user:', error);
          const errorMessage = error.error?.message || 'Error al eliminar usuario';
          this.snackBar.open(errorMessage, 'Cerrar', { duration: 5000 });
        }
      });
    }
  }

  assignToTenants(user: User): void {
    // Cargar el usuario completo y mostrar diálogo de asignación
    this.userService.getUser(user.id).subscribe({
      next: (response) => {
        const fullUser = response.data;
        
        const dialogRef = this.dialog.open(UserFormComponent, {
          width: '800px',
          maxWidth: '90vw',
          data: { isEdit: false, user: fullUser, showTenantAssignment: true } as UserFormData
        });

        dialogRef.afterClosed().subscribe(result => {
          if (result) {
            this.loadUsers();
          }
        });
      },
      error: (error) => {
        console.error('Error loading user:', error);
        this.snackBar.open('Error al cargar los datos del usuario', 'Cerrar', { duration: 3000 });
      }
    });
  }

  applyFilters(): void {
    this.currentPage = 0;
    this.loadUsers();
  }

  clearFilters(): void {
    this.filters = {
      name: '',
      email: ''
    };
    this.currentPage = 0;
    this.loadUsers();
  }

  onPageChange(event: PageEvent): void {
    this.currentPage = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadUsers();
  }
}
