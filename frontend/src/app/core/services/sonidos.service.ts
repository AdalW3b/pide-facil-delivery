import { Injectable, signal } from '@angular/core';

export type TipoSonido = 'comanda' | 'domicilio' | 'alerta' | 'listo' | 'cancelado';

/** Notas de cada aviso: [frecuencia Hz, inicio s, duración s]. */
const MELODIAS: Record<TipoSonido, [number, number, number][]> = {
  // Cocina: campanita de dos notas, como la del mostrador.
  comanda: [[880, 0, 0.5], [1320, 0.18, 0.7]],
  // Pedido a domicilio: tres notas subiendo, distinto a cocina para no confundirlos.
  domicilio: [[660, 0, 0.35], [880, 0.16, 0.35], [1175, 0.32, 0.6]],
  // Mesa que llama al mesero: dos toques iguales, insistente.
  alerta: [[988, 0, 0.3], [988, 0.28, 0.45]],
  // Listo para entregar: acorde que sube y se queda, como "¡salió!".
  listo: [[784, 0, 0.3], [988, 0.12, 0.3], [1319, 0.24, 0.8]],
  // Se canceló algo en cocina: dos notas que bajan, para no prepararlo.
  cancelado: [[523, 0, 0.35], [392, 0.22, 0.6]],
};

/**
 * Los sonidos de aviso del panel. Se generan con Web Audio en vez de un
 * archivo: suenan igual en Chrome, Safari y iPhone (el .ogg de antes no se
 * oía en Safari) y no dependen de que un archivo cargue.
 *
 * El navegador no deja sonar nada hasta que la persona toca la página una vez.
 * Por eso el primer toque en cualquier parte del panel los desbloquea, y
 * `bloqueado` avisa mientras eso no pase.
 */
@Injectable({ providedIn: 'root' })
export class SonidosService {
  private ctx: AudioContext | null = null;
  readonly bloqueado = signal(true);

  constructor() {
    if (typeof document === 'undefined') return;
    const alTocar = () => {
      this.desbloquear();
      if (!this.bloqueado()) {
        document.removeEventListener('pointerdown', alTocar, true);
        document.removeEventListener('keydown', alTocar, true);
      }
    };
    document.addEventListener('pointerdown', alTocar, true);
    document.addEventListener('keydown', alTocar, true);
  }

  /** Llamar desde un clic: deja listo el audio para los avisos que lleguen después. */
  desbloquear(): void {
    const ctx = this.contexto();
    if (!ctx) return;
    if (ctx.state === 'running') {
      this.bloqueado.set(false);
      return;
    }
    ctx.resume().then(
      () => this.bloqueado.set(ctx.state !== 'running'),
      () => this.bloqueado.set(true)
    );
  }

  /** Toca el aviso. Si el navegador aún no deja, no truena: queda `bloqueado`. */
  tocar(tipo: TipoSonido): void {
    const ctx = this.contexto();
    if (!ctx) return;
    if (ctx.state !== 'running') {
      // Si ya hubo un toque antes, resume() funciona aunque no venga de un clic.
      ctx.resume().then(() => {
        this.bloqueado.set(ctx.state !== 'running');
        if (ctx.state === 'running') this.sonar(ctx, tipo);
      }, () => this.bloqueado.set(true));
      return;
    }
    this.sonar(ctx, tipo);
  }

  private sonar(ctx: AudioContext, tipo: TipoSonido): void {
    const ahora = ctx.currentTime + 0.02;
    for (const [frecuencia, inicio, duracion] of MELODIAS[tipo]) {
      const osc = ctx.createOscillator();
      const vol = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = frecuencia;
      // Ataque rápido y caída suave: suena a campana, no a pitido.
      vol.gain.setValueAtTime(0.0001, ahora + inicio);
      vol.gain.exponentialRampToValueAtTime(0.35, ahora + inicio + 0.015);
      vol.gain.exponentialRampToValueAtTime(0.0001, ahora + inicio + duracion);
      osc.connect(vol).connect(ctx.destination);
      osc.start(ahora + inicio);
      osc.stop(ahora + inicio + duracion + 0.05);
    }
  }

  private contexto(): AudioContext | null {
    if (this.ctx) return this.ctx;
    const Ctor = (globalThis as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext })
      .AudioContext ?? (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    try {
      this.ctx = new Ctor();
      this.bloqueado.set(this.ctx.state !== 'running');
    } catch {
      return null;
    }
    return this.ctx;
  }
}
