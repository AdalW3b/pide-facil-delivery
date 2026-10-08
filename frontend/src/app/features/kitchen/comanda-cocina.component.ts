import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { LucideBike, LucideShoppingBag, LucideTicket, LucideUtensils, LucideX } from '@lucide/angular';
import type { KitchenItemStatus, KitchenTicketDTO, KitchenTicketItemDTO } from './kitchen.component';
import {
  COLOR_BORDE, COLOR_TIEMPO, Ronda, estadoDe, etiquetaDe, minutosDe, nombreEstado, porHacer, rondasDe, semaforoDe, tipoDe,
} from './comanda';

/**
 * Una comanda en tarjeta, como la imprimiría la cocina: cantidades grandes,
 * extras y notas resaltadas, y cuánto lleva esperando. Con muchos platillos
 * muestra los primeros y "Ver comanda" abre la ventana con todo. En modo TV
 * se ve completa y sin botones.
 */
@Component({
  selector: 'app-comanda-cocina',
  standalone: true,
  imports: [LucideBike, LucideShoppingBag, LucideTicket, LucideUtensils, LucideX],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    @keyframes resaltar { 0%, 100% { box-shadow: 0 0 0 0 rgba(56, 189, 248, 0); } 50% { box-shadow: 0 0 0 6px rgba(56, 189, 248, .35); } }
    @media (prefers-reduced-motion: reduce) { :host * { animation: none !important; } }
  `],
  template: `
    <article class="relative rounded-2xl border-2 bg-slate-900 flex flex-col overflow-hidden" [class]="claseBorde() + (nueva ? ' !border-sky-400 animate-[resaltar_1.6s_ease-in-out_3]' : '')">
      @if (nueva) {
        <span class="absolute top-0 left-1/2 -translate-x-1/2 rounded-b-lg bg-sky-400 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-slate-950">Nueva</span>
      }
      <!-- A dónde va y cuánto lleva; tocarlo abre la comanda completa -->
      <header class="flex items-start justify-between gap-2 px-4 pt-3 pb-2.5 border-b border-slate-800"
        [class.cursor-pointer]="!tv" (click)="!tv && ver.emit()" (keydown.enter)="!tv && ver.emit()"
        [attr.role]="tv ? null : 'button'" [attr.tabindex]="tv ? null : 0"
        [attr.aria-label]="tv ? null : 'Ver la comanda completa de ' + etiqueta()">
        <div class="min-w-0">
          <h3 class="flex items-center gap-2 font-black text-white leading-tight" [class]="tv ? 'text-2xl' : 'text-xl'">
            @switch (tipo()) {
              @case ('DOMICILIO') { <svg lucideBike class="w-5 h-5 text-sky-400 shrink-0" aria-label="Domicilio"></svg> }
              @case ('MOSTRADOR') { <svg lucideTicket class="w-5 h-5 text-violet-300 shrink-0" aria-label="Mostrador"></svg> }
              @case ('LLEVAR') { <svg lucideShoppingBag class="w-5 h-5 text-amber-300 shrink-0" aria-label="Para llevar"></svg> }
              @default { <svg lucideUtensils class="w-5 h-5 text-slate-400 shrink-0" aria-label="Mesa"></svg> }
            }
            <span class="truncate">{{ etiqueta() }}</span>
          </h3>
          <p class="text-[11px] text-slate-500 tabular-nums mt-0.5">{{ listos() }} de {{ items().length }} listos</p>
        </div>
        @if (estado() === 'LISTA') {
          <span class="shrink-0 px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-300 text-sm font-black">Listo</span>
        } @else {
          <span class="shrink-0 px-2.5 py-1 rounded-lg font-black tabular-nums" [class]="claseTiempo() + (tv ? ' text-2xl' : ' text-lg')">{{ minutos() }}′</span>
        }
      </header>

      <div class="flex-1 px-2 py-2">
        @for (r of rondasVisibles(); track r.numero) {
          @if (rondas().length > 1) {
            <p class="flex items-center gap-2 px-2 pt-2 pb-1 text-[11px] font-bold uppercase tracking-wider"
              [class]="r.nueva ? 'text-amber-300' : 'text-slate-500'">
              <span class="h-px flex-1" [class]="r.nueva ? 'bg-amber-400/40' : 'bg-slate-800'"></span>
              Ronda {{ r.numero }}{{ r.nueva ? ' · nuevo' : '' }}
              <span class="h-px flex-1" [class]="r.nueva ? 'bg-amber-400/40' : 'bg-slate-800'"></span>
            </p>
          }
          <ul>
            @for (item of r.items; track item.itemId) {
              <li class="flex items-stretch gap-1">
                <button type="button" (click)="avanzarItem.emit(item)" [disabled]="tv"
                  class="flex-1 min-w-0 text-left flex gap-3 px-2 py-2 rounded-xl"
                  [class]="tv ? '' : 'cursor-pointer hover:bg-slate-800/60 active:bg-slate-800'"
                  [attr.aria-label]="item.quantity + ' ' + item.productName + ', ' + estadoTexto(item.kitchenStatus) + (tv ? '' : '. Tocar para avanzar.')">
                  <span class="w-8 shrink-0 text-right font-black leading-none tabular-nums" [class]="claseCantidad(item.kitchenStatus) + (tv ? ' text-3xl' : ' text-2xl')">{{ item.quantity }}</span>
                  <span class="min-w-0 flex-1">
                    <span class="flex items-start gap-2">
                      <span class="font-bold leading-snug" [class]="claseNombre(item.kitchenStatus) + (tv ? ' text-xl' : ' text-base')">{{ item.productName }}</span>
                      <span class="mt-1.5 w-2.5 h-2.5 rounded-full shrink-0" [class]="claseEstado(item.kitchenStatus)" [title]="estadoTexto(item.kitchenStatus)"></span>
                    </span>
                    @for (a of item.adicionales ?? []; track a) {
                      <span class="block font-semibold text-sky-300 leading-snug" [class]="tv ? 'text-base' : 'text-sm'">+ {{ a }}</span>
                    }
                    @if (item.specialInstructions) {
                      <span class="mt-0.5 inline-block font-bold text-amber-200 bg-amber-500/15 rounded px-1.5" [class]="tv ? 'text-base' : 'text-sm'">⚠ {{ item.specialInstructions }}</span>
                    }
                  </span>
                </button>
                @if (!tv) {
                  <button type="button" (click)="cancelarItem.emit(item)" class="px-1.5 text-slate-600 hover:text-rose-400 cursor-pointer" [attr.aria-label]="'Cancelar ' + item.productName">
                    <svg lucideX class="w-4 h-4"></svg>
                  </button>
                }
              </li>
            }
          </ul>
        }
        @if (ocultos() > 0) {
          <button type="button" (click)="ver.emit()"
            class="mt-1 w-full flex justify-between gap-2 rounded-xl border border-dashed border-slate-700 px-3 py-2.5 text-sm font-semibold text-slate-300 hover:text-white hover:border-slate-500 cursor-pointer">
            <span>+{{ ocultos() }} más</span><span>Ver comanda ›</span>
          </button>
        }
      </div>

      @if (!tv) {
        <footer class="grid gap-2 p-2 border-t border-slate-800 grid-cols-2">
          <button type="button" (click)="ver.emit()" class="py-3 rounded-xl border border-slate-700 text-slate-200 text-sm font-bold cursor-pointer hover:bg-slate-800">Ver comanda</button>
          @if (hayEnCocina()) {
            @if (hayPendientes()) {
              <button type="button" (click)="cambiarTodo.emit({ de: ['PENDING'], a: 'PREPARING' })"
                class="py-3 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-200 text-sm font-bold cursor-pointer hover:bg-amber-500/25">Empezar</button>
            } @else {
              <button type="button" (click)="cambiarTodo.emit({ de: ['PENDING', 'PREPARING'], a: 'READY' })"
                class="py-3 rounded-xl bg-emerald-600 text-white text-sm font-bold cursor-pointer hover:bg-emerald-500">Todo listo</button>
            }
          } @else {
            <button type="button" (click)="cambiarTodo.emit({ de: ['READY'], a: 'DELIVERED' })"
              class="py-3 rounded-xl bg-slate-800 text-slate-200 text-sm font-bold cursor-pointer hover:bg-slate-700">Entregado</button>
          }
        </footer>
      }
    </article>
  `,
})
export class ComandaCocinaComponent {
  @Input({ required: true }) ticket!: KitchenTicketDTO;
  /** La hora de la pantalla (se actualiza cada 10 s). */
  @Input({ required: true }) ahora!: number;
  /** Cuántos platillos se ven antes de "+N más". Null = todos. */
  @Input() maxLineas: number | null = 4;
  /** Modo TV: completa, letra grande y sin botones. */
  @Input() tv = false;
  /** Recién llegada o con ronda nueva: se resalta un momento. */
  @Input() nueva = false;
  @Output() avanzarItem = new EventEmitter<KitchenTicketItemDTO>();
  @Output() cancelarItem = new EventEmitter<KitchenTicketItemDTO>();
  @Output() cambiarTodo = new EventEmitter<{ de: KitchenItemStatus[]; a: KitchenItemStatus }>();
  @Output() ver = new EventEmitter<void>();

  etiqueta = () => etiquetaDe(this.ticket);
  tipo = () => tipoDe(this.ticket);
  estado = () => estadoDe(this.ticket);
  items = () => porHacer(this.ticket);
  rondas = () => rondasDe(this.ticket, this.ahora);
  minutos = () => minutosDe(this.ticket, this.ahora);
  estadoTexto = nombreEstado;

  listos(): number {
    return this.items().filter((i) => i.kitchenStatus === 'READY').length;
  }

  hayPendientes(): boolean {
    return this.ticket.items.some((i) => i.kitchenStatus === 'PENDING');
  }

  hayEnCocina(): boolean {
    return this.ticket.items.some((i) => i.kitchenStatus === 'PENDING' || i.kitchenStatus === 'PREPARING');
  }

  /** Las rondas recortadas a los primeros platillos (todo en TV). */
  rondasVisibles(): Ronda[] {
    const limite = this.tv || this.maxLineas == null ? Infinity : this.maxLineas;
    let quedan = limite;
    const visibles: Ronda[] = [];
    for (const r of this.rondas()) {
      if (quedan <= 0) break;
      visibles.push({ ...r, items: r.items.slice(0, quedan) });
      quedan -= r.items.length;
    }
    return visibles;
  }

  ocultos(): number {
    if (this.tv || this.maxLineas == null) return 0;
    return Math.max(0, this.items().length - this.maxLineas);
  }

  claseTiempo(): string {
    return COLOR_TIEMPO[semaforoDe(this.minutos())];
  }

  claseBorde(): string {
    if (this.estado() === 'LISTA') return 'border-emerald-600/40 opacity-80';
    return COLOR_BORDE[semaforoDe(this.minutos())];
  }

  claseEstado(s: KitchenItemStatus): string {
    return { PENDING: 'bg-slate-500', PREPARING: 'bg-amber-400 animate-pulse', READY: 'bg-emerald-400', DELIVERED: 'bg-slate-700' }[s];
  }

  claseCantidad(s: KitchenItemStatus): string {
    return s === 'READY' ? 'text-emerald-500/50' : s === 'PREPARING' ? 'text-amber-300' : 'text-white';
  }

  claseNombre(s: KitchenItemStatus): string {
    return s === 'READY' ? 'text-slate-500 line-through' : s === 'PREPARING' ? 'text-amber-100' : 'text-white';
  }
}
