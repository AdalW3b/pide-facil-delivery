import { Injectable, signal } from '@angular/core';

/** Un renglón de la comanda que el mesero está armando. */
export interface LineaComanda {
  /** Mismo platillo, mismos extras y misma nota = mismo renglón. */
  clave: string;
  productId: string;
  nombre: string;
  /** Precio del platillo más sus extras, por pieza. */
  precio: number;
  cantidad: number;
  adicionales: string[];
  adicionalesNombres: string[];
  nota: string;
}

/**
 * Las comandas que se están armando y todavía no van a cocina, una por cuenta.
 * Viven mientras la app está abierta: si el mesero cierra el panel de la mesa
 * por error, al volver sigue ahí lo que llevaba.
 */
@Injectable({ providedIn: 'root' })
export class ComandasEnBorradorService {
  private readonly porCuenta = signal<Record<string, LineaComanda[]>>({});

  de(orderId: string): LineaComanda[] {
    return this.porCuenta()[orderId] ?? [];
  }

  guardar(orderId: string, lineas: LineaComanda[]): void {
    this.porCuenta.update((todas) => {
      const copia = { ...todas };
      if (lineas.length) copia[orderId] = lineas;
      else delete copia[orderId];
      return copia;
    });
  }

  piezas(orderId: string): number {
    return this.de(orderId).reduce((n, l) => n + l.cantidad, 0);
  }

  static clave(productId: string, adicionales: string[], nota: string): string {
    return `${productId}|${[...adicionales].sort().join(',')}|${nota.trim().toLowerCase()}`;
  }
}
