import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideLoader2 } from '@lucide/angular';
import { environment } from '../../../environments/environment';
import { AvisosService } from '../../core/services/avisos.service';
import { SucursalActivaService } from '../../core/services/sucursal-activa.service';
import { TituloPaginaComponent } from '../../shared/components/titulo-pagina.component';
import { PesosPipe, formatearPesos } from '../../shared/utils/pesos';

interface Movimiento {
  id: string;
  tipo: 'ENTRADA' | 'SALIDA';
  monto: number;
  concepto: string;
  por: string | null;
  creadoEn: string;
}

/** La caja abierta. Sin ventas ni esperado: el cierre se cuenta a ciegas. */
interface EstadoCaja {
  turnoId: string;
  abiertoPor: string | null;
  abiertoEn: string;
  fondoInicial: number;
  cuentasCobradas: number;
  cortesRecibidos: number;
  movimientos: Movimiento[];
}

interface VentaPorMetodo {
  metodo: string;
  esEfectivo: boolean;
  cobros: number;
  monto: number;
  propinas: number;
}

interface CorteEnCaja {
  corteId: string;
  repartidor: string | null;
  entregas: number;
  recibido: number;
  creadoEn: string;
}

interface Arqueo {
  turnoId: string;
  abiertoPor: string | null;
  abiertoEn: string;
  cerradoPor: string | null;
  cerradoEn: string;
  fondoInicial: number;
  cuentasCobradas: number;
  ventasPorMetodo: VentaPorMetodo[];
  totalVentas: number;
  totalPropinas: number;
  movimientos: Movimiento[];
  entradas: number;
  salidas: number;
  cortes: CorteEnCaja[];
  totalCortes: number;
  efectivoEsperado: number;
  efectivoContado: number;
  diferencia: number;
  conteo: Record<string, number> | null;
  notas: string | null;
}

interface TurnoResumen {
  turnoId: string;
  abiertoPor: string | null;
  abiertoEn: string;
  cerradoPor: string | null;
  cerradoEn: string;
  fondoInicial: number;
  efectivoEsperado: number;
  efectivoContado: number;
  diferencia: number;
}

/** Billetes y monedas de pesos, de mayor a menor. El de $20 se cuenta junto, billete o moneda. */
const DENOMINACIONES: { valor: string; etiqueta: string }[] = [
  { valor: '1000', etiqueta: '$1,000' },
  { valor: '500', etiqueta: '$500' },
  { valor: '200', etiqueta: '$200' },
  { valor: '100', etiqueta: '$100' },
  { valor: '50', etiqueta: '$50' },
  { valor: '20', etiqueta: '$20' },
  { valor: '10', etiqueta: '$10' },
  { valor: '5', etiqueta: '$5' },
  { valor: '2', etiqueta: '$2' },
  { valor: '1', etiqueta: '$1' },
  { valor: '0.5', etiqueta: '50¢' },
];

/**
 * La caja de la sucursal: se abre con un fondo, registra el efectivo que
 * entra o sale sin ser venta y se cierra contando el cajón a ciegas. El
 * arqueo (cuánto debía haber y la diferencia) se ve hasta cerrar.
 */
@Component({
  selector: 'app-caja',
  standalone: true,
  imports: [FormsModule, DatePipe, PesosPipe, TituloPaginaComponent, LucideLoader2],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6 min-h-screen bg-slate-950 text-slate-100 p-2 sm:p-4">
      <app-titulo-pagina titulo="Caja"
        descripcion="Ábrela con tu fondo, registra el efectivo que entra o sale y ciérrala contando el cajón." />

      @if (!branchId()) {
        <p class="text-sm text-slate-400">Elige una sucursal en la barra de arriba.</p>
      } @else if (cargando()) {
        <p class="flex items-center gap-2 text-sm text-slate-400"><svg lucideLoader2 class="w-4 h-4 animate-spin"></svg> Cargando...</p>
      } @else {

        <!-- ============================== ARQUEO (recien cerrada o del historial) -->
        @if (arqueo(); as a) {
          <section class="max-w-3xl rounded-2xl border border-slate-800 bg-slate-900/40 p-5 space-y-5 print:border-0 print:bg-white print:text-black">
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 class="text-lg font-bold text-white print:text-black">Arqueo de caja</h2>
                <p class="text-xs text-slate-400 tabular-nums">
                  Abrió {{ a.abiertoPor || '—' }} el {{ a.abiertoEn | date: 'dd/MM HH:mm' }} ·
                  cerró {{ a.cerradoPor || '—' }} el {{ a.cerradoEn | date: 'dd/MM HH:mm' }}
                </p>
              </div>
              <div class="flex gap-2 print:hidden">
                <button type="button" (click)="imprimir()" class="px-3 py-2 rounded-lg border border-slate-700 text-xs font-bold text-slate-300 hover:text-white cursor-pointer">Imprimir</button>
                <button type="button" (click)="arqueo.set(null)" class="px-3 py-2 rounded-lg bg-slate-800 text-xs font-bold text-white hover:bg-slate-700 cursor-pointer">Cerrar</button>
              </div>
            </div>

            <dl class="grid grid-cols-3 gap-2 text-center">
              <div class="rounded-xl bg-slate-950/60 p-3">
                <dt class="text-[11px] text-slate-500 uppercase tracking-wider">Debía haber</dt>
                <dd class="text-lg font-black text-white tabular-nums">{{ a.efectivoEsperado | pesos }}</dd>
              </div>
              <div class="rounded-xl bg-slate-950/60 p-3">
                <dt class="text-[11px] text-slate-500 uppercase tracking-wider">Se contó</dt>
                <dd class="text-lg font-black text-white tabular-nums">{{ a.efectivoContado | pesos }}</dd>
              </div>
              <div class="rounded-xl p-3 border" [class]="claseDiferencia(a.diferencia)">
                <dt class="text-[11px] uppercase tracking-wider opacity-80">{{ textoDiferencia(a.diferencia) }}</dt>
                <dd class="text-lg font-black tabular-nums">{{ abs(a.diferencia) | pesos }}</dd>
              </div>
            </dl>

            <div class="grid gap-5 md:grid-cols-2">
              <div class="space-y-2">
                <h3 class="text-xs font-bold text-slate-300 uppercase tracking-wider">Efectivo en el cajón</h3>
                <dl class="text-sm space-y-1 tabular-nums">
                  <div class="flex justify-between"><dt class="text-slate-400">Fondo inicial</dt><dd>{{ a.fondoInicial | pesos }}</dd></div>
                  <div class="flex justify-between"><dt class="text-slate-400">Cobros en efectivo</dt><dd>+ {{ efectivoDe(a).monto | pesos }}</dd></div>
                  <div class="flex justify-between"><dt class="text-slate-400">Propinas en efectivo</dt><dd>+ {{ efectivoDe(a).propinas | pesos }}</dd></div>
                  <div class="flex justify-between"><dt class="text-slate-400">Cortes de repartidores</dt><dd>+ {{ a.totalCortes | pesos }}</dd></div>
                  <div class="flex justify-between"><dt class="text-slate-400">Entradas</dt><dd>+ {{ a.entradas | pesos }}</dd></div>
                  <div class="flex justify-between"><dt class="text-slate-400">Salidas</dt><dd>− {{ a.salidas | pesos }}</dd></div>
                  <div class="flex justify-between border-t border-slate-800 pt-1 font-bold text-white"><dt>Debía haber</dt><dd>{{ a.efectivoEsperado | pesos }}</dd></div>
                </dl>
              </div>

              <div class="space-y-2">
                <h3 class="text-xs font-bold text-slate-300 uppercase tracking-wider">Ventas por método · {{ a.cuentasCobradas }} {{ a.cuentasCobradas === 1 ? 'cuenta' : 'cuentas' }}</h3>
                @if (a.ventasPorMetodo.length === 0) {
                  <p class="text-sm text-slate-500">No se cobró ninguna cuenta.</p>
                } @else {
                  <table class="w-full text-sm tabular-nums">
                    <tbody class="divide-y divide-slate-800">
                      @for (v of a.ventasPorMetodo; track v.metodo) {
                        <tr>
                          <td class="py-1 text-slate-300">{{ v.metodo }} <span class="text-[11px] text-slate-500">({{ v.cobros }})</span></td>
                          <td class="py-1 text-right">{{ v.monto | pesos }}</td>
                          <td class="py-1 text-right text-[11px] text-slate-400">{{ v.propinas > 0 ? '+ ' + (v.propinas | pesos) + ' prop.' : '' }}</td>
                        </tr>
                      }
                      <tr class="font-bold text-white">
                        <td class="py-1">Total</td>
                        <td class="py-1 text-right">{{ a.totalVentas | pesos }}</td>
                        <td class="py-1 text-right text-[11px]">{{ a.totalPropinas > 0 ? '+ ' + (a.totalPropinas | pesos) + ' prop.' : '' }}</td>
                      </tr>
                    </tbody>
                  </table>
                  <p class="text-[11px] text-slate-500">Lo que no es efectivo (tarjeta, transferencia) se revisa contra los vouchers y el banco.</p>
                }
              </div>
            </div>

            @if (a.movimientos.length || a.cortes.length) {
              <div class="grid gap-5 md:grid-cols-2">
                @if (a.movimientos.length) {
                  <div class="space-y-1">
                    <h3 class="text-xs font-bold text-slate-300 uppercase tracking-wider">Entradas y salidas</h3>
                    <ul class="text-sm divide-y divide-slate-800">
                      @for (m of a.movimientos; track m.id) {
                        <li class="flex justify-between gap-2 py-1">
                          <span class="text-slate-300 min-w-0 truncate">{{ m.creadoEn | date: 'HH:mm' }} · {{ m.concepto }}</span>
                          <span class="tabular-nums shrink-0" [class]="m.tipo === 'SALIDA' ? 'text-rose-300' : 'text-emerald-300'">{{ m.tipo === 'SALIDA' ? '−' : '+' }} {{ m.monto | pesos }}</span>
                        </li>
                      }
                    </ul>
                  </div>
                }
                @if (a.cortes.length) {
                  <div class="space-y-1">
                    <h3 class="text-xs font-bold text-slate-300 uppercase tracking-wider">Cortes de repartidores</h3>
                    <ul class="text-sm divide-y divide-slate-800">
                      @for (c of a.cortes; track c.corteId) {
                        <li class="flex justify-between gap-2 py-1">
                          <span class="text-slate-300">{{ c.creadoEn | date: 'HH:mm' }} · {{ c.repartidor || 'Repartidor' }} ({{ c.entregas }})</span>
                          <span class="tabular-nums">{{ c.recibido | pesos }}</span>
                        </li>
                      }
                    </ul>
                  </div>
                }
              </div>
            }

            @if (a.conteo) {
              <div class="space-y-1">
                <h3 class="text-xs font-bold text-slate-300 uppercase tracking-wider">Conteo</h3>
                <p class="text-sm text-slate-300 tabular-nums">
                  @for (d of conteoDe(a); track d.etiqueta; let ultimo = $last) {
                    {{ d.piezas }} × {{ d.etiqueta }}{{ ultimo ? '' : ' · ' }}
                  }
                </p>
              </div>
            }
            @if (a.notas) {
              <p class="text-sm text-amber-300/90">Nota: {{ a.notas }}</p>
            }
          </section>
        }

        <!-- ============================== CAJA CERRADA: ABRIR -->
        @if (!estado()) {
          <section class="max-w-md rounded-2xl border border-slate-800 bg-slate-900/40 p-5 space-y-4">
            <div>
              <h2 class="text-sm font-bold text-white">La caja está cerrada</h2>
              <p class="text-xs text-slate-400 mt-0.5">Mientras esté cerrada no se pueden cobrar mesas ni recibir cortes de repartidores.</p>
            </div>
            <div>
              <label for="fondo" class="block text-[11px] text-slate-400 uppercase tracking-wider mb-1">Fondo inicial (efectivo con el que abres)</label>
              <input id="fondo" type="number" min="0" step="0.5" inputmode="decimal" [(ngModel)]="fondo"
                class="w-full bg-slate-950 border border-slate-800 rounded-lg py-2.5 px-3 text-white outline-none focus:border-indigo-500 tabular-nums" />
            </div>
            <button type="button" (click)="abrir()" [disabled]="enviando() || fondo === null || fondo < 0"
              class="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
              {{ enviando() ? 'Abriendo...' : 'Abrir caja' }}
            </button>
          </section>
        } @else {
          @let e = estado()!;
          <!-- ============================== CAJA ABIERTA -->
          <section class="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p class="text-sm font-bold text-emerald-300">Caja abierta</p>
                <p class="text-xs text-slate-400">Desde las {{ e.abiertoEn | date: 'HH:mm' }} ({{ e.abiertoEn | date: 'dd/MM' }}){{ e.abiertoPor ? ' · ' + e.abiertoPor : '' }}</p>
              </div>
              <dl class="flex gap-5 text-center">
                <div><dt class="text-[11px] text-slate-500 uppercase tracking-wider">Fondo</dt><dd class="font-bold text-white tabular-nums">{{ e.fondoInicial | pesos }}</dd></div>
                <div><dt class="text-[11px] text-slate-500 uppercase tracking-wider">Cuentas</dt><dd class="font-bold text-white tabular-nums">{{ e.cuentasCobradas }}</dd></div>
                <div><dt class="text-[11px] text-slate-500 uppercase tracking-wider">Cortes</dt><dd class="font-bold text-white tabular-nums">{{ e.cortesRecibidos }}</dd></div>
              </dl>
            </div>
          </section>

          <div class="grid gap-6 lg:grid-cols-2">
            <!-- Entradas y salidas -->
            <section class="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 space-y-4">
              <div>
                <h2 class="text-sm font-bold text-white">Entradas y salidas de efectivo</h2>
                <p class="text-xs text-slate-400 mt-0.5">Lo que entra o sale del cajón sin ser venta: cambio que traes, retiros, gastos, propinas que repartes.</p>
              </div>
              <div class="flex gap-1" role="group" aria-label="Tipo de movimiento">
                <button type="button" (click)="tipoMovimiento.set('SALIDA')" [attr.aria-pressed]="tipoMovimiento() === 'SALIDA'"
                  class="flex-1 py-2 rounded-lg text-xs font-bold cursor-pointer"
                  [class]="tipoMovimiento() === 'SALIDA' ? 'bg-rose-600 text-white' : 'bg-slate-950 text-slate-400 border border-slate-800'">Sale</button>
                <button type="button" (click)="tipoMovimiento.set('ENTRADA')" [attr.aria-pressed]="tipoMovimiento() === 'ENTRADA'"
                  class="flex-1 py-2 rounded-lg text-xs font-bold cursor-pointer"
                  [class]="tipoMovimiento() === 'ENTRADA' ? 'bg-emerald-600 text-white' : 'bg-slate-950 text-slate-400 border border-slate-800'">Entra</button>
              </div>
              <div class="flex flex-wrap gap-2">
                <input type="number" min="0" step="0.5" inputmode="decimal" [(ngModel)]="montoMovimiento" placeholder="Monto" aria-label="Monto"
                  class="w-28 bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-sm text-white outline-none focus:border-indigo-500 tabular-nums" />
                <input type="text" maxlength="200" [(ngModel)]="conceptoMovimiento" placeholder="Concepto (ej. pago del gas)" aria-label="Concepto"
                  class="flex-1 min-w-40 bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-sm text-white outline-none focus:border-indigo-500" />
                <button type="button" (click)="registrarMovimiento()"
                  [disabled]="enviando() || !montoMovimiento || montoMovimiento <= 0 || !conceptoMovimiento.trim()"
                  class="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
                  Registrar
                </button>
              </div>
              @if (e.movimientos.length === 0) {
                <p class="text-sm text-slate-500">Sin movimientos en este turno.</p>
              } @else {
                <ul class="text-sm divide-y divide-slate-800">
                  @for (m of e.movimientos; track m.id) {
                    <li class="flex justify-between gap-2 py-1.5">
                      <span class="min-w-0 text-slate-300">
                        {{ m.creadoEn | date: 'HH:mm' }} · {{ m.concepto }}
                        @if (m.por) { <span class="text-[11px] text-slate-500">({{ m.por }})</span> }
                      </span>
                      <span class="tabular-nums shrink-0 font-semibold" [class]="m.tipo === 'SALIDA' ? 'text-rose-300' : 'text-emerald-300'">{{ m.tipo === 'SALIDA' ? '−' : '+' }} {{ m.monto | pesos }}</span>
                    </li>
                  }
                </ul>
              }
            </section>

            <!-- Cierre a ciegas -->
            <section class="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 space-y-4">
              <div>
                <h2 class="text-sm font-bold text-white">Cerrar caja</h2>
                <p class="text-xs text-slate-400 mt-0.5">Cuenta el efectivo del cajón. Cuánto debía haber lo ves después de cerrar.</p>
              </div>
              <label class="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input type="checkbox" [ngModel]="soloTotal()" (ngModelChange)="soloTotal.set($event)" class="accent-indigo-500" />
                Capturar solo el total
              </label>
              @if (soloTotal()) {
                <input type="number" min="0" step="0.5" inputmode="decimal" [ngModel]="totalCapturado()" (ngModelChange)="totalCapturado.set($event)" placeholder="Total contado" aria-label="Total contado"
                  class="w-full bg-slate-950 border border-slate-800 rounded-lg py-2.5 px-3 text-white outline-none focus:border-indigo-500 tabular-nums" />
              } @else {
                <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  @for (d of denominaciones; track d.valor) {
                    <label class="flex items-center gap-2 rounded-lg bg-slate-950/60 border border-slate-800 px-2 py-1.5">
                      <span class="w-12 text-xs font-bold text-slate-300 tabular-nums">{{ d.etiqueta }}</span>
                      <span class="text-slate-600 text-xs">×</span>
                      <input type="number" min="0" step="1" inputmode="numeric" [attr.aria-label]="'Piezas de ' + d.etiqueta"
                        [ngModel]="piezas()[d.valor] || null" (ngModelChange)="fijarPiezas(d.valor, $event)"
                        class="w-full min-w-0 bg-transparent text-sm text-white outline-none tabular-nums text-right" placeholder="0" />
                    </label>
                  }
                </div>
              }
              <p class="flex justify-between text-sm font-bold text-white tabular-nums border-t border-slate-800 pt-2">
                <span>Contaste</span><span>{{ contado() | pesos }}</span>
              </p>
              <input type="text" maxlength="500" [(ngModel)]="notasCierre" placeholder="Nota (opcional)" aria-label="Nota del cierre"
                class="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-sm text-white outline-none focus:border-indigo-500" />
              <button type="button" (click)="cerrar()" [disabled]="enviando() || !hayConteo()"
                class="w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-bold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
                {{ enviando() ? 'Cerrando...' : 'Cerrar caja con ' + formatear(contado()) }}
              </button>
            </section>
          </div>
        }

        @if (error()) {
          <p class="text-sm text-rose-400" role="alert">{{ error() }}</p>
        }

        <!-- ============================== HISTORIAL -->
        <section class="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 space-y-3 print:hidden">
          <h2 class="text-sm font-bold text-white">Cierres anteriores</h2>
          @if (historial().length === 0) {
            <p class="text-sm text-slate-500">Todavía no hay cierres.</p>
          } @else {
            <div class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead>
                  <tr class="text-[11px] text-slate-500 uppercase tracking-wider text-left">
                    <th class="py-2 pr-3 font-semibold">Cierre</th>
                    <th class="py-2 pr-3 font-semibold">Quién</th>
                    <th class="py-2 pr-3 font-semibold text-right">Debía haber</th>
                    <th class="py-2 pr-3 font-semibold text-right">Se contó</th>
                    <th class="py-2 pr-3 font-semibold text-right">Diferencia</th>
                    <th class="py-2"><span class="sr-only">Ver</span></th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-800">
                  @for (t of historial(); track t.turnoId) {
                    <tr>
                      <td class="py-2 pr-3 text-slate-400 tabular-nums whitespace-nowrap">{{ t.cerradoEn | date: 'dd/MM HH:mm' }}</td>
                      <td class="py-2 pr-3 text-white">{{ t.cerradoPor || '—' }}</td>
                      <td class="py-2 pr-3 text-right tabular-nums">{{ t.efectivoEsperado | pesos }}</td>
                      <td class="py-2 pr-3 text-right tabular-nums">{{ t.efectivoContado | pesos }}</td>
                      <td class="py-2 pr-3 text-right tabular-nums font-bold" [class]="t.diferencia < 0 ? 'text-rose-400' : t.diferencia > 0 ? 'text-amber-300' : 'text-emerald-400'">
                        {{ t.diferencia === 0 ? 'Exacto' : (t.diferencia > 0 ? '+' : '−') + (abs(t.diferencia) | pesos) }}
                      </td>
                      <td class="py-2 text-right">
                        <button type="button" (click)="verArqueo(t.turnoId)" class="text-xs font-bold text-indigo-400 hover:text-indigo-300 cursor-pointer">Ver arqueo</button>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </section>
      }
    </div>
  `,
})
export class CajaComponent {
  private readonly http = inject(HttpClient);
  private readonly avisos = inject(AvisosService);
  private readonly sucursal = inject(SucursalActivaService);

  readonly branchId = computed(() => this.sucursal.branchId());
  readonly denominaciones = DENOMINACIONES;
  readonly abs = Math.abs;
  readonly formatear = formatearPesos;

  readonly cargando = signal(true);
  readonly enviando = signal(false);
  readonly error = signal<string | null>(null);
  readonly estado = signal<EstadoCaja | null>(null);
  readonly historial = signal<TurnoResumen[]>([]);
  readonly arqueo = signal<Arqueo | null>(null);

  fondo: number | null = null;
  readonly tipoMovimiento = signal<'ENTRADA' | 'SALIDA'>('SALIDA');
  montoMovimiento: number | null = null;
  conceptoMovimiento = '';

  readonly soloTotal = signal(false);
  readonly piezas = signal<Record<string, number>>({});
  readonly totalCapturado = signal<number | string | null>(null);
  notasCierre = '';

  readonly contado = computed(() => {
    if (this.soloTotal()) return Number(this.totalCapturado()) || 0;
    return Object.entries(this.piezas()).reduce((s, [valor, n]) => s + Number(valor) * (Number(n) || 0), 0);
  });

  constructor() {
    effect(() => {
      if (this.branchId()) this.cargar();
    });
  }

  private url(ruta = ''): string {
    return `${environment.apiUrl}/branches/${this.branchId()}/caja${ruta}`;
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set(null);
    this.http.get<EstadoCaja | null>(this.url(), { observe: 'response' }).subscribe({
      next: (r) => {
        this.estado.set(r.status === 204 ? null : r.body);
        this.cargando.set(false);
      },
      error: (err) => {
        this.cargando.set(false);
        this.error.set(this.mensaje(err, 'No se pudo cargar la caja.'));
      },
    });
    this.http.get<TurnoResumen[]>(this.url('/turnos')).subscribe({ next: (h) => this.historial.set(h) });
  }

  abrir(): void {
    if (this.fondo === null || this.fondo < 0) return;
    this.enviando.set(true);
    this.http.post<EstadoCaja>(this.url('/abrir'), { fondoInicial: this.fondo }).subscribe({
      next: (e) => {
        this.enviando.set(false);
        this.estado.set(e);
        this.fondo = null;
        this.arqueo.set(null);
        this.avisos.exito('Caja abierta.');
      },
      error: (err) => {
        this.enviando.set(false);
        this.error.set(this.mensaje(err, 'No se pudo abrir la caja.'));
      },
    });
  }

  registrarMovimiento(): void {
    const monto = Number(this.montoMovimiento);
    if (!monto || monto <= 0 || !this.conceptoMovimiento.trim()) return;
    this.enviando.set(true);
    this.http.post<Movimiento>(this.url('/movimientos'), {
      tipo: this.tipoMovimiento(),
      monto,
      concepto: this.conceptoMovimiento.trim(),
    }).subscribe({
      next: (m) => {
        this.enviando.set(false);
        this.estado.update((e) => (e ? { ...e, movimientos: [...e.movimientos, m] } : e));
        this.montoMovimiento = null;
        this.conceptoMovimiento = '';
      },
      error: (err) => {
        this.enviando.set(false);
        this.error.set(this.mensaje(err, 'No se pudo registrar.'));
      },
    });
  }

  fijarPiezas(valor: string, n: unknown): void {
    const piezas = n === null || n === '' ? 0 : Math.max(0, Math.floor(Number(n) || 0));
    this.piezas.update((p) => ({ ...p, [valor]: piezas }));
  }

  /** Ya se capturo algo: piezas o el total (un total de $0 tambien vale). */
  readonly hayConteo = computed(() => {
    if (this.soloTotal()) {
      const t = this.totalCapturado();
      return t !== null && t !== '' && Number(t) >= 0;
    }
    return Object.values(this.piezas()).some((n) => n > 0);
  });

  async cerrar(): Promise<void> {
    if (!this.hayConteo()) return;
    const ok = await this.avisos.confirmar({
      titulo: `¿Cerrar la caja con ${formatearPesos(this.contado())}?`,
      mensaje: 'Después de cerrar ya no se puede cambiar el conteo. Ahí verás cuánto debía haber y la diferencia.',
      confirmar: 'Cerrar caja',
    });
    if (!ok) return;

    const cuerpo = this.soloTotal()
      ? { efectivoContado: Number(this.totalCapturado()), notas: this.notasCierre.trim() || null }
      : { conteo: this.conteoLimpio(), notas: this.notasCierre.trim() || null };

    this.enviando.set(true);
    this.http.post<Arqueo>(this.url('/cerrar'), cuerpo).subscribe({
      next: (a) => {
        this.enviando.set(false);
        this.estado.set(null);
        this.arqueo.set(a);
        this.piezas.set({});
        this.totalCapturado.set(null);
        this.notasCierre = '';
        this.http.get<TurnoResumen[]>(this.url('/turnos')).subscribe({ next: (h) => this.historial.set(h) });
      },
      error: (err) => {
        this.enviando.set(false);
        this.error.set(this.mensaje(err, 'No se pudo cerrar la caja.'));
      },
    });
  }

  verArqueo(turnoId: string): void {
    this.http.get<Arqueo>(this.url(`/turnos/${turnoId}`)).subscribe({
      next: (a) => {
        this.arqueo.set(a);
        // Lo que se desplaza es el <main> del panel, no la ventana.
        document.querySelector('main')?.scrollTo({ top: 0, behavior: 'smooth' });
      },
      error: (err) => this.error.set(this.mensaje(err, 'No se pudo cargar el arqueo.')),
    });
  }

  imprimir(): void {
    window.print();
  }

  efectivoDe(a: Arqueo): { monto: number; propinas: number } {
    return a.ventasPorMetodo
      .filter((v) => v.esEfectivo)
      .reduce((s, v) => ({ monto: s.monto + Number(v.monto), propinas: s.propinas + Number(v.propinas) }), { monto: 0, propinas: 0 });
  }

  conteoDe(a: Arqueo): { etiqueta: string; piezas: number }[] {
    const conteo = a.conteo ?? {};
    return DENOMINACIONES
      .filter((d) => (conteo[d.valor] ?? 0) > 0)
      .map((d) => ({ etiqueta: d.etiqueta, piezas: conteo[d.valor] }));
  }

  textoDiferencia(d: number): string {
    return d === 0 ? 'Cuadra' : d < 0 ? 'Faltan' : 'Sobran';
  }

  claseDiferencia(d: number): string {
    if (d === 0) return 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300';
    return d < 0 ? 'bg-rose-500/10 border-rose-500/30 text-rose-300' : 'bg-amber-500/10 border-amber-500/30 text-amber-300';
  }

  private conteoLimpio(): Record<string, number> {
    return Object.fromEntries(Object.entries(this.piezas()).filter(([, n]) => n > 0));
  }

  private mensaje(err: any, otro: string): string {
    return err?.error?.error || err?.error?.message || otro;
  }
}
