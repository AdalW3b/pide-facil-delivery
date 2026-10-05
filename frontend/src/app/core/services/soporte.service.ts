import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

/** Una sesión de soporte del operador en un restaurante. */
export interface SesionSoporte {
  id: string;
  restaurantId: string;
  restaurante: string;
  operador: string | null;
  motivo: string;
  inicio: string;
  fin: string | null;
  /** Hasta cuándo puede hacer cambios; null = solo lectura. */
  cambiosHasta: string | null;
  abierta: boolean;
}

/**
 * El modo soporte del operador de la plataforma: la sesión abierta (una a la
 * vez), abrirla con motivo, usar el código del dueño y terminarla. El backend
 * es el que pone el candado; esto solo lleva la cuenta en la pantalla.
 */
@Injectable({ providedIn: 'root' })
export class SoporteService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly api = `${environment.apiUrl}/system/soporte`;

  readonly sesion = signal<SesionSoporte | null>(null);
  readonly esOperador = computed(() => this.auth.userRole() === 'SYSTEM_ADMIN');

  /** La ventana de cambios sigue abierta. */
  readonly puedeCambiar = computed(() => {
    const s = this.sesion();
    return !!s?.cambiosHasta && new Date(s.cambiosHasta).getTime() > Date.now();
  });

  constructor() {
    effect(() => {
      const operador = this.esOperador();
      untracked(() => (operador ? this.cargar() : this.sesion.set(null)));
    });
  }

  cargar(): void {
    this.http.get<SesionSoporte | null>(`${this.api}/sesiones/activa`, { observe: 'response' }).subscribe({
      next: (r) => this.sesion.set(r.status === 204 ? null : r.body),
      error: () => this.sesion.set(null),
    });
  }

  abrir(restaurantId: string, motivo: string): Observable<SesionSoporte> {
    return this.http.post<SesionSoporte>(`${this.api}/sesiones`, { restaurantId, motivo }).pipe(tap((s) => this.sesion.set(s)));
  }

  autorizar(codigo: string): Observable<SesionSoporte> {
    return this.http.post<SesionSoporte>(`${this.api}/sesiones/cambios`, { codigo }).pipe(tap((s) => this.sesion.set(s)));
  }

  terminar(): Observable<void> {
    return this.http.post<void>(`${this.api}/sesiones/terminar`, {}).pipe(tap(() => this.sesion.set(null)));
  }
}
