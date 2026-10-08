import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import type { KitchenTicketDTO } from './kitchen.component';
import { COLOR_BARRA, COLOR_TIEMPO, EstadoComanda, Semaforo, estadoDe, etiquetaDe, minutosDe, piezasDe, porHacer, semaforoDe } from './comanda';

interface Columna {
  estado: EstadoComanda;
  nombre: string;
  punto: string;
  comandas: KitchenTicketDTO[];
  semaforo: Record<Semaforo, number>;
}

/**
 * El tablero de cocina para cuando hay muchos pedidos: cada comanda es una
 * fila de una línea (a dónde va, cuántos platillos, resumen y tiempo), la más
 * atrasada arriba. Cada columna dice cuántas hay y cuántas van tarde. Tocar
 * una fila abre la comanda completa.
 */
@Component({
  selector: 'app-tablero-cocina',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    @keyframes resaltar { 0%, 100% { box-shadow: 0 0 0 0 rgba(56, 189, 248, 0); } 50% { box-shadow: 0 0 0 6px rgba(56, 189, 248, .35); } }
    @media (prefers-reduced-motion: reduce) { :host * { animation: none !important; } }
  `],
  template: `
    <div class="grid gap-3 items-start grid-cols-1 md:grid-cols-3 xl:grid-cols-[repeat(3,minmax(0,1fr))_160px]">
      @for (col of columnas(); track col.estado) {
        <section class="rounded-2xl border border-slate-800 bg-slate-900/60 flex flex-col min-w-0 md:max-h-[calc(100dvh-14rem)]" [attr.aria-label]="col.nombre + ': ' + col.comandas.length">
          <header class="px-3 py-2.5 border-b border-slate-800 space-y-1.5">
            <div class="flex items-center justify-between gap-2">
              <h3 class="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-white">
                <span class="w-2.5 h-2.5 rounded-full" [class]="col.punto"></span>{{ col.nombre }}
              </h3>
              <span class="text-2xl font-black tabular-nums text-white">{{ col.comandas.length }}</span>
            </div>
            @if (col.estado !== 'LISTA' && col.comandas.length > 0) {
              <div class="flex flex-wrap gap-1.5 text-[11px] font-bold tabular-nums">
                @if (col.semaforo.rojo) { <span class="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300">{{ col.semaforo.rojo }} tarde</span> }
                @if (col.semaforo.amarillo) { <span class="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">{{ col.semaforo.amarillo }} por vencer</span> }
                @if (col.semaforo.verde) { <span class="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300">{{ col.semaforo.verde }} a tiempo</span> }
              </div>
            }
          </header>
          <div class="flex-1 min-h-0 overflow-y-auto p-1.5 space-y-1.5">
            @for (t of col.comandas; track t.orderId) {
              <button type="button" (click)="ver.emit(t.orderId)"
                class="w-full min-h-[56px] grid grid-cols-[4px_minmax(0,1fr)_auto] items-center gap-2.5 rounded-xl border bg-slate-950/60 pr-2 py-2 text-left cursor-pointer hover:border-slate-600 active:bg-slate-800/60"
                [class]="nuevas.has(t.orderId) ? 'border-sky-400 animate-[resaltar_1.6s_ease-in-out_3]' : 'border-slate-800'"
                [attr.aria-label]="etiqueta(t) + ', ' + piezas(t) + ' platillos' + (col.estado === 'LISTA' ? ', listo' : ', ' + minutos(t) + ' minutos') + '. Ver comanda.'">
                <span class="self-stretch rounded-r" [class]="col.estado === 'LISTA' ? 'bg-emerald-500/60' : barra(t)"></span>
                <span class="min-w-0">
                  <span class="flex items-baseline gap-2">
                    <span class="font-black text-white truncate">{{ etiqueta(t) }}</span>
                    @if (nuevas.has(t.orderId)) {
                      <span class="shrink-0 rounded bg-sky-400 px-1.5 text-[10px] font-black uppercase text-slate-950">Nueva</span>
                    }
                    <span class="shrink-0 text-[11px] text-slate-500 tabular-nums">{{ piezas(t) }} platillos</span>
                  </span>
                  <span class="block text-xs text-slate-400 truncate">
                    @if (tieneNotas(t)) { <span class="text-amber-300 font-bold" title="Lleva notas">⚠ </span> }{{ resumen(t) }}
                  </span>
                </span>
                <span class="flex items-center gap-1.5 shrink-0">
                  @if (col.estado !== 'LISTA') {
                    <span class="px-1.5 py-0.5 rounded-md text-sm font-black tabular-nums" [class]="tiempo(t)">{{ minutos(t) }}′</span>
                  }
                  <span class="text-xs font-bold text-slate-300 border border-slate-700 rounded-lg px-2 py-1.5">Ver</span>
                </span>
              </button>
            } @empty {
              <p class="py-8 text-center text-xs text-slate-600">Nada aquí</p>
            }
          </div>
        </section>
      }
      <!-- Entregados: solo el número; cocina no necesita leerlos -->
      <section class="rounded-2xl border border-slate-800 bg-slate-900/40 px-3 py-2.5 md:col-span-3 xl:col-span-1" aria-label="Entregados">
        <div class="flex items-center justify-between gap-2">
          <h3 class="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-slate-300">
            <span class="w-2.5 h-2.5 rounded-full bg-slate-500"></span>Entregados
          </h3>
          <span class="text-2xl font-black tabular-nums text-slate-300">{{ entregadas }}</span>
        </div>
        <p class="text-[11px] text-slate-500 mt-1">Mesas que siguen abiertas con todo entregado.</p>
      </section>
    </div>
  `,
})
export class TableroCocinaComponent {
  /** Las comandas con algo por hacer. */
  @Input({ required: true }) comandas: KitchenTicketDTO[] = [];
  @Input() entregadas = 0;
  /** Recién llegadas o con ronda nueva: se resaltan un momento. */
  @Input() nuevas: Set<string> = new Set();
  @Input({ required: true }) ahora!: number;
  @Output() ver = new EventEmitter<string>();

  columnas(): Columna[] {
    const defs: { estado: EstadoComanda; nombre: string; punto: string }[] = [
      { estado: 'PENDIENTE', nombre: 'Pendientes', punto: 'bg-slate-400' },
      { estado: 'PREPARANDO', nombre: 'Preparando', punto: 'bg-amber-400' },
      { estado: 'LISTA', nombre: 'Listos', punto: 'bg-emerald-400' },
    ];
    return defs.map((d) => {
      const comandas = this.comandas
        .filter((t) => estadoDe(t) === d.estado)
        .sort((a, b) => minutosDe(b, this.ahora) - minutosDe(a, this.ahora));
      const semaforo: Record<Semaforo, number> = { verde: 0, amarillo: 0, rojo: 0 };
      comandas.forEach((t) => semaforo[semaforoDe(minutosDe(t, this.ahora))]++);
      return { ...d, comandas, semaforo };
    });
  }

  etiqueta = etiquetaDe;
  piezas = (t: KitchenTicketDTO) => piezasDe(porHacer(t));
  minutos = (t: KitchenTicketDTO) => minutosDe(t, this.ahora);
  tiempo = (t: KitchenTicketDTO) => COLOR_TIEMPO[semaforoDe(this.minutos(t))];
  barra = (t: KitchenTicketDTO) => COLOR_BARRA[semaforoDe(this.minutos(t))];

  /** "2 Tacos al pastor · 1 Gringa": lo que se cocina, sin lo ya listo. */
  resumen(t: KitchenTicketDTO): string {
    const items = porHacer(t);
    const pendientes = items.filter((i) => i.kitchenStatus !== 'READY');
    return (pendientes.length ? pendientes : items).map((i) => `${i.quantity} ${i.productName}`).join(' · ');
  }

  tieneNotas(t: KitchenTicketDTO): boolean {
    return porHacer(t).some((i) => !!i.specialInstructions);
  }
}

