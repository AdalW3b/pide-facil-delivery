import { ChangeDetectionStrategy, Component, ElementRef, effect, inject, viewChild } from '@angular/core';
import { AvisosService } from '../../core/services/avisos.service';

/**
 * Dibuja los avisos breves y la pregunta de confirmación de AvisosService.
 * Va una sola vez, en la raíz de la app.
 */
@Component({
  selector: 'app-avisos',
  standalone: true,
  template: `
    <!-- Avisos breves -->
    <div
      class="fixed z-[90] left-1/2 -translate-x-1/2 bottom-24 lg:bottom-6 w-[calc(100%-2rem)] max-w-md flex flex-col gap-2 pointer-events-none"
      aria-live="polite"
    >
      @for (a of avisos.avisos(); track a.id) {
        <div
          class="pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 shadow-2xl text-sm font-medium backdrop-blur-md aviso-entra"
          [class]="a.tipo === 'error'
            ? 'bg-rose-950/95 border-rose-500/40 text-rose-100'
            : a.tipo === 'exito'
              ? 'bg-emerald-950/95 border-emerald-500/40 text-emerald-100'
              : 'bg-slate-900/95 border-slate-700 text-slate-100'"
          [attr.role]="a.tipo === 'error' ? 'alert' : 'status'"
        >
          <span class="flex-1 leading-snug">{{ a.texto }}</span>
          <button
            (click)="avisos.cerrar(a.id)"
            class="shrink-0 -mr-1 px-1.5 rounded text-current opacity-70 hover:opacity-100 cursor-pointer"
            aria-label="Cerrar aviso"
          >✕</button>
        </div>
      }
    </div>

    <!-- Pregunta de confirmación -->
    @if (avisos.pregunta(); as p) {
      <div class="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        (click)="avisos.responderPregunta(false)">
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="pregunta-titulo"
          [attr.aria-describedby]="p.mensaje ? 'pregunta-mensaje' : null"
          class="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl text-slate-100 aviso-entra"
          (click)="$event.stopPropagation()"
          (keydown.escape)="avisos.responderPregunta(false)"
        >
          <h2 id="pregunta-titulo" class="text-base font-bold text-white">{{ p.titulo }}</h2>
          @if (p.mensaje) {
            <p id="pregunta-mensaje" class="mt-2 text-sm text-slate-300 leading-relaxed">{{ p.mensaje }}</p>
          }
          <div class="mt-5 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <button
              (click)="avisos.responderPregunta(false)"
              class="px-4 py-2.5 rounded-xl border border-slate-700 text-sm font-semibold text-slate-200 hover:bg-slate-800 cursor-pointer"
            >{{ p.cancelar ?? 'Volver' }}</button>
            <button
              #botonConfirmar
              (click)="avisos.responderPregunta(true)"
              class="px-4 py-2.5 rounded-xl text-sm font-bold text-white cursor-pointer"
              [class]="p.peligro ? 'bg-rose-600 hover:bg-rose-500' : 'bg-indigo-600 hover:bg-indigo-500'"
            >{{ p.confirmar }}</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    @keyframes entra { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
    .aviso-entra { animation: entra .18s ease-out; }
    @media (prefers-reduced-motion: reduce) { .aviso-entra { animation: none; } }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AvisosComponent {
  readonly avisos = inject(AvisosService);
  private readonly botonConfirmar = viewChild<ElementRef<HTMLButtonElement>>('botonConfirmar');

  constructor() {
    // Al abrir la pregunta, el foco va al botón: Enter confirma y Escape cancela.
    effect(() => {
      const boton = this.botonConfirmar();
      if (boton) queueMicrotask(() => boton.nativeElement.focus());
    });
  }
}
