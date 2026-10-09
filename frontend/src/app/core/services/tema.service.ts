import { Injectable, signal } from '@angular/core';

export type Tema = 'oscuro' | 'claro';

const CLAVE = 'pidefacil.tema';

/**
 * Modo claro u oscuro del panel. Se guarda en cada dispositivo: la tablet de
 * cocina puede quedarse oscura y la compu de la oficina en claro.
 *
 * Solo pinta el panel: el layout lo aplica al entrar y lo quita al salir, así
 * la página de inicio, el menú del cliente y el kiosko no cambian.
 */
@Injectable({ providedIn: 'root' })
export class TemaService {
  readonly tema = signal<Tema>(leer());
  private activo = false;

  /** El panel entra: se pinta con el tema elegido. */
  activar(): void {
    this.activo = true;
    this.aplicar();
  }

  /** El panel sale: lo demás vuelve a su diseño. */
  desactivar(): void {
    this.activo = false;
    delete document.documentElement.dataset['tema'];
  }

  alternar(): void {
    const nuevo: Tema = this.tema() === 'claro' ? 'oscuro' : 'claro';
    this.tema.set(nuevo);
    try {
      localStorage.setItem(CLAVE, nuevo);
    } catch {
      // Sin almacenamiento (navegación privada): dura mientras esté abierta la página.
    }
    this.aplicar();
  }

  private aplicar(): void {
    if (!this.activo) return;
    if (this.tema() === 'claro') document.documentElement.dataset['tema'] = 'claro';
    else delete document.documentElement.dataset['tema'];
  }
}

function leer(): Tema {
  try {
    return localStorage.getItem(CLAVE) === 'claro' ? 'claro' : 'oscuro';
  } catch {
    return 'oscuro';
  }
}
