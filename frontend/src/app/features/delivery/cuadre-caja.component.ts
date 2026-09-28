import { AvisosService } from '../../core/services/avisos.service';
import { PesosPipe, formatearPesos } from '../../shared/utils/pesos';
import { Component, ChangeDetectionStrategy, computed, effect, inject, input, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../environments/environment';
import { LucideLoader2 } from '@lucide/angular';

interface Pendiente {
  driverId: string;
  nombre: string;
  telefono: string;
  entregas: number;
  cobrado: number;
  pagoRepartidor: number;
  primeraEntrega: string;
  ultimaEntrega: string;
}

interface Corte {
  id: string;
  repartidor: string;
  creadoEn: string;
  entregas: number;
  cobrado: number;
  pagoRepartidor: number;
  pagoDescontado: boolean;
  esperado: number;
  recibido: number;
  diferencia: number;
  notas: string | null;
}

/**
 * Cuadre de efectivo de los repartidores al cerrar el turno: cuánto cobró,
 * cuánto se le paga, cuánto debe entregar, y lo que entregó de verdad.
 */
@Component({
  selector: 'app-cuadre-caja',
  standalone: true,
  imports: [PesosPipe, FormsModule, DatePipe, LucideLoader2],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">
      <section class="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5 space-y-4">
        <div>
          <h2 class="text-sm font-bold text-white">Por liquidar</h2>
          <p class="text-xs text-slate-400 mt-0.5">
            Entregas cerradas que todavía no pasan por caja. La propina es del repartidor y no entra en la cuenta.
          </p>
        </div>

        @if (cargando()) {
          <p class="flex items-center gap-2 text-sm text-slate-400"><svg lucideLoader2 class="w-4 h-4 animate-spin"></svg> Cargando...</p>
        } @else if (pendientes().length === 0) {
          <p class="text-sm text-slate-500 py-6 text-center">Nadie tiene entregas por liquidar.</p>
        } @else {
          <ul class="grid grid-cols-1 lg:grid-cols-2 gap-3">
            @for (p of pendientes(); track p.driverId) {
              <li class="rounded-xl border border-slate-800 bg-slate-950/50 p-4 space-y-3">
                <div class="flex items-baseline justify-between gap-2">
                  <p class="font-bold text-white">{{ p.nombre }}</p>
                  <p class="text-[11px] text-slate-500 tabular-nums">
                    {{ p.entregas }} {{ p.entregas === 1 ? 'entrega' : 'entregas' }} ·
                    {{ p.primeraEntrega | date: 'HH:mm' }}–{{ p.ultimaEntrega | date: 'HH:mm' }}
                  </p>
                </div>

                <dl class="grid grid-cols-3 gap-2 text-center">
                  <div class="rounded-lg bg-slate-900 p-2">
                    <dt class="text-[11px] text-slate-500 uppercase tracking-wider">Cobró</dt>
                    <dd class="font-bold text-white tabular-nums">{{ p.cobrado | pesos }}</dd>
                  </div>
                  <div class="rounded-lg bg-slate-900 p-2">
                    <dt class="text-[11px] text-slate-500 uppercase tracking-wider">Su pago</dt>
                    <dd class="font-bold text-white tabular-nums">{{ p.pagoRepartidor | pesos }}</dd>
                  </div>
                  <div class="rounded-lg bg-indigo-500/10 border border-indigo-500/30 p-2">
                    <dt class="text-[11px] text-indigo-300 uppercase tracking-wider">Entrega</dt>
                    <dd class="font-black text-indigo-200 tabular-nums">{{ esperado(p) | pesos }}</dd>
                  </div>
                </dl>

                <label class="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input type="checkbox" [ngModel]="descontar(p.driverId)" (ngModelChange)="fijar(p.driverId, 'descontar', $event)" class="accent-indigo-500" />
                  Su pago sale del mismo efectivo
                </label>

                <div class="flex flex-wrap items-end gap-2">
                  <div class="flex-1 min-w-32">
                    <label [for]="'rec-' + p.driverId" class="block text-[11px] text-slate-400 uppercase tracking-wider mb-1">Entregó en caja</label>
                    <input aria-label="Efectivo recibido" [id]="'rec-' + p.driverId" type="number" min="0" step="0.5" inputmode="decimal"
                      [ngModel]="recibido(p.driverId)" (ngModelChange)="fijar(p.driverId, 'recibido', $event)"
                      [placeholder]="esperado(p).toFixed(2)"
                      class="w-full bg-slate-900 border border-slate-800 rounded-lg py-2 px-3 text-sm text-white outline-none focus:border-indigo-500 tabular-nums" />
                  </div>
                  <input type="text" [ngModel]="nota(p.driverId)" (ngModelChange)="fijar(p.driverId, 'nota', $event)" placeholder="Nota (opcional)"
                    aria-label="Nota del cuadre"
                    class="flex-1 min-w-32 bg-slate-900 border border-slate-800 rounded-lg py-2 px-3 text-sm text-white outline-none focus:border-indigo-500" />
                  <button (click)="cerrar(p)" [disabled]="recibido(p.driverId) === null || cerrando() === p.driverId"
                    class="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
                    {{ cerrando() === p.driverId ? 'Cerrando...' : 'Cerrar cuadre' }}
                  </button>
                </div>

                @if (recibido(p.driverId) !== null) {
                  @if (diferencia(p); as d) {
                    <p class="text-xs font-semibold" [class]="d < 0 ? 'text-rose-400' : 'text-amber-300'">
                      {{ d < 0 ? 'Faltan' : 'Sobran' }} {{ abs(d) | pesos }}
                    </p>
                  } @else {
                    <p class="text-xs font-semibold text-emerald-400">Cuadra exacto</p>
                  }
                }
              </li>
            }
          </ul>
        }
        @if (error()) {
          <p class="text-xs text-rose-400" role="alert">{{ error() }}</p>
        }
      </section>

      <section class="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5 space-y-3">
        <h2 class="text-sm font-bold text-white">Cortes anteriores</h2>
        @if (historial().length === 0) {
          <p class="text-sm text-slate-500">Todavía no hay cortes.</p>
        } @else {
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="text-[11px] text-slate-500 uppercase tracking-wider text-left">
                  <th class="py-2 pr-3 font-semibold">Fecha</th>
                  <th class="py-2 pr-3 font-semibold">Repartidor</th>
                  <th class="py-2 pr-3 font-semibold text-right">Entregas</th>
                  <th class="py-2 pr-3 font-semibold text-right">Esperado</th>
                  <th class="py-2 pr-3 font-semibold text-right">Entregó</th>
                  <th class="py-2 font-semibold text-right">Diferencia</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-800">
                @for (c of historial(); track c.id) {
                  <tr>
                    <td class="py-2 pr-3 text-slate-400 tabular-nums whitespace-nowrap">{{ c.creadoEn | date: 'dd/MM HH:mm' }}</td>
                    <td class="py-2 pr-3 text-white">
                      {{ c.repartidor }}
                      @if (c.notas) { <span class="block text-[11px] text-slate-500">{{ c.notas }}</span> }
                    </td>
                    <td class="py-2 pr-3 text-right tabular-nums">{{ c.entregas }}</td>
                    <td class="py-2 pr-3 text-right tabular-nums">{{ c.esperado | pesos }}</td>
                    <td class="py-2 pr-3 text-right tabular-nums">{{ c.recibido | pesos }}</td>
                    <td class="py-2 text-right tabular-nums font-bold"
                      [class]="c.diferencia < 0 ? 'text-rose-400' : c.diferencia > 0 ? 'text-amber-300' : 'text-emerald-400'">
                      {{ c.diferencia === 0 ? 'Exacto' : (c.diferencia > 0 ? '+' : '−') + (abs(c.diferencia) | pesos) }}
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </section>
    </div>
  `,
})
export class CuadreCajaComponent {
  private readonly avisos = inject(AvisosService);
  private readonly http = inject(HttpClient);

  readonly branchId = input.required<string>();

  readonly pendientes = signal<Pendiente[]>([]);
  readonly historial = signal<Corte[]>([]);
  readonly cargando = signal(true);
  readonly cerrando = signal<string | null>(null);
  readonly error = signal<string | null>(null);

  /** Lo que se va escribiendo por repartidor. */
  private readonly formulario = signal<Record<string, { recibido: number | null; descontar: boolean; nota: string }>>({});

  readonly abs = Math.abs;

  constructor() {
    effect(() => {
      if (this.branchId()) this.cargar();
    });
  }

  cargar(): void {
    const b = this.branchId();
    this.cargando.set(true);
    this.http.get<Pendiente[]>(`${environment.apiUrl}/branches/${b}/delivery/cuadre/pendientes`).subscribe({
      next: (p) => {
        this.pendientes.set(p);
        this.cargando.set(false);
      },
      error: () => {
        this.cargando.set(false);
        this.error.set('No se pudo cargar el cuadre.');
      },
    });
    this.http.get<Corte[]>(`${environment.apiUrl}/branches/${b}/delivery/cuadre/historial`).subscribe({
      next: (h) => this.historial.set(h),
    });
  }

  private campos(id: string) {
    return this.formulario()[id] ?? { recibido: null, descontar: true, nota: '' };
  }

  recibido(id: string): number | null {
    const v = this.campos(id).recibido;
    return v === null || (v as unknown) === '' ? null : Number(v);
  }
  descontar(id: string): boolean {
    return this.campos(id).descontar;
  }
  nota(id: string): string {
    return this.campos(id).nota;
  }

  fijar(id: string, campo: 'recibido' | 'descontar' | 'nota', valor: unknown): void {
    this.formulario.update((f) => ({ ...f, [id]: { ...this.campos(id), [campo]: valor } }));
  }

  esperado(p: Pendiente): number {
    return this.descontar(p.driverId) ? p.cobrado - p.pagoRepartidor : p.cobrado;
  }

  /** Recibido menos esperado, redondeado a centavos; 0 si cuadra. */
  diferencia(p: Pendiente): number {
    const r = this.recibido(p.driverId);
    return r === null ? 0 : Math.round((r - this.esperado(p)) * 100) / 100;
  }

  async cerrar(p: Pendiente): Promise<void> {
    const recibido = this.recibido(p.driverId);
    if (recibido === null) return;
    const d = this.diferencia(p);
    if (d !== 0 && !(await this.avisos.confirmar({ titulo: `${d < 0 ? 'Faltan' : 'Sobran'} ${formatearPesos(Math.abs(d))}`, mensaje: 'La diferencia queda registrada en el historial del repartidor.', confirmar: 'Cerrar cuadre así' }))) return;

    this.cerrando.set(p.driverId);
    this.error.set(null);
    this.http.post<Corte>(`${environment.apiUrl}/branches/${this.branchId()}/delivery/cuadre`, {
      driverId: p.driverId,
      recibido,
      pagoDescontado: this.descontar(p.driverId),
      notas: this.nota(p.driverId).trim() || null,
    }).subscribe({
      next: () => {
        this.cerrando.set(null);
        this.formulario.update((f) => {
          const copia = { ...f };
          delete copia[p.driverId];
          return copia;
        });
        this.cargar();
      },
      error: (err) => {
        this.cerrando.set(null);
        this.error.set(err.error?.error || err.error?.message || 'No se pudo cerrar el cuadre.');
      },
    });
  }
}
