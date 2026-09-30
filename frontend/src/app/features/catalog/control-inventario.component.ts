import { ChangeDetectionStrategy, Component, effect, inject, input, signal, untracked } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { AvisosService } from '../../core/services/avisos.service';

type Modo = 'AVISAR' | 'BLOQUEAR' | 'APAGADO';

const MODOS: { valor: Modo; nombre: string; detalle: string }[] = [
  { valor: 'AVISAR', nombre: 'Solo avisar', detalle: 'Vende aunque falte; el número puede quedar en negativo y te avisamos.' },
  { valor: 'BLOQUEAR', nombre: 'Bloquear', detalle: 'No deja vender lo que no alcanza, y lo marca agotado en el menú y el bot.' },
  { valor: 'APAGADO', nombre: 'Apagado', detalle: 'Las ventas no descuentan nada. Para cuando aún no llevas inventario.' },
];

/** Qué pasa cuando una venta necesita más de lo que hay, en la sucursal elegida. */
@Component({
  selector: 'app-control-inventario',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="rounded-xl border border-slate-800 bg-slate-950/40 p-4" aria-labelledby="ctl-titulo">
      <div class="flex flex-col lg:flex-row lg:items-center gap-3">
        <div class="lg:w-56 shrink-0">
          <h3 id="ctl-titulo" class="text-xs font-bold text-white">Cuando algo no alcanza</h3>
          <p class="text-[11px] text-slate-500 mt-0.5">Aplica a esta sucursal.</p>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 flex-1" role="radiogroup" aria-labelledby="ctl-titulo">
          @for (m of modos; track m.valor) {
            <button type="button" role="radio" [attr.aria-checked]="modo() === m.valor" (click)="cambiar(m.valor)"
              [disabled]="guardando() || !branchId()"
              class="text-left rounded-lg border px-3 py-2 cursor-pointer transition-colors disabled:cursor-wait"
              [class]="modo() === m.valor ? 'border-indigo-500 bg-indigo-500/10' : 'border-slate-800 hover:border-slate-600'">
              <span class="block text-xs font-bold" [class]="modo() === m.valor ? 'text-indigo-200' : 'text-slate-200'">{{ m.nombre }}</span>
              <span class="block text-[11px] text-slate-400 mt-0.5 leading-snug">{{ m.detalle }}</span>
            </button>
          }
        </div>
      </div>
    </section>
  `,
})
export class ControlInventarioComponent {
  private readonly http = inject(HttpClient);
  private readonly avisos = inject(AvisosService);

  readonly branchId = input<string | null>(null);
  readonly modos = MODOS;
  readonly modo = signal<Modo | null>(null);
  readonly guardando = signal(false);

  constructor() {
    effect(() => {
      const id = this.branchId();
      untracked(() => {
        this.modo.set(null);
        if (!id) return;
        this.http.get<{ modo: Modo }>(`${environment.apiUrl}/branches/${id}/inventario/config`).subscribe({
          next: (c) => this.modo.set(c.modo),
          error: () => this.modo.set(null),
        });
      });
    });
  }

  cambiar(nuevo: Modo): void {
    const id = this.branchId();
    if (!id || nuevo === this.modo()) return;
    const antes = this.modo();
    this.modo.set(nuevo);
    this.guardando.set(true);
    this.http.put<{ modo: Modo }>(`${environment.apiUrl}/branches/${id}/inventario/config`, { modo: nuevo }).subscribe({
      next: (c) => {
        this.guardando.set(false);
        this.modo.set(c.modo);
        this.avisos.exito(`Listo: "${MODOS.find((m) => m.valor === c.modo)!.nombre}" en esta sucursal.`);
      },
      error: (err) => {
        this.guardando.set(false);
        this.modo.set(antes);
        this.avisos.error(err.error?.error || 'No se pudo cambiar.');
      },
    });
  }
}
