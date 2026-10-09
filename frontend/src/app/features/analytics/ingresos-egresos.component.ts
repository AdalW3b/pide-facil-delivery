import { ChangeDetectionStrategy, Component, Input, OnChanges, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { NgxEchartsModule } from 'ngx-echarts';
import type { EChartsOption } from 'echarts';
import { LucideDownload, LucideLoader2 } from '@lucide/angular';
import { environment } from '../../../environments/environment';
import { AvisosService } from '../../core/services/avisos.service';
import { PesosPipe, formatearPesos } from '../../shared/utils/pesos';

interface Concepto {
  nombre: string;
  monto: number;
}

interface Salida {
  fecha: string;
  concepto: string;
  monto: number;
  por: string | null;
  sucursal: string | null;
}

interface Flujo {
  ingresos: { total: number; cuentas: number; porMetodo: Concepto[] };
  egresos: {
    total: number;
    comprasCaja: number;
    comprasTransferencia: number;
    comprasSinFormaPago: number;
    pagosCredito: number;
    gastos: number;
    gastosPorCategoria: Concepto[];
    otrasSalidas: number;
    comisionesLinea?: number;
    reembolsosLinea?: number;
    detalleOtrasSalidas: Salida[];
  };
  resultado: number;
  compradoSinPagar: number;
  propinas: { total: number; enEfectivo: number; otrosMetodos: number; repartidas: number; porMesero: Concepto[] };
  porDia: { fecha: string; ingresos: number; egresos: number }[];
  porProveedor: { proveedor: string; notas: number; comprado: number; pagado: number; debe: number }[];
}

/** Nombre de cada categoría de gasto. */
const CATEGORIAS: Record<string, string> = {
  RENTA: 'Renta', LUZ: 'Luz', AGUA: 'Agua', GAS: 'Gas', NOMINA: 'Nómina', INTERNET: 'Internet y teléfono',
  MANTENIMIENTO: 'Mantenimiento', IMPUESTOS: 'Impuestos', OTRO: 'Otros gastos',
};

const TARJETA = 'p-5 bg-slate-900/90 border border-slate-700/50 rounded-2xl';
const PANEL = 'p-5 sm:p-6 bg-slate-900 border border-slate-700/50 rounded-2xl';
const VACIO = 'py-8 text-center text-xs text-slate-400 italic border border-dashed border-slate-800 rounded-xl';

/**
 * Ingresos y egresos: el dinero que entró (ventas cobradas) contra el que
 * salió (compras, pagos a proveedores y salidas de caja). Las propinas van
 * aparte, para repartirlas entre el personal.
 */
@Component({
  selector: 'app-ingresos-egresos',
  standalone: true,
  imports: [FormsModule, PesosPipe, NgxEchartsModule, LucideDownload, LucideLoader2],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (flujo(); as f) {
      <div class="space-y-6" [class.opacity-60]="cargando()">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <p class="text-sm text-slate-400">{{ etiqueta }} · el dinero que entró y el que salió.</p>
          <button type="button" (click)="exportar()" class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg text-xs font-semibold cursor-pointer">
            <svg lucideDownload class="w-3.5 h-3.5"></svg> Exportar
          </button>
        </div>

        <!-- Totales -->
        <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <div class="${TARJETA}">
            <p class="text-xs font-bold text-slate-400 uppercase tracking-wider">Ingresos</p>
            <p class="mt-2 text-2xl lg:text-3xl font-extrabold text-emerald-400 tabular-nums">{{ f.ingresos.total | pesos }}</p>
            <p class="mt-1 text-xs text-slate-400 tabular-nums">Ventas cobradas · {{ f.ingresos.cuentas }} {{ f.ingresos.cuentas === 1 ? 'cuenta' : 'cuentas' }}</p>
          </div>
          <div class="${TARJETA}">
            <p class="text-xs font-bold text-slate-400 uppercase tracking-wider">Egresos</p>
            <p class="mt-2 text-2xl lg:text-3xl font-extrabold text-rose-400 tabular-nums">{{ f.egresos.total | pesos }}</p>
            <p class="mt-1 text-xs text-slate-400">Compras, gastos y salidas de caja</p>
          </div>
          <div class="${TARJETA}" [class.!border-emerald-500/40]="f.resultado >= 0" [class.!border-rose-500/50]="f.resultado < 0">
            <p class="text-xs font-bold text-slate-400 uppercase tracking-wider">Resultado</p>
            <p class="mt-2 text-2xl lg:text-3xl font-extrabold tabular-nums" [class]="f.resultado >= 0 ? 'text-white' : 'text-rose-300'">{{ f.resultado | pesos }}</p>
            <p class="mt-1 text-xs" [class]="f.resultado >= 0 ? 'text-slate-400' : 'text-rose-300'">{{ f.resultado >= 0 ? 'Entró más de lo que salió' : 'Salió más de lo que entró' }}</p>
          </div>
          <div class="${TARJETA}" [class.!border-amber-500/40]="f.compradoSinPagar > 0">
            <p class="text-xs font-bold text-slate-400 uppercase tracking-wider">Comprado sin pagar</p>
            <p class="mt-2 text-2xl lg:text-3xl font-extrabold tabular-nums" [class]="f.compradoSinPagar > 0 ? 'text-amber-300' : 'text-slate-500'">{{ f.compradoSinPagar | pesos }}</p>
            <p class="mt-1 text-xs text-slate-400">A crédito: será egreso cuando se pague</p>
          </div>
        </div>

        <!-- Por día -->
        <section class="${PANEL}">
          <div class="flex flex-wrap items-center justify-between gap-3 mb-3">
            <h3 class="text-base font-bold text-white">Por día</h3>
            <div class="flex gap-4 text-xs text-slate-400">
              <span class="inline-flex items-center gap-1.5"><i class="w-2.5 h-2.5 rounded-sm bg-emerald-400"></i>Ingresos</span>
              <span class="inline-flex items-center gap-1.5"><i class="w-2.5 h-2.5 rounded-sm bg-rose-400"></i>Egresos</span>
            </div>
          </div>
          @if (f.porDia.length) {
            <div echarts [options]="grafica()" class="h-72 w-full"></div>
          } @else {
            <p class="${VACIO}">No hubo movimientos de dinero en este periodo.</p>
          }
        </section>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <!-- De dónde entró -->
          <section class="${PANEL} space-y-3">
            <h3 class="text-base font-bold text-white">De dónde entró</h3>
            @for (c of f.ingresos.porMetodo; track c.nombre) {
              <div class="space-y-1">
                <div class="flex justify-between gap-3 text-sm"><span class="text-slate-300">{{ c.nombre }}</span><span class="font-semibold text-white tabular-nums">{{ c.monto | pesos }}</span></div>
                <div class="h-1.5 rounded-full bg-slate-800 overflow-hidden"><div class="h-full rounded-full bg-emerald-400" [style.width.%]="pct(c.monto, f.ingresos.total)"></div></div>
              </div>
            } @empty {
              <p class="${VACIO}">No hubo ventas cobradas.</p>
            }
            <div class="flex justify-between border-t border-slate-800 pt-3 text-sm font-bold"><span class="text-slate-300">Total ingresos</span><span class="text-emerald-400 tabular-nums">{{ f.ingresos.total | pesos }}</span></div>
            <p class="text-[11px] text-slate-500">No incluye propinas: van aparte, abajo, para repartirlas.</p>
          </section>

          <!-- En qué salió -->
          <section class="${PANEL} space-y-3">
            <h3 class="text-base font-bold text-white">En qué salió</h3>
            @for (c of conceptosEgreso(); track c.nombre) {
              <div class="space-y-1">
                <div class="flex justify-between gap-3 text-sm"><span class="text-slate-300">{{ c.nombre }}</span><span class="font-semibold text-white tabular-nums">{{ c.monto | pesos }}</span></div>
                <div class="h-1.5 rounded-full bg-slate-800 overflow-hidden"><div class="h-full rounded-full bg-rose-400" [style.width.%]="pct(c.monto, f.egresos.total)"></div></div>
              </div>
            } @empty {
              <p class="${VACIO}">No salió dinero en este periodo.</p>
            }
            <div class="flex justify-between border-t border-slate-800 pt-3 text-sm font-bold"><span class="text-slate-300">Total egresos</span><span class="text-rose-400 tabular-nums">{{ f.egresos.total | pesos }}</span></div>
            <p class="text-[11px] text-slate-500">Las compras a crédito cuentan el día que se pagan. Renta, luz, nómina y demás se registran en Gastos.</p>
            @if (f.egresos.detalleOtrasSalidas.length) {
              <details class="text-xs">
                <summary class="cursor-pointer text-slate-400 hover:text-white">Ver las otras salidas de caja ({{ f.egresos.detalleOtrasSalidas.length }})</summary>
                <ul class="mt-2 divide-y divide-slate-800">
                  @for (s of f.egresos.detalleOtrasSalidas; track $index) {
                    <li class="flex justify-between gap-3 py-1.5">
                      <span class="text-slate-300 min-w-0">{{ s.concepto }} <span class="text-slate-500">· {{ fechaHora(s.fecha) }}{{ s.por ? ' · ' + s.por : '' }}</span></span>
                      <span class="tabular-nums text-white shrink-0">{{ s.monto | pesos }}</span>
                    </li>
                  }
                </ul>
              </details>
            }
          </section>
        </div>

        <!-- Propinas -->
        <section class="${PANEL} space-y-4">
          <div class="flex flex-wrap items-baseline justify-between gap-3">
            <div>
              <h3 class="text-base font-bold text-white">Propinas por repartir</h3>
              <p class="text-xs text-slate-400">Son del personal: no cuentan como ingreso del restaurante.</p>
            </div>
            <p class="text-2xl font-extrabold text-sky-300 tabular-nums">{{ f.propinas.total | pesos }}</p>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div class="rounded-xl bg-slate-950/60 border border-slate-800 p-3">
              <p class="text-[11px] font-bold uppercase tracking-wider text-slate-500">En efectivo</p>
              <p class="text-lg font-bold text-white tabular-nums">{{ f.propinas.enEfectivo | pesos }}</p>
              <p class="text-[11px] text-slate-500">Ya están en el cajón</p>
            </div>
            <div class="rounded-xl bg-slate-950/60 border border-slate-800 p-3">
              <p class="text-[11px] font-bold uppercase tracking-wider text-slate-500">Con tarjeta o transferencia</p>
              <p class="text-lg font-bold text-white tabular-nums">{{ f.propinas.otrosMetodos | pesos }}</p>
              <p class="text-[11px] text-slate-500">Se sacan de la caja para entregarlas</p>
            </div>
            <div class="rounded-xl bg-slate-950/60 border border-slate-800 p-3">
              <p class="text-[11px] font-bold uppercase tracking-wider text-slate-500">Ya repartidas</p>
              <p class="text-lg font-bold tabular-nums" [class]="porRepartir() > 0 ? 'text-amber-300' : 'text-emerald-300'">{{ f.propinas.repartidas | pesos }}</p>
              <p class="text-[11px] text-slate-500">{{ porRepartir() > 0 ? 'Faltan ' + formatear(porRepartir()) : 'Todo repartido' }} · salidas de caja con "propina"</p>
            </div>
          </div>

          <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div class="space-y-2">
              <p class="text-xs font-bold text-slate-400 uppercase tracking-wider">Repartir entre todo el personal</p>
              <div class="flex flex-wrap items-end gap-3">
                <div>
                  <label for="ie-personas" class="block text-[11px] text-slate-400 mb-1">¿Entre cuántas personas?</label>
                  <input id="ie-personas" type="number" min="1" step="1" inputmode="numeric" [ngModel]="personas()" (ngModelChange)="personas.set($event)"
                    class="w-28 bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-sm text-white tabular-nums outline-none focus:border-indigo-500 min-h-[40px]" />
                </div>
                <p class="text-sm text-slate-300 pb-2">a cada quien: <strong class="text-xl text-white tabular-nums">{{ porPersona() | pesos }}</strong></p>
              </div>
              <p class="text-[11px] text-slate-500">Parejo entre meseros, cocina, caja y quien participe. Para dejar registro, saca lo repartido en Caja como salida con el concepto "Propinas".</p>
            </div>
            <div class="space-y-1.5">
              <p class="text-xs font-bold text-slate-400 uppercase tracking-wider">Quién atendió las cuentas</p>
              @for (m of f.propinas.porMesero; track m.nombre) {
                <div class="flex justify-between gap-3 text-sm"><span class="text-slate-300 truncate">{{ m.nombre }}</span><span class="text-white tabular-nums">{{ m.monto | pesos }}</span></div>
              } @empty {
                <p class="text-xs text-slate-500">No hubo propinas en este periodo.</p>
              }
            </div>
          </div>
        </section>

        <!-- Compras por proveedor -->
        <section class="${PANEL}">
          <h3 class="text-base font-bold text-white">Compras por proveedor</h3>
          <p class="text-xs text-slate-400 mb-3">Lo que se compró en el periodo, cuánto ya se pagó y cuánto se le debe.</p>
          @if (f.porProveedor.length) {
            <div class="overflow-x-auto">
              <table class="w-full text-sm min-w-[520px]">
                <thead>
                  <tr class="text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
                    <th class="text-left font-semibold px-2 py-2">Proveedor</th>
                    <th class="text-right font-semibold px-2 py-2">Notas</th>
                    <th class="text-right font-semibold px-2 py-2">Comprado</th>
                    <th class="text-right font-semibold px-2 py-2">Pagado</th>
                    <th class="text-right font-semibold px-2 py-2">Debemos</th>
                  </tr>
                </thead>
                <tbody>
                  @for (p of f.porProveedor; track p.proveedor) {
                    <tr class="border-b border-slate-800/60">
                      <td class="px-2 py-2.5 text-slate-200">{{ p.proveedor }}</td>
                      <td class="px-2 py-2.5 text-right tabular-nums text-slate-300">{{ p.notas }}</td>
                      <td class="px-2 py-2.5 text-right tabular-nums text-white">{{ p.comprado | pesos }}</td>
                      <td class="px-2 py-2.5 text-right tabular-nums text-slate-300">{{ p.pagado | pesos }}</td>
                      <td class="px-2 py-2.5 text-right tabular-nums" [class]="p.debe > 0 ? 'text-amber-300 font-semibold' : 'text-slate-500'">{{ p.debe | pesos }}</td>
                    </tr>
                  }
                </tbody>
                <tfoot>
                  <tr class="font-bold">
                    <td class="px-2 py-2.5 text-slate-300">Total</td>
                    <td class="px-2 py-2.5 text-right tabular-nums text-slate-300">{{ totalProveedores().notas }}</td>
                    <td class="px-2 py-2.5 text-right tabular-nums text-white">{{ totalProveedores().comprado | pesos }}</td>
                    <td class="px-2 py-2.5 text-right tabular-nums text-slate-300">{{ totalProveedores().pagado | pesos }}</td>
                    <td class="px-2 py-2.5 text-right tabular-nums text-amber-300">{{ totalProveedores().debe | pesos }}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          } @else {
            <p class="${VACIO}">No hubo compras en este periodo.</p>
          }
        </section>

        <p class="text-xs text-slate-500">El resultado es el dinero, no la ganancia: la utilidad (ventas menos el costo de recetas) está en la vista Ventas.</p>
      </div>
    } @else {
      <div class="flex items-center justify-center gap-2 py-16 text-sm text-slate-400">
        <svg lucideLoader2 class="w-4 h-4 animate-spin"></svg> Cargando ingresos y egresos…
      </div>
    }
  `,
})
export class IngresosEgresosComponent implements OnChanges {
  private readonly http = inject(HttpClient);
  private readonly avisos = inject(AvisosService);

  /** "?restaurantId=…&branchId=…&startDate=…&endDate=…", la misma consulta que el resto de Reportes. */
  @Input({ required: true }) consulta = '';
  /** Cambia con "Actualizar". */
  @Input() recarga = 0;
  /** "Últimos 7 días", "Del 01/10 al 08/10"… */
  @Input() etiqueta = '';
  /** Para el nombre del archivo exportado. */
  @Input() sufijo = '';

  readonly flujo = signal<Flujo | null>(null);
  readonly cargando = signal(false);
  readonly personas = signal<number | null>(null);
  private pedida = 0;

  readonly conceptosEgreso = computed<Concepto[]>(() => {
    const e = this.flujo()?.egresos;
    if (!e) return [];
    return [
      { nombre: 'Compras pagadas con efectivo de caja', monto: e.comprasCaja },
      { nombre: 'Compras pagadas por transferencia', monto: e.comprasTransferencia },
      { nombre: 'Compras sin forma de pago', monto: e.comprasSinFormaPago },
      { nombre: 'Pagos de compras a crédito', monto: e.pagosCredito },
      ...e.gastosPorCategoria.map((c) => ({ nombre: CATEGORIAS[c.nombre] ?? c.nombre, monto: c.monto })),
      { nombre: 'Otras salidas de caja', monto: e.otrasSalidas },
      { nombre: 'Comisiones de pagos con tarjeta en línea', monto: e.comisionesLinea ?? 0 },
      { nombre: 'Devoluciones de pagos en línea', monto: e.reembolsosLinea ?? 0 },
    ].filter((c) => c.monto > 0);
  });

  readonly porRepartir = computed(() => {
    const p = this.flujo()?.propinas;
    return p ? Math.max(0, p.total - p.repartidas) : 0;
  });

  readonly porPersona = computed(() => {
    const n = Math.floor(Number(this.personas()));
    const total = this.flujo()?.propinas.total ?? 0;
    return n > 0 ? Math.floor((total / n) * 100) / 100 : 0;
  });

  readonly totalProveedores = computed(() => (this.flujo()?.porProveedor ?? []).reduce(
    (t, p) => ({ notas: t.notas + p.notas, comprado: t.comprado + p.comprado, pagado: t.pagado + p.pagado, debe: t.debe + p.debe }),
    { notas: 0, comprado: 0, pagado: 0, debe: 0 },
  ));

  readonly grafica = computed<EChartsOption>(() => {
    const dias = this.flujo()?.porDia ?? [];
    const etiqueta = (iso: string) => {
      const [a, m, d] = iso.split('-').map(Number);
      return new Date(a, m - 1, d).toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' });
    };
    return {
      backgroundColor: 'transparent',
      grid: { left: 8, right: 8, top: 16, bottom: 8, containLabel: true },
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#0f172a',
        borderColor: '#334155',
        textStyle: { color: '#e2e8f0' },
        valueFormatter: (v) => formatearPesos(Number(v)),
      },
      xAxis: {
        type: 'category',
        data: dias.map((d) => etiqueta(d.fecha)),
        axisLabel: { color: '#94a3b8', fontSize: 11 },
        axisLine: { lineStyle: { color: '#334155' } },
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: '#94a3b8', fontSize: 11, formatter: (v: number) => (v >= 1000 ? `${v / 1000}k` : String(v)) },
        splitLine: { lineStyle: { color: '#1e293b' } },
      },
      series: [
        { name: 'Ingresos', type: 'bar', data: dias.map((d) => d.ingresos), itemStyle: { color: '#34d399', borderRadius: [4, 4, 0, 0] }, barMaxWidth: 22 },
        { name: 'Egresos', type: 'bar', data: dias.map((d) => d.egresos), itemStyle: { color: '#fb7185', borderRadius: [4, 4, 0, 0] }, barMaxWidth: 22 },
      ],
    };
  });

  ngOnChanges(): void {
    this.cargar();
  }

  cargar(): void {
    const esta = ++this.pedida;
    this.cargando.set(true);
    this.http.get<Flujo>(`${environment.apiUrl}/analytics/flujo${this.consulta}`).subscribe({
      next: (f) => {
        if (esta !== this.pedida) return;
        this.flujo.set(f);
        this.cargando.set(false);
      },
      error: (err) => {
        if (esta !== this.pedida) return;
        this.cargando.set(false);
        this.avisos.error(err.error?.error || 'No se pudieron cargar los ingresos y egresos.');
      },
    });
  }

  pct(parte: number, total: number): number {
    return total > 0 ? Math.min(100, (parte / total) * 100) : 0;
  }

  formatear(n: number): string {
    return formatearPesos(n);
  }

  fechaHora(iso: string): string {
    return new Date(iso).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  /** CSV que Excel abre con acentos: resumen, por día y por proveedor. */
  exportar(): void {
    const f = this.flujo();
    if (!f) return;
    const n = (v: number) => Number(v).toFixed(2);
    const filas: (string | number)[][] = [
      ['Ingresos y egresos', this.etiqueta],
      [],
      ['Concepto', 'Monto'],
      ...f.ingresos.porMetodo.map((c) => ['Ingreso · ' + c.nombre, n(c.monto)]),
      ['Total ingresos', n(f.ingresos.total)],
      ...this.conceptosEgreso().map((c) => ['Egreso · ' + c.nombre, n(c.monto)]),
      ['Total egresos', n(f.egresos.total)],
      ['Resultado', n(f.resultado)],
      ['Comprado a crédito sin pagar', n(f.compradoSinPagar)],
      ['Propinas (aparte)', n(f.propinas.total)],
      [],
      ['Fecha', 'Ingresos', 'Egresos', 'Resultado'],
      ...f.porDia.map((d) => [d.fecha, n(d.ingresos), n(d.egresos), n(d.ingresos - d.egresos)]),
      [],
      ['Proveedor', 'Notas', 'Comprado', 'Pagado', 'Debemos'],
      ...f.porProveedor.map((p) => [p.proveedor, p.notas, n(p.comprado), n(p.pagado), n(p.debe)]),
    ];
    const celda = (v: string | number | undefined) => {
      const s = v === undefined ? '' : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const texto = '﻿' + filas.map((r) => r.map(celda).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([texto], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `ingresos-y-egresos-${this.sufijo || 'reporte'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
