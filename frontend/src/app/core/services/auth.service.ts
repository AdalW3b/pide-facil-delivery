import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface UserRoleInfo {
  id?: string | number;
  name?: string;
  description?: string;
  defaultRoute?: string;
  default_route?: string;
}

export interface UserInfo {
  id?: string | number;
  username?: string;
  role?: UserRoleInfo;
  [key: string]: any;
}

export interface LoginResponse {
  token?: string;
  jwt?: string;
  accessToken?: string;
  user?: UserInfo;
  [key: string]: any;
}

export interface DecodedTokenPayload {
  sub?: string; // username
  role?: string | UserRoleInfo;
  defaultRoute?: string;
  default_route?: string;
  branch_id?: string | number;
  permissions?: string[];
  exp?: number;
  [key: string]: any;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly tokenKey = 'token';
  private readonly apiBase = environment.apiUrl;

  // Signals
  private readonly _token = signal<string | null>(localStorage.getItem(this.tokenKey));
  public readonly token = this._token.asReadonly();

  public readonly isAuthenticated = computed(() => {
    const tokenStr = this.token();
    if (!tokenStr) return false;
    
    try {
      // Extraemos el payload del JWT (la segunda parte dividida por el punto)
      const payload = JSON.parse(atob(tokenStr.split('.')[1]));
      
      // El 'exp' del JWT viene en segundos, lo multiplicamos por 1000 para compararlo con milisegundos
      const isExpired = (payload.exp * 1000) < Date.now();
      return !isExpired;
    } catch (e) {
      // Si el token está mal formado o no se puede decodificar, forzamos el cierre de sesión
      return false;
    }
  });

  // Computed signal to decode payload
  public readonly decodedToken = computed<DecodedTokenPayload | null>(() => {
    return this.decodeToken(this.token());
  });

  // Expose role and branch_id
  public readonly userRole = computed<string | null>(() => {
    const rawRole = this.decodedToken()?.role;
    if (rawRole && typeof rawRole === 'object') {
      return rawRole.name || null;
    }
    return (rawRole as string) || null;
  });

  public readonly userBranchId = computed<string | null>(() => {
    const token = this.decodedToken() as any;
    if (!token) return null;
    const branch = token.branchId || token.branch_id;
    return branch ? String(branch) : null;
  });

  /** Computed list of permissions from the JWT payload */
  public readonly permissions = computed<string[]>(() => {
    const rawPerms = this.decodedToken()?.permissions ?? [];
    if (!Array.isArray(rawPerms)) return [];
    return rawPerms.map((p: any) => {
      if (typeof p === 'string') return p.toUpperCase();
      if (p && typeof p === 'object' && p.name) return String(p.name).toUpperCase();
      return String(p).toUpperCase();
    });
  });

  /** Computed current user ID from the JWT payload */
  public readonly currentUserId = computed<string | number | null>(() => {
    const payload = this.decodedToken();
    if (!payload) return null;
    return payload['userId'] ?? payload['user_id'] ?? payload['id'] ?? payload.sub ?? null;
  });

  /** Dynamic default route from user role, decoded token, or localStorage */
  public readonly defaultRoute = computed<string>(() => {
    const payload = this.decodedToken();
    if (payload?.role && typeof payload.role === 'object') {
      const routeFromObj = payload.role.defaultRoute || payload.role.default_route;
      if (routeFromObj) return routeFromObj;
    }
    const tokenRoute = payload?.defaultRoute || payload?.default_route;
    if (tokenRoute) return tokenRoute;

    const storedRoute = localStorage.getItem('defaultRoute');
    if (storedRoute) return storedRoute;

    return '/dashboard';
  });

  /**
   * Returns true if the current user has the given permission string.
   * Falls back to true for SUPER_ADMIN to guarantee full access.
   */
  public hasPermission(permission: string): boolean {
    if (!permission) return true;
    if (this.userRole() === 'SUPER_ADMIN') return true;
    const targetPerm = permission.toUpperCase();
    return this.permissions().includes(targetPerm);
  }

  public readonly username = computed<string | null>(() => {
    return this.decodedToken()?.sub || null;
  });

  /**
   * Logs in the user with username and password
   */
  login(credentials: { username: string; password: string }): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiBase}/auth/login`, credentials).pipe(
      tap((res) => {
        // Support token, jwt, or accessToken key
        const token = res.token || res.jwt || res.accessToken;
        if (token) {
          this.setToken(token);
        }
        const route = res.user?.role?.defaultRoute || res.user?.role?.default_route;
        if (route) {
          localStorage.setItem('defaultRoute', route);
        }
      })
    );
  }

  /**
   * Registers a new client restaurant/branch
   */
  register(data: any): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiBase}/auth/register`, data).pipe(
      tap((res) => {
        const token = res.token || res.jwt || res.accessToken;
        if (token) {
          this.setToken(token);
        }
        localStorage.setItem('defaultRoute', '/admin');
      })
    );
  }

  /**
   * Clears session and redirects to login
   */
  logout(): void {
    // El usuario recordado es una preferencia de la persona, no de la sesión:
    // sobrevive al cierre para que solo tenga que escribir la contraseña.
    // Lo mismo el sonido de Cocina, que es del equipo y no de quien entró.
    const rememberedUser = localStorage.getItem('pidefacil.rememberedUser');
    const sonidoCocina = localStorage.getItem('pidefacil.cocina.sonido');

    this.clearToken();
    localStorage.clear();
    sessionStorage.clear();

    if (rememberedUser) {
      localStorage.setItem('pidefacil.rememberedUser', rememberedUser);
    }
    if (sonidoCocina) {
      localStorage.setItem('pidefacil.cocina.sonido', sonidoCocina);
    }

    this.router.navigate(['/login']);
  }

  /**
   * Sets the auth token in signal and localStorage
   */
  private setToken(token: string): void {
    localStorage.setItem(this.tokenKey, token);
    this._token.set(token);
  }

  /**
   * Clears the auth token from signal and localStorage
   */
  private clearToken(): void {
    localStorage.removeItem(this.tokenKey);
    this._token.set(null);
  }

  /**
   * Lightweight helper to decode JWT payload safely
   */
  private decodeToken(token: string | null): DecodedTokenPayload | null {
    if (!token) return null;
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      const payload = parts[1];
      // Decode base64 URL
      const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload) as DecodedTokenPayload;
    } catch (error) {
      console.error('Failed to decode JWT token:', error);
      return null;
    }
  }
}
