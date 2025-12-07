import { BooleanInput } from '@angular/cdk/coercion';
import { NgClass } from '@angular/common';
import {
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    Input,
    OnDestroy,
    OnInit,
    ViewEncapsulation,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { NgIconsModule } from '@ng-icons/core';
import { Subject, takeUntil } from 'rxjs';
import { AuthService, Tenant, User } from 'app/core/services/auth.service';
import { IconNamePipe } from 'app/core/icons/icon-name.pipe';
import { EditProfileComponent } from './edit-profile/edit-profile.component';

@Component({
    selector: 'user',
    templateUrl: './user.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    exportAs: 'user',
    imports: [
        MatButtonModule,
        MatMenuModule,
        MatIconModule,
        NgClass,
        MatDividerModule,
        NgIconsModule,
        IconNamePipe,
    ],
})
export class UserComponent implements OnInit, OnDestroy {
    /* eslint-disable @typescript-eslint/naming-convention */
    static ngAcceptInputType_showAvatar: BooleanInput;
    /* eslint-enable @typescript-eslint/naming-convention */

    @Input() showAvatar: boolean = true;
    user: { id: string; name: string; email: string; avatar?: string; status?: string; is_central_admin?: boolean; } | null = null;
    tenants: Tenant[] = [];
    currentTenant: Tenant | null = null;
    isCentralAdminMode: boolean = false;

    private _unsubscribeAll: Subject<any> = new Subject<any>();

    /**
     * Constructor
     */
    constructor(
        private _changeDetectorRef: ChangeDetectorRef,
        private _router: Router,
        private _authService: AuthService,
        private _dialog: MatDialog
    ) {}

    // -----------------------------------------------------------------------------------------------------
    // @ Lifecycle hooks
    // -----------------------------------------------------------------------------------------------------

    /**
     * On init
     */
    ngOnInit(): void {
        // Initialize central admin mode state
        this.isCentralAdminMode = this._authService.isCentralAdminMode();

        // Subscribe to user changes from the new auth service
        this._authService.currentUser$
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe((user: User | null) => {
                if (user) {
                    this.user = {
                        id: user.id.toString(),
                        name: user.name,
                        email: user.email,
                        avatar: user.avatar,
                        status: user.status || 'online',
                        is_central_admin: user.is_central_admin
                    };
                } else {
                    this.user = null;
                }

                // Mark for check
                this._changeDetectorRef.markForCheck();
            });

        // Subscribe to tenants changes
        this._authService.tenants$
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe((tenants: Tenant[]) => {
                console.log('UserComponent: tenants received:', tenants);
                this.tenants = tenants;

                // Mark for check
                this._changeDetectorRef.markForCheck();
            });

        // Subscribe to current tenant changes
        this._authService.currentTenant$
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe((tenant: Tenant | null) => {
                this.currentTenant = tenant;
                this.isCentralAdminMode = this._authService.isCentralAdminMode();

                // Mark for check
                this._changeDetectorRef.markForCheck();
            });
    }

    /**
     * On destroy
     */
    ngOnDestroy(): void {
        // Unsubscribe from all subscriptions
        this._unsubscribeAll.next(null);
        this._unsubscribeAll.complete();
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods
    // -----------------------------------------------------------------------------------------------------

    /**
     * Update the user status
     *
     * @param status
     */
    updateUserStatus(status: string): void {
        // Return if user is not available
        if (!this.user) {
            return;
        }

        // Update the user status locally
        this.user.status = status;
        this._changeDetectorRef.markForCheck();
    }

    /**
     * Change tenant
     */
    changeTenant(tenant: Tenant): void {
        this._authService.setCurrentTenant(tenant);
        // Redirigir al dashboard después de cambiar el tenant
        this._router.navigate(['/parking/dashboard']).then(() => {
            // Recargar la página para que todas las peticiones usen el nuevo tenant
            location.reload();
        });
    }

    /**
     * Activate central admin mode
     */
    activateCentralAdminMode(): void {
        this._authService.setCentralAdminMode();
        // Redirigir al dashboard de administración central
        this._router.navigate(['/central-admin/dashboard']).then(() => {
            // Recargar la página para aplicar los cambios de navegación
            location.reload();
        });
    }

    /**
     * Check if user is central admin
     */
    get isCentralAdmin(): boolean {
        return this.user?.is_central_admin === true;
    }

    /**
     * Sign out
     */
    signOut(): void {
        this._authService.logout();
    }

    /**
     * Open edit profile dialog
     */
    openEditProfile(): void {
        const currentTenant = this._authService.getCurrentTenant();
        
        const dialogRef = this._dialog.open(EditProfileComponent, {
            width: '500px',
            data: {
                user: {
                    id: this.user?.id || '',
                    name: this.user?.name || '',
                    email: this.user?.email || '',
                    tenant: currentTenant?.name || ''
                }
            }
        });

        dialogRef.afterClosed().subscribe((result) => {
            if (result) {
                // Actualizar el usuario si se guardaron cambios
                // El AuthService debe actualizar automáticamente
                this._changeDetectorRef.markForCheck();
            }
        });
    }
}
