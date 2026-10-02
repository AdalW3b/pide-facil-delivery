import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LucideLoader2, LucideX } from '@lucide/angular';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../core/services/auth.service';
import { PaymentMethod } from '../../../core/models/payment-method.model';
import { PesosPipe, formatearPesos } from '../../../shared/utils/pesos';

/** Un pago de la cuenta mientras se captura. Los montos van como texto del input. */
interface Linea {
  metodoId: string;
  monto: number | null;
  propina: number | null;
  recibido: number | null;
}

interface CobroResultado {
  orderId: string;
  total: number;
  propinas: number;
  cambio: number;
}

/**
 * Cobrar la cuenta de una mesa: con qué pagó (puede dividirse entre varios
 * métodos), la propina y, en efectivo, con cuánto pagó para dar el cambio.
 * Al cobrar se cierra la mesa.
 */
@Component({
  selector: 'app-cobro',
  standalone: true,
  imports: [FormsModule, RouterLink, PesosPipe, LucideLoader2, LucideX],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="titulo-cobro">
      <div class="w-full sm:max-w-md max-h-[92vh] overflow-y-auto bg-slate-900 border border-slate-800 rounded-t-2xl sm:rounded-2xl p-5 space-y-4">
        <div class="flex items-start justify-between gap-3">
          <div>
            <h2 id="titulo-cobro" class="text-lg font-bold text-white">{{ titulo() ?? 'Cobrar mesa ' + mesa() }}</h2>
            <p class="text-2xl font-black text-white tabular-nums">{{ total() | pesos }}</p>
          </div>
          <button type="button" (click)="cerrar.emit()" aria-label="Cerrar" class="p-1 text-slate-400 hover:text-white cursor-pointer">
            <svg lucideX class="w-5 h-5"></svg>
          </button>
        </div>

        @if (cargando()) {
          <p class="flex items-center gap-2 text-sm text-slate-400"><svg lucideLoader2 class="w-4 h-4 animate-spin"></svg> Cargando...</p>
        } @else if (!cajaAbierta()) {
          <div class="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200 space-y-2">
            <p class="font-bold">La caja está cerrada</p>
            <p>Para cobrar hay que abrirla primero.</p>
            @if (puedeAbrirCaja) {
              <a routerLink="/caja" (click)="cerrar.emit()" class="inline-block font-bold text-amber-100 underline underline-offset-2">Ir a Caja</a>
            } @else {
              <p class="text-amber-300/80">Pídele a quien lleva la caja que la abra.</p>
            }
          </div>
        } @else if (metodos().length === 0) {
          <p class="text-sm text-amber-300">Esta sucursal no tiene métodos de pago activos. Agrégalos en Ajustes › Métodos de pago.</p>
        } @else {
          @for (l of lineas(); track $index; let i = $index) {
            <div class="rounded-xl border border-slate-800 bg-slate-950/50 p-3 space-y-3">
              <div class="flex flex-wrap gap-1.5" role="radiogroup" [attr.aria-label]="'Método del pago ' + (i + 1)">
                @for (m of metodos(); track m.id) {
                  <button type="button" role="radio" [attr.aria-checked]="l.metodoId === m.id" (click)="cambiar(i, { metodoId: '' + m.id })"
                    class="px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer border"
                    [class]="l.metodoId === m.id ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white'">
                    {{ m.name }}
                  </button>
                }
                @if (lineas().length > 1) {
                  <button type="button" (click)="quitar(i)" class="ml-auto text-[11px] text-rose-400 hover:text-rose-300 cursor-pointer">Quitar</button>
                }
              </div>

              <div class="grid grid-cols-2 gap-2">
                <label class="block">
                  <span class="block text-[11px] text-slate-400 uppercase tracking-wider mb-1">Monto</span>
                  <input type="number" min="0" step="0.5" inputmode="decimal" [ngModel]="l.monto" (ngModelChange)="cambiar(i, { monto: numero($event) })"
                    class="w-full bg-slate-900 border border-slate-800 rounded-lg py-2 px-3 text-sm text-white outline-none focus:border-indigo-500 tabular-nums" />
                </label>
                <label class="block">
                  <span class="block text-[11px] text-slate-400 uppercase tracking-wider mb-1">Propina</span>
                  <input type="number" min="0" step="0.5" inputmode="decimal" [ngModel]="l.propina" (ngModelChange)="cambiar(i, { propina: numero($event) })" placeholder="0"
                    class="w-full bg-slate-900 border border-slate-800 rounded-lg py-2 px-3 text-sm text-white outline-none focus:border-indigo-500 tabular-nums" />
                </label>
              </div>

              @if (esEfectivo(l)) {
                <div class="space-y-2">
                  <label class="block">
                    <span class="block text-[11px] text-slate-400 uppercase tracking-wider mb-1">Paga con</span>
                    <input type="number" min="0" step="0.5" inputmode="decimal" [ngModel]="l.recibido" (ngModelChange)="cambiar(i, { recibido: numero($event) })"
                      [placeholder]="aPagar(l).toFixed(2)"
                      class="w-full bg-slate-900 border border-slate-800 rounded-lg py-2 px-3 text-sm text-white outline-none focus:border-indigo-500 tabular-nums" />
                  </label>
                  <div class="flex flex-wrap gap-1.5">
                    @for (b of billetesRapidos(l); track b) {
                      <button type="button" (click)="cambiar(i, { recibido: b })"
                        class="px-2.5 py-1 rounded-md bg-slate-800 text-xs font-semibold text-slate-200 hover:bg-slate-700 cursor-pointer tabular-nums">
                        {{ b === aPagar(l) ? 'Exacto' : (b | pesos) }}
                      </button>
                    }
                  </div>
                  @if (l.recibido !== null) {
                    @if (l.recibido < aPagar(l)) {
                      <p class="text-xs font-semibold text-rose-400">No alcanza: faltan {{ aPagar(l) - l.recibido | pesos }}</p>
                    } @else {
                      <p class="text-sm font-bold text-emerald-300">Cambio: {{ l.recibido - aPagar(l) | pesos }}</p>
                    }
                  }
                </div>
              }
            </div>
          }

          <div class="flex items-center justify-between text-sm">
            <button type="button" (click)="dividir()" [disabled]="restante() <= 0"
              class="text-xs font-bold text-indigo-400 hover:text-indigo-300 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
              + Pagar el resto con otro método
            </button>
            <span class="tabular-nums font-semibold" [class]="restante() === 0 ? 'text-emerald-400' : 'text-amber-300'">
              {{ restante() === 0 ? 'Cuadra' : restante() > 0 ? 'Faltan ' + formatear(restante()) : 'Sobran ' + formatear(-restante()) }}
            </span>
          </div>

          @if (error()) {
            <p class="text-xs text-rose-400" role="alert">{{ error() }}</p>
          }

          <button type="button" (click)="cobrar()" [disabled]="!listo() || enviando()"
            class="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
            {{ enviando() ? 'Cobrando...' : accion() + (propinas() > 0 ? ' · propina ' + formatear(propinas()) : '') }}
          </button>
        }
      </div>
    </div>
  `,
})
export class CobroComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  readonly branchId = input.required<string>();
  readonly orderId = input.required<string>();
  readonly mesa = input<number | null>(null);
  readonly total = input.required<number>();
  /** Encabezado; por omisión "Cobrar mesa N". */
  readonly titulo = input<string | null>(null);
  /** Texto del botón final. */
  readonly accion = input('Cobrar y cerrar mesa');

  readonly cerrar = output<void>();
  readonly cobrado = output<CobroResultado>();

  readonly cargando = signal(true);
  readonly enviando = signal(false);
  readonly error = signal<string | null>(null);
  readonly cajaAbierta = signal(false);
  readonly metodos = signal<PaymentMethod[]>([]);
  readonly lineas = signal<Linea[]>([]);

  readonly puedeAbrirCaja = this.auth.hasPermission('CAJA_OPERAR');
  readonly formatear = formatearPesos;

  /** Lo que falta por repartir entre los pagos, a centavos. */
  readonly restante = computed(() =>
    redondear(this.total() - this.lineas().reduce((s, l) => s + (l.monto ?? 0), 0)));

  readonly propinas = computed(() => redondear(this.lineas().reduce((s, l) => s + (l.propina ?? 0), 0)));

  /** Todo cuadra: métodos elegidos, montos positivos, efectivo que alcanza. */
  readonly listo = computed(() =>
    this.restante() === 0 &&
    this.lineas().every((l) => l.metodoId && (l.monto ?? 0) > 0 && (l.propina ?? 0) >= 0 &&
      (!this.esEfectivo(l) || l.recibido === null || l.recibido >= this.aPagar(l))));

  ngOnInit(): void {
    const b = this.branchId();
    let pendientes = 2;
    const listo = () => {
      if (--pendientes === 0) this.cargando.set(false);
    };
    this.http.get<{ abierta: boolean }>(`${environment.apiUrl}/branches/${b}/caja/abierta`).subscribe({
      next: (r) => { this.cajaAbierta.set(r.abierta); listo(); },
      error: () => { this.cajaAbierta.set(false); listo(); },
    });
    this.http.get<PaymentMethod[]>(`${environment.apiUrl}/branches/${b}/payment-methods`).subscribe({
      next: (ms) => {
        const activos = ms.filter((m) => m.active);
        this.metodos.set(activos);
        // Arranca con efectivo por todo, que es lo más común.
        const inicial = activos.find((m) => m.esEfectivo) ?? activos[0];
        this.lineas.set([{ metodoId: inicial ? '' + inicial.id : '', monto: redondear(this.total()), propina: null, recibido: null }]);
        listo();
      },
      error: () => {
        this.error.set('No se pudieron cargar los métodos de pago.');
        listo();
      },
    });
  }

  cambiar(i: number, cambio: Partial<Linea>): void {
    this.lineas.update((ls) => ls.map((l, j) => {
      if (j !== i) return l;
      const nueva = { ...l, ...cambio };
      // Al dejar de ser efectivo, el "paga con" ya no aplica.
      if (cambio.metodoId !== undefined && !this.esEfectivo(nueva)) nueva.recibido = null;
      return nueva;
    }));
  }

  dividir(): void {
    const resto = this.restante();
    if (resto <= 0) return;
    const usados = new Set(this.lineas().map((l) => l.metodoId));
    const otro = this.metodos().find((m) => !usados.has('' + m.id)) ?? this.metodos()[0];
    this.lineas.update((ls) => [...ls, { metodoId: '' + otro.id, monto: resto, propina: null, recibido: null }]);
  }

  quitar(i: number): void {
    this.lineas.update((ls) => ls.filter((_, j) => j !== i));
  }

  esEfectivo(l: Linea): boolean {
    return !!this.metodos().find((m) => '' + m.id === l.metodoId)?.esEfectivo;
  }

  aPagar(l: Linea): number {
    return redondear((l.monto ?? 0) + (l.propina ?? 0));
  }

  /** Exacto y los billetes con que suele pagar la gente, de menor a mayor. */
  billetesRapidos(l: Linea): number[] {
    const a = this.aPagar(l);
    if (a <= 0) return [];
    const opciones = [a];
    for (const b of [50, 100, 200, 500, 1000]) {
      const redondo = Math.ceil(a / b) * b;
      if (redondo > a && !opciones.includes(redondo)) opciones.push(redondo);
    }
    return opciones.slice(0, 4);
  }

  numero(v: unknown): number | null {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  cobrar(): void {
    if (!this.listo() || this.enviando()) return;
    this.enviando.set(true);
    this.error.set(null);
    const pagos = this.lineas().map((l) => ({
      paymentMethodId: l.metodoId,
      monto: l.monto,
      propina: l.propina ?? 0,
      recibido: this.esEfectivo(l) ? l.recibido : null,
    }));
    this.http.post<CobroResultado>(`${environment.apiUrl}/branches/${this.branchId()}/orders/${this.orderId()}/cobrar`, { pagos }).subscribe({
      next: (r) => {
        this.enviando.set(false);
        this.cobrado.emit(r);
      },
      error: (err) => {
        this.enviando.set(false);
        this.error.set(err?.error?.error || err?.error?.message || 'No se pudo cobrar.');
      },
    });
  }
}

function redondear(n: number): number {
  return Math.round(n * 100) / 100;
}
