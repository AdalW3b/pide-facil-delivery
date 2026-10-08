import { DestroyRef, Injectable, effect, inject, signal, untracked } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { esColorValido, todasLasVariablesDeMarca, variablesDeMarca } from '../../shared/utils/paleta';

/** Cómo se presenta el restaurante. Los campos null son los de Pide Facil. */
export interface Marca {
  /** El que se muestra: el propio o, si no hay, el del restaurante. */
  nombre: string;
  /** El que eligió el dueño; null = el del restaurante. */
  nombrePropio: string | null;
  color: string | null;
  logoUrl: string | null;
  personalizada: boolean;
}

/**
 * La marca del restaurante en pantalla: nombre, color y logo.
 *
 * La aplican el panel (para el equipo) y las pantallas públicas (para los
 * clientes); al salir de ellas se quita, y la landing y el acceso se ven
 * siempre como Pide Facil. Solo cambia la apariencia.
 */
@Injectable({ providedIn: 'root' })
export class MarcaService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiUrl;
  private readonly tituloOriginal = document.title;

  private readonly _marca = signal<Marca | null>(null);
  readonly marca = this._marca.asReadonly();

  /** La del restaurante de quien entró al panel. El operador no tiene: se queda como Pide Facil. */
  cargarPropia(): void {
    this.http.get<Marca | null>(`${this.api}/marca`).subscribe({
      next: (m) => (m ? this.aplicar(m) : this.quitar()),
      error: () => this.quitar(),
    });
  }

  /** Para el menú, el kiosko, la cuenta del cliente y el repartidor. */
  cargarDeSucursal(branchId: string): void {
    this.http.get<Marca>(`${this.api}/public/branches/${branchId}/marca`).subscribe({
      next: (m) => this.aplicar(m),
      error: () => this.quitar(),
    });
  }

  guardar(nombre: string | null, color: string | null): Observable<Marca> {
    return this.http.put<Marca>(`${this.api}/marca`, { nombre, color }).pipe(tap((m) => this.aplicar(m)));
  }

  subirLogo(archivo: Blob): Observable<Marca> {
    const datos = new FormData();
    datos.append('logo', archivo, 'logo.png');
    return this.http.post<Marca>(`${this.api}/marca/logo`, datos).pipe(tap((m) => this.aplicar(m)));
  }

  quitarLogo(): Observable<Marca> {
    return this.http.delete<Marca>(`${this.api}/marca/logo`).pipe(tap((m) => this.aplicar(m)));
  }

  /** La URL completa del logo, o null si no hay. */
  urlLogo(m: Marca | null = this._marca()): string | null {
    return m?.logoUrl ? `${this.api}${m.logoUrl}` : null;
  }

  aplicar(m: Marca): void {
    this._marca.set(m);
    this.pintar(m.color);
    document.title = m.personalizada ? m.nombre : this.tituloOriginal;
  }

  /** Vuelve a los colores y el título de Pide Facil. */
  quitar(): void {
    this._marca.set(null);
    this.pintar(null);
    document.title = this.tituloOriginal;
  }

  /** Cambia los colores de acento de todas las pantallas; null regresa a los de Tailwind. */
  pintar(color: string | null): void {
    const estilo = document.documentElement.style;
    if (esColorValido(color)) {
      for (const [variable, valor] of Object.entries(variablesDeMarca(color))) {
        estilo.setProperty(variable, valor);
      }
    } else {
      for (const variable of todasLasVariablesDeMarca()) {
        estilo.removeProperty(variable);
      }
    }
  }
}

/**
 * Para una pantalla pública (menú, kiosko, cuenta del cliente, repartidor):
 * aplica la marca de la sucursal en cuanto se conoce y la quita al salir.
 * Se llama al crear el componente.
 */
export function usarMarcaDeSucursal(branchId: () => string | null | undefined): MarcaService {
  const marca = inject(MarcaService);
  let cargada: string | null = null;
  effect(() => {
    const id = branchId();
    if (id && id !== cargada) {
      cargada = id;
      untracked(() => marca.cargarDeSucursal(id));
    }
  });
  inject(DestroyRef).onDestroy(() => marca.quitar());
  return marca;
}
