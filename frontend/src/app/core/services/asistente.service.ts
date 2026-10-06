import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

/** Si el usuario puede usar o configurar el asistente, y por qué no. */
export interface EstadoAsistente {
  complemento: boolean;
  configurado: boolean;
  puedeUsar: boolean;
  puedeConfigurar: boolean;
  motivo: string | null;
  proveedor: string | null;
  modelo: string | null;
}

export interface TurnoChat {
  delUsuario: boolean;
  texto: string;
  /** Qué datos consultó para contestar (solo en las respuestas). */
  consulto?: string[];
  error?: boolean;
}

export interface ConfigAsistente {
  complemento: boolean;
  proveedor: string | null;
  modelo: string | null;
  urlBase: string | null;
  /** Últimos 4 caracteres de la llave guardada; la llave nunca regresa. */
  llaveFinal: string | null;
  resumenDiario: boolean;
  /** El servidor tiene su llave maestra para cifrar las llaves. */
  servidorListo: boolean;
  preguntasDelMes: number;
  tokensEntradaDelMes: number;
  tokensSalidaDelMes: number;
}

export interface PersonaAsistente {
  id: string;
  nombre: string | null;
  usuario: string;
  rol: string;
  habilitado: boolean;
  /** Dueño y gerentes: siempre lo tienen. */
  siempre: boolean;
}

export interface ResumenDiario {
  dia: string;
  contenido: string;
  creadoEn: string;
}

/**
 * El asistente operativo del restaurante: su estado para el menú y la
 * conversación en curso, que se conserva al moverse entre pantallas.
 */
@Injectable({ providedIn: 'root' })
export class AsistenteService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly api = `${environment.apiUrl}/asistente`;

  readonly estado = signal<EstadoAsistente | null>(null);
  /** Se muestra en el menú a quien lo puede usar, y al dueño para configurarlo. */
  readonly visible = computed(() => {
    const e = this.estado();
    return !!e && e.complemento && (e.puedeUsar || e.puedeConfigurar);
  });
  readonly conversacion = signal<TurnoChat[]>([]);

  constructor() {
    effect(() => {
      const dentro = this.auth.isAuthenticated() && this.auth.userRole() !== 'SYSTEM_ADMIN';
      untracked(() => {
        this.conversacion.set([]);
        if (dentro) this.cargarEstado();
        else this.estado.set(null);
      });
    });
  }

  cargarEstado(): void {
    this.http.get<EstadoAsistente>(`${this.api}/estado`).subscribe({
      next: (e) => this.estado.set(e),
      error: () => this.estado.set(null),
    });
  }

  preguntar(pregunta: string, branchId: string | null, historial: TurnoChat[]): Observable<{ texto: string; consulto: string[] }> {
    return this.http.post<{ texto: string; consulto: string[] }>(`${this.api}/preguntar`, {
      pregunta,
      branchId: branchId || null,
      historial: historial.filter((t) => !t.error).map((t) => ({ delUsuario: t.delUsuario, texto: t.texto })),
    });
  }

  resumenes(branchId: string | null): Observable<ResumenDiario[]> {
    return this.http.get<ResumenDiario[]>(`${this.api}/resumenes`, { params: branchId ? { branchId } : {} });
  }

  generarResumen(branchId: string | null): Observable<ResumenDiario> {
    return this.http.post<ResumenDiario>(`${this.api}/resumenes/generar`, {}, { params: branchId ? { branchId } : {} });
  }

  config(): Observable<ConfigAsistente> {
    return this.http.get<ConfigAsistente>(`${this.api}/config`);
  }

  guardar(c: { proveedor: string; modelo: string; urlBase: string | null; llave: string | null; resumenDiario: boolean }): Observable<ConfigAsistente> {
    return this.http.put<ConfigAsistente>(`${this.api}/config`, c);
  }

  probar(): Observable<{ respuesta: string }> {
    return this.http.post<{ respuesta: string }>(`${this.api}/config/probar`, {});
  }

  personal(): Observable<PersonaAsistente[]> {
    return this.http.get<PersonaAsistente[]>(`${this.api}/personal`);
  }

  habilitar(userId: string, habilitado: boolean): Observable<void> {
    return this.http.put<void>(`${this.api}/personal/${userId}`, { habilitado });
  }
}
