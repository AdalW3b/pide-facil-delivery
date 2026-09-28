import { AvisosService } from '../../core/services/avisos.service';
import { Component, ChangeDetectionStrategy, signal, computed, inject, input, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../environments/environment';
import { Category, Ingredient, Product } from './models/catalog.model';
import {
  LucidePlus,
  LucideEdit,
  LucideTrash2,
  LucideX,
  LucideLoader2,
  LucideChevronUp,
  LucideChevronDown,
  LucideAlertCircle,
  LucideLayers,
} from '@lucide/angular';

/** Espejo de GrupoAdicionalDTO del backend. */
export interface OpcionAdicional {
  id: string | null;
  nombre: string;
  precio: number;
  activo: boolean;
  /** Ingrediente que descuenta al venderse, opcional. */
  ingredientId: string | null;
  /** Cuánto descuenta, en la unidad del ingrediente. */
  cantidadIngrediente: number | null;
}

export interface GrupoAdicional {
  id: string | null;
  nombre: string;
  minimo: number;
  maximo: number;
  orden: number;
  activo: boolean;
  opciones: OpcionAdicional[];
  categoryIds: string[];
  productIds: string[];
}

/**
 * Grupos de adicionales del restaurante: "Extras", "Tortilla", "Tamaño".
 *
 * Un grupo se arma una vez y se asigna a categorías enteras o a platillos
 * sueltos. Es lo que el cliente ve en la ficha del platillo al pedir.
 */
@Component({
  selector: 'app-adicionales-admin',
  standalone: true,
  imports: [
    FormsModule,
    LucidePlus,
    LucideEdit,
    LucideTrash2,
    LucideX,
    LucideLoader2,
    LucideChevronUp,
    LucideChevronDown,
    LucideAlertCircle,
    LucideLayers,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-5">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p class="text-xs text-slate-400 max-w-2xl">
          Arma un grupo una vez y asígnalo a una categoría o a platillos sueltos. El cliente lo verá al tocar el
          platillo en el menú en línea, y cocina recibirá lo que eligió.
        </p>
        @if (!editando()) {
          <button
            (click)="nuevo()"
            class="shrink-0 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer"
          >
            <svg lucidePlus class="w-4 h-4"></svg>
            Nuevo grupo
          </button>
        }
      </div>

      @if (error()) {
        <div class="flex items-start gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
          <svg lucideAlertCircle class="w-4 h-4 shrink-0 mt-0.5"></svg>
          <span>{{ error() }}</span>
        </div>
      }

      <!-- Editor -->
      @if (editando(); as g) {
        <div class="bg-slate-900/60 border border-indigo-500/30 rounded-2xl p-5 space-y-5">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-bold text-white">{{ g.id ? 'Editar grupo' : 'Nuevo grupo' }}</h3>
            <button (click)="cancelar()" class="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer" aria-label="Cancelar">
              <svg lucideX class="w-4 h-4"></svg>
            </button>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="md:col-span-1">
              <label for="ad-nombre" class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Nombre del grupo</label>
              <input id="ad-nombre" type="text" maxlength="60" [ngModel]="g.nombre" (ngModelChange)="cambiar({ nombre: $event })"
                placeholder="Extras, Tortilla, Tamaño..."
                class="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-sm text-white outline-none focus:border-indigo-500" />
            </div>
            <div>
              <label for="ad-min" class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Mínimo a elegir</label>
              <input id="ad-min" type="number" min="0" [ngModel]="g.minimo" (ngModelChange)="cambiar({ minimo: +$event })"
                class="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-sm text-white outline-none focus:border-indigo-500 tabular-nums" />
            </div>
            <div>
              <label for="ad-max" class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Máximo a elegir</label>
              <input id="ad-max" type="number" min="1" [ngModel]="g.maximo" (ngModelChange)="cambiar({ maximo: +$event })"
                class="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-sm text-white outline-none focus:border-indigo-500 tabular-nums" />
            </div>
          </div>
          <p class="text-[11px] text-indigo-300 -mt-2">{{ explicarRegla(g) }}</p>

          <!-- Opciones -->
          <div>
            <p class="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Opciones</p>
            <ul class="space-y-2">
              @for (op of g.opciones; track $index; let i = $index; let ultimo = $last) {
                <li class="bg-slate-950/60 border border-slate-800 rounded-xl p-2 space-y-2">
                 <div class="flex flex-wrap sm:flex-nowrap items-center gap-2">
                  <div class="flex flex-col">
                    <button (click)="mover(i, -1)" [disabled]="i === 0" class="text-slate-500 hover:text-white disabled:opacity-20 cursor-pointer" aria-label="Subir">
                      <svg lucideChevronUp class="w-3.5 h-3.5"></svg>
                    </button>
                    <button (click)="mover(i, 1)" [disabled]="ultimo" class="text-slate-500 hover:text-white disabled:opacity-20 cursor-pointer" aria-label="Bajar">
                      <svg lucideChevronDown class="w-3.5 h-3.5"></svg>
                    </button>
                  </div>
                  <input type="text" maxlength="60" [ngModel]="op.nombre" (ngModelChange)="cambiarOpcion(i, { nombre: $event })"
                    placeholder="Carne extra" [attr.aria-label]="'Nombre de la opción ' + (i + 1)"
                    class="flex-1 min-w-40 bg-slate-950 border border-slate-800 rounded-lg py-1.5 px-2.5 text-sm text-white outline-none focus:border-indigo-500" />
                  <div class="flex items-center gap-1">
                    <span class="text-slate-500 text-sm">+$</span>
                    <input type="number" min="0" step="0.5" [ngModel]="op.precio" (ngModelChange)="cambiarOpcion(i, { precio: +$event })"
                      [attr.aria-label]="'Precio de la opción ' + (i + 1)"
                      class="w-20 bg-slate-950 border border-slate-800 rounded-lg py-1.5 px-2 text-sm text-white outline-none focus:border-indigo-500 tabular-nums" />
                  </div>
                  <label class="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer px-1" title="Desmárcalo cuando se acabe: se verá como agotado">
                    <input type="checkbox" [ngModel]="op.activo" (ngModelChange)="cambiarOpcion(i, { activo: $event })" class="accent-indigo-500" />
                    Disponible
                  </label>
                  <button (click)="quitarOpcion(i)" [disabled]="g.opciones.length === 1"
                    class="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 disabled:opacity-20 cursor-pointer" aria-label="Quitar opción">
                    <svg lucideTrash2 class="w-4 h-4"></svg>
                  </button>
                 </div>
                 <!-- Inventario: opcional, para que "Carne extra" saque pastor -->
                 <div class="flex flex-wrap items-center gap-2 pl-6 text-xs text-slate-400">
                   <span>Descuenta del inventario:</span>
                   <select [ngModel]="op.ingredientId ?? ''" (ngModelChange)="cambiarIngrediente(i, $event)"
                     [attr.aria-label]="'Ingrediente que descuenta la opción ' + (i + 1)"
                     class="bg-slate-950 border border-slate-800 rounded-lg py-1 px-2 text-xs text-white outline-none focus:border-indigo-500">
                     <option value="">Nada</option>
                     @for (ing of ingredientes(); track ing.id) {
                       <option [value]="ing.id">{{ ing.name }}</option>
                     }
                   </select>
                   @if (op.ingredientId) {
                     <input type="number" min="0" step="0.001" [ngModel]="op.cantidadIngrediente"
                       (ngModelChange)="cambiarOpcion(i, { cantidadIngrediente: $event === null || $event === '' ? null : +$event })"
                       [attr.aria-label]="'Cantidad de ingrediente de la opción ' + (i + 1)"
                       placeholder="0.08"
                       class="w-24 bg-slate-950 border border-slate-800 rounded-lg py-1 px-2 text-xs text-white outline-none focus:border-indigo-500 tabular-nums" />
                     <span>{{ unidadDe(op.ingredientId) }} por platillo</span>
                   }
                 </div>
                </li>
              }
            </ul>
            <button (click)="agregarOpcion()" class="mt-2 text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer">
              <svg lucidePlus class="w-3.5 h-3.5"></svg> Agregar opción
            </button>
            <p class="text-[11px] text-slate-500 mt-1">Precio 0 para opciones sin costo, como "Sin cebolla".</p>
          </div>

          <!-- A qué aplica -->
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <p class="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Categorías completas</p>
              <div class="max-h-56 overflow-y-auto bg-slate-950/60 border border-slate-800 rounded-xl p-2 space-y-1">
                @for (c of categorias(); track c.id) {
                  <label class="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-800/60 text-sm text-slate-200 cursor-pointer">
                    <input type="checkbox" [checked]="g.categoryIds.includes(c.id)" (change)="alternar('categoryIds', c.id)" class="accent-indigo-500" />
                    {{ c.name }}
                  </label>
                } @empty {
                  <p class="text-xs text-slate-400 p-2">No hay categorías.</p>
                }
              </div>
            </div>
            <div>
              <p class="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Platillos sueltos</p>
              <input type="search" [ngModel]="buscar()" (ngModelChange)="buscar.set($event)" placeholder="Buscar platillo..."
                aria-label="Buscar platillo"
                class="w-full mb-2 bg-slate-950 border border-slate-800 rounded-lg py-1.5 px-2.5 text-sm text-white outline-none focus:border-indigo-500" />
              <div class="max-h-44 overflow-y-auto bg-slate-950/60 border border-slate-800 rounded-xl p-2 space-y-1">
                @for (p of productosFiltrados(); track p.id) {
                  <label class="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-800/60 text-sm text-slate-200 cursor-pointer">
                    <input type="checkbox" [checked]="g.productIds.includes(p.id)" (change)="alternar('productIds', p.id)" class="accent-indigo-500" />
                    <span class="flex-1 min-w-0 truncate">{{ p.name }}</span>
                    <span class="text-[11px] text-slate-500 shrink-0">{{ p.categoryName }}</span>
                  </label>
                } @empty {
                  <p class="text-xs text-slate-400 p-2">Sin coincidencias.</p>
                }
              </div>
            </div>
          </div>
          @if (g.categoryIds.length === 0 && g.productIds.length === 0) {
            <p class="text-[11px] text-amber-300">Todavía no aplica a ningún platillo: el cliente no lo verá.</p>
          }

          <div class="flex flex-col sm:flex-row sm:items-center justify-end gap-3 pt-2 border-t border-slate-800">
            @if (motivoBloqueo(); as motivo) {
              <p class="text-[11px] text-slate-400 sm:mr-auto">{{ motivo }}</p>
            }
            <button (click)="cancelar()" class="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 cursor-pointer">
              Cancelar
            </button>
            <button (click)="guardar()" [disabled]="motivoBloqueo() !== null || guardando()"
              class="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2">
              @if (guardando()) { <svg lucideLoader2 class="w-4 h-4 animate-spin"></svg> }
              Guardar grupo
            </button>
          </div>
        </div>
      }

      <!-- Lista -->
      @if (cargando()) {
        <div class="flex items-center gap-2 text-slate-400 text-sm py-10 justify-center">
          <svg lucideLoader2 class="w-4 h-4 animate-spin"></svg> Cargando adicionales...
        </div>
      } @else if (grupos().length === 0 && !editando()) {
        <div class="text-center py-14 px-6 bg-slate-900/40 border border-dashed border-slate-800 rounded-2xl">
          <svg lucideLayers class="w-8 h-8 text-slate-600 mx-auto"></svg>
          <p class="text-sm text-slate-300 font-semibold mt-3">Aún no hay adicionales</p>
          <p class="text-xs text-slate-400 mt-1 max-w-md mx-auto">
            Por ejemplo, un grupo "Extras" con carne extra +$25 y queso +$15 para todos los tacos, o "Tortilla" con maíz o
            harina, obligatorio.
          </p>
        </div>
      } @else {
        <ul class="grid grid-cols-1 md:grid-cols-2 gap-3">
          @for (g of grupos(); track g.id) {
            <li class="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-4 flex flex-col gap-2" [class.opacity-50]="!g.activo">
              <div class="flex items-start gap-2">
                <div class="min-w-0 flex-1">
                  <p class="font-bold text-white text-sm">{{ g.nombre }}</p>
                  <p class="text-[11px] text-indigo-300">{{ explicarRegla(g) }}</p>
                </div>
                <button (click)="editar(g)" class="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer" [attr.aria-label]="'Editar ' + g.nombre">
                  <svg lucideEdit class="w-4 h-4"></svg>
                </button>
                <button (click)="eliminar(g)" class="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer" [attr.aria-label]="'Eliminar ' + g.nombre">
                  <svg lucideTrash2 class="w-4 h-4"></svg>
                </button>
              </div>
              <p class="text-xs text-slate-300">
                @for (op of g.opciones; track op.id; let ultimo = $last) {
                  <span [class.line-through]="!op.activo" [class.text-slate-500]="!op.activo">{{ op.nombre }}@if (op.precio > 0) { (+\${{ op.precio }}) }@if (op.ingredientId) { <span class="text-emerald-400" title="Descuenta inventario">●</span> }</span>@if (!ultimo) {<span class="text-slate-600">, </span>}
                }
              </p>
              <p class="text-[11px] text-slate-500">Aplica a: {{ describirAlcance(g) }}</p>
            </li>
          }
        </ul>
      }
    </div>
  `,
})
export class AdicionalesAdminComponent implements OnInit {
  private readonly avisos = inject(AvisosService);
  private readonly http = inject(HttpClient);

  readonly categorias = input<Category[]>([]);
  readonly productos = input<Product[]>([]);
  readonly ingredientes = input<Ingredient[]>([]);

  readonly grupos = signal<GrupoAdicional[]>([]);
  readonly cargando = signal(true);
  readonly guardando = signal(false);
  readonly error = signal<string | null>(null);
  readonly editando = signal<GrupoAdicional | null>(null);
  readonly buscar = signal('');

  private readonly url = `${environment.apiUrl}/adicionales`;

  readonly productosFiltrados = computed(() => {
    const q = this.buscar().trim().toLowerCase();
    const todos = this.productos();
    return q ? todos.filter((p) => p.name.toLowerCase().includes(q)) : todos;
  });

  /** Por qué todavía no se puede guardar, dicho en palabras. */
  readonly motivoBloqueo = computed<string | null>(() => {
    const g = this.editando();
    if (!g) return null;
    if (!g.nombre.trim()) return 'Ponle nombre al grupo.';
    if (g.opciones.some((o) => !o.nombre.trim())) return 'Todas las opciones necesitan nombre.';
    const sinCantidad = g.opciones.find((o) => o.ingredientId && !(o.cantidadIngrediente && o.cantidadIngrediente > 0));
    if (sinCantidad) return `Indica cuánto ingrediente gasta "${sinCantidad.nombre || 'la opción'}".`;
    if (g.minimo < 0 || g.maximo < 1) return 'El mínimo va desde 0 y el máximo desde 1.';
    if (g.minimo > g.maximo) return 'El mínimo no puede ser mayor que el máximo.';
    const disponibles = g.opciones.filter((o) => o.activo).length;
    if (g.minimo > disponibles) return `Pide elegir ${g.minimo} pero solo hay ${disponibles} disponibles.`;
    return null;
  });

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.http.get<GrupoAdicional[]>(this.url).subscribe({
      next: (g) => {
        this.grupos.set(g);
        this.cargando.set(false);
      },
      error: (err) => {
        this.cargando.set(false);
        this.error.set(err.error?.error || 'No pudimos cargar los adicionales.');
      },
    });
  }

  explicarRegla(g: Pick<GrupoAdicional, 'minimo' | 'maximo'>): string {
    if (g.minimo === 1 && g.maximo === 1) return 'Obligatorio: el cliente elige una';
    if (g.minimo > 0) return `Obligatorio: elige de ${g.minimo} a ${g.maximo}`;
    return g.maximo === 1 ? 'Opcional: puede elegir una' : `Opcional: puede elegir hasta ${g.maximo}`;
  }

  describirAlcance(g: GrupoAdicional): string {
    const cats = this.categorias().filter((c) => g.categoryIds.includes(c.id)).map((c) => c.name);
    const prods = this.productos().filter((p) => g.productIds.includes(p.id)).map((p) => p.name);
    const partes = [...cats.map((c) => `toda la categoría ${c}`), ...prods];
    return partes.length ? partes.join(', ') : 'ningún platillo todavía';
  }

  nuevo(): void {
    this.error.set(null);
    this.buscar.set('');
    this.editando.set({
      id: null,
      nombre: '',
      minimo: 0,
      maximo: 3,
      orden: this.grupos().length,
      activo: true,
      opciones: [{ id: null, nombre: '', precio: 0, activo: true, ingredientId: null, cantidadIngrediente: null }],
      categoryIds: [],
      productIds: [],
    });
  }

  editar(g: GrupoAdicional): void {
    this.error.set(null);
    this.buscar.set('');
    // Copia profunda: lo que se edita no toca la lista hasta guardar.
    this.editando.set({
      ...g,
      opciones: g.opciones.map((o) => ({ ...o })),
      categoryIds: [...g.categoryIds],
      productIds: [...g.productIds],
    });
  }

  cancelar(): void {
    this.editando.set(null);
  }

  cambiar(cambio: Partial<GrupoAdicional>): void {
    this.editando.update((g) => (g ? { ...g, ...cambio } : g));
  }

  cambiarOpcion(i: number, cambio: Partial<OpcionAdicional>): void {
    this.editando.update((g) =>
      g ? { ...g, opciones: g.opciones.map((o, j) => (j === i ? { ...o, ...cambio } : o)) } : g
    );
  }

  cambiarIngrediente(i: number, id: string): void {
    this.cambiarOpcion(i, id ? { ingredientId: id } : { ingredientId: null, cantidadIngrediente: null });
  }

  /** La unidad en que se lleva el ingrediente: la cantidad se escribe en ella. */
  unidadDe(ingredientId: string | null): string {
    return this.ingredientes().find((x) => x.id === ingredientId)?.unitOfMeasure ?? '';
  }

  agregarOpcion(): void {
    this.editando.update((g) =>
      g ? { ...g, opciones: [...g.opciones, { id: null, nombre: '', precio: 0, activo: true, ingredientId: null, cantidadIngrediente: null }] } : g
    );
  }

  quitarOpcion(i: number): void {
    this.editando.update((g) => (g ? { ...g, opciones: g.opciones.filter((_, j) => j !== i) } : g));
  }

  mover(i: number, delta: number): void {
    this.editando.update((g) => {
      if (!g) return g;
      const opciones = [...g.opciones];
      const j = i + delta;
      if (j < 0 || j >= opciones.length) return g;
      [opciones[i], opciones[j]] = [opciones[j], opciones[i]];
      return { ...g, opciones };
    });
  }

  alternar(campo: 'categoryIds' | 'productIds', id: string): void {
    this.editando.update((g) => {
      if (!g) return g;
      const lista = g[campo].includes(id) ? g[campo].filter((x) => x !== id) : [...g[campo], id];
      return { ...g, [campo]: lista };
    });
  }

  guardar(): void {
    const g = this.editando();
    if (!g || this.motivoBloqueo() !== null) return;

    this.guardando.set(true);
    this.error.set(null);
    const peticion = g.id ? this.http.put<GrupoAdicional>(`${this.url}/${g.id}`, g) : this.http.post<GrupoAdicional>(this.url, g);

    peticion.subscribe({
      next: (guardado) => {
        this.guardando.set(false);
        this.editando.set(null);
        this.grupos.update((lista) =>
          g.id ? lista.map((x) => (x.id === guardado.id ? guardado : x)) : [...lista, guardado]
        );
      },
      error: (err) => {
        this.guardando.set(false);
        this.error.set(err.error?.error || err.error?.message || 'No pudimos guardar el grupo.');
      },
    });
  }

  async eliminar(g: GrupoAdicional): Promise<void> {
    if (!g.id) return;
    const ok = (await this.avisos.confirmar({ titulo: `¿Eliminar el grupo ${g.nombre}?`, mensaje: 'Deja de aparecer en el menú. Los pedidos pasados conservan lo que se eligió.', confirmar: 'Eliminar grupo', peligro: true }));
    if (!ok) return;

    this.http.delete(`${this.url}/${g.id}`).subscribe({
      next: () => this.grupos.update((lista) => lista.filter((x) => x.id !== g.id)),
      error: (err) => this.error.set(err.error?.error || 'No pudimos eliminar el grupo.'),
    });
  }
}
