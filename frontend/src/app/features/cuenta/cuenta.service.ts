import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

export type TipoCuenta = 'CLIENTE' | 'REPARTIDOR';

export interface Sesion {
  token: string;
  tipo: TipoCuenta;
  id: string;
  nombre: string;
  telefono: string;
  email: string | null;
  /** La sucursal con la que se abrió: la cuenta es de un restaurante. */
  branchId: string;
}

export interface PedidoHistorial {
  orderId: string;
  token: string | null;
  tipo: string;
  estado: string;
  estadoEntrega: string | null;
  fecha: string;
  direccion: string | null;
  mesa: number | null;
  platillos: string[];
  comida: number;
  envio: number;
  propina: number;
  total: number;
}

export interface EntregaHistorial {
  orderId: string;
  token: string;
  estado: string;
  sucursal: string | null;
  direccion: string | null;
  distanciaKm: number | null;
  tuPago: number | null;
  /** Lo que le cobró al cliente, propina incluida. */
  cobrado: number;
  /** La propina del cliente: es del repartidor. */
  propina: number;
  asignadoEn: string | null;
  entregadoEn: string | null;
}

const CLAVE_SESION = 'pidefacil.cuenta';

/**
 * La sesión de un cliente o un repartidor.
 *
 * Es independiente de la del personal: son tokens distintos y se guardan
 * aparte, para que entrar como cliente en el mismo navegador no tumbe la
 * sesión del panel ni al revés.
 */
@Injectable({ providedIn: 'root' })
export class CuentaService {
  private readonly http = inject(HttpClient);

  readonly sesion = signal<Sesion | null>(this.leerGuardada());

  readonly haIniciado = computed(() => this.sesion() !== null);
  readonly esCliente = computed(() => this.sesion()?.tipo === 'CLIENTE');
  readonly esRepartidor = computed(() => this.sesion()?.tipo === 'REPARTIDOR');

  /**
   * Quien abre estas pantallas casi siempre lo hace desde su teléfono, no desde
   * la máquina del restaurante, así que el backend tiene que ser el público
   * cuando la página no se sirve en local.
   */
  private readonly api = (() => {
    const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
    const esLocal = host === 'localhost' || host === '127.0.0.1';
    return esLocal ? environment.apiUrl : environment.publicApiUrl;
  })();

  solicitarCodigo(branchId: string, tipo: TipoCuenta, phoneNumber: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(
      `${this.api}/public/branches/${branchId}/cuenta/codigo`,
      { tipo, phoneNumber }
    );
  }

  registrar(branchId: string, cuerpo: Record<string, unknown>): Observable<Sesion> {
    return this.http
      .post<Sesion>(`${this.api}/public/branches/${branchId}/cuenta/registro`, cuerpo)
      .pipe(tap((s) => this.guardar({ ...s, branchId })));
  }

  iniciarSesion(
    branchId: string,
    tipo: TipoCuenta,
    phoneNumber: string,
    password: string
  ): Observable<Sesion> {
    return this.http
      .post<Sesion>(`${this.api}/public/branches/${branchId}/cuenta/login`, { tipo, phoneNumber, password })
      .pipe(tap((s) => this.guardar({ ...s, branchId })));
  }

  restablecer(branchId: string, cuerpo: Record<string, unknown>): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(
      `${this.api}/public/branches/${branchId}/cuenta/contrasena`,
      cuerpo
    );
  }

  misPedidos(): Observable<PedidoHistorial[]> {
    const s = this.exigirSesion();
    return this.http.get<PedidoHistorial[]>(
      `${this.api}/public/branches/${s.branchId}/cuenta/pedidos`,
      { headers: this.cabeceras() }
    );
  }

  misEntregas(): Observable<EntregaHistorial[]> {
    const s = this.exigirSesion();
    return this.http.get<EntregaHistorial[]>(
      `${this.api}/public/branches/${s.branchId}/cuenta/entregas`,
      { headers: this.cabeceras() }
    );
  }

  cerrarSesion(): void {
    this.sesion.set(null);
    try {
      localStorage.removeItem(CLAVE_SESION);
    } catch {
      // Sin almacenamiento la sesión solo dura lo que la pestaña; no es grave.
    }
  }

  /** La cabecera con su token, para las llamadas que piden sesión. */
  cabeceras(): Record<string, string> {
    const s = this.sesion();
    return s ? { Authorization: `Bearer ${s.token}` } : {};
  }

  private exigirSesion(): Sesion {
    const s = this.sesion();
    if (!s) {
      throw new Error('No hay sesión abierta.');
    }
    return s;
  }

  private guardar(sesion: Sesion): void {
    this.sesion.set(sesion);
    try {
      localStorage.setItem(CLAVE_SESION, JSON.stringify(sesion));
    } catch {
      // Ventana privada o almacenamiento bloqueado: la sesión vive en memoria.
    }
  }

  private leerGuardada(): Sesion | null {
    try {
      const crudo = localStorage.getItem(CLAVE_SESION);
      return crudo ? (JSON.parse(crudo) as Sesion) : null;
    } catch {
      return null;
    }
  }
}
