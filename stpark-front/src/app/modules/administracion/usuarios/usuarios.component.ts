import { Component, ViewEncapsulation, ViewChild, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { CommonModule } from '@angular/common';
import { User } from 'app/interfaces/user.interface';
import { TableModule } from 'primeng/table';
import { MenuModule } from 'primeng/menu';
import { DialogModule } from 'primeng/dialog';
import { ToastModule } from 'primeng/toast';
import { SelectModule } from 'primeng/select';
import { TooltipModule } from 'primeng/tooltip';
import { InputTextModule } from 'primeng/inputtext';
import { MenuItem, MessageService, LazyLoadEvent } from 'primeng/api';
import { Menu } from 'primeng/menu';
import { UserCreateModalComponent } from './user-create-modal/user-create-modal.component';
import { UserDetailsModalComponent } from './user-details-modal/user-details-modal.component';
import { FuseConfirmationService } from '@fuse/services/confirmation/confirmation.service';
import { UsersService, UsersParams } from './services/users.service';
    
@Component({
    selector: 'administracion-usuarios',
    standalone: true,
    templateUrl: './usuarios.component.html',
    styleUrls: ['./usuarios.component.scss'],
    encapsulation: ViewEncapsulation.None,
    providers: [MessageService],
    imports: [
        ButtonModule,
        CardModule,
        CommonModule,
        FormsModule,
        TableModule,
        MenuModule,
        DialogModule,
        ToastModule,
        SelectModule,
        TooltipModule,
        InputTextModule,
        UserCreateModalComponent,
        UserDetailsModalComponent
    ],
})
export class UsuariosComponent implements OnInit
{
    @ViewChild('menu') menu!: Menu;
    
    users: User[] = [];
    totalRecords: number = 0;
    loading: boolean = false;
    menuItems: MenuItem[] = [];
    showCreateModal: boolean = false;
    showDetailsModal: boolean = false;
    userToEdit: User | null = null;
    selectedUser: User | null = null;
    showFilters: boolean = false;
    
    // Parámetros de paginación y ordenamiento
    first: number = 0;
    rows: number = 10;
    sortField: string = '';
    sortOrder: number = 1;
    
    // Opciones para los dropdowns
    rowsPerPageOptions = [10, 25, 50, 100];
    
    // Filtros
    filters = {
        name: '',
        lastname: '',
        email: '',
        role: '',
        status: ''
    };
    
    // Opciones para los filtros
    roleOptions = [
        { label: 'Todos los roles', value: '' },
        { label: 'Administrador', value: 'Administrador' },
        { label: 'Supervisor', value: 'Supervisor' },
        { label: 'Operador', value: 'Operador' },
        { label: 'Auditor', value: 'Auditor' }
    ];
    
    statusOptions = [
        { label: 'Todos los estados', value: '' },
        { label: 'Activo', value: 'true' },
        { label: 'Inactivo', value: 'false' }
    ];
    
    /**
     * Constructor
     */
    constructor(
        private router: Router, 
        private messageService: MessageService,
        private confirmationService: FuseConfirmationService,
        private usersService: UsersService
    ) {}

    ngOnInit(): void {
        this.loadUsers();
    }

    loadUsers(): void {
        this.loading = true;
        
        const params: UsersParams = {
            page: Math.floor(this.first / this.rows) + 1,
            limit: this.rows,
            sortBy: this.sortField,
            sortOrder: this.sortOrder === 1 ? 'asc' : 'desc'
        };

        this.usersService.getUsers(params).subscribe({
            next: (users) => {
                this.users = users;
                // MockAPI no devuelve el total, así que estimamos basado en la respuesta
                this.totalRecords = users.length === this.rows ? (Math.floor(this.first / this.rows) + 1) * this.rows + 1 : users.length;
                this.loading = false;
            },
            error: (error) => {
                console.error('Error loading users:', error);
                this.messageService.add({
                    severity: 'error',
                    summary: 'Error',
                    detail: 'Error al cargar los usuarios',
                    life: 3000
                });
                this.loading = false;
            }
        });
    }

    onLazyLoad(event: LazyLoadEvent): void {
        this.first = event.first || 0;
        this.rows = event.rows || 10;
        
        if (event.sortField) {
            this.sortField = event.sortField;
            this.sortOrder = event.sortOrder || 1;
        }
        
        this.loadUsers();
    }

    toggleFilters(): void {
        this.showFilters = !this.showFilters;
    }

    applyFilters(): void {
        this.first = 0; // Reset to first page
        this.loadUsers();
    }

    clearFilters(): void {
        this.filters = {
            name: '',
            lastname: '',
            email: '',
            role: '',
            status: ''
        };
        this.first = 0; // Reset to first page
        this.loadUsers();
    }

    toggleMenu(event: Event, user: User): void {
        this.menu.toggle(event);
    }

    getMenuItems(user: User): MenuItem[] {
        return [
            {
                label: 'Ver detalles',
                icon: 'pi pi-eye text-blue-500',
                styleClass: 'menu-item-view',
                command: () => this.verUsuario(user)
            },
            {
                label: 'Editar',
                icon: 'pi pi-pencil text-yellow-500',
                styleClass: 'menu-item-edit',
                command: () => this.editarUsuario(user)
            },
            {
                separator: true
            },
            {
                label: 'Eliminar',
                icon: 'pi pi-trash text-red-500',
                styleClass: 'menu-item-delete p-menuitem-danger',
                command: () => this.eliminarUsuario(user)
            }
        ];
    }

    crearUsuario(): void {
        this.showCreateModal = true;
    }

    verUsuario(user: User): void {
        console.log('Ver usuario:', user);
        this.selectedUser = user;
        this.showDetailsModal = true;
    }

    editarUsuario(user: User): void {
        console.log('Editando usuario:', user);
        this.userToEdit = user;
        this.showCreateModal = true;
        console.log('userToEdit establecido:', this.userToEdit);
    }

    eliminarUsuario(user: User): void {
        // Configurar el diálogo de confirmación
        const confirmationConfig = {
            title: 'Confirmar eliminación',
            message: `¿Estás seguro de que deseas eliminar al usuario <strong>${user.name} ${user.lastname}</strong>?<br><br>Esta acción no se puede deshacer.`,
            icon: {
                show: true,
                name: 'heroicons_outline:exclamation-triangle',
                color: 'warn' as const,
            },
            actions: {
                confirm: {
                    show: true,
                    label: 'Eliminar',
                    color: 'warn' as const,
                },
                cancel: {
                    show: true,
                    label: 'Cancelar',
                },
            },
            dismissible: false,
        };

        // Abrir el diálogo de confirmación
        const dialogRef = this.confirmationService.open(confirmationConfig);

        // Aplicar blur al backdrop después de que se abra el diálogo
        setTimeout(() => {
            const backdrop = document.querySelector('.cdk-overlay-backdrop');
            if (backdrop) {
                (backdrop as HTMLElement).style.setProperty('backdrop-filter', 'blur(4px)', 'important');
                (backdrop as HTMLElement).style.setProperty('-webkit-backdrop-filter', 'blur(4px)', 'important');
                (backdrop as HTMLElement).style.setProperty('background-color', 'rgba(0, 0, 0, 0.5)', 'important');
            }
        }, 50);

        // Manejar la respuesta del diálogo
        dialogRef.afterClosed().subscribe((result) => {
            if (result === 'confirmed') {
                this.confirmarEliminacion(user);
            }
        });
    }

    private confirmarEliminacion(user: User): void {
        if (user.id) {
            this.usersService.deleteUser(user.id).subscribe({
                next: () => {
                    // Recargar la lista de usuarios
                    this.loadUsers();
                    
                    // Mostrar notificación de éxito
                    this.messageService.add({
                        severity: 'success',
                        summary: 'Éxito',
                        detail: `Usuario ${user.name} ${user.lastname} eliminado correctamente`,
                        life: 3000
                    });
                    
                    console.log('Usuario eliminado:', user);
                },
                error: (error) => {
                    console.error('Error deleting user:', error);
                    this.messageService.add({
                        severity: 'error',
                        summary: 'Error',
                        detail: 'Error al eliminar el usuario',
                        life: 3000
                    });
                }
            });
        } else {
            this.messageService.add({
                severity: 'error',
                summary: 'Error',
                detail: 'No se pudo encontrar el ID del usuario para eliminar',
                life: 3000
            });
        }
    }


    closeCreateModal(): void {
        this.showCreateModal = false;
        this.userToEdit = null;
    }

    closeDetailsModal(): void {
        this.showDetailsModal = false;
        this.selectedUser = null;
    }

    onDetailsModalVisibleChange(visible: boolean): void {
        this.showDetailsModal = visible;
        if (!visible) {
            this.selectedUser = null;
        }
    }

    onCreateModalVisibleChange(visible: boolean): void {
        this.showCreateModal = visible;
        
        // Si se cierra el modal, limpiar el usuario a editar
        if (!visible) {
            this.userToEdit = null;
        }
    }

    onUserCreated(newUser: User): void {
        this.showCreateModal = false;
        this.userToEdit = null;
        
        // Recargar la lista de usuarios
        this.loadUsers();
        
        // Mostrar notificación de éxito
        this.messageService.add({
            severity: 'success',
            summary: 'Éxito',
            detail: `Usuario ${newUser.name} ${newUser.lastname} creado correctamente`,
            life: 3000
        });
        
        console.log('Usuario creado:', newUser);
    }

    onUserUpdated(updatedUser: User): void {
        this.showCreateModal = false;
        this.userToEdit = null;
        
        // Recargar la lista de usuarios
        this.loadUsers();
        
        // Mostrar notificación de éxito
        this.messageService.add({
            severity: 'success',
            summary: 'Éxito',
            detail: `Usuario ${updatedUser.name} ${updatedUser.lastname} actualizado correctamente`,
            life: 3000
        });
        
        console.log('Usuario actualizado:', updatedUser);
    }
}