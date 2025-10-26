import { inject } from '@angular/core';
import { CanActivateChildFn, CanActivateFn, Router } from '@angular/router';
import { AuthService } from 'app/core/services/auth.service';
import { of } from 'rxjs';

export const NoAuthGuard: CanActivateFn | CanActivateChildFn = (
    route,
    state
) => {
    const router: Router = inject(Router);
    const authService = inject(AuthService);

    // Check the authentication status
    const isAuthenticated = authService.isAuthenticated();
    
    console.log('NoAuthGuard: checking for', state.url, 'isAuthenticated:', isAuthenticated);

    // If the user is authenticated, redirect to the parking page
    if (isAuthenticated) {
        console.log('NoAuthGuard: redirecting authenticated user to /parking');
        return of(router.parseUrl('/parking'));
    }

    // Allow the access
    console.log('NoAuthGuard: allowing access to unauthenticated route');
    return of(true);
};
