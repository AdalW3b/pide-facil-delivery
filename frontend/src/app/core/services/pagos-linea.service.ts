import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export type EstadoCuenta = 'SIN_CONECTAR' | 'PENDIENTE' | 'LISTA' | 'DETENIDA';

/** Cómo está la cuenta de Stripe del restaurante y cómo cobra el menú en línea. */
export interface EstadoPagosLinea {
  /** El servidor tiene la llave de Stripe; si no, no se puede conectar nada. */
  servidorListo: boolean;
  conectada: boolean;
  /** Solo los últimos caracteres: ••••EfGh */
  cuenta: string | null;
  estadoCuenta: EstadoCuenta;
  motivo: string | null;
  activo: boolean;
  modoPrueba: boolean;
  aceptaTarjeta: boolean;
  aceptaEfectivo: boolean;
  aceptaEnTienda: boolean;
  comisionPlataformaPct: number;
  conectadoEn: string | null;
}

export interface AjustesPagosLinea {
  activo?: boolean;
  aceptaTarjeta?: boolean;
  aceptaEfectivo?: boolean;
  aceptaEnTienda?: boolean;
}

export interface MovimientoPagosLinea {
  accion: string;
  detalle: string | null;
  usuario: string | null;
  en: string;
}

@Injectable({ providedIn: 'root' })
export class PagosLineaService {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.apiUrl}/pagos-linea`;

  estado(): Observable<EstadoPagosLinea> {
    return this.http.get<EstadoPagosLinea>(`${this.api}/estado`);
  }

  /** La liga a Stripe; al terminar, Stripe regresa a esta misma pantalla. */
  conectar(): Observable<{ url: string }> {
    return this.http.post<{ url: string }>(`${this.api}/conectar`, { origen: window.location.origin });
  }

  sincronizar(): Observable<EstadoPagosLinea> {
    return this.http.post<EstadoPagosLinea>(`${this.api}/sincronizar`, {});
  }

  ajustes(ajustes: AjustesPagosLinea): Observable<EstadoPagosLinea> {
    return this.http.put<EstadoPagosLinea>(`${this.api}/ajustes`, ajustes);
  }

  desconectar(): Observable<EstadoPagosLinea> {
    return this.http.post<EstadoPagosLinea>(`${this.api}/desconectar`, {});
  }

  bitacora(): Observable<MovimientoPagosLinea[]> {
    return this.http.get<MovimientoPagosLinea[]>(`${this.api}/bitacora`);
  }

  // Operador de la plataforma

  estadoDe(restaurantId: string): Observable<EstadoPagosLinea> {
    return this.http.get<EstadoPagosLinea>(`${environment.apiUrl}/system/pagos-linea/${restaurantId}`);
  }

  fijarComision(restaurantId: string, porcentaje: number): Observable<EstadoPagosLinea> {
    return this.http.put<EstadoPagosLinea>(`${environment.apiUrl}/system/pagos-linea/${restaurantId}/comision`, { porcentaje });
  }
}
