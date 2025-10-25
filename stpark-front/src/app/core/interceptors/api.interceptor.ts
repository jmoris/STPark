import { HttpInterceptorFn, HttpErrorResponse, HttpRequest, HttpEvent } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError } from 'rxjs/operators';
import { throwError, Observable } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';

export const ApiInterceptor: HttpInterceptorFn = (req: HttpRequest<unknown>, next) => {
  const snackBar = inject(MatSnackBar);
  const router = inject(Router);

  // Agregar headers comunes
  const authReq = req.clone({
    setHeaders: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      // Agregar token de autenticación si existe
      // 'Authorization': `Bearer ${getAuthToken()}`
    }
  });

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
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

function getAuthToken(): string | null {
  // Obtener token del localStorage o del servicio de autenticación
  return localStorage.getItem('auth_token');
}

