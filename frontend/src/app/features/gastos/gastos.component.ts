import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { LucideBan, LucideChevronLeft, LucideChevronRight, LucideLoader2, LucidePencil, LucidePlus, LucideX } from '@lucide/angular';
import { environment } from '../../../environments/environment';
import { AvisosService } from '../../core/services/avisos.service';
import { SucursalActivaService } from '../../core/services/sucursal-activa.service';
import { TituloPaginaComponent } from '../../shared/components/titulo-pagina.component';
import { SelectorFechaComponent, hoyIso } from '../../shared/components/selector-fecha.component';
import { PesosPipe, formatearPesos } from '../../shared/utils/pesos';

interface Gasto {
  id: string;
  categoria: string;
  concepto: string;
  monto: number;
  fecha: string;
  formaPago: string;
  nota: string | null;
  gastoFijoId: string | null;
  usuario: string | null;
  creadoEn: string;
  anulado: boolean;
  anuladoPor: string | null;
}

interface GastoFijo {
  id: string;
  categoria: string;
  concepto: string;
  monto: number;
  diaDelMes: number;
  activo: boolean;
  vence: string;
  pago: Gasto | null;
}

interface Mes {
  mes: string;
  fijos: GastoFijo[];
  gastos: Gasto[];
  total: number;
  pendiente: number;
}

type Forma = 'CAJA' | 'TRANSFERENCIA' | 'TARJETA';

const CATEGORIAS: { id: string; nombre: string }[] = [
  { id: 'RENTA', nombre: 'Renta' },
  { id: 'LUZ', nombre: 'Luz' },
  { id: 'AGUA', nombre: 'Agua' },
  { id: 'GAS', nombre: 'Gas' },
  { id: 'NOMINA', nombre: 'Nómina' },
  { id: 'INTERNET', nombre: 'Internet y teléfono' },
  { id: 'MANTENIMIENTO', nombre: 'Mantenimiento' },
  { id: 'IMPUESTOS', nombre: 'Impuestos' },
  { id: 'OTRO', nombre: 'Otro' },
];
const CAMPO = 'w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-sm text-white outline-none focus:border-indigo-500 min-h-[40px]';
const ETIQUETA = 'block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1';

/**
 * Gastos que no son compras de mercancía: renta, luz, nómina… Los que se
 * repiten cada mes quedan como gastos fijos y aquí se ve cuáles faltan.
 * Todo cuenta como egreso en Reportes › Ingresos y egresos.
 */
@Component({
  selector: 'app-gastos',
  standalone: true,
  imports: [FormsModule, PesosPipe, TituloPaginaComponent, SelectorFechaComponent,
    LucideBan, LucideChevronLeft, LucideChevronRight, LucideLoader2, LucidePencil, LucidePlus, LucideX],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">
      <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
        <app-titulo-pagina titulo="Gastos" descripcion="Renta, luz, nómina y todo lo que no es compra de mercancía. Cuentan como egreso en Reportes." />
        <div class="inline-flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-xl" role="group" aria-label="Mes">
          <button type="button" (click)="moverMes(-1)" class="w-9 h-9 rounded-lg text-slate-300 hover:bg-slate-800 flex items-center justify-center cursor-pointer" aria-label="Mes anterior">
            <svg lucideChevronLeft class="w-4 h-4"></svg>
          </button>
          <span class="px-2 min-w-[9.5rem] text-center text-sm font-bold text-white capitalize">{{ nombreMes() }}</span>
          <button type="button" (click)="moverMes(1)" [disabled]="esMesActual()" class="w-9 h-9 rounded-lg text-slate-300 hover:bg-slate-800 flex items-center justify-center cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed" aria-label="Mes siguiente">
            <svg lucideChevronRight class="w-4 h-4"></svg>
          </button>
        </div>
      </div>

      @if (datos(); as d) {
        <!-- Totales -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div class="p-5 bg-slate-900/90 border border-slate-700/50 rounded-2xl">
            <p class="text-xs font-bold text-slate-400 uppercase tracking-wider">Gastado en el mes</p>
            <p class="mt-2 text-2xl font-extrabold text-rose-300 tabular-nums">{{ d.total | pesos }}</p>
            <p class="mt-1 text-xs text-slate-400">{{ vigentes().length }} {{ vigentes().length === 1 ? 'gasto' : 'gastos' }}</p>
          </div>
          <div class="p-5 bg-slate-900/90 border rounded-2xl" [class]="d.pendiente > 0 ? 'border-amber-500/40' : 'border-slate-700/50'">
            <p class="text-xs font-bold text-slate-400 uppercase tracking-wider">Fijos por pagar</p>
            <p class="mt-2 text-2xl font-extrabold tabular-nums" [class]="d.pendiente > 0 ? 'text-amber-300' : 'text-emerald-300'">{{ d.pendiente | pesos }}</p>
            <p class="mt-1 text-xs text-slate-400">{{ porPagar().length ? porPagar().length + ' de ' + d.fijos.length + ' sin pagar' : d.fijos.length ? 'Todos pagados' : 'Sin gastos fijos' }}</p>
          </div>
          <div class="p-5 bg-slate-900/90 border rounded-2xl" [class]="vencidos() > 0 ? 'border-rose-500/50' : 'border-slate-700/50'">
            <p class="text-xs font-bold text-slate-400 uppercase tracking-wider">Vencidos</p>
            <p class="mt-2 text-2xl font-extrabold tabular-nums" [class]="vencidos() > 0 ? 'text-rose-300' : 'text-slate-500'">{{ vencidos() }}</p>
            <p class="mt-1 text-xs text-slate-400">Gastos fijos que ya pasaron su día</p>
          </div>
        </div>

        <div class="grid grid-cols-1 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] gap-6 items-start">
          <div class="space-y-6 min-w-0">
            <!-- Gastos fijos -->
            <section class="p-5 bg-slate-900 border border-slate-700/50 rounded-2xl space-y-3">
              <div class="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 class="text-base font-bold text-white">Gastos fijos del mes</h2>
                  <p class="text-xs text-slate-400">Los que se pagan cada mes. Regístralos una vez y aquí ves cuáles faltan.</p>
                </div>
                <button type="button" (click)="nuevoFijo()" class="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-700 text-xs font-bold text-slate-200 hover:border-slate-500 cursor-pointer min-h-[36px]">
                  <svg lucidePlus class="w-4 h-4"></svg> Gasto fijo
                </button>
              </div>
              <ul class="divide-y divide-slate-800">
                @for (f of d.fijos; track f.id) {
                  <li class="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
                    <div class="min-w-0 flex-1">
                      <p class="text-sm font-semibold text-white truncate">{{ f.concepto }}</p>
                      <p class="text-[11px] text-slate-500">{{ nombreCategoria(f.categoria) }} · el día {{ f.diaDelMes }}{{ f.activo ? '' : ' · ya no se repite' }}</p>
                    </div>
                    <span class="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded" [class]="estado(f).clase">{{ estado(f).texto }}</span>
                    <span class="w-24 text-right text-sm font-bold tabular-nums" [class]="f.pago ? 'text-slate-300' : 'text-white'">{{ (f.pago ? f.pago.monto : f.monto) | pesos }}</span>
                    <div class="flex items-center gap-1">
                      @if (!f.pago) {
                        <button type="button" (click)="pagarFijo(f)" class="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold cursor-pointer min-h-[36px]">Registrar pago</button>
                      }
                      @if (f.activo) {
                        <button type="button" (click)="editarFijo(f)" class="w-9 h-9 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 flex items-center justify-center cursor-pointer" [attr.aria-label]="'Editar ' + f.concepto">
                          <svg lucidePencil class="w-4 h-4"></svg>
                        </button>
                      }
                    </div>
                  </li>
                } @empty {
                  <li class="py-6 text-center text-sm text-slate-400">Agrega la renta, la luz, la nómina… lo que pagas cada mes.</li>
                }
              </ul>
            </section>

            <!-- Gastos del mes -->
            <section class="p-5 bg-slate-900 border border-slate-700/50 rounded-2xl space-y-3">
              <h2 class="text-base font-bold text-white">Gastos del mes</h2>
              @if (porCategoria().length) {
                <div class="flex flex-wrap gap-2">
                  @for (c of porCategoria(); track c.id) {
                    <span class="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300">{{ c.nombre }} <strong class="text-white tabular-nums">{{ c.monto | pesos }}</strong></span>
                  }
                </div>
              }
              <ul class="divide-y divide-slate-800">
                @for (g of d.gastos; track g.id) {
                  <li class="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5" [class.opacity-50]="g.anulado">
                    <div class="min-w-0 flex-1">
                      <p class="text-sm text-slate-200 truncate" [class.line-through]="g.anulado">{{ g.concepto }}</p>
                      <p class="text-[11px] text-slate-500">{{ nombreCategoria(g.categoria) }} · {{ fechaCorta(g.fecha) }} · {{ nombreForma(g.formaPago) }}{{ g.usuario ? ' · ' + g.usuario : '' }}{{ g.nota ? ' · ' + g.nota : '' }}</p>
                    </div>
                    <span class="w-24 text-right text-sm font-bold tabular-nums" [class]="g.anulado ? 'text-slate-500 line-through' : 'text-white'">{{ g.monto | pesos }}</span>
                    @if (g.anulado) {
                      <span class="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-300">Anulado</span>
                    } @else {
                      <button type="button" (click)="anular(g)" class="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-rose-300 cursor-pointer min-h-[32px]">
                        <svg lucideBan class="w-3.5 h-3.5"></svg> Anular
                      </button>
                    }
                  </li>
                } @empty {
                  <li class="py-6 text-center text-sm text-slate-400">No hay gastos registrados en este mes.</li>
                }
              </ul>
            </section>
          </div>

          <!-- Registrar gasto -->
          <form ngNoForm class="p-5 bg-slate-900 border border-slate-700/50 rounded-2xl space-y-4 xl:sticky xl:top-4" (submit)="registrar($event)" novalidate>
            <h2 class="text-base font-bold text-white">{{ pagando() ? 'Pago de ' + pagando()!.concepto : 'Registrar gasto' }}</h2>
            @if (pagando(); as p) {
              <div class="flex items-center justify-between gap-3 rounded-xl border border-indigo-500/40 bg-indigo-500/10 px-3 py-2 text-xs text-indigo-100">
                <span>Gasto fijo del día {{ p.diaDelMes }}. Cambia el monto si este mes fue distinto.</span>
                <button type="button" (click)="limpiar()" class="text-slate-300 hover:text-white cursor-pointer">Quitar</button>
              </div>
            }
            <div>
              <span class="${ETIQUETA}">Categoría</span>
              <div class="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Categoría">
                @for (c of categorias; track c.id) {
                  <button type="button" role="radio" [attr.aria-checked]="categoria() === c.id" (click)="categoria.set(c.id)"
                    class="px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer min-h-[34px]"
                    [class]="categoria() === c.id ? 'border-indigo-500 bg-indigo-500/15 text-white' : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-600'">{{ c.nombre }}</button>
                }
              </div>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] gap-3">
              <div>
                <label for="gs-concepto" class="${ETIQUETA}">Concepto</label>
                <input id="gs-concepto" [ngModel]="concepto()" (ngModelChange)="concepto.set($event)" maxlength="120" [placeholder]="ejemplo()" class="${CAMPO}" />
              </div>
              <div>
                <label for="gs-monto" class="${ETIQUETA}">Monto</label>
                <input id="gs-monto" type="number" min="0" step="any" inputmode="decimal" [ngModel]="monto()" (ngModelChange)="monto.set($event)" placeholder="0.00" class="${CAMPO} tabular-nums" />
              </div>
            </div>
            <div>
              <span class="${ETIQUETA}">Fecha de pago</span>
              <app-selector-fecha idBoton="gs-fecha" [valor]="fecha()" (valorChange)="fecha.set($event)" />
            </div>
            <div>
              <span class="${ETIQUETA}">¿Cómo se pagó?</span>
              <div class="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Forma de pago">
                @for (f of formas; track f.id) {
                  <button type="button" role="radio" [attr.aria-checked]="forma() === f.id" (click)="forma.set(f.id)"
                    class="text-left rounded-xl border px-3 py-2 cursor-pointer min-h-[52px]"
                    [class]="forma() === f.id ? 'border-indigo-500 bg-indigo-500/10' : 'border-slate-800 bg-slate-950 hover:border-slate-600'">
                    <span class="block text-sm font-bold text-white">{{ f.nombre }}</span>
                    <span class="block text-[11px] text-slate-400">{{ f.ayuda }}</span>
                  </button>
                }
              </div>
              @if (forma() === 'CAJA') {
                <p class="mt-2 rounded-lg px-3 py-2 text-xs" role="status"
                  [class]="cajaAbierta() === false ? 'bg-rose-500/10 text-rose-300' : 'bg-emerald-500/10 text-emerald-200'">
                  {{ cajaAbierta() === false ? 'La caja está cerrada: ábrela en Caja para pagar con efectivo, o elige transferencia o tarjeta.' : 'Sale del cajón; el arqueo lo descuenta solo.' }}
                </p>
              }
            </div>
            <div>
              <label for="gs-nota" class="${ETIQUETA}">Nota</label>
              <input id="gs-nota" [ngModel]="nota()" (ngModelChange)="nota.set($event)" maxlength="300" placeholder="Opcional: número de recibo, periodo…" class="${CAMPO}" />
            </div>
            <div class="flex items-center justify-end gap-3">
              @if (faltante(); as f) { <p class="text-xs text-amber-300">{{ f }}</p> }
              <button type="submit" [disabled]="!!faltante() || guardando()"
                class="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed min-h-[48px]">
                @if (guardando()) { <svg lucideLoader2 class="w-4 h-4 animate-spin"></svg> }
                Registrar gasto
              </button>
            </div>
          </form>
        </div>
      } @else {
        <div class="flex items-center justify-center gap-2 py-16 text-sm text-slate-400">
          <svg lucideLoader2 class="w-4 h-4 animate-spin"></svg> Cargando gastos…
        </div>
      }
    </div>

    <!-- Gasto fijo -->
    @if (fijo(); as f) {
      <div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" (click)="fijo.set(null)">
        <form ngNoForm class="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-5 space-y-3" role="dialog" aria-modal="true" aria-labelledby="fijo-titulo"
          (click)="$event.stopPropagation()" (submit)="guardarFijo($event)" novalidate>
          <div class="flex items-center justify-between">
            <h3 id="fijo-titulo" class="text-base font-bold text-white">{{ f.id ? 'Editar gasto fijo' : 'Nuevo gasto fijo' }}</h3>
            <button type="button" (click)="fijo.set(null)" class="w-9 h-9 rounded-lg text-slate-400 hover:text-white flex items-center justify-center cursor-pointer" aria-label="Cerrar">
              <svg lucideX class="w-4 h-4"></svg>
            </button>
          </div>
          <div>
            <label for="gf-cat" class="${ETIQUETA}">Categoría</label>
            <select id="gf-cat" [ngModel]="f.categoria" (ngModelChange)="cambiarFijo({ categoria: $event })" class="${CAMPO} [color-scheme:dark] cursor-pointer">
              @for (c of categorias; track c.id) { <option [value]="c.id">{{ c.nombre }}</option> }
            </select>
          </div>
          <div>
            <label for="gf-concepto" class="${ETIQUETA}">Concepto</label>
            <input id="gf-concepto" [ngModel]="f.concepto" (ngModelChange)="cambiarFijo({ concepto: $event })" maxlength="120" placeholder="Renta del local" class="${CAMPO}" />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label for="gf-monto" class="${ETIQUETA}">Monto de siempre</label>
              <input id="gf-monto" type="number" min="0" step="any" inputmode="decimal" [ngModel]="f.monto" (ngModelChange)="cambiarFijo({ monto: $event })" class="${CAMPO} tabular-nums" />
            </div>
            <div>
              <label for="gf-dia" class="${ETIQUETA}">Día del mes</label>
              <input id="gf-dia" type="number" min="1" max="31" step="1" inputmode="numeric" [ngModel]="f.diaDelMes" (ngModelChange)="cambiarFijo({ diaDelMes: $event })" class="${CAMPO} tabular-nums" />
            </div>
          </div>
          <p class="text-[11px] text-slate-500">Si el monto cambia cada mes (como la luz), pon el aproximado: al registrar el pago escribes el real.</p>
          <div class="flex flex-wrap items-center justify-between gap-2 pt-1">
            @if (f.id) {
              <button type="button" (click)="quitarFijo(f.id)" class="text-xs text-slate-400 hover:text-rose-300 cursor-pointer">Ya no se paga cada mes</button>
            } @else { <span></span> }
            <div class="flex gap-2">
              <button type="button" (click)="fijo.set(null)" class="px-4 py-2.5 rounded-lg border border-slate-700 text-sm text-slate-300 cursor-pointer">Cancelar</button>
              <button type="submit" [disabled]="!fijoValido() || guardando()" class="px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold cursor-pointer disabled:opacity-40">Guardar</button>
            </div>
          </div>
        </form>
      </div>
    }
  `,
})
export class GastosComponent {
  private readonly http = inject(HttpClient);
  private readonly avisos = inject(AvisosService);
  private readonly sucursalActiva = inject(SucursalActivaService);

  readonly categorias = CATEGORIAS;
  readonly formas: { id: Forma; nombre: string; ayuda: string }[] = [
    { id: 'CAJA', nombre: 'Efectivo de caja', ayuda: 'Sale del cajón' },
    { id: 'TRANSFERENCIA', nombre: 'Transferencia', ayuda: 'Desde el banco' },
    { id: 'TARJETA', nombre: 'Tarjeta', ayuda: 'Del negocio' },
  ];

  readonly branchId = computed(() => this.sucursalActiva.branchId());
  readonly mes = signal(hoyIso().slice(0, 7));
  readonly datos = signal<Mes | null>(null);
  readonly cajaAbierta = signal<boolean | null>(null);
  readonly guardando = signal(false);

  // Formulario
  readonly categoria = signal('RENTA');
  readonly concepto = signal('');
  readonly monto = signal<number | null>(null);
  readonly fecha = signal(hoyIso());
  readonly forma = signal<Forma>('TRANSFERENCIA');
  readonly nota = signal('');
  readonly pagando = signal<GastoFijo | null>(null);
  readonly fijo = signal<{ id: string | null; categoria: string; concepto: string; monto: number | null; diaDelMes: number | null } | null>(null);

  readonly esMesActual = computed(() => this.mes() >= hoyIso().slice(0, 7));
  readonly nombreMes = computed(() => {
    const [a, m] = this.mes().split('-').map(Number);
    return new Date(a, m - 1, 1).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
  });
  readonly vigentes = computed(() => (this.datos()?.gastos ?? []).filter((g) => !g.anulado));
  readonly porPagar = computed(() => (this.datos()?.fijos ?? []).filter((f) => !f.pago && f.activo));
  readonly vencidos = computed(() => this.porPagar().filter((f) => f.vence < hoyIso()).length);
  readonly porCategoria = computed(() => {
    const suma = new Map<string, number>();
    for (const g of this.vigentes()) suma.set(g.categoria, (suma.get(g.categoria) ?? 0) + Number(g.monto));
    return [...suma.entries()].map(([id, monto]) => ({ id, nombre: this.nombreCategoria(id), monto })).sort((a, b) => b.monto - a.monto);
  });
  readonly ejemplo = computed(() => ({
    RENTA: 'Renta del local', LUZ: 'Recibo CFE', AGUA: 'Recibo de agua', GAS: 'Gas LP', NOMINA: 'Nómina semanal',
    INTERNET: 'Internet y teléfono', MANTENIMIENTO: 'Plomero, refrigeración…', IMPUESTOS: 'Pago SAT', OTRO: '¿Qué se pagó?',
  } as Record<string, string>)[this.categoria()] ?? '');

  readonly faltante = computed(() => {
    if (!this.concepto().trim()) return 'Escribe qué se pagó.';
    if (!(Number(this.monto()) > 0)) return 'Escribe el monto.';
    if (this.forma() === 'CAJA' && this.cajaAbierta() === false) return 'Con la caja cerrada no se puede pagar en efectivo.';
    return null;
  });
  readonly fijoValido = computed(() => {
    const f = this.fijo();
    const dia = Number(f?.diaDelMes);
    return !!f && !!f.concepto.trim() && Number(f.monto) > 0 && Number.isInteger(dia) && dia >= 1 && dia <= 31;
  });

  constructor() {
    effect(() => {
      const id = this.branchId();
      const mes = this.mes();
      untracked(() => {
        if (!id) return;
        this.cargar(id, mes);
        this.http.get<{ abierta: boolean }>(`${environment.apiUrl}/branches/${id}/caja/abierta`).subscribe({
          next: (r) => this.cajaAbierta.set(r.abierta),
          error: () => this.cajaAbierta.set(null),
        });
      });
    });
  }

  private api(ruta = ''): string {
    return `${environment.apiUrl}/branches/${this.branchId()}/gastos${ruta}`;
  }

  private cargar(id = this.branchId(), mes = this.mes()): void {
    this.http.get<Mes>(`${environment.apiUrl}/branches/${id}/gastos?mes=${mes}`).subscribe({
      next: (d) => this.datos.set(d),
      error: (err) => this.avisos.error(err.error?.error || 'No se pudieron cargar los gastos.'),
    });
  }

  moverMes(n: number): void {
    const [a, m] = this.mes().split('-').map(Number);
    const d = new Date(a, m - 1 + n, 1);
    this.mes.set(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  // ------------------------------------------------------------------ registrar

  pagarFijo(f: GastoFijo): void {
    this.pagando.set(f);
    this.categoria.set(f.categoria);
    this.concepto.set(f.concepto);
    this.monto.set(f.monto);
    // Si se está viendo otro mes, el pago va con fecha de ese mes (su día, o hoy si aún no llega).
    this.fecha.set(f.vence < hoyIso() ? f.vence : hoyIso());
    this.nota.set('');
  }

  limpiar(): void {
    this.pagando.set(null);
    this.concepto.set('');
    this.monto.set(null);
    this.fecha.set(hoyIso());
    this.nota.set('');
  }

  registrar(e: Event): void {
    e.preventDefault();
    if (this.faltante() || this.guardando()) return;
    this.guardando.set(true);
    this.http.post<{ mensaje: string }>(this.api(), {
      categoria: this.categoria(),
      concepto: this.concepto().trim(),
      monto: Number(this.monto()),
      fecha: this.fecha(),
      formaPago: this.forma(),
      nota: this.nota().trim() || null,
      gastoFijoId: this.pagando()?.id ?? null,
    }).subscribe({
      next: (r) => {
        this.guardando.set(false);
        this.avisos.exito(r.mensaje);
        this.limpiar();
        this.cargar();
      },
      error: (err) => {
        this.guardando.set(false);
        this.avisos.error(err.error?.error || 'No se pudo registrar el gasto.');
      },
    });
  }

  async anular(g: Gasto): Promise<void> {
    if (!(await this.avisos.confirmar({
      titulo: `¿Anular ${g.concepto} por ${formatearPesos(g.monto)}?`,
      mensaje: g.formaPago === 'CAJA' ? 'El efectivo regresa a la caja abierta.' : 'Deja de contar como egreso. Queda en la lista como anulado.',
      confirmar: 'Anular gasto', cancelar: 'Volver', peligro: true,
    }))) return;
    this.http.post<{ mensaje: string }>(this.api(`/${g.id}/anular`), {}).subscribe({
      next: (r) => {
        this.avisos.exito(r.mensaje);
        this.cargar();
      },
      error: (err) => this.avisos.error(err.error?.error || 'No se pudo anular el gasto.'),
    });
  }

  // ------------------------------------------------------------------ gastos fijos

  nuevoFijo(): void {
    this.fijo.set({ id: null, categoria: 'RENTA', concepto: '', monto: null, diaDelMes: 1 });
  }

  editarFijo(f: GastoFijo): void {
    this.fijo.set({ id: f.id, categoria: f.categoria, concepto: f.concepto, monto: f.monto, diaDelMes: f.diaDelMes });
  }

  cambiarFijo(cambio: Partial<{ categoria: string; concepto: string; monto: number | null; diaDelMes: number | null }>): void {
    this.fijo.update((f) => (f ? { ...f, ...cambio } : f));
  }

  guardarFijo(e: Event): void {
    e.preventDefault();
    const f = this.fijo();
    if (!f || !this.fijoValido() || this.guardando()) return;
    this.guardando.set(true);
    const cuerpo = { categoria: f.categoria, concepto: f.concepto.trim(), monto: Number(f.monto), diaDelMes: Number(f.diaDelMes) };
    const peticion = f.id
      ? this.http.put<{ mensaje: string }>(this.api(`/fijos/${f.id}`), cuerpo)
      : this.http.post<{ mensaje: string }>(this.api('/fijos'), cuerpo);
    peticion.subscribe({
      next: (r) => {
        this.guardando.set(false);
        this.avisos.exito(r.mensaje);
        this.fijo.set(null);
        this.cargar();
      },
      error: (err) => {
        this.guardando.set(false);
        this.avisos.error(err.error?.error || 'No se pudo guardar el gasto fijo.');
      },
    });
  }

  async quitarFijo(id: string): Promise<void> {
    if (!(await this.avisos.confirmar({
      titulo: '¿Ya no se paga cada mes?',
      mensaje: 'Deja de aparecer en los meses siguientes. Lo que ya se pagó se queda.',
      confirmar: 'Quitar', cancelar: 'Volver', peligro: true,
    }))) return;
    this.http.delete<{ mensaje: string }>(this.api(`/fijos/${id}`)).subscribe({
      next: (r) => {
        this.avisos.exito(r.mensaje);
        this.fijo.set(null);
        this.cargar();
      },
      error: (err) => this.avisos.error(err.error?.error || 'No se pudo quitar.'),
    });
  }

  // ------------------------------------------------------------------ apoyos

  estado(f: GastoFijo): { texto: string; clase: string } {
    if (f.pago) return { texto: 'Pagado ' + this.fechaCorta(f.pago.fecha), clase: 'bg-emerald-500/15 text-emerald-300' };
    const hoy = hoyIso();
    if (f.vence < hoy) return { texto: 'Vencido · era el ' + this.fechaCorta(f.vence), clase: 'bg-rose-500/15 text-rose-300' };
    if (f.vence === hoy) return { texto: 'Vence hoy', clase: 'bg-amber-500/15 text-amber-300' };
    return { texto: 'Vence el ' + this.fechaCorta(f.vence), clase: 'bg-slate-800 text-slate-300' };
  }

  nombreCategoria(id: string): string {
    return CATEGORIAS.find((c) => c.id === id)?.nombre ?? id;
  }

  nombreForma(id: string): string {
    return this.formas.find((f) => f.id === id)?.nombre ?? id;
  }

  fechaCorta(iso: string): string {
    const [a, m, d] = iso.slice(0, 10).split('-').map(Number);
    return new Date(a, m - 1, d).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
  }
}
