import { Injectable, signal } from '@angular/core';

export type TipoAviso = 'exito' | 'error' | 'info';

export interface Aviso {
  id: number;
  texto: string;
  tipo: TipoAviso;
}

export interface Pregunta {
  titulo: string;
  mensaje?: string;
  /** Texto del botón que confirma: di lo que va a pasar ("Eliminar", "Cerrar mesa"). */
  confirmar: string;
  cancelar?: string;
  /** La acción borra o cancela algo: el botón sale en rojo. */
  peligro?: boolean;
}

/**
 * Avisos breves (abajo de la pantalla) y preguntas de confirmación dentro del
 * panel. Sustituyen a alert() y confirm() del navegador, que se ven distinto
 * en cada equipo, congelan la pantalla (y con ella las alertas de cocina) y en
 * tablets a veces se cierran sin querer.
 */
@Injectable({ providedIn: 'root' })
export class AvisosService {
  readonly avisos = signal<Aviso[]>([]);
  readonly pregunta = signal<Pregunta | null>(null);

  private siguienteId = 1;
  private responder: ((si: boolean) => void) | null = null;

  exito(texto: string): void {
    this.mostrar(texto, 'exito', 3500);
  }

  error(texto: string): void {
    this.mostrar(texto, 'error', 6000);
  }

  info(texto: string): void {
    this.mostrar(texto, 'info', 4000);
  }

  cerrar(id: number): void {
    this.avisos.update((lista) => lista.filter((a) => a.id !== id));
  }

  /** Pregunta y espera la respuesta: `if (!(await avisos.confirmar({...}))) return;` */
  confirmar(pregunta: Pregunta): Promise<boolean> {
    // Si ya había una abierta, esa cuenta como cancelada.
    this.responder?.(false);
    this.pregunta.set(pregunta);
    return new Promise<boolean>((resolve) => {
      this.responder = resolve;
    });
  }

  responderPregunta(si: boolean): void {
    const r = this.responder;
    this.responder = null;
    this.pregunta.set(null);
    r?.(si);
  }

  private mostrar(texto: string, tipo: TipoAviso, ms: number): void {
    const id = this.siguienteId++;
    // Máximo tres a la vez: los viejos se van primero.
    this.avisos.update((lista) => [...lista.slice(-2), { id, texto, tipo }]);
    setTimeout(() => this.cerrar(id), ms);
  }
}
