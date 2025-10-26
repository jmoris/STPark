import { HttpInterceptorFn, HttpErrorResponse, HttpRequest, HttpEvent } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError } from 'rxjs/operators';
import { throwError, Observable } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { environment } from 'environments/environment';
import { AuthService } from 'app/core/services/auth.service';

export const ApiInterceptor: HttpInterceptorFn = (req: HttpRequest<unknown>, next) => {
  const snackBar = inject(MatSnackBar);
  const router = inject(Router);
  const authService = inject(AuthService);

  // Clone the request object
  let newReq = req.clone();

  // Get current tenant and add X-Tenant header
  const currentTenant = authService.getCurrentTenant();
  console.log('ApiInterceptor: Current tenant:', currentTenant);
  if (currentTenant) {
    console.log('ApiInterceptor: Adding X-Tenant header:', currentTenant.id);
    newReq = newReq.clone({
      headers: newReq.headers.set('X-Tenant', currentTenant.id),
    });
  } else {
    console.warn('ApiInterceptor: No current tenant selected');
  }

  // Add Content-Type and Accept headers
  newReq = newReq.clone({
    headers: newReq.headers
      .set('Content-Type', 'application/json')
      .set('Accept', 'application/json')
  });

  // Add Authorization header if token exists
  const token = authService.getToken();
  if (token) {
    newReq = newReq.clone({
      headers: newReq.headers.set(
        'Authorization',
        'Bearer ' + token
      ),
    });
  }

  return next(newReq).pipe(
    catchError((error: HttpErrorResponse) => {
      // Catch "401 Unauthorized" responses
      if (error.status === 401) {
        // Sign out
        authService.logout();
      }
      
      return handleError(error, snackBar, router);
    })
  );
};

function handleError(error: HttpErrorResponse, snackBar: MatSnackBar, router: Router) {
  let errorMessage = 'Ha ocurrido un error inesperado';

  if (error.error instanceof ErrorEvent) {
    // Error del lado del cliente
    errorMessage = `Error: ${error.error.message}`;
  } else {
    // Error del lado del servidor
    switch (error.status) {
      case 400:
        errorMessage = 'Solicitud inválida';
        if (error.error?.message) {
          errorMessage = error.error.message;
        }
        break;
      case 401:
        errorMessage = 'No autorizado';
        // Redirigir al login
        router.navigate(['/sign-in']);
        break;
      case 403:
        errorMessage = 'Acceso denegado';
        break;
      case 404:
        errorMessage = 'Recurso no encontrado';
        break;
      case 422:
        errorMessage = 'Error de validación';
        if (error.error?.errors) {
          // Mostrar errores de validación específicos
          const validationErrors = Object.values(error.error.errors).flat();
          errorMessage = validationErrors.join(', ');
        }
        break;
      case 500:
        errorMessage = 'Error interno del servidor';
        break;
      case 503:
        errorMessage = 'Servicio no disponible';
        break;
      default:
        errorMessage = error.error?.message || `Error ${error.status}: ${error.statusText}`;
    }
  }

  // Mostrar notificación de error
  snackBar.open(errorMessage, 'Cerrar', {
    duration: 5000,
    panelClass: ['error-snackbar']
  });

  return throwError(() => error);
}


