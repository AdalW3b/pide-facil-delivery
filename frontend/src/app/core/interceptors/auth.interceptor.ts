import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const token = authService.token();

  // Clone request to add the Bearer token if it exists
  let clonedReq = req;
  if (token) {
    clonedReq = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`,
      },
    });
  }

  return next(clonedReq).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse) {
        // Skip side effects for the login endpoint itself so the component can handle validation messages
        if (!req.url.includes('/auth/login')) {
          if (error.status === 401) {
            // 401 Unauthorized: token missing/expired -> logout and redirect to /login
            authService.logout();
          } else if (error.status === 403 && !error.error?.modoSoporte) {
            // 403 Forbidden: authenticated user lacks permission -> redirect to /unauthorized (do NOT logout)
            // Los 403 del modo soporte (falta abrir sesión o el código del dueño)
            // no sacan al operador de la pantalla: la franja de soporte se lo dice.
            router.navigate(['/unauthorized']);
          }
        }
      }
      return throwError(() => error);
    })
  );
};
