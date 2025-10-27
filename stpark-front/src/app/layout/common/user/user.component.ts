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
import { Router } from '@angular/router';
import { NgIconsModule } from '@ng-icons/core';
import { Subject, takeUntil } from 'rxjs';
import { AuthService, Tenant, User } from 'app/core/services/auth.service';
import { IconNamePipe } from 'app/core/icons/icon-name.pipe';

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
    user: { id: string; name: string; email: string; avatar?: string; status?: string; } | null = null;
    tenants: Tenant[] = [];
    currentTenant: Tenant | null = null;

    private _unsubscribeAll: Subject<any> = new Subject<any>();

    /**
     * Constructor
     */
    constructor(
        private _changeDetectorRef: ChangeDetectorRef,
        private _router: Router,
        private _authService: AuthService
    ) {}

    // -----------------------------------------------------------------------------------------------------
    // @ Lifecycle hooks
    // -----------------------------------------------------------------------------------------------------

    /**
     * On init
     */
    ngOnInit(): void {
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
                        status: user.status || 'online'
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
        // Recargar la página para que todas las peticiones usen el nuevo tenant
        location.reload();
    }

    /**
     * Sign out
     */
    signOut(): void {
        this._authService.logout();
    }
}
