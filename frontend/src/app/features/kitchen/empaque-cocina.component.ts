import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { LucideBike, LucidePackageCheck, LucideShoppingBag, LucideTicket } from '@lucide/angular';
import type { AreaCocina, KitchenTicketDTO } from './kitchen.component';
import { etiquetaDe, horaDe, semaforoDe, COLOR_TIEMPO, tipoDe } from './comanda';

/** Cómo va un área dentro de un pedido. */
interface EstadoArea {
  nombre: string;
  listo: boolean;
  texto: string;
  piezas: string;
}

/**
 * Empaque: junta lo de domicilio y para llevar. Ve qué área ya entregó lo
 * suyo y qué falta; solo deja empacar con todo listo. Al empacar, el pedido
 * pasa a "Listo para repartidor" (o se llama el turno en mostrador).
 */
@Component({
  selector: 'app-empaque-cocina',
  standalone: true,
  imports: [LucideBike, LucidePackageCheck, LucideShoppingBag, LucideTicket],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="grid gap-3 items-start" [class]="tv ? '[grid-template-columns:repeat(auto-fill,minmax(min(100%,340px),1fr))]' : '[grid-template-columns:repeat(auto-fill,minmax(min(100%,290px),1fr))]'">
      @for (t of porEmpacar(); track t.orderId) {
        <article class="rounded-2xl border-2 bg-slate-900 flex flex-col overflow-hidden"
          [class]="completo(t) ? 'border-emerald-500/60' : 'border-slate-700'">
          <header class="flex items-start justify-between gap-2 px-4 pt-3 pb-2.5 border-b border-slate-800">
            <h3 class="flex items-center gap-2 font-black text-white leading-tight min-w-0" [class]="tv ? 'text-2xl' : 'text-xl'">
              @switch (tipo(t)) {
                @case ('DOMICILIO') { <svg lucideBike class="w-5 h-5 text-sky-400 shrink-0" aria-label="Domicilio"></svg> }
                @case ('MOSTRADOR') { <svg lucideTicket class="w-5 h-5 text-violet-300 shrink-0" aria-label="Mostrador"></svg> }
                @default { <svg lucideShoppingBag class="w-5 h-5 text-amber-300 shrink-0" aria-label="Para llevar"></svg> }
              }
              <span class="truncate">{{ etiqueta(t) }}</span>
            </h3>
            <span class="shrink-0 px-2.5 py-1 rounded-lg font-black tabular-nums" [class]="claseTiempo(t) + (tv ? ' text-2xl' : ' text-lg')">{{ minutos(t) }}′</span>
          </header>
          <ul class="px-3 py-2 divide-y divide-slate-800">
            @for (a of estados(t); track a.nombre) {
              <li class="py-2 flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <p class="font-bold text-white" [class]="tv ? 'text-lg' : 'text-sm'">{{ a.nombre }}</p>
                  <p class="text-slate-400 leading-snug" [class]="tv ? 'text-base' : 'text-xs'">{{ a.piezas }}</p>
                </div>
                <span class="shrink-0 px-2 py-0.5 rounded-md font-black uppercase tracking-wide"
                  [class]="(a.listo ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300') + (tv ? ' text-sm' : ' text-[11px]')">{{ a.texto }}</span>
              </li>
            }
          </ul>
          @if (!tv) {
            <footer class="p-2 border-t border-slate-800">
              <button type="button" (click)="empacar.emit(t)" [disabled]="!completo(t)"
                class="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold cursor-pointer disabled:cursor-not-allowed"
                [class]="completo(t) ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-slate-800 text-slate-500'">
                <svg lucidePackageCheck class="w-4 h-4"></svg>
                {{ completo(t) ? (tipo(t) === 'DOMICILIO' ? 'Empacado: listo para repartidor' : 'Empacado: llamar turno') : 'Faltan áreas' }}
              </button>
            </footer>
          }
        </article>
      } @empty {
        <p class="col-span-full py-20 text-center text-slate-500" [class]="tv ? 'text-2xl' : 'text-sm'">Nada por empacar. Los pedidos a domicilio y para llevar aparecen aquí en cuanto su primera área termina.</p>
      }
    </div>
  `,
})
export class EmpaqueCocinaComponent {
  /** Todas las comandas (sin filtrar por área). */
  @Input({ required: true }) tickets: KitchenTicketDTO[] = [];
  @Input({ required: true }) areas: AreaCocina[] = [];
  @Input({ required: true }) ahora!: number;
  @Input() tv = false;
  @Output() empacar = new EventEmitter<KitchenTicketDTO>();

  etiqueta = etiquetaDe;
  tipo = tipoDe;

  /** Domicilio y para llevar que siguen sin empacar y con algo ya listo; lo más viejo primero. */
  porEmpacar(): KitchenTicketDTO[] {
    return this.tickets
      .filter((t) => t.orderType && t.orderType !== 'SALON' && t.deliveryStatus === 'CONFIRMADO')
      .filter((t) => t.items.some((i) => i.kitchenStatus === 'READY'))
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  completo(t: KitchenTicketDTO): boolean {
    return t.items.every((i) => i.kitchenStatus === 'READY' || i.kitchenStatus === 'DELIVERED');
  }

  estados(t: KitchenTicketDTO): EstadoArea[] {
    const porArea = new Map<string, KitchenTicketDTO['items']>();
    for (const i of t.items) {
      const k = i.areaId ?? '';
      porArea.set(k, [...(porArea.get(k) ?? []), i]);
    }
    const orden = (id: string) => this.areas.findIndex((a) => a.id === id);
    return [...porArea.entries()]
      .sort((a, b) => orden(a[0]) - orden(b[0]))
      .map(([id, items]) => {
        const listos = items.filter((i) => i.kitchenStatus === 'READY' || i.kitchenStatus === 'DELIVERED').length;
        const listo = listos === items.length;
        const preparando = items.some((i) => i.kitchenStatus === 'PREPARING');
        return {
          nombre: this.areas.find((a) => a.id === id)?.nombre ?? 'Cocina',
          listo,
          texto: listo ? '✓ Llegó' : preparando ? 'Preparando' : 'Pendiente',
          piezas: items.map((i) => `${i.quantity} ${i.productName}`).join(' · '),
        };
      });
  }

  minutos(t: KitchenTicketDTO): number {
    return Math.max(0, Math.floor((this.ahora - Math.min(...t.items.map((i) => horaDe(i, this.ahora)))) / 60_000));
  }

  claseTiempo(t: KitchenTicketDTO): string {
    return COLOR_TIEMPO[semaforoDe(this.minutos(t))];
  }
}
