import { inject } from '@angular/core';
import { CanActivateChildFn, CanActivateFn, Router } from '@angular/router';
import { AuthService as AuthServiceNew } from 'app/core/services/auth.service';
import { of } from 'rxjs';

export const AuthGuard: CanActivateFn | CanActivateChildFn = (route, state) => {
    const router: Router = inject(Router);
    const authService = inject(AuthServiceNew);

    // Check the authentication status
    const isAuthenticated = authService.isAuthenticated();
    
    console.log('AuthGuard: checking authentication for', state.url, 'isAuthenticated:', isAuthenticated);

    // If the user is not authenticated...
    if (!isAuthenticated) {
        // Redirect to the sign-in page with a redirectUrl param
        const redirectURL =
            state.url === '/sign-out'
                ? ''
                : `redirectURL=${state.url}`;
        const urlTree = router.parseUrl(`sign-in?${redirectURL}`);
        
        console.log('AuthGuard: redirecting to sign-in');
        return of(urlTree);
    }

    // Allow the access
    console.log('AuthGuard: allowing access');
    return of(true);
};
