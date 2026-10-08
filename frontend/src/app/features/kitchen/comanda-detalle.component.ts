import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import { LucideX } from '@lucide/angular';
import type { KitchenItemStatus, KitchenTicketDTO, KitchenTicketItemDTO } from './kitchen.component';
import { COLOR_TIEMPO, estadoDe, etiquetaDe, minutosDe, nombreEstado, piezasDe, porHacer, rondasDe, semaforoDe, tipoDe } from './comanda';

/**
 * La comanda completa en una ventana: todo lo que lleva, por rondas, con su
 * estado. Tocar un renglón lo avanza; abajo, la acción para toda la comanda.
 * Se cierra con Esc, con la X o tocando fuera.
 */
@Component({
  selector: 'app-comanda-detalle',
  standalone: true,
  imports: [LucideX],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'cerrar.emit()' },
  template: `
    <div class="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-3 sm:p-6" (click)="cerrar.emit()">
      <div class="w-full max-w-xl max-h-full flex flex-col rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden"
        role="dialog" aria-modal="true" aria-labelledby="comanda-titulo" (click)="$event.stopPropagation()">
        <header class="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-800">
          <div class="min-w-0">
            <h2 id="comanda-titulo" class="text-2xl sm:text-3xl font-black text-white leading-tight truncate">{{ etiqueta() }}</h2>
            <p class="text-xs text-slate-400 mt-1 tabular-nums">
              {{ tipoTexto() }} · {{ piezas() }} {{ piezas() === 1 ? 'platillo' : 'platillos' }}
              @if (estado() !== 'LISTA') { · <span class="font-bold px-1.5 py-0.5 rounded" [class]="claseTiempo()">{{ minutos() }} min esperando</span> }
            </p>
          </div>
          <button #cerrarBtn type="button" (click)="cerrar.emit()" class="w-11 h-11 shrink-0 rounded-xl border border-slate-700 text-slate-300 hover:text-white flex items-center justify-center cursor-pointer" aria-label="Cerrar comanda">
            <svg lucideX class="w-5 h-5"></svg>
          </button>
        </header>

        <div class="flex-1 min-h-0 overflow-y-auto px-3 py-2">
          @for (r of rondas(); track r.numero) {
            @if (rondas().length > 1) {
              <p class="flex items-center gap-2 px-2 pt-3 pb-1 text-xs font-bold uppercase tracking-wider" [class]="r.nueva ? 'text-amber-300' : 'text-slate-500'">
                <span class="h-px flex-1" [class]="r.nueva ? 'bg-amber-400/40' : 'bg-slate-800'"></span>
                Ronda {{ r.numero }}{{ r.nueva ? ' · nuevo' : '' }}
                <span class="h-px flex-1" [class]="r.nueva ? 'bg-amber-400/40' : 'bg-slate-800'"></span>
              </p>
            }
            @for (item of r.items; track item.itemId) {
              <div class="flex items-stretch gap-1">
                <button type="button" (click)="avanzarItem.emit(item)"
                  class="flex-1 min-w-0 text-left flex items-start gap-3 px-2 py-3 rounded-xl hover:bg-slate-800/60 active:bg-slate-800 cursor-pointer"
                  [attr.aria-label]="item.quantity + ' ' + item.productName + ', ' + estadoTexto(item.kitchenStatus) + '. Tocar para avanzar.'">
                  <span class="w-9 shrink-0 text-right text-3xl font-black leading-none tabular-nums" [class]="item.kitchenStatus === 'READY' ? 'text-emerald-500/50' : 'text-white'">{{ item.quantity }}</span>
                  <span class="min-w-0 flex-1">
                    <span class="block text-lg font-bold leading-snug" [class]="item.kitchenStatus === 'READY' ? 'text-slate-500 line-through' : 'text-white'">{{ item.productName }}</span>
                    @for (a of item.adicionales ?? []; track a) {
                      <span class="block text-sm font-semibold text-sky-300">+ {{ a }}</span>
                    }
                    @if (item.specialInstructions) {
                      <span class="mt-1 inline-block text-sm font-bold text-amber-200 bg-amber-500/15 rounded px-1.5">⚠ {{ item.specialInstructions }}</span>
                    }
                  </span>
                  <span class="shrink-0 self-center text-[11px] font-bold uppercase tracking-wide px-2 py-1 rounded-md" [class]="claseEstado(item.kitchenStatus)">{{ estadoTexto(item.kitchenStatus) }}</span>
                </button>
                <button type="button" (click)="cancelarItem.emit(item)" class="px-2 text-slate-600 hover:text-rose-400 cursor-pointer" [attr.aria-label]="'Cancelar ' + item.productName">
                  <svg lucideX class="w-4 h-4"></svg>
                </button>
              </div>
            }
          } @empty {
            <p class="py-10 text-center text-sm text-slate-500">Esta comanda ya se entregó.</p>
          }
        </div>

        <footer class="grid grid-cols-2 gap-2 p-3 border-t border-slate-800">
          @if (estado() === 'PENDIENTE' || estado() === 'PREPARANDO') {
            <button type="button" (click)="cambiarTodo.emit({ de: ['PENDING'], a: 'PREPARING' })" [disabled]="!hayPendientes()"
              class="min-h-[52px] rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-200 font-bold cursor-pointer hover:bg-amber-500/25 disabled:opacity-40 disabled:cursor-not-allowed">Empezar</button>
            <button type="button" (click)="cambiarTodo.emit({ de: ['PENDING', 'PREPARING'], a: 'READY' }); cerrar.emit()"
              class="min-h-[52px] rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer">Todo listo</button>
          } @else if (estado() === 'LISTA') {
            <button type="button" (click)="cerrar.emit()" class="min-h-[52px] rounded-xl border border-slate-700 text-slate-200 font-bold cursor-pointer">Cerrar</button>
            <button type="button" (click)="cambiarTodo.emit({ de: ['READY'], a: 'DELIVERED' }); cerrar.emit()"
              class="min-h-[52px] rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-bold cursor-pointer">Entregado</button>
          } @else {
            <button type="button" (click)="cerrar.emit()" class="col-span-2 min-h-[52px] rounded-xl border border-slate-700 text-slate-200 font-bold cursor-pointer">Cerrar</button>
          }
        </footer>
      </div>
    </div>
  `,
})
export class ComandaDetalleComponent implements AfterViewInit {
  @Input({ required: true }) ticket!: KitchenTicketDTO;
  @Input({ required: true }) ahora!: number;
  @Output() avanzarItem = new EventEmitter<KitchenTicketItemDTO>();
  @Output() cancelarItem = new EventEmitter<KitchenTicketItemDTO>();
  @Output() cambiarTodo = new EventEmitter<{ de: KitchenItemStatus[]; a: KitchenItemStatus }>();
  @Output() cerrar = new EventEmitter<void>();
  @ViewChild('cerrarBtn') private cerrarBtn?: ElementRef<HTMLButtonElement>;

  etiqueta = () => etiquetaDe(this.ticket);
  estado = () => estadoDe(this.ticket);
  rondas = () => rondasDe(this.ticket, this.ahora);
  minutos = () => minutosDe(this.ticket, this.ahora);
  piezas = () => piezasDe(porHacer(this.ticket));
  estadoTexto = nombreEstado;

  ngAfterViewInit(): void {
    // El foco entra a la ventana: con teclado se puede cerrar de inmediato.
    this.cerrarBtn?.nativeElement.focus();
  }

  tipoTexto(): string {
    return { SALON: 'Mesa', DOMICILIO: 'Domicilio', MOSTRADOR: 'Mostrador', LLEVAR: 'Para llevar' }[tipoDe(this.ticket)];
  }

  hayPendientes(): boolean {
    return this.ticket.items.some((i) => i.kitchenStatus === 'PENDING');
  }

  claseTiempo(): string {
    return COLOR_TIEMPO[semaforoDe(this.minutos())];
  }

  claseEstado(s: KitchenItemStatus): string {
    return {
      PENDING: 'bg-slate-800 text-slate-300',
      PREPARING: 'bg-amber-500/20 text-amber-300',
      READY: 'bg-emerald-500/20 text-emerald-300',
      DELIVERED: 'bg-slate-800 text-slate-500',
    }[s];
  }
}
