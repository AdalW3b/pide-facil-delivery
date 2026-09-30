import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../environments/environment';
import { cantidadLegible, convertirUnidad, unidadesCompatibles } from '../../shared/utils/unidades';

/** Lo que se va a mover: un ingrediente o un producto terminado (refrescos). */
export interface ObjetivoInventario {
  tipo: 'INGREDIENTE' | 'PRODUCTO';
  id: string;
  nombre: string;
  /** Unidad del inventario. Los productos se cuentan por pieza. */
  unidad: string;
  stock: number;
}

type Movimiento = 'ENTRADA' | 'MERMA' | 'CONTEO';

const MOVIMIENTOS: { valor: Movimiento; nombre: string; ayuda: string }[] = [
  { valor: 'ENTRADA', nombre: 'Entrada', ayuda: 'Llegó mercancía.' },
  { valor: 'MERMA', nombre: 'Merma', ayuda: 'Se echó a perder, se cayó o se tiró.' },
  { valor: 'CONTEO', nombre: 'Conteo', ayuda: 'Lo que hay de verdad en el refri o el almacén.' },
];

/**
 * Registrar una entrada de mercancía, una merma o un conteo físico. Cada uno
 * queda en el historial con quién, cuándo y por qué; antes "Ajustar stock"
 * borraba el número anterior sin dejar rastro.
 */
@Component({
  selector: 'app-movimiento-inventario',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="mov-titulo">
      <div (click)="cerrar.emit()" class="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"></div>
      <div class="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        <div class="px-6 pt-5 pb-4 border-b border-slate-800">
          <h3 id="mov-titulo" class="text-base font-bold text-white">{{ objetivo().nombre }}</h3>
          <p class="text-xs text-slate-400 mt-0.5">Hay {{ legible(objetivo().stock) }} en esta sucursal.</p>
        </div>

        <div class="p-6 space-y-4 overflow-y-auto">
          <div class="grid grid-cols-3 gap-1 p-1 rounded-xl bg-slate-950 border border-slate-800" role="radiogroup" aria-label="Tipo de movimiento">
            @for (m of movimientos; track m.valor) {
              <button type="button" role="radio" [attr.aria-checked]="tipo() === m.valor" (click)="tipo.set(m.valor)"
                class="py-2 rounded-lg text-xs font-bold cursor-pointer transition-colors"
                [class]="tipo() === m.valor ? claseTipo(m.valor) : 'text-slate-400 hover:text-white'">
                {{ m.nombre }}
              </button>
            }
          </div>
          <p class="text-xs text-slate-400">{{ ayuda() }}</p>

          <div class="grid grid-cols-3 gap-3">
            <div class="col-span-2">
              <label for="mov-cant" class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                {{ tipo() === 'CONTEO' ? 'Cuánto hay' : 'Cantidad' }}
              </label>
              <input id="mov-cant" type="number" inputmode="decimal" min="0" [step]="esProducto() ? 1 : 'any'"
                [ngModel]="cantidad()" (ngModelChange)="cantidad.set($event)"
                class="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3 text-sm text-white tabular-nums outline-none focus:border-indigo-500" />
            </div>
            <div>
              <label for="mov-uni" class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Unidad</label>
              @if (esProducto()) {
                <p class="py-2.5 text-sm text-slate-300">piezas</p>
              } @else {
                <select id="mov-uni" [ngModel]="unidad()" (ngModelChange)="unidad.set($event)"
                  class="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-2 text-sm text-white outline-none focus:border-indigo-500 cursor-pointer [color-scheme:dark]">
                  @for (u of unidades(); track u) {
                    <option [value]="u" class="bg-slate-900">{{ u }}</option>
                  }
                </select>
              }
            </div>
          </div>

          @if (tipo() === 'ENTRADA') {
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label for="mov-costo" class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Pagaste ($)</label>
                <input id="mov-costo" type="number" inputmode="decimal" min="0" step="any" placeholder="Opcional"
                  [ngModel]="costoTotal()" (ngModelChange)="costoTotal.set($event)"
                  class="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3 text-sm text-white tabular-nums outline-none focus:border-indigo-500" />
              </div>
              <div>
                <label for="mov-prov" class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Proveedor</label>
                <input id="mov-prov" type="text" maxlength="120" placeholder="Opcional"
                  [ngModel]="proveedor()" (ngModelChange)="proveedor.set($event)"
                  class="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3 text-sm text-white outline-none focus:border-indigo-500" />
              </div>
            </div>
          }

          <div>
            <label for="mov-nota" class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              {{ tipo() === 'MERMA' ? 'Motivo' : 'Nota' }}
            </label>
            <input id="mov-nota" type="text" maxlength="300"
              [placeholder]="tipo() === 'MERMA' ? 'Ej. se echó a perder, se cayó' : 'Opcional'"
              [ngModel]="nota()" (ngModelChange)="nota.set($event)"
              class="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3 text-sm text-white outline-none focus:border-indigo-500" />
          </div>

          @if (resultado(); as r) {
            <p class="text-xs rounded-lg px-3 py-2" [class]="r.negativo ? 'bg-rose-500/10 text-rose-300' : 'bg-slate-950 text-slate-300'">
              Quedarán <strong>{{ r.texto }}</strong>
              @if (tipo() === 'CONTEO') {
                <span class="text-slate-500"> · diferencia {{ r.diferencia }}</span>
              }
            </p>
          }
        </div>

        <div class="px-6 py-4 border-t border-slate-800 flex items-center justify-end gap-3">
          @if (error()) {
            <p class="mr-auto text-xs text-rose-400">{{ error() }}</p>
          }
          <button (click)="cerrar.emit()" class="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white cursor-pointer">Cancelar</button>
          <button (click)="guardar()" [disabled]="!puedeGuardar() || guardando()"
            class="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
            {{ guardando() ? 'Guardando…' : 'Registrar ' + nombreTipo().toLowerCase() }}
          </button>
        </div>
      </div>
    </div>
  `,
})
export class MovimientoInventarioComponent implements OnInit {
  private readonly http = inject(HttpClient);

  readonly branchId = input.required<string>();
  readonly objetivo = input.required<ObjetivoInventario>();
  readonly cerrar = output<void>();
  /** Se registró: el mensaje con cómo quedó. */
  readonly guardado = output<string>();

  readonly movimientos = MOVIMIENTOS;
  readonly tipo = signal<Movimiento>('ENTRADA');
  readonly cantidad = signal<number | null>(null);
  readonly unidad = signal('');
  readonly costoTotal = signal<number | null>(null);
  readonly proveedor = signal('');
  readonly nota = signal('');
  readonly guardando = signal(false);
  readonly error = signal<string | null>(null);

  readonly esProducto = computed(() => this.objetivo().tipo === 'PRODUCTO');
  readonly unidades = computed(() => unidadesCompatibles(this.objetivo().unidad));
  readonly ayuda = computed(() => MOVIMIENTOS.find((m) => m.valor === this.tipo())!.ayuda);
  readonly nombreTipo = computed(() => MOVIMIENTOS.find((m) => m.valor === this.tipo())!.nombre);

  /** La cantidad en la unidad del inventario. */
  private readonly enInventario = computed(() => {
    const c = Number(this.cantidad());
    if (!Number.isFinite(c) || this.cantidad() === null) return null;
    return this.esProducto() ? c : convertirUnidad(c, this.unidad() || this.objetivo().unidad, this.objetivo().unidad);
  });

  readonly resultado = computed(() => {
    const c = this.enInventario();
    if (c === null) return null;
    const actual = Number(this.objetivo().stock) || 0;
    const final = this.tipo() === 'ENTRADA' ? actual + c : this.tipo() === 'MERMA' ? actual - c : c;
    const dif = final - actual;
    return {
      texto: this.legible(final),
      negativo: final < 0,
      diferencia: (dif > 0 ? '+' : dif < 0 ? '−' : '') + this.legible(Math.abs(dif)),
    };
  });

  readonly puedeGuardar = computed(() => {
    const c = Number(this.cantidad());
    if (this.cantidad() === null || !Number.isFinite(c) || c < 0) return false;
    if (this.tipo() !== 'CONTEO' && c <= 0) return false;
    if (this.esProducto() && !Number.isInteger(c)) return false;
    return true;
  });

  ngOnInit(): void {
    this.unidad.set(this.objetivo().unidad);
  }

  legible(n: number): string {
    return this.esProducto()
      ? `${Math.round(n * 1000) / 1000} ${Math.abs(n) === 1 ? 'pieza' : 'piezas'}`
      : cantidadLegible(n, this.objetivo().unidad);
  }

  claseTipo(t: Movimiento): string {
    return t === 'ENTRADA' ? 'bg-emerald-600 text-white' : t === 'MERMA' ? 'bg-rose-600 text-white' : 'bg-sky-600 text-white';
  }

  guardar(): void {
    if (!this.puedeGuardar() || this.guardando()) return;
    const o = this.objetivo();
    this.guardando.set(true);
    this.error.set(null);
    this.http
      .post<{ saldo: number; mensaje: string }>(`${environment.apiUrl}/branches/${this.branchId()}/inventario/movimientos`, {
        ingredientId: o.tipo === 'INGREDIENTE' ? o.id : null,
        productId: o.tipo === 'PRODUCTO' ? o.id : null,
        tipo: this.tipo(),
        cantidad: Number(this.cantidad()),
        unidad: o.tipo === 'INGREDIENTE' ? this.unidad() || o.unidad : null,
        costoTotal: this.tipo() === 'ENTRADA' && this.costoTotal() ? Number(this.costoTotal()) : null,
        proveedor: this.tipo() === 'ENTRADA' ? this.proveedor().trim() || null : null,
        nota: this.nota().trim() || null,
      })
      .subscribe({
        next: (r) => {
          this.guardando.set(false);
          this.guardado.emit(r.mensaje);
        },
        error: (err) => {
          this.guardando.set(false);
          this.error.set(err.error?.error || err.error?.message || 'No se pudo registrar.');
        },
      });
  }
}
