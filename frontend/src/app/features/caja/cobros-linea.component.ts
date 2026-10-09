import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { DatePipe, TitleCasePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LucideDownload, LucideLoader2, LucideRotateCcw, LucideX } from '@lucide/angular';
import { AvisosService } from '../../core/services/avisos.service';
import { CobroLinea, DetalleCobro, EstadoCobro, PagosLineaService } from '../../core/services/pagos-linea.service';
import { TituloPaginaComponent } from '../../shared/components/titulo-pagina.component';
import { PesosPipe, formatearPesos } from '../../shared/utils/pesos';

const ESTADOS: Record<EstadoCobro, { texto: string; clase: string }> = {
  PAGADO: { texto: 'Pagado', clase: 'bg-emerald-500/15 text-emerald-300' },
  REEMBOLSO_PARCIAL: { texto: 'Devolución parcial', clase: 'bg-indigo-500/15 text-indigo-300' },
  REEMBOLSADO: { texto: 'Devuelto', clase: 'bg-indigo-500/15 text-indigo-300' },
  PENDIENTE: { texto: 'Pendiente', clase: 'bg-slate-700/60 text-slate-300' },
  PROCESANDO: { texto: 'Procesando', clase: 'bg-amber-500/15 text-amber-300' },
  FALLIDO: { texto: 'Rechazado', clase: 'bg-rose-500/15 text-rose-300' },
  CANCELADO: { texto: 'Cancelado', clase: 'bg-slate-700/60 text-slate-400' },
};

function hoy(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function haceDias(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Los pagos con tarjeta del menú en línea: qué se cobró, cuánto se llevaron
 * Stripe y Pide Fácil, cuánto le queda al restaurante, y las devoluciones.
 */
@Component({
  selector: 'app-cobros-linea',
  standalone: true,
  imports: [DatePipe, TitleCasePipe, PesosPipe, TituloPaginaComponent, LucideLoader2, LucideDownload, LucideRotateCcw, LucideX],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-5 text-slate-100 p-2 sm:p-4">
      <app-titulo-pagina titulo="Cobros en línea"
        descripcion="Lo que tus clientes pagaron con tarjeta en el menú en línea. Stripe te lo deposita en tu banco." />

      <!-- Filtros -->
      <div class="flex flex-wrap items-end gap-3">
        <div>
          <label for="cl-desde" class="block text-xs text-slate-400 mb-1">Desde</label>
          <input id="cl-desde" type="date" [value]="desde()" (change)="desde.set($any($event.target).value); cargar()"
            class="rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-white" />
        </div>
        <div>
          <label for="cl-hasta" class="block text-xs text-slate-400 mb-1">Hasta</label>
          <input id="cl-hasta" type="date" [value]="hasta()" (change)="hasta.set($any($event.target).value); cargar()"
            class="rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-white" />
        </div>
        <label class="flex items-center gap-2 text-sm text-slate-300 cursor-pointer pb-2">
          <input type="checkbox" [checked]="todos()" (change)="todos.set($any($event.target).checked); cargar()" class="w-4 h-4 accent-indigo-500" />
          Ver también los no pagados
        </label>
        <input type="search" aria-label="Buscar pedido o tarjeta" placeholder="Buscar pedido o tarjeta…" [value]="busqueda()"
          (input)="busqueda.set($any($event.target).value)"
          class="rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-white min-w-48 flex-1 sm:flex-none" />
        <button type="button" (click)="exportar()" [disabled]="!visibles().length"
          class="ml-auto inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-700 text-sm text-slate-200 hover:border-indigo-500 cursor-pointer disabled:opacity-50">
          <svg lucideDownload class="w-4 h-4"></svg> Exportar a Excel
        </button>
      </div>

      <!-- Totales -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div class="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
          <p class="text-xs text-slate-400">Cobrado</p>
          <p class="text-2xl font-black tabular-nums">{{ totales().cobrado | pesos }}</p>
          <p class="text-[11px] text-slate-500">{{ totales().pagos }} pago(s)</p>
        </div>
        <div class="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
          <p class="text-xs text-slate-400">Comisiones</p>
          <p class="text-2xl font-black tabular-nums text-amber-300">{{ totales().comisiones | pesos }}</p>
          <p class="text-[11px] text-slate-500">Stripe y Pide Fácil</p>
        </div>
        <div class="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
          <p class="text-xs text-slate-400">Devuelto</p>
          <p class="text-2xl font-black tabular-nums text-indigo-300">{{ totales().devuelto | pesos }}</p>
        </div>
        <div class="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
          <p class="text-xs text-slate-400">Te queda</p>
          <p class="text-2xl font-black tabular-nums text-emerald-300">{{ totales().neto | pesos }}</p>
        </div>
      </div>

      <!-- Lista -->
      @if (cargando()) {
        <div class="flex items-center gap-2 text-sm text-slate-400"><svg lucideLoader2 class="w-4 h-4 animate-spin"></svg> Cargando…</div>
      } @else if (error()) {
        <p class="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-300" role="alert">{{ error() }}</p>
      } @else if (!visibles().length) {
        <p class="rounded-2xl border border-dashed border-slate-700 p-8 text-center text-sm text-slate-400">
          No hay pagos con tarjeta en estas fechas.
        </p>
      } @else {
        <div class="overflow-x-auto rounded-2xl border border-slate-800">
          <table class="w-full text-sm min-w-[760px]">
            <thead class="bg-slate-900/60 text-xs text-slate-400 text-left">
              <tr>
                <th class="px-4 py-2.5 font-semibold">Fecha</th>
                <th class="px-4 py-2.5 font-semibold">Pedido</th>
                <th class="px-4 py-2.5 font-semibold">Tarjeta</th>
                <th class="px-4 py-2.5 font-semibold">Estado</th>
                <th class="px-4 py-2.5 font-semibold text-right">Cobrado</th>
                <th class="px-4 py-2.5 font-semibold text-right">Comisiones</th>
                <th class="px-4 py-2.5 font-semibold text-right">Te queda</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-800">
              @for (c of visibles(); track c.id) {
                <tr (click)="abrir(c)" class="hover:bg-slate-800/40 cursor-pointer">
                  <td class="px-4 py-2.5 text-slate-300 whitespace-nowrap">{{ c.creadoEn | date: 'd MMM, HH:mm' }}</td>
                  <td class="px-4 py-2.5">
                    <span class="font-semibold text-white">{{ c.pedido ?? '—' }}</span>
                    @if (c.sucursal) { <span class="block text-[11px] text-slate-500">{{ c.sucursal }}</span> }
                  </td>
                  <td class="px-4 py-2.5 text-slate-300">{{ c.marca ? (c.marca | titlecase) : '' }}{{ c.ultimos4 ? ' •••• ' + c.ultimos4 : '—' }}</td>
                  <td class="px-4 py-2.5"><span class="rounded-full px-2 py-0.5 text-[11px] font-bold" [class]="estado(c.estado).clase">{{ estado(c.estado).texto }}</span></td>
                  <td class="px-4 py-2.5 text-right tabular-nums">{{ c.monto | pesos }}</td>
                  <td class="px-4 py-2.5 text-right tabular-nums text-slate-400">{{ comisiones(c) | pesos }}</td>
                  <td class="px-4 py-2.5 text-right tabular-nums font-semibold text-emerald-300">{{ c.neto | pesos }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      <!-- Detalle -->
      @if (detalle(); as d) {
        <div class="fixed inset-0 z-40 bg-black/50" (click)="cerrar()" aria-hidden="true"></div>
        <aside role="dialog" aria-modal="true" aria-label="Detalle del pago"
          class="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-slate-950 border-l border-slate-800 overflow-y-auto p-5 space-y-5">
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="text-xs text-slate-400">Pedido {{ d.cobro.pedido ?? '' }}</p>
              <p class="text-2xl font-black tabular-nums">{{ d.cobro.monto | pesos }}</p>
              <span class="rounded-full px-2 py-0.5 text-[11px] font-bold" [class]="estado(d.cobro.estado).clase">{{ estado(d.cobro.estado).texto }}</span>
            </div>
            <button type="button" (click)="cerrar()" aria-label="Cerrar" class="p-2 rounded-lg hover:bg-slate-800 cursor-pointer">
              <svg lucideX class="w-5 h-5"></svg>
            </button>
          </div>

          <dl class="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div><dt class="text-xs text-slate-500">Fecha</dt><dd>{{ (d.cobro.pagadoEn ?? d.cobro.creadoEn) | date: 'd MMM y, HH:mm' }}</dd></div>
            <div><dt class="text-xs text-slate-500">Tarjeta</dt><dd>{{ d.cobro.marca ? (d.cobro.marca | titlecase) : '—' }}{{ d.cobro.ultimos4 ? ' •••• ' + d.cobro.ultimos4 : '' }}</dd></div>
            <div><dt class="text-xs text-slate-500">Cliente</dt><dd>{{ d.cobro.cliente ?? '—' }}</dd></div>
            <div><dt class="text-xs text-slate-500">Sucursal</dt><dd>{{ d.cobro.sucursal ?? '—' }}</dd></div>
            <div><dt class="text-xs text-slate-500">Propina</dt><dd class="tabular-nums">{{ d.cobro.propina | pesos }}</dd></div>
            <div><dt class="text-xs text-slate-500">Comisión de Stripe</dt><dd class="tabular-nums">{{ d.cobro.comisionStripe !== null ? (d.cobro.comisionStripe | pesos) : '—' }}</dd></div>
            @if (d.cobro.comisionPlataforma > 0) {
              <div><dt class="text-xs text-slate-500">Comisión de Pide Fácil</dt><dd class="tabular-nums">{{ d.cobro.comisionPlataforma | pesos }}</dd></div>
            }
            <div><dt class="text-xs text-slate-500">Te queda</dt><dd class="tabular-nums font-bold text-emerald-300">{{ d.cobro.neto | pesos }}</dd></div>
            <div class="col-span-2"><dt class="text-xs text-slate-500">Referencia en Stripe</dt><dd class="font-mono text-xs text-slate-400 [overflow-wrap:anywhere]">{{ d.paymentIntentId }}</dd></div>
            @if (d.cobro.error) {
              <div class="col-span-2"><dt class="text-xs text-slate-500">Motivo</dt><dd class="text-rose-300">{{ d.cobro.error }}</dd></div>
            }
          </dl>

          @if (d.reembolsos.length) {
            <section class="space-y-2">
              <h3 class="text-sm font-bold">Devoluciones</h3>
              <ul class="divide-y divide-slate-800 text-sm rounded-xl border border-slate-800">
                @for (r of d.reembolsos; track r.id) {
                  <li class="px-3 py-2 flex flex-wrap justify-between gap-2">
                    <span>
                      <span class="tabular-nums font-semibold">{{ r.monto | pesos }}</span>
                      <span class="text-xs text-slate-500"> · {{ r.creadoEn | date: 'd MMM, HH:mm' }} · {{ r.hechoPor }}</span>
                      @if (r.motivo) { <span class="block text-xs text-slate-400">{{ r.motivo }}</span> }
                    </span>
                    @if (r.estado !== 'HECHO') { <span class="text-xs text-rose-300">{{ r.estado === 'FALLIDO' ? 'Falló' : 'Pendiente' }}</span> }
                  </li>
                }
              </ul>
            </section>
          }

          @if (d.puedeReembolsar && d.reembolsable > 0) {
            <section class="space-y-3 rounded-2xl border border-slate-800 p-4">
              <h3 class="text-sm font-bold">Devolver al cliente</h3>
              <p class="text-xs text-slate-400">Stripe lo regresa a la misma tarjeta; el cliente lo ve en 5 a 10 días. La comisión de Stripe no se recupera.</p>
              <div>
                <label for="cl-monto" class="block text-xs text-slate-400 mb-1">Monto (vacío = todo, {{ d.reembolsable | pesos }})</label>
                <input id="cl-monto" type="number" inputmode="decimal" min="0" [max]="d.reembolsable" step="0.01" [value]="montoReembolso() ?? ''"
                  (input)="montoReembolso.set($any($event.target).value === '' ? null : +$any($event.target).value)"
                  class="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-white" />
              </div>
              <div>
                <label for="cl-motivo" class="block text-xs text-slate-400 mb-1">Motivo</label>
                <input id="cl-motivo" type="text" maxlength="300" placeholder="Ej. Se acabó un platillo" [value]="motivoReembolso()"
                  (input)="motivoReembolso.set($any($event.target).value)"
                  class="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-white" />
              </div>
              <button type="button" (click)="reembolsar(d)" [disabled]="reembolsando()"
                class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-sm font-bold cursor-pointer disabled:opacity-50">
                @if (reembolsando()) { <svg lucideLoader2 class="w-4 h-4 animate-spin"></svg> } @else { <svg lucideRotateCcw class="w-4 h-4"></svg> }
                Devolver {{ (montoReembolso() ?? d.reembolsable) | pesos }}
              </button>
            </section>
          }
        </aside>
      }
    </div>
  `,
})
export class CobrosLineaComponent {
  private readonly servicio = inject(PagosLineaService);
  private readonly avisos = inject(AvisosService);
  private readonly destroyRef = inject(DestroyRef);

  readonly desde = signal(haceDias(30));
  readonly hasta = signal(hoy());
  readonly todos = signal(false);
  readonly busqueda = signal('');
  readonly cobros = signal<CobroLinea[]>([]);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);

  readonly detalle = signal<DetalleCobro | null>(null);
  readonly montoReembolso = signal<number | null>(null);
  readonly motivoReembolso = signal('');
  readonly reembolsando = signal(false);

  readonly visibles = computed(() => {
    const q = this.busqueda().trim().toLowerCase();
    if (!q) return this.cobros();
    return this.cobros().filter((c) =>
      [c.pedido, c.ultimos4, c.marca, c.cliente, c.sucursal].some((v) => v?.toLowerCase().includes(q)));
  });

  readonly totales = computed(() => {
    const cobrados = this.visibles().filter((c) => ['PAGADO', 'REEMBOLSADO', 'REEMBOLSO_PARCIAL'].includes(c.estado));
    const suma = (f: (c: CobroLinea) => number) => cobrados.reduce((s, c) => s + f(c), 0);
    return {
      pagos: cobrados.length,
      cobrado: suma((c) => c.monto),
      comisiones: suma((c) => this.comisiones(c)),
      devuelto: suma((c) => c.montoReembolsado),
      neto: suma((c) => c.neto),
    };
  });

  constructor() {
    this.cargar();
  }

  estado(e: EstadoCobro): { texto: string; clase: string } {
    return ESTADOS[e];
  }

  comisiones(c: CobroLinea): number {
    return (c.comisionStripe ?? 0) + (c.comisionPlataforma ?? 0);
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set(null);
    this.servicio.cobros(this.desde(), this.hasta(), this.todos()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (lista) => { this.cobros.set(lista); this.cargando.set(false); },
      error: (err) => { this.error.set(this.mensaje(err)); this.cargando.set(false); },
    });
  }

  abrir(c: CobroLinea): void {
    this.montoReembolso.set(null);
    this.motivoReembolso.set('');
    this.servicio.detalleCobro(c.id).subscribe({
      next: (d) => this.detalle.set(d),
      error: (err) => this.avisos.error(this.mensaje(err)),
    });
  }

  cerrar(): void {
    this.detalle.set(null);
  }

  async reembolsar(d: DetalleCobro): Promise<void> {
    const monto = this.montoReembolso();
    const cuanto = monto ?? d.reembolsable;
    if (cuanto <= 0 || cuanto > d.reembolsable) {
      this.avisos.error(`El monto va de $0.01 a ${formatearPesos(d.reembolsable)}.`);
      return;
    }
    const si = await this.avisos.confirmar({
      titulo: `¿Devolver ${formatearPesos(cuanto)} al cliente?`,
      mensaje: 'Stripe lo regresa a su tarjeta. No se puede deshacer.',
      confirmar: 'Devolver',
      peligro: true,
    });
    if (!si) return;
    this.reembolsando.set(true);
    this.servicio.reembolsar(d.cobro.id, monto, this.motivoReembolso().trim()).subscribe({
      next: (nuevo) => {
        this.reembolsando.set(false);
        this.detalle.set(nuevo);
        this.cobros.update((lista) => lista.map((c) => (c.id === nuevo.cobro.id ? nuevo.cobro : c)));
        this.montoReembolso.set(null);
        this.motivoReembolso.set('');
        this.avisos.exito('Devolución hecha.');
      },
      error: (err) => { this.reembolsando.set(false); this.avisos.error(this.mensaje(err)); },
    });
  }

  /** CSV que abre Excel con acentos (BOM) y columnas separadas por coma. */
  exportar(): void {
    const celda = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const filas = [
      ['Fecha', 'Pedido', 'Sucursal', 'Tarjeta', 'Estado', 'Cobrado', 'Propina', 'Comisión Stripe', 'Comisión Pide Fácil', 'Devuelto', 'Te queda'],
      ...this.visibles().map((c) => [
        c.creadoEn.replace('T', ' ').slice(0, 16), c.pedido, c.sucursal,
        `${c.marca ?? ''} ${c.ultimos4 ?? ''}`.trim(), ESTADOS[c.estado].texto,
        c.monto, c.propina, c.comisionStripe ?? '', c.comisionPlataforma, c.montoReembolsado, c.neto,
      ]),
    ];
    const csv = '﻿' + filas.map((f) => f.map(celda).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `cobros-en-linea_${this.desde()}_${this.hasta()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  private mensaje(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      return err.error?.message ?? err.error?.error ?? 'No se pudo completar. Intenta de nuevo.';
    }
    return 'No se pudo completar. Intenta de nuevo.';
  }
}
