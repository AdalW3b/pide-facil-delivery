import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnInit, Output, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { NgTemplateOutlet } from '@angular/common';
import { LucideChevronLeft, LucideLoader2, LucideMinus, LucidePlus, LucideSearch, LucideSend, LucideSlidersHorizontal, LucideX } from '@lucide/angular';
import { environment } from '../../../../environments/environment';
import { AvisosService } from '../../../core/services/avisos.service';
import { PesosPipe } from '../../../shared/utils/pesos';
import { ComandasEnBorradorService, LineaComanda } from '../comandas-en-borrador.service';
import { GrupoAdicional } from './order-panel.component';

/** Un platillo del catálogo, como lo da /products. */
interface Platillo {
  id: string;
  name: string;
  price: number;
  categoryName?: string;
  active?: boolean;
  isCombo?: boolean;
  comboItems?: { cantidad: number; nombre: string }[] | null;
  vigenteHoy?: boolean;
  agotado?: boolean;
}

/** El platillo que se está eligiendo con extras, nota y cantidad. */
interface Ficha {
  platillo: Platillo;
  cantidad: number;
  nota: string;
  elegidos: Set<string>;
  /** Si se está editando un renglón de la comanda. */
  clave: string | null;
}

const MAS_PEDIDOS = '__mas';

/**
 * Tomar el pedido de una mesa: se toca el platillo en la cuadrícula y se suma
 * a la comanda; cuando está completa se manda toda junta a cocina. Así cocina
 * recibe un ticket entero en vez de platillos sueltos, y el mesero puede
 * corregir antes de enviar.
 *
 * En tablet la comanda está a la derecha; en celular, en la barra de abajo.
 */
@Component({
  selector: 'app-toma-pedido',
  standalone: true,
  imports: [FormsModule, NgTemplateOutlet, PesosPipe, LucideChevronLeft, LucideLoader2, LucideMinus, LucidePlus, LucideSearch, LucideSend, LucideSlidersHorizontal, LucideX],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="@container/toma fixed inset-0 z-[60] bg-slate-950 text-slate-100 flex flex-col" role="dialog" aria-modal="true" [attr.aria-label]="'Tomar pedido de la mesa ' + mesa">
      <!-- Encabezado: mesa y buscador -->
      <header class="shrink-0 flex items-center gap-2 px-3 sm:px-4 py-2.5 border-b border-slate-800 bg-slate-900" style="padding-top: max(0.625rem, env(safe-area-inset-top))">
        <button type="button" (click)="cerrar.emit()" class="flex items-center gap-1 pr-2 py-2 rounded-lg text-slate-300 hover:text-white cursor-pointer shrink-0" aria-label="Volver a la mesa">
          <svg lucideChevronLeft class="w-5 h-5"></svg>
          <span class="font-bold text-white">Mesa {{ mesa }}</span>
        </button>
        <div class="relative flex-1 min-w-0">
          <svg lucideSearch class="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"></svg>
          <input type="search" [ngModel]="busqueda()" (ngModelChange)="busqueda.set($event)" placeholder="Buscar platillo"
            aria-label="Buscar platillo" autocomplete="off"
            class="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-9 pr-3 text-sm text-white outline-none focus:border-indigo-500" />
        </div>
      </header>

      <div class="flex-1 min-h-0 @3xl/toma:grid @3xl/toma:grid-cols-[minmax(0,1fr)_minmax(300px,360px)]">
        <!-- Menú -->
        <section class="@container/menu h-full min-h-0 flex flex-col">
          @if (!busqueda().trim()) {
            <nav class="shrink-0 flex gap-2 overflow-x-auto px-3 sm:px-4 py-3 [scrollbar-width:none]" aria-label="Categorías">
              @for (c of categorias(); track c.id) {
                <button type="button" (click)="categoria.set(c.id)" [attr.aria-pressed]="categoria() === c.id"
                  class="shrink-0 px-4 py-2 rounded-full text-sm font-semibold cursor-pointer whitespace-nowrap"
                  [class]="categoria() === c.id ? 'bg-indigo-600 text-white' : 'bg-slate-900 border border-slate-800 text-slate-300'">
                  {{ c.nombre }}
                </button>
              }
            </nav>
          }

          <div class="flex-1 min-h-0 overflow-y-auto px-3 sm:px-4 pb-28 @3xl/toma:pb-4" [class.pt-3]="busqueda().trim()">
            @if (cargando()) {
              <p class="flex items-center gap-2 text-sm text-slate-400 py-10 justify-center"><svg lucideLoader2 class="w-4 h-4 animate-spin"></svg> Cargando menú…</p>
            } @else {
              <div class="grid grid-cols-2 @md/menu:grid-cols-3 @3xl/menu:grid-cols-4 gap-2">
                @for (p of visibles(); track p.id) {
                  <button type="button" (click)="tocar(p)" [disabled]="noSeVende(p)"
                    class="relative text-left min-h-[84px] rounded-xl border p-3 [touch-action:manipulation] flex flex-col justify-between gap-1 cursor-pointer active:scale-[0.98] transition disabled:cursor-not-allowed"
                    [class]="enComanda(p.id) > 0 ? 'bg-indigo-600/15 border-indigo-500/60' : 'bg-slate-900 border-slate-800 hover:border-slate-600'"
                    [class.opacity-40]="noSeVende(p)">
                    <span class="text-sm font-semibold leading-tight line-clamp-2 pr-6" [class.line-through]="p.agotado">{{ p.name }}</span>
                    <span class="flex items-center justify-between gap-2 text-xs">
                      <span class="tabular-nums text-slate-300">{{ p.price | pesos }}</span>
                      @if (p.agotado) {
                        <span class="text-rose-300 font-semibold">Se acabó</span>
                      } @else if (tieneExtras(p.id)) {
                        <span class="flex items-center gap-1 text-[11px] font-semibold text-slate-400 border border-slate-700 rounded-md px-1.5 py-0.5">
                          <svg lucideSlidersHorizontal class="w-3 h-3" aria-hidden="true"></svg>elige
                        </span>
                      }
                    </span>
                    @if (enComanda(p.id) > 0) {
                      <span class="absolute top-2 right-2 min-w-6 h-6 px-1.5 rounded-full bg-indigo-500 text-white text-xs font-black flex items-center justify-center tabular-nums">{{ enComanda(p.id) }}</span>
                    }
                  </button>
                } @empty {
                  <p class="col-span-full text-center text-sm text-slate-500 py-10">No hay platillos que coincidan.</p>
                }
              </div>
            }
          </div>
        </section>

        <!-- Comanda: a la derecha en tablet -->
        <aside class="hidden @3xl/toma:flex flex-col min-h-0 border-l border-slate-800 bg-slate-900/60">
          <ng-container *ngTemplateOutlet="comanda" />
        </aside>
      </div>

      <!-- Celular: barra de abajo con la comanda -->
      <div class="@3xl/toma:hidden fixed inset-x-0 bottom-0 z-10 border-t border-slate-800 bg-slate-900 px-3 pt-2.5" style="padding-bottom: max(0.625rem, env(safe-area-inset-bottom))">
        @if (lineas().length === 0) {
          <p class="text-center text-xs text-slate-500 py-2">Toca un platillo para agregarlo.</p>
        } @else {
          <div class="flex gap-2">
            <button type="button" (click)="verComanda.set(true)" class="flex-1 py-3 rounded-xl border border-slate-700 text-sm font-semibold text-white cursor-pointer">
              Ver comanda ({{ piezas() }}) · <span class="tabular-nums">{{ total() | pesos }}</span>
            </button>
            <button type="button" (click)="enviar()" [disabled]="enviando()" class="px-4 py-3 rounded-xl bg-emerald-600 text-white text-sm font-bold cursor-pointer disabled:opacity-50 flex items-center gap-1.5">
              <svg lucideSend class="w-4 h-4"></svg> Enviar
            </button>
          </div>
        }
      </div>

      @if (verComanda()) {
        <div class="@3xl/toma:hidden fixed inset-0 z-20 flex flex-col justify-end bg-black/60" (click)="verComanda.set(false)">
          <div class="max-h-[80vh] flex flex-col rounded-t-2xl bg-slate-900 border-t border-slate-800" (click)="$event.stopPropagation()">
            <ng-container *ngTemplateOutlet="comanda" />
          </div>
        </div>
      }

      <!-- Extras, nota y cantidad de un platillo -->
      @if (ficha(); as f) {
        <div class="fixed inset-0 z-30 flex items-end sm:items-center justify-center bg-black/60 sm:p-6" (click)="ficha.set(null)">
          <div class="w-full sm:max-w-md max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-slate-900 border border-slate-800 p-5 space-y-4"
            role="dialog" aria-modal="true" [attr.aria-label]="f.platillo.name" (click)="$event.stopPropagation()">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <h3 class="text-lg font-bold text-white leading-tight">{{ f.platillo.name }}</h3>
                @if (incluye(f.platillo); as inc) { <p class="text-xs text-slate-400 mt-1">Incluye: {{ inc }}</p> }
              </div>
              <button type="button" (click)="ficha.set(null)" class="p-1.5 rounded-lg text-slate-400 hover:text-white cursor-pointer" aria-label="Cerrar">
                <svg lucideX class="w-5 h-5"></svg>
              </button>
            </div>

            @for (g of grupos(f.platillo.id); track g.id) {
              <div>
                <div class="flex items-baseline justify-between mb-1.5">
                  <span class="text-xs font-semibold text-slate-300 uppercase tracking-wide">{{ g.nombre }}</span>
                  <span class="text-[11px]" [class]="g.minimo > 0 && elegidosEn(f, g) < g.minimo ? 'text-amber-400' : 'text-slate-500'">
                    {{ g.minimo > 0 ? 'Obligatorio' : 'Opcional' }} · {{ g.maximo === 1 ? 'elige 1' : 'hasta ' + g.maximo }}
                  </span>
                </div>
                <div class="flex flex-wrap gap-2">
                  @for (op of g.opciones; track op.id) {
                    <button type="button" (click)="alternar(f, g, op.id)" [disabled]="!op.disponible" [attr.aria-pressed]="f.elegidos.has(op.id)"
                      class="px-3 py-2 rounded-xl text-sm border cursor-pointer disabled:opacity-40 disabled:line-through"
                      [class]="f.elegidos.has(op.id) ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-950 border-slate-800 text-slate-300'">
                      {{ op.nombre }}@if (op.precio > 0) { <span class="opacity-70"> +{{ op.precio | pesos }}</span> }
                    </button>
                  }
                </div>
              </div>
            }

            <div>
              <label for="tp-nota" class="block text-xs font-semibold text-slate-300 uppercase tracking-wide mb-1.5">Nota para cocina</label>
              <input id="tp-nota" type="text" maxlength="200" [ngModel]="f.nota" (ngModelChange)="f.nota = $event"
                placeholder="Ej. sin cebolla, bien dorado"
                class="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3 text-sm text-white outline-none focus:border-indigo-500" />
            </div>

            <div class="flex items-center justify-between gap-3">
              <div class="flex items-center gap-2" role="group" aria-label="Cantidad">
                <button type="button" (click)="f.cantidad = f.cantidad > 1 ? f.cantidad - 1 : 1" class="w-11 h-11 rounded-xl border border-slate-700 flex items-center justify-center cursor-pointer" aria-label="Uno menos">
                  <svg lucideMinus class="w-4 h-4"></svg>
                </button>
                <span class="w-8 text-center text-lg font-black tabular-nums">{{ f.cantidad }}</span>
                <button type="button" (click)="f.cantidad = f.cantidad + 1" class="w-11 h-11 rounded-xl border border-slate-700 flex items-center justify-center cursor-pointer" aria-label="Uno más">
                  <svg lucidePlus class="w-4 h-4"></svg>
                </button>
              </div>
              <button type="button" (click)="guardarFicha(f)" [disabled]="faltaEn(f) !== null"
                class="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed tabular-nums">
                {{ f.clave ? 'Guardar' : 'Agregar' }} · {{ precioFicha(f) * f.cantidad | pesos }}
              </button>
            </div>
            @if (faltaEn(f); as falta) { <p class="text-xs text-amber-400 text-center">{{ falta }}</p> }
          </div>
        </div>
      }
    </div>

    <ng-template #comanda>
      <div class="shrink-0 flex items-center justify-between px-4 py-3 border-b border-slate-800">
        <h3 class="text-sm font-bold text-white">Comanda <span class="text-slate-500 font-normal">· sin enviar</span></h3>
        @if (lineas().length > 0) {
          <button type="button" (click)="vaciar()" class="text-xs text-slate-400 hover:text-rose-300 cursor-pointer">Vaciar</button>
        }
      </div>
      <ul class="flex-1 min-h-0 overflow-y-auto divide-y divide-slate-800/70 px-4">
        @for (l of lineas(); track l.clave) {
          <li class="py-3 flex items-start gap-3">
            <button type="button" (click)="editar(l)" class="flex-1 min-w-0 text-left cursor-pointer" [attr.aria-label]="'Cambiar ' + l.nombre">
              <span class="block text-sm font-semibold text-white leading-tight">{{ l.nombre }}</span>
              @for (a of l.adicionalesNombres; track a) { <span class="block text-xs text-sky-300">+ {{ a }}</span> }
              @if (l.nota) { <span class="block text-xs text-amber-300">↳ {{ l.nota }}</span> }
              <span class="block text-[11px] text-slate-500 tabular-nums mt-0.5">{{ l.precio * l.cantidad | pesos }}</span>
            </button>
            <div class="flex items-center gap-1 shrink-0" role="group" [attr.aria-label]="'Cantidad de ' + l.nombre">
              <button type="button" (click)="sumar(l, -1)" class="w-9 h-9 rounded-lg border border-slate-700 flex items-center justify-center cursor-pointer" aria-label="Uno menos">
                <svg lucideMinus class="w-3.5 h-3.5"></svg>
              </button>
              <span class="w-6 text-center text-sm font-black tabular-nums">{{ l.cantidad }}</span>
              <button type="button" (click)="sumar(l, 1)" class="w-9 h-9 rounded-lg border border-slate-700 flex items-center justify-center cursor-pointer" aria-label="Uno más">
                <svg lucidePlus class="w-3.5 h-3.5"></svg>
              </button>
            </div>
          </li>
        } @empty {
          <li class="py-10 text-center text-sm text-slate-500">Toca los platillos para armar la comanda.</li>
        }
      </ul>
      <div class="shrink-0 p-4 border-t border-slate-800 space-y-2" style="padding-bottom: max(1rem, env(safe-area-inset-bottom))">
        <div class="flex justify-between text-sm">
          <span class="text-slate-400">{{ piezas() }} {{ piezas() === 1 ? 'platillo' : 'platillos' }}</span>
          <span class="font-bold text-white tabular-nums">{{ total() | pesos }}</span>
        </div>
        <button type="button" (click)="enviar()" [disabled]="lineas().length === 0 || enviando()"
          class="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
          @if (enviando()) { <svg lucideLoader2 class="w-4 h-4 animate-spin"></svg> Enviando… } @else { <svg lucideSend class="w-4 h-4"></svg> Enviar a cocina ({{ piezas() }}) }
        </button>
      </div>
    </ng-template>
  `,
})
export class TomaPedidoComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly avisos = inject(AvisosService);
  private readonly borradores = inject(ComandasEnBorradorService);

  @Input({ required: true }) branchId!: string;
  @Input({ required: true }) orderId!: string;
  @Input({ required: true }) mesa!: number;
  @Output() cerrar = new EventEmitter<void>();
  /** Se mandó a cocina: el panel de la mesa recarga la cuenta. */
  @Output() enviado = new EventEmitter<number>();

  readonly cargando = signal(true);
  readonly enviando = signal(false);
  readonly platillos = signal<Platillo[]>([]);
  readonly gruposPorPlatillo = signal<Map<string, GrupoAdicional[]>>(new Map());
  readonly masPedidos = signal<string[]>([]);
  readonly busqueda = signal('');
  readonly categoria = signal<string>('');
  readonly ficha = signal<Ficha | null>(null);
  readonly verComanda = signal(false);
  readonly lineas = signal<LineaComanda[]>([]);

  readonly piezas = computed(() => this.lineas().reduce((n, l) => n + l.cantidad, 0));
  readonly total = computed(() => this.lineas().reduce((n, l) => n + l.precio * l.cantidad, 0));

  /** "Más pedidos" primero (si hay), luego las categorías del menú en su orden. */
  readonly categorias = computed(() => {
    const vistas = new Map<string, string>();
    for (const p of this.platillos()) {
      const nombre = p.categoryName || 'Otros';
      if (!vistas.has(nombre)) vistas.set(nombre, nombre);
    }
    const lista = [...vistas.keys()].map((n) => ({ id: n, nombre: n }));
    return this.masPedidos().length ? [{ id: MAS_PEDIDOS, nombre: '★ Más pedidos' }, ...lista] : lista;
  });

  readonly visibles = computed(() => {
    const q = normalizar(this.busqueda());
    const todos = this.platillos();
    if (q) return todos.filter((p) => normalizar(p.name).includes(q));
    const c = this.categoria() || this.categorias()[0]?.id;
    if (c === MAS_PEDIDOS) {
      const porId = new Map(todos.map((p) => [p.id, p]));
      return this.masPedidos().map((id) => porId.get(id)).filter((p): p is Platillo => !!p);
    }
    return todos.filter((p) => (p.categoryName || 'Otros') === c);
  });

  ngOnInit(): void {
    this.lineas.set(this.borradores.de(this.orderId));
    const api = environment.apiUrl;
    this.http.get<Platillo[]>(`${api}/products?branchId=${this.branchId}`).subscribe({
      next: (lista) => {
        // Solo lo activo, y los combos solo en los días de su promoción.
        this.platillos.set(lista.filter((p) => p.active !== false && p.vigenteHoy !== false));
        this.cargando.set(false);
      },
      error: () => {
        this.cargando.set(false);
        this.avisos.error('No se pudo cargar el menú.');
      },
    });
    // Los extras salen del menú público: el mesero y el cliente ven lo mismo.
    this.http.get<{ items: { id: string; grupos?: GrupoAdicional[] }[] }[]>(`${api}/public/branches/${this.branchId}/menu`).subscribe({
      next: (menu) => {
        const mapa = new Map<string, GrupoAdicional[]>();
        menu.forEach((c) => c.items.forEach((i) => mapa.set(i.id, i.grupos ?? [])));
        this.gruposPorPlatillo.set(mapa);
      },
    });
    this.http.get<string[]>(`${api}/public/branches/${this.branchId}/menu/mas-pedidos`).subscribe({
      next: (ids) => this.masPedidos.set(ids.slice(0, 12)),
    });
  }

  // ------------------------------------------------------------------ menú

  grupos(productId: string): GrupoAdicional[] {
    return this.gruposPorPlatillo().get(productId) ?? [];
  }

  tieneExtras(productId: string): boolean {
    return this.grupos(productId).length > 0;
  }

  noSeVende(p: Platillo): boolean {
    return !!p.agotado;
  }

  enComanda(productId: string): number {
    return this.lineas().filter((l) => l.productId === productId).reduce((n, l) => n + l.cantidad, 0);
  }

  incluye(p: Platillo): string | null {
    return p.isCombo && p.comboItems?.length ? p.comboItems.map((c) => `${c.cantidad} × ${c.nombre}`).join(', ') : null;
  }

  /** Un toque suma uno. Si lleva opciones, primero se eligen. */
  tocar(p: Platillo): void {
    if (this.noSeVende(p)) return;
    if (this.tieneExtras(p.id)) {
      this.ficha.set({ platillo: p, cantidad: 1, nota: '', elegidos: new Set(), clave: null });
      return;
    }
    this.agregar({
      clave: ComandasEnBorradorService.clave(p.id, [], ''),
      productId: p.id, nombre: p.name, precio: Number(p.price), cantidad: 1,
      adicionales: [], adicionalesNombres: [], nota: '',
    });
  }

  // ------------------------------------------------------------------ ficha

  elegidosEn(f: Ficha, g: GrupoAdicional): number {
    return g.opciones.filter((o) => f.elegidos.has(o.id)).length;
  }

  /** En un grupo de una sola opción, elegir otra reemplaza la anterior. */
  alternar(f: Ficha, g: GrupoAdicional, opcionId: string): void {
    const set = new Set(f.elegidos);
    if (set.has(opcionId)) set.delete(opcionId);
    else if (g.maximo === 1) {
      g.opciones.forEach((o) => set.delete(o.id));
      set.add(opcionId);
    } else if (this.elegidosEn(f, g) < g.maximo) set.add(opcionId);
    this.ficha.set({ ...f, elegidos: set });
  }

  faltaEn(f: Ficha): string | null {
    for (const g of this.grupos(f.platillo.id)) {
      if (this.elegidosEn(f, g) < g.minimo) return `Falta elegir ${g.nombre.toLowerCase()}`;
    }
    return null;
  }

  precioFicha(f: Ficha): number {
    const extras = this.grupos(f.platillo.id).flatMap((g) => g.opciones)
      .filter((o) => f.elegidos.has(o.id)).reduce((n, o) => n + Number(o.precio || 0), 0);
    return Number(f.platillo.price) + extras;
  }

  guardarFicha(f: Ficha): void {
    if (this.faltaEn(f) !== null) return;
    const opciones = this.grupos(f.platillo.id).flatMap((g) => g.opciones.map((o) => ({ ...o, grupo: g.nombre })));
    const elegidas = opciones.filter((o) => f.elegidos.has(o.id));
    const nota = f.nota.trim();
    const linea: LineaComanda = {
      clave: ComandasEnBorradorService.clave(f.platillo.id, elegidas.map((o) => o.id), nota),
      productId: f.platillo.id,
      nombre: f.platillo.name,
      precio: this.precioFicha(f),
      cantidad: f.cantidad,
      adicionales: elegidas.map((o) => o.id),
      adicionalesNombres: elegidas.map((o) => o.nombre),
      nota,
    };
    // Al editar, el renglón viejo se reemplaza (puede juntarse con otro igual).
    const sinLaVieja = f.clave ? this.lineas().filter((l) => l.clave !== f.clave) : this.lineas();
    this.fijar(sinLaVieja);
    this.agregar(linea);
    this.ficha.set(null);
  }

  // ------------------------------------------------------------------ comanda

  editar(l: LineaComanda): void {
    const platillo = this.platillos().find((p) => p.id === l.productId)
      ?? { id: l.productId, name: l.nombre, price: l.precio };
    this.ficha.set({ platillo, cantidad: l.cantidad, nota: l.nota, elegidos: new Set(l.adicionales), clave: l.clave });
  }

  sumar(l: LineaComanda, delta: number): void {
    this.fijar(this.lineas()
      .map((x) => (x.clave === l.clave ? { ...x, cantidad: x.cantidad + delta } : x))
      .filter((x) => x.cantidad > 0));
  }

  async vaciar(): Promise<void> {
    if (!(await this.avisos.confirmar({ titulo: '¿Vaciar la comanda?', mensaje: 'Se quita todo lo que no se ha enviado a cocina.', confirmar: 'Vaciar', cancelar: 'Volver', peligro: true }))) return;
    this.fijar([]);
    this.verComanda.set(false);
  }

  /** Todo junto a cocina: un solo ticket. */
  enviar(): void {
    const lineas = this.lineas();
    if (!lineas.length || this.enviando()) return;
    this.enviando.set(true);
    const items = lineas.map((l) => ({
      productId: l.productId,
      quantity: l.cantidad,
      specialInstructions: l.nota,
      adicionales: l.adicionales,
    }));
    this.http.post(`${environment.apiUrl}/branches/${this.branchId}/orders/${this.orderId}/items`, { items }).subscribe({
      next: () => {
        const piezas = this.piezas();
        this.enviando.set(false);
        this.fijar([]);
        this.verComanda.set(false);
        this.avisos.exito(`Enviado a cocina: ${piezas} ${piezas === 1 ? 'platillo' : 'platillos'}.`);
        this.enviado.emit(piezas);
      },
      error: (err) => {
        this.enviando.set(false);
        // La comanda se queda como estaba para corregir y volver a enviar.
        this.avisos.error(err.error?.error || err.error?.message || 'No se pudo enviar a cocina.');
      },
    });
  }

  /** Si ya hay un renglón igual (mismo platillo, extras y nota), se suma ahí. */
  private agregar(linea: LineaComanda): void {
    const actuales = this.lineas();
    const igual = actuales.some((l) => l.clave === linea.clave);
    this.fijar(igual
      ? actuales.map((l) => (l.clave === linea.clave ? { ...l, cantidad: l.cantidad + linea.cantidad } : l))
      : [...actuales, linea]);
  }

  private fijar(lineas: LineaComanda[]): void {
    this.lineas.set(lineas);
    this.borradores.guardar(this.orderId, lineas);
  }
}

function normalizar(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}
