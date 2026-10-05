import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  if (authService.isAuthenticated()) return true;
  return router.createUrlTree(['/login']);
};

export const roleGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  if (!authService.isAuthenticated()) return router.createUrlTree(['/login']);
  const userRole = authService.userRole();
  // Las pantallas de la plataforma son solo del operador: ahí el dueño no pasa.
  const soloOperador = route.data?.['soloOperador'] === true;
  if (soloOperador) {
    return userRole === 'SYSTEM_ADMIN' ? true : router.createUrlTree(['/unauthorized']);
  }
  if (userRole === 'SUPER_ADMIN') return true;
  const expectedRoles = (route.data?.['roles'] || route.data?.['expectedRoles']) as string[] | undefined;
  if (!expectedRoles || expectedRoles.length === 0) return true;
  if (userRole && expectedRoles.includes(userRole)) return true;
  return router.createUrlTree(['/unauthorized']);
};

export const permissionGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  if (!authService.isAuthenticated()) return router.createUrlTree(['/login']);
  const requiredPermission = route.data?.['requiredPermission'] as string | undefined;
  if (!requiredPermission) return true;
  if (authService.hasPermission(requiredPermission)) return true;
  // Permisos que también abren la pantalla: quien tenía acceso por el catálogo
  // conserva el del inventario aunque su sesión sea anterior al permiso nuevo.
  const alternos = (route.data?.['permisosAlternos'] as string[] | undefined) ?? [];
  if (alternos.some((p) => authService.hasPermission(p))) return true;
  return router.createUrlTree(['/unauthorized']);
};
