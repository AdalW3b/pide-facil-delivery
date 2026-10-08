import { ComprasInventarioComponent } from './compras-inventario.component';
import { ProveedoresInventarioComponent } from './proveedores-inventario.component';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../environments/environment';
import { AvisosService } from '../../core/services/avisos.service';
import { AuthService } from '../../core/services/auth.service';
import { SucursalActivaService } from '../../core/services/sucursal-activa.service';
import { TituloPaginaComponent } from '../../shared/components/titulo-pagina.component';
import { PesosPipe } from '../../shared/utils/pesos';
import { cantidadLegible, convertirUnidad, unidadesCompatibles } from '../../shared/utils/unidades';
import { MovimientoInventarioComponent, ObjetivoInventario } from '../catalog/movimiento-inventario.component';
import { HistorialInventarioComponent } from '../catalog/historial-inventario.component';
import { ControlInventarioComponent } from '../catalog/control-inventario.component';

/** Ingrediente o producto terminado: la pantalla los maneja igual. */
interface Articulo {
  tipo: 'INGREDIENTE' | 'PRODUCTO';
  id: string;
  nombre: string;
  unidad: string;
  existencia: number;
  minimo: number | null;
  costo: number | null;
  zonaId: string | null;
  zona: string | null;
  activo: boolean;
  usos: number;
  esPreparado: boolean;
}

/** Una zona dada de alta: "Refri", "Almacén". */
interface Zona {
  id: string;
  nombre: string;
  orden: number;
  articulos: number;
}

interface Renglon {
  clave: string;
  cantidad: number | null;
  unidad: string;
}

interface Componente {
  componenteId: string;
  nombre?: string;
  cantidad: number | null;
  unidad: string;
}

interface Preparacion {
  preparadoId: string;
  nombre: string;
  unidad: string;
  rinde: number | null;
  componentes: Componente[];
  costoPorUnidad: number | null;
  /** Si al vender no alcanza lo registrado, se prepara sola con sus ingredientes. */
  prepararAlVender: boolean;
}

/** Lo que va a usar una preparación de un ingrediente, contra lo que hay. */
interface UsoPrevisto {
  nombre: string;
  usa: number;
  hay: number;
  unidad: string;
  alcanza: boolean;
}

interface RenglonReporte {
  tipo: string;
  id: string;
  nombre: string;
  unidad: string;
  existencia: number;
  minimo: number | null;
  entradas: number;
  consumo: number;
  merma: number;
  costoUnitario: number | null;
  costoConsumo: number | null;
  costoMerma: number | null;
  consumoDiario: number;
  diasQueAlcanza: number | null;
  sugerido: number;
  esPreparado: boolean;
  diferenciaConteo: number;
  costoDiferencia: number | null;
}

/** El costeo de cada sucursal, para el dueño. */
interface CosteoSucursal {
  branchId: string;
  sucursal: string;
  costoConsumo: number;
  costoMerma: number;
  costoDiferencias: number;
  porReponer: number;
}

interface CosteoRestaurante {
  costoConsumo: number;
  costoMerma: number;
  costoDiferencias: number;
  sucursales: CosteoSucursal[];
}

interface Reporte {
  desde: string;
  hasta: string;
  costoConsumo: number;
  costoMerma: number;
  costoDiferencias: number;
  renglones: RenglonReporte[];
}

type Pestana = 'existencias' | 'compras' | 'proveedores' | 'conteo' | 'preparaciones' | 'transferencias' | 'reporte';

const PESTANAS: { id: Pestana; nombre: string }[] = [
  { id: 'existencias', nombre: 'Existencias' },
  { id: 'compras', nombre: 'Compras' },
  { id: 'proveedores', nombre: 'Proveedores' },
  { id: 'conteo', nombre: 'Conteo' },
  { id: 'preparaciones', nombre: 'Preparaciones' },
  { id: 'transferencias', nombre: 'Transferencias' },
  { id: 'reporte', nombre: 'Reporte' },
];

const INPUT = 'w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-sm text-white outline-none focus:border-indigo-500';

/**
 * El inventario de la sucursal en un solo lugar: lo que hay, lo que llega, lo
 * que se cuenta, lo que se prepara, lo que se pasa a otra sucursal y el
 * reporte de consumo y merma. Tiene su propio permiso: quien lleva el almacén
 * no necesita tocar precios ni platillos.
 */
@Component({
  selector: 'app-inventario',
  standalone: true,
  imports: [FormsModule, TituloPaginaComponent, PesosPipe, MovimientoInventarioComponent, HistorialInventarioComponent, ControlInventarioComponent, ComprasInventarioComponent, ProveedoresInventarioComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6 min-h-screen bg-slate-950 text-slate-100 p-2 sm:p-4">
      <app-titulo-pagina titulo="Inventario" descripcion="Lo que hay, lo que llega, lo que se tira y lo que conviene comprar." />

      @if (!branchId()) {
        <p class="text-sm text-slate-400">Elige una sucursal en la barra de arriba.</p>
      } @else {
        <nav class="flex gap-1 overflow-x-auto pb-1" aria-label="Secciones del inventario">
          @for (p of pestanas; track p.id) {
            <button type="button" (click)="pestana.set(p.id)" [attr.aria-current]="pestana() === p.id ? 'page' : null"
              class="px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-colors"
              [class]="pestana() === p.id ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'">
              {{ p.nombre }}
            </button>
          }
        </nav>

        <!-- ============================== EXISTENCIAS -->
        @if (pestana() === 'existencias') {
          <section class="space-y-4">
            @if (puedeMover()) { <app-control-inventario [branchId]="branchId()" /> }
            <div class="flex flex-wrap items-center gap-2">
              <input type="search" placeholder="Buscar…" [value]="busqueda()" (input)="busqueda.set($any($event.target).value)"
                class="w-full sm:w-60 bg-slate-900 border border-slate-800 rounded-lg py-2 px-3 text-sm text-white outline-none focus:border-indigo-500" aria-label="Buscar artículo" />
              <select [value]="zonaFiltro()" (change)="zonaFiltro.set($any($event.target).value)" aria-label="Zona"
                class="bg-slate-900 border border-slate-800 rounded-lg py-2 px-3 text-sm text-white cursor-pointer [color-scheme:dark]">
                <option value="">Todas las zonas</option>
                @for (z of zonas(); track z.id) { <option [value]="z.id">{{ z.nombre }}</option> }
              </select>
              @if (puedeMover()) {
                <button type="button" (click)="administrandoZonas.set(true)" class="text-xs font-semibold text-indigo-400 hover:text-indigo-300 cursor-pointer">Administrar zonas</button>
              }
              <div class="inline-flex p-1 bg-slate-900 border border-slate-800 rounded-lg" role="group" aria-label="Estado">
                @for (f of filtros; track f.id) {
                  <button type="button" (click)="filtro.set(f.id)" [attr.aria-pressed]="filtro() === f.id"
                    class="px-3 py-1 rounded-md text-xs font-semibold cursor-pointer"
                    [class]="filtro() === f.id ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'">
                    {{ f.nombre }} · {{ cuantos(f.id) }}
                  </button>
                }
              </div>
            </div>

            <div class="overflow-x-auto border border-slate-800 rounded-xl">
              <table class="w-full text-sm">
                <thead class="bg-slate-900 text-[11px] uppercase tracking-wider text-slate-400 text-left">
                  <tr>
                    <th class="py-3 px-4">Artículo</th>
                    <th class="py-3 px-4">Zona</th>
                    <th class="py-3 px-4 text-right">Hay</th>
                    <th class="py-3 px-4 text-right">Mínimo</th>
                    <th class="py-3 px-4 text-right">Costo</th>
                    <th class="py-3 px-4 text-right"><span class="sr-only">Acciones</span></th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-800">
                  @for (a of visibles(); track a.tipo + a.id) {
                    <tr class="hover:bg-slate-900/60" [class.opacity-50]="!a.activo">
                      <td class="py-3 px-4">
                        <span class="font-semibold text-white">{{ a.nombre }}</span>
                        <span class="block text-[11px] text-slate-500">
                          {{ a.tipo === 'PRODUCTO' ? 'Producto terminado' : a.esPreparado ? 'Preparación' : (a.usos ? 'En ' + a.usos + (a.usos === 1 ? ' platillo' : ' platillos') : 'Ingrediente') }}
                          @if (!a.activo) { · desactivado }
                        </span>
                      </td>
                      <td class="py-3 px-4 text-slate-400">{{ a.zona || '—' }}</td>
                      <td class="py-3 px-4 text-right tabular-nums font-bold" [class]="claseExistencia(a)">{{ legible(a.existencia, a) }}</td>
                      <td class="py-3 px-4 text-right tabular-nums text-slate-400">{{ a.minimo ? legible(a.minimo, a) : '—' }}</td>
                      <td class="py-3 px-4 text-right tabular-nums text-slate-400">{{ a.costo !== null ? (a.costo | pesos) + '/' + unidadCorta(a) : '—' }}</td>
                      <td class="py-3 px-4">
                        <div class="flex justify-end gap-1">
                          @if (puedeMover()) {
                            <button (click)="mover(a)" class="px-2.5 py-1 rounded-lg bg-sky-500/10 text-sky-300 text-xs font-semibold hover:bg-sky-500/20 cursor-pointer">Movimiento</button>
                          }
                          <button (click)="verHistorial(a)" class="px-2.5 py-1 rounded-lg text-slate-400 text-xs font-semibold hover:text-white hover:bg-slate-800 cursor-pointer">Historial</button>
                          @if (puedeMover()) {
                            <button (click)="editar(a)" class="px-2.5 py-1 rounded-lg text-slate-400 text-xs font-semibold hover:text-white hover:bg-slate-800 cursor-pointer">Editar</button>
                          }
                        </div>
                      </td>
                    </tr>
                  } @empty {
                    <tr><td colspan="6" class="py-10 text-center text-slate-500">No hay artículos con ese filtro.</td></tr>
                  }
                </tbody>
              </table>
            </div>
          </section>
        }

        <!-- ============================== COMPRAS -->
        @if (pestana() === 'compras') {
          <app-compras-inventario [branchId]="branchId()" [articulos]="articulos()" [puedeAnular]="puedeMover()" (registrada)="cargarExistencias()" />
        }

        <!-- ============================== PROVEEDORES -->
        @if (pestana() === 'proveedores') {
          <app-proveedores-inventario [branchId]="branchId()" [articulos]="articulos()" [puedeEditar]="puedeMover()" />
        }

        <!-- ============================== CONTEO -->
        @if (pestana() === 'conteo') {
          <section class="space-y-4 max-w-3xl">
            <p class="text-xs text-slate-400">Ve a la zona, cuenta lo que hay y escríbelo. Lo que dejes vacío no se toca; lo que cuentes queda en el historial con la diferencia.</p>
            <div class="flex flex-wrap gap-2">
              <select [value]="zonaConteo()" (change)="zonaConteo.set($any($event.target).value)" aria-label="Zona a contar"
                class="bg-slate-900 border border-slate-800 rounded-lg py-2 px-3 text-sm text-white cursor-pointer [color-scheme:dark]">
                <option value="">Todas las zonas</option>
                @for (z of zonas(); track z.id) { <option [value]="z.id">{{ z.nombre }}</option> }
                <option value="__sin">Sin zona</option>
              </select>
              <input [ngModel]="notaConteo()" (ngModelChange)="notaConteo.set($event)" maxlength="300" placeholder="Nota (opcional)" aria-label="Nota del conteo"
                class="flex-1 min-w-40 bg-slate-900 border border-slate-800 rounded-lg py-2 px-3 text-sm text-white outline-none focus:border-indigo-500" />
            </div>
            <ul class="divide-y divide-slate-800 border border-slate-800 rounded-xl">
              @for (a of paraContar(); track a.tipo + a.id) {
                <li class="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
                  <div class="w-full sm:w-auto sm:flex-1 min-w-0">
                    <p class="text-sm font-semibold text-white">{{ a.nombre }}</p>
                    <p class="text-[11px] text-slate-500">El sistema dice {{ legible(a.existencia, a) }}</p>
                  </div>
                  <input type="number" inputmode="decimal" min="0" step="any" [attr.aria-label]="'Cuánto hay de ' + a.nombre"
                    [ngModel]="contado()[clave(a)] ?? null" (ngModelChange)="contar(a, $event)"
                    class="w-24 bg-slate-950 border border-slate-800 rounded-lg py-2 px-2 text-sm text-white text-right tabular-nums outline-none focus:border-indigo-500" />
                  <span class="text-xs text-slate-400">{{ unidadCorta(a) }}</span>
                  <span class="ml-auto min-w-16 text-right text-xs tabular-nums" [class]="claseDiferencia(a)">{{ diferencia(a) }}</span>
                </li>
              } @empty {
                <li class="px-4 py-8 text-center text-sm text-slate-500">No hay artículos en esa zona. Asígnales zona en Existencias → Editar.</li>
              }
            </ul>
            <div class="flex justify-end">
              <button (click)="guardarConteo()" [disabled]="contados() === 0 || guardando()"
                class="px-5 py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
                {{ guardando() ? 'Guardando…' : 'Guardar conteo (' + contados() + ')' }}
              </button>
            </div>
          </section>
        }

        <!-- ============================== PREPARACIONES -->
        @if (pestana() === 'preparaciones') {
          <section class="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div class="space-y-3">
              <div class="flex items-center justify-between">
                <h2 class="text-sm font-bold text-white">Preparaciones</h2>
                @if (puedeMover()) {
                  <button (click)="nuevaPreparacion()" class="text-xs font-bold text-indigo-400 hover:text-indigo-300 cursor-pointer">+ Nueva preparación</button>
                }
              </div>
              <p class="text-xs text-slate-400">Salsas, frijoles, carne marinada: se hacen con otros ingredientes. Al registrar lo que preparaste, salen sus ingredientes y entra lo preparado con su costo.</p>
              @for (p of preparaciones(); track p.preparadoId) {
                <article class="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-2">
                  <div class="flex items-baseline gap-2">
                    <strong class="text-white">{{ p.nombre }}</strong>
                    <span class="text-xs text-slate-500">rinde {{ p.rinde }} {{ p.unidad }} por tanda</span>
                    @if (p.costoPorUnidad !== null) { <span class="ml-auto text-xs text-slate-400 tabular-nums">{{ p.costoPorUnidad | pesos }}/{{ p.unidad }}</span> }
                  </div>
                  <p class="text-xs text-slate-400">{{ describirComponentes(p) }}</p>
                  @if (p.prepararAlVender) {
                    <p class="text-[11px] text-emerald-300">Se prepara sola al vender si no alcanza lo registrado.</p>
                  }
                  @if (previsto(p); as usos) {
                    <ul class="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 space-y-0.5 text-[11px]" aria-label="Lo que se va a usar">
                      @for (u of usos; track u.nombre) {
                        <li class="flex justify-between gap-3" [class]="u.alcanza ? 'text-slate-300' : 'text-rose-300'">
                          <span>{{ u.nombre }}: usa {{ legibleU(u.usa, u.unidad) }}</span>
                          <span class="tabular-nums">{{ u.alcanza ? 'hay ' + legibleU(u.hay, u.unidad) : 'solo hay ' + legibleU(u.hay, u.unidad) }}</span>
                        </li>
                      }
                    </ul>
                  }
                  @if (puedeMover()) {
                    <div class="flex flex-wrap items-center gap-2 pt-1">
                      <input type="number" min="0" step="any" [attr.aria-label]="'Cuánto preparaste de ' + p.nombre" placeholder="Cuánto hiciste"
                        [ngModel]="aProducir()[p.preparadoId]" (ngModelChange)="fijarProducir(p.preparadoId, $event)"
                        class="w-32 bg-slate-950 border border-slate-800 rounded-lg py-1.5 px-2 text-sm text-white tabular-nums outline-none focus:border-indigo-500" />
                      <span class="text-xs text-slate-400">{{ p.unidad }}</span>
                      <button (click)="producir(p)" [disabled]="!(aProducir()[p.preparadoId] > 0) || guardando()"
                        class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold cursor-pointer disabled:opacity-40">Registrar lo que preparé</button>
                      <button (click)="editarPreparacion(p)" class="ml-auto text-xs text-slate-400 hover:text-white cursor-pointer">Editar receta</button>
                    </div>
                  }
                </article>
              } @empty {
                <p class="text-xs text-slate-500">Todavía no hay preparaciones.</p>
              }
            </div>

            @if (editandoPrep(); as e) {
              <div class="rounded-xl border border-indigo-500/30 bg-slate-900/60 p-4 space-y-3 self-start">
                <h2 class="text-sm font-bold text-white">{{ e.preparadoId ? 'Receta de ' + nombreDe('INGREDIENTE', e.preparadoId) : 'Nueva preparación' }}</h2>
                <div>
                  <label for="p-ing" class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Qué se prepara</label>
                  <select id="p-ing" [ngModel]="e.preparadoId" (ngModelChange)="e.preparadoId = $event; editandoPrep.set({ ...e })" class="${INPUT} [color-scheme:dark]">
                    <option value="">Elige el ingrediente (créalo antes en Catálogo)</option>
                    @for (a of ingredientesParaPreparar(); track a.id) { <option [value]="a.id">{{ a.nombre }} ({{ a.unidad }})</option> }
                  </select>
                </div>
                <div>
                  <label for="p-rinde" class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Una tanda rinde ({{ unidadDePreparado(e.preparadoId) }})</label>
                  <input id="p-rinde" type="number" min="0" step="any" [ngModel]="e.rinde" (ngModelChange)="e.rinde = $event" class="${INPUT} tabular-nums" />
                </div>
                <p class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Ingredientes de una tanda</p>
                @for (c of e.componentes; track $index) {
                  <div class="grid grid-cols-12 gap-2 items-center">
                    <select [ngModel]="c.componenteId" (ngModelChange)="c.componenteId = $event; c.unidad = unidadDeIngrediente($event)" aria-label="Ingrediente" class="col-span-6 ${INPUT} [color-scheme:dark]">
                      <option value="">Ingrediente</option>
                      @for (a of componentesPosibles(e.preparadoId); track a.id) { <option [value]="a.id">{{ a.nombre }}{{ a.esPreparado ? ' · preparación' : '' }}</option> }
                    </select>
                    <input type="number" min="0" step="any" [ngModel]="c.cantidad" (ngModelChange)="c.cantidad = $event" aria-label="Cantidad" class="col-span-3 ${INPUT} tabular-nums" />
                    <select [ngModel]="c.unidad" (ngModelChange)="c.unidad = $event" aria-label="Unidad" class="col-span-2 ${INPUT} [color-scheme:dark]">
                      @for (u of unidadesDeIngrediente(c.componenteId); track u) { <option [value]="u">{{ u }}</option> }
                    </select>
                    <button type="button" (click)="e.componentes.splice($index, 1); editandoPrep.set({ ...e })" aria-label="Quitar" class="col-span-1 text-slate-500 hover:text-rose-400 cursor-pointer">✕</button>
                  </div>
                }
                <button type="button" (click)="e.componentes.push({ componenteId: '', cantidad: null, unidad: '' }); editandoPrep.set({ ...e })"
                  class="text-xs font-bold text-indigo-400 hover:text-indigo-300 cursor-pointer">+ Agregar ingrediente</button>
                <label class="flex items-start gap-2 text-xs text-slate-300 cursor-pointer">
                  <input type="checkbox" [ngModel]="e.prepararAlVender" (ngModelChange)="e.prepararAlVender = $event"
                    class="mt-0.5 accent-indigo-500" />
                  <span>
                    <strong class="text-white">Prepararla sola al vender</strong><br />
                    Si se vende más de la que registró la cocina, lo que falta se prepara en ese momento con sus ingredientes.
                    Así no queda en negativo cuando a alguien se le olvida registrarla.
                  </span>
                </label>
                <div class="flex items-center gap-3 pt-2">
                  @if (e.preparadoId && esPreparacionExistente(e.preparadoId)) {
                    <button (click)="quitarPreparacion(e.preparadoId)" class="text-xs text-rose-400 hover:text-rose-300 cursor-pointer">Ya no es preparación</button>
                  }
                  <button (click)="editandoPrep.set(null)" class="ml-auto text-xs text-slate-400 hover:text-white cursor-pointer">Cancelar</button>
                  <button (click)="guardarPreparacion()" [disabled]="guardando()"
                    class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold cursor-pointer disabled:opacity-40">Guardar receta</button>
                </div>
              </div>
            }
          </section>
        }

        <!-- ============================== TRANSFERENCIAS -->
        @if (pestana() === 'transferencias') {
          <section class="max-w-3xl space-y-4 rounded-xl border border-slate-800 bg-slate-900/40 p-4">
            <h2 class="text-sm font-bold text-white">Pasar mercancía a otra sucursal</h2>
            @if (otrasSucursales().length === 0) {
              <p class="text-xs text-slate-400">Este restaurante no tiene otras sucursales.</p>
            } @else {
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label for="t-dest" class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">A qué sucursal</label>
                  <select id="t-dest" [ngModel]="destino()" (ngModelChange)="destino.set($event)" class="${INPUT} [color-scheme:dark]">
                    <option value="">Elige la sucursal</option>
                    @for (s of otrasSucursales(); track s.id) { <option [value]="s.id">{{ s.name }}</option> }
                  </select>
                </div>
                <div>
                  <label for="t-nota" class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Nota</label>
                  <input id="t-nota" [ngModel]="notaTransferencia()" (ngModelChange)="notaTransferencia.set($event)" maxlength="300" placeholder="Opcional" class="${INPUT}" />
                </div>
              </div>
              @for (r of renglonesTransferencia(); track $index) {
                <div class="grid grid-cols-12 gap-2 items-center">
                  <select [ngModel]="r.clave" (ngModelChange)="cambiarArticulo(r, $event)" aria-label="Artículo" class="col-span-12 sm:col-span-6 ${INPUT} [color-scheme:dark]">
                    <option value="">Elige un artículo</option>
                    @for (a of activos(); track a.tipo + a.id) { <option [value]="clave(a)">{{ a.nombre }} (hay {{ legible(a.existencia, a) }})</option> }
                  </select>
                  <input type="number" min="0" step="any" [ngModel]="r.cantidad" (ngModelChange)="r.cantidad = $event; renglonesTransferencia.set([...renglonesTransferencia()])" aria-label="Cantidad" class="col-span-5 sm:col-span-3 ${INPUT} tabular-nums" />
                  <select [ngModel]="r.unidad" (ngModelChange)="r.unidad = $event" aria-label="Unidad" class="col-span-6 sm:col-span-2 ${INPUT} [color-scheme:dark]">
                    @for (u of unidadesDe(r.clave); track u) { <option [value]="u">{{ u }}</option> }
                  </select>
                  <button type="button" (click)="quitarRenglon(renglonesTransferencia, $index)" aria-label="Quitar renglón" class="col-span-1 text-slate-500 hover:text-rose-400 cursor-pointer">✕</button>
                </div>
              }
              <div class="flex items-center gap-3">
                <button type="button" (click)="agregarRenglon(renglonesTransferencia)" class="text-xs font-bold text-indigo-400 hover:text-indigo-300 cursor-pointer">+ Agregar artículo</button>
                <button (click)="transferir()" [disabled]="!destino() || !listos(renglonesTransferencia()) || guardando()"
                  class="ml-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
                  {{ guardando() ? 'Guardando…' : 'Pasar mercancía' }}
                </button>
              </div>
            }
          </section>
        }

        <!-- ============================== REPORTE -->
        @if (pestana() === 'reporte') {
          <section class="space-y-4">
            <div class="flex flex-wrap items-center gap-2">
              @for (d of rangos; track d) {
                <button type="button" (click)="cargarReporte(d)" [attr.aria-pressed]="dias() === d"
                  class="px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
                  [class]="dias() === d ? 'bg-slate-700 text-white' : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'">
                  Últimos {{ d }} días
                </button>
              }
            </div>
            @if (esDueno() && costeoTodas(); as t) {
              @if (t.sucursales.length > 1) {
                <div class="rounded-xl border border-indigo-500/30 bg-slate-900/40 overflow-x-auto">
                  <h2 class="px-4 pt-4 text-sm font-bold text-white">Todas tus sucursales</h2>
                  <p class="px-4 text-[11px] text-slate-400">Cada sucursal con sus propios costos. Elige una para ver su detalle abajo.</p>
                  <table class="w-full text-sm mt-2">
                    <thead class="text-[11px] uppercase tracking-wider text-slate-400 text-left">
                      <tr>
                        <th class="py-2 px-4">Sucursal</th>
                        <th class="py-2 px-4 text-right">Consumido</th>
                        <th class="py-2 px-4 text-right">Merma</th>
                        <th class="py-2 px-4 text-right">Conteos</th>
                        <th class="py-2 px-4 text-right">Por reponer</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-800">
                      @for (x of t.sucursales; track x.branchId) {
                        <tr class="cursor-pointer hover:bg-slate-800/40" [class.bg-indigo-500/10]="x.branchId === branchId()"
                          (click)="verSucursal(x.branchId)" tabindex="0" (keydown.enter)="verSucursal(x.branchId)"
                          [attr.aria-current]="x.branchId === branchId() ? 'true' : null">
                          <td class="py-2.5 px-4 text-white font-medium">{{ x.sucursal }}</td>
                          <td class="py-2.5 px-4 text-right tabular-nums text-slate-300">{{ x.costoConsumo | pesos }}</td>
                          <td class="py-2.5 px-4 text-right tabular-nums text-rose-300">{{ x.costoMerma | pesos }}</td>
                          <td class="py-2.5 px-4 text-right tabular-nums" [class]="x.costoDiferencias < 0 ? 'text-rose-300' : 'text-slate-300'">{{ x.costoDiferencias | pesos }}</td>
                          <td class="py-2.5 px-4 text-right tabular-nums" [class]="x.porReponer > 0 ? 'text-amber-300' : 'text-slate-500'">{{ x.porReponer }}</td>
                        </tr>
                      }
                      <tr class="font-bold">
                        <td class="py-2.5 px-4 text-white">Total</td>
                        <td class="py-2.5 px-4 text-right tabular-nums text-white">{{ t.costoConsumo | pesos }}</td>
                        <td class="py-2.5 px-4 text-right tabular-nums text-rose-300">{{ t.costoMerma | pesos }}</td>
                        <td class="py-2.5 px-4 text-right tabular-nums" [class]="t.costoDiferencias < 0 ? 'text-rose-300' : 'text-white'">{{ t.costoDiferencias | pesos }}</td>
                        <td class="py-2.5 px-4"></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              }
            }
            @if (reporte(); as r) {
              <h2 class="text-sm font-bold text-white">{{ esDueno() && (costeoTodas()?.sucursales?.length ?? 0) > 1 ? 'Detalle de ' + nombreSucursal() : 'Costeo de tu sucursal' }}</h2>
              <dl class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                <div class="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
                  <dt class="text-[11px] uppercase tracking-wider text-slate-400 font-bold">Costo de lo consumido</dt>
                  <dd class="text-2xl font-black text-white tabular-nums mt-1">{{ r.costoConsumo | pesos }}</dd>
                </div>
                <div class="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
                  <dt class="text-[11px] uppercase tracking-wider text-slate-400 font-bold">Costo de la merma</dt>
                  <dd class="text-2xl font-black text-rose-300 tabular-nums mt-1">{{ r.costoMerma | pesos }}</dd>
                </div>
                <div class="rounded-xl border border-slate-800 bg-slate-900/40 p-4" title="Lo que los conteos encontraron de menos (o de más) contra lo que decía el sistema">
                  <dt class="text-[11px] uppercase tracking-wider text-slate-400 font-bold">{{ r.costoDiferencias < 0 ? 'Faltante en conteos' : 'Diferencia en conteos' }}</dt>
                  <dd class="text-2xl font-black tabular-nums mt-1" [class]="r.costoDiferencias < 0 ? 'text-rose-300' : 'text-white'">{{ r.costoDiferencias | pesos }}</dd>
                </div>
                <div class="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
                  <dt class="text-[11px] uppercase tracking-wider text-slate-400 font-bold">Por comprar</dt>
                  <dd class="text-2xl font-black text-amber-300 tabular-nums mt-1">{{ porComprar().length }} <span class="text-sm font-semibold text-slate-400">artículos</span></dd>
                </div>
              </dl>

              @if (porComprar().length > 0) {
                <div class="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
                  <h2 class="text-sm font-bold text-amber-200">Lista de compras para una semana</h2>
                  <ul class="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
                    @for (x of porComprar(); track x.id) {
                      <li class="flex justify-between gap-3"><span class="text-slate-200">{{ x.nombre }}</span><span class="tabular-nums text-amber-200">{{ legibleR(x.sugerido, x) }}</span></li>
                    }
                  </ul>
                </div>
              }
              @if (porPreparar().length > 0) {
                <div class="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
                  <h2 class="text-sm font-bold text-emerald-200">Por preparar en la semana</h2>
                  <p class="text-[11px] text-slate-400">Se hacen en cocina con sus ingredientes; regístralas en Preparaciones.</p>
                  <ul class="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
                    @for (x of porPreparar(); track x.id) {
                      <li class="flex justify-between gap-3"><span class="text-slate-200">{{ x.nombre }}</span><span class="tabular-nums text-emerald-200">{{ legibleR(x.sugerido, x) }}</span></li>
                    }
                  </ul>
                </div>
              }

              <div class="overflow-x-auto border border-slate-800 rounded-xl">
                <table class="w-full text-sm">
                  <thead class="bg-slate-900 text-[11px] uppercase tracking-wider text-slate-400 text-left">
                    <tr>
                      <th class="py-3 px-4">Artículo</th>
                      <th class="py-3 px-4 text-right">Consumo</th>
                      <th class="py-3 px-4 text-right">Merma</th>
                      <th class="py-3 px-4 text-right" title="Lo que los conteos encontraron de menos (−) o de más (+)">Conteos</th>
                      <th class="py-3 px-4 text-right">Costo</th>
                      <th class="py-3 px-4 text-right">Hay</th>
                      <th class="py-3 px-4 text-right">Alcanza</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-800">
                    @for (x of r.renglones; track x.id) {
                      <tr>
                        <td class="py-2.5 px-4 text-white">{{ x.nombre }}</td>
                        <td class="py-2.5 px-4 text-right tabular-nums text-slate-300">{{ legibleR(x.consumo, x) }}</td>
                        <td class="py-2.5 px-4 text-right tabular-nums" [class]="x.merma > 0 ? 'text-rose-300' : 'text-slate-500'">{{ x.merma > 0 ? legibleR(x.merma, x) : '—' }}</td>
                        <td class="py-2.5 px-4 text-right tabular-nums" [class]="x.diferenciaConteo < 0 ? 'text-rose-300' : x.diferenciaConteo > 0 ? 'text-slate-300' : 'text-slate-500'"
                          [title]="x.costoDiferencia !== null ? 'A costo: ' + (x.costoDiferencia | pesos) : ''">
                          {{ x.diferenciaConteo === 0 ? '—' : (x.diferenciaConteo > 0 ? '+' : '') + legibleR(x.diferenciaConteo, x) }}
                        </td>
                        <td class="py-2.5 px-4 text-right tabular-nums text-slate-300">{{ x.costoConsumo !== null ? (x.costoConsumo | pesos) : '—' }}</td>
                        <td class="py-2.5 px-4 text-right tabular-nums" [class]="x.existencia < 0 ? 'text-rose-300' : 'text-slate-300'">{{ legibleR(x.existencia, x) }}</td>
                        <td class="py-2.5 px-4 text-right tabular-nums" [class]="x.diasQueAlcanza !== null && x.diasQueAlcanza < 3 ? 'text-amber-300 font-bold' : 'text-slate-400'">
                          {{ x.diasQueAlcanza !== null ? x.diasQueAlcanza + ' días' : '—' }}
                        </td>
                      </tr>
                    } @empty {
                      <tr><td colspan="7" class="py-10 text-center text-slate-500">Sin movimientos en este periodo.</td></tr>
                    }
                  </tbody>
                </table>
              </div>
              <p class="text-[11px] text-slate-500">El costo usa el costo promedio de cada artículo: regístralo en las compras (o en Existencias → Editar) para que el reporte sea completo.</p>
            } @else {
              <p class="text-sm text-slate-500">Cargando…</p>
            }
          </section>
        }
      }

      @if (movimientoDe(); as o) {
        <app-movimiento-inventario [branchId]="branchId()" [objetivo]="o" (cerrar)="movimientoDe.set(null)" (guardado)="alMover($event)" />
      }
      @if (historialDe(); as o) {
        <app-historial-inventario [branchId]="branchId()" [objetivo]="o" (cerrar)="historialDe.set(null)" />
      }

      <!-- Zonas dadas de alta -->
      @if (administrandoZonas()) {
        <div class="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="zonas-titulo">
          <div (click)="administrandoZonas.set(false)" class="absolute inset-0 bg-slate-950/70"></div>
          <div class="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div>
              <h3 id="zonas-titulo" class="text-base font-bold text-white">Zonas del inventario</h3>
              <p class="text-xs text-slate-400 mt-0.5">Los lugares donde guardas la mercancía. Se dan de alta una vez y luego se eligen en cada artículo.</p>
            </div>
            <ul class="space-y-2">
              @for (z of zonas(); track z.id) {
                <li class="flex items-center gap-2">
                  <input [value]="z.nombre" #nombreZona maxlength="40" [attr.aria-label]="'Nombre de ' + z.nombre"
                    (keydown.enter)="renombrarZona(z, nombreZona.value)" (blur)="renombrarZona(z, nombreZona.value)"
                    class="flex-1 ${INPUT}" />
                  <span class="text-[11px] text-slate-500 w-20 text-right">{{ z.articulos }} {{ z.articulos === 1 ? 'artículo' : 'artículos' }}</span>
                  <button type="button" (click)="borrarZona(z)" [attr.aria-label]="'Borrar ' + z.nombre" class="text-slate-500 hover:text-rose-400 cursor-pointer px-1">✕</button>
                </li>
              } @empty {
                <li class="text-xs text-slate-500">Todavía no hay zonas.</li>
              }
            </ul>
            <div class="flex gap-2">
              <input [ngModel]="zonaNueva()" (ngModelChange)="zonaNueva.set($event)" (keydown.enter)="crearZona()" maxlength="40"
                placeholder="Nueva zona (ej. Refri, Almacén, Barra)" aria-label="Nueva zona" class="flex-1 ${INPUT}" />
              <button type="button" (click)="crearZona()" [disabled]="!zonaNueva().trim()"
                class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold cursor-pointer disabled:opacity-40">Agregar</button>
            </div>
            <div class="flex justify-end">
              <button (click)="administrandoZonas.set(false)" class="text-xs text-slate-400 hover:text-white cursor-pointer">Listo</button>
            </div>
          </div>
        </div>
      }

      <!-- Editar mínimo, zona y costo -->
      @if (editando(); as e) {
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="ed-titulo">
          <div (click)="editando.set(null)" class="absolute inset-0 bg-slate-950/70"></div>
          <div class="relative w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
            <h3 id="ed-titulo" class="text-base font-bold text-white">{{ e.nombre }}</h3>
            <div>
              <label for="ed-min" class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Mínimo en esta sucursal ({{ unidadCorta(e) }})</label>
              <input id="ed-min" type="number" min="0" step="any" [ngModel]="e.minimo" (ngModelChange)="e.minimo = $event" class="${INPUT} tabular-nums" />
            </div>
            <div>
              <label for="ed-zona" class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Zona</label>
              <select id="ed-zona" [ngModel]="e.zonaId ?? ''" (ngModelChange)="e.zonaId = $event || null" class="${INPUT} [color-scheme:dark]">
                <option value="">Sin zona</option>
                @for (z of zonas(); track z.id) { <option [value]="z.id">{{ z.nombre }}</option> }
              </select>
              <button type="button" (click)="administrandoZonas.set(true)" class="mt-1 text-[11px] text-indigo-400 hover:text-indigo-300 cursor-pointer">
                {{ zonas().length ? 'Administrar zonas' : 'Todavía no hay zonas: dalas de alta' }}
              </button>
            </div>
            <div>
              <label for="ed-costo" class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Costo por {{ unidadCorta(e) }} en esta sucursal ($)</label>
              <input id="ed-costo" type="number" min="0" step="any" [ngModel]="e.costo" (ngModelChange)="e.costo = $event" class="${INPUT} tabular-nums" />
              <p class="text-[11px] text-slate-500 mt-1">Se actualiza solo con cada compra que registre lo que pagaste. Cada sucursal lleva el suyo.</p>
            </div>
            <div class="flex justify-end gap-3 pt-2">
              <button (click)="editando.set(null)" class="text-xs text-slate-400 hover:text-white cursor-pointer">Cancelar</button>
              <button (click)="guardarEdicion()" [disabled]="guardando()" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold cursor-pointer disabled:opacity-40">Guardar</button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class InventarioComponent {
  private readonly http = inject(HttpClient);
  private readonly avisos = inject(AvisosService);
  private readonly auth = inject(AuthService);
  private readonly sucursal = inject(SucursalActivaService);

  readonly pestanas = PESTANAS;
  readonly pestana = signal<Pestana>('existencias');
  readonly branchId = computed(() => this.sucursal.branchId());
  readonly puedeMover = computed(() => this.auth.hasPermission('INVENTORY_UPDATE') || this.auth.hasPermission('CATALOG_UPDATE'));
  readonly guardando = signal(false);

  // Existencias
  readonly articulos = signal<Articulo[]>([]);
  readonly busqueda = signal('');
  readonly zonaFiltro = signal('');
  readonly filtro = signal<'todos' | 'bajo' | 'negativo'>('todos');
  readonly filtros = [
    { id: 'todos' as const, nombre: 'Todos' },
    { id: 'bajo' as const, nombre: 'Bajo mínimo' },
    { id: 'negativo' as const, nombre: 'En negativo' },
  ];
  readonly movimientoDe = signal<ObjetivoInventario | null>(null);
  readonly historialDe = signal<ObjetivoInventario | null>(null);
  readonly editando = signal<Articulo | null>(null);

  readonly activos = computed(() => this.articulos().filter((a) => a.activo));
  /** Las zonas dadas de alta en el restaurante. */
  readonly zonas = signal<Zona[]>([]);
  readonly administrandoZonas = signal(false);
  readonly zonaNueva = signal('');
  readonly visibles = computed(() => {
    const q = this.busqueda().trim().toLowerCase();
    return this.articulos().filter((a) =>
      (!q || a.nombre.toLowerCase().includes(q)) &&
      (!this.zonaFiltro() || a.zonaId === this.zonaFiltro()) &&
      this.cumple(a, this.filtro()));
  });

  // Conteo
  readonly zonaConteo = signal('');
  readonly notaConteo = signal('');
  readonly contado = signal<Record<string, number | null>>({});
  readonly contados = computed(() => Object.values(this.contado()).filter((v) => v !== null && `${v}` !== '').length);
  readonly paraContar = computed(() => this.activos().filter((a) => {
    const z = this.zonaConteo();
    return !z || (z === '__sin' ? !a.zonaId : a.zonaId === z);
  }));

  // Preparaciones
  readonly preparaciones = signal<Preparacion[]>([]);
  readonly editandoPrep = signal<{ preparadoId: string; rinde: number | null; componentes: Componente[]; prepararAlVender: boolean } | null>(null);
  readonly aProducir = signal<Record<string, number>>({});

  // Transferencias
  readonly destino = signal('');
  readonly notaTransferencia = signal('');
  readonly renglonesTransferencia = signal<Renglon[]>([this.renglonVacio()]);
  readonly otrasSucursales = computed(() => this.sucursal.sucursales().filter((s) => s.id !== this.branchId()));

  // Reporte
  readonly rangos = [7, 30];
  readonly dias = signal(7);
  readonly reporte = signal<Reporte | null>(null);
  readonly costeoTodas = signal<CosteoRestaurante | null>(null);
  readonly esDueno = computed(() => this.auth.userRole() === 'SUPER_ADMIN');
  readonly porComprar = computed(() => (this.reporte()?.renglones ?? []).filter((r) => r.sugerido > 0 && !r.esPreparado));
  /** Salsas, bases y marinados que conviene hacer: no se compran, se preparan. */
  readonly porPreparar = computed(() => (this.reporte()?.renglones ?? []).filter((r) => r.sugerido > 0 && r.esPreparado));

  constructor() {
    effect(() => {
      const id = this.branchId();
      const p = this.pestana();
      untracked(() => {
        if (!id) return;
        this.cargarExistencias();
        if (p === 'preparaciones') this.cargarPreparaciones();
        if (p === 'reporte') this.cargarReporte(this.dias());
      });
    });
  }

  private api(ruta: string): string {
    return `${environment.apiUrl}/branches/${this.branchId()}/inventario/${ruta}`;
  }

  // ------------------------------------------------------------------ existencias

  cargarZonas(): void {
    this.http.get<Zona[]>(this.api('zonas')).subscribe({ next: (z) => this.zonas.set(z) });
  }

  crearZona(): void {
    const nombre = this.zonaNueva().trim();
    if (!nombre) return;
    this.http.post<Zona>(this.api('zonas'), { nombre }).subscribe({
      next: () => {
        this.zonaNueva.set('');
        this.cargarZonas();
      },
      error: (err) => this.avisos.error(err.error?.error || 'No se pudo agregar la zona.'),
    });
  }

  renombrarZona(z: Zona, nombre: string): void {
    const nuevo = nombre.trim();
    if (!nuevo || nuevo === z.nombre) return;
    this.http.put<Zona>(this.api(`zonas/${z.id}`), { nombre: nuevo, orden: z.orden }).subscribe({
      next: () => {
        this.avisos.exito(`La zona ahora se llama ${nuevo}.`);
        this.cargarZonas();
        this.cargarExistencias();
      },
      error: (err) => {
        this.avisos.error(err.error?.error || 'No se pudo cambiar el nombre.');
        this.cargarZonas();
      },
    });
  }

  async borrarZona(z: Zona): Promise<void> {
    const ok = await this.avisos.confirmar({
      titulo: `¿Borrar la zona ${z.nombre}?`,
      mensaje: z.articulos ? `Sus ${z.articulos} artículos quedarán sin zona.` : 'No tiene artículos.',
      confirmar: 'Borrar zona',
      peligro: true,
    });
    if (!ok) return;
    this.http.delete(this.api(`zonas/${z.id}`)).subscribe({
      next: () => {
        this.cargarZonas();
        this.cargarExistencias();
      },
      error: (err) => this.avisos.error(err.error?.error || 'No se pudo borrar.'),
    });
  }

  cargarExistencias(): void {
    this.cargarZonas();
    this.http.get<Articulo[]>(this.api('existencias')).subscribe({
      next: (lista) => this.articulos.set(lista),
      error: (err) => this.avisos.error(err.error?.error || 'No se pudo cargar el inventario.'),
    });
  }

  private cumple(a: Articulo, f: 'todos' | 'bajo' | 'negativo'): boolean {
    if (f === 'bajo') return a.activo && !!a.minimo && a.existencia < a.minimo;
    if (f === 'negativo') return a.existencia < 0;
    return true;
  }

  cuantos(f: 'todos' | 'bajo' | 'negativo'): number {
    return this.articulos().filter((a) => this.cumple(a, f)).length;
  }

  claseExistencia(a: Articulo): string {
    if (a.existencia < 0) return 'text-rose-300';
    if (a.minimo && a.existencia < a.minimo) return 'text-amber-300';
    if (a.existencia === 0) return 'text-slate-500';
    return 'text-emerald-300';
  }

  unidadCorta(a: { tipo: string; unidad: string }): string {
    return a.tipo === 'PRODUCTO' ? 'pieza' : a.unidad;
  }

  legible(n: number, a: { tipo: string; unidad: string }): string {
    return a.tipo === 'PRODUCTO' ? `${n} ${Math.abs(n) === 1 ? 'pieza' : 'piezas'}` : cantidadLegible(n, a.unidad);
  }

  legibleR(n: number, x: RenglonReporte): string {
    return this.legible(Math.round(n * 1000) / 1000, x);
  }

  private objetivo(a: Articulo): ObjetivoInventario {
    return { tipo: a.tipo, id: a.id, nombre: a.nombre, unidad: a.tipo === 'PRODUCTO' ? 'pieza' : a.unidad, stock: a.existencia };
  }

  mover(a: Articulo): void {
    this.movimientoDe.set(this.objetivo(a));
  }

  verHistorial(a: Articulo): void {
    this.historialDe.set(this.objetivo(a));
  }

  alMover(mensaje: string): void {
    this.movimientoDe.set(null);
    this.avisos.exito(mensaje);
    this.cargarExistencias();
  }

  editar(a: Articulo): void {
    this.editando.set({ ...a });
  }

  guardarEdicion(): void {
    const e = this.editando();
    if (!e) return;
    this.guardando.set(true);
    this.http.put(this.api(`articulos/${e.tipo}/${e.id}`), {
      minimo: e.minimo === null || `${e.minimo}` === '' ? null : Number(e.minimo),
      zonaId: e.zonaId || null,
      costo: e.costo === null || `${e.costo}` === '' ? null : Number(e.costo),
    }).subscribe({
      next: () => {
        this.guardando.set(false);
        this.editando.set(null);
        this.avisos.exito(`${e.nombre} actualizado.`);
        this.cargarExistencias();
      },
      error: (err) => {
        this.guardando.set(false);
        this.avisos.error(err.error?.error || 'No se pudo guardar.');
      },
    });
  }

  // ------------------------------------------------------------------ renglones (transferencias)

  clave(a: Articulo): string {
    return `${a.tipo === 'PRODUCTO' ? 'P' : 'I'}:${a.id}`;
  }

  private articuloDe(clave: string): Articulo | undefined {
    return this.articulos().find((a) => this.clave(a) === clave);
  }

  unidadesDe(clave: string): string[] {
    const a = this.articuloDe(clave);
    if (!a) return [];
    return a.tipo === 'PRODUCTO' ? ['pieza'] : unidadesCompatibles(a.unidad);
  }

  cambiarArticulo(r: Renglon, clave: string): void {
    r.clave = clave;
    r.unidad = this.unidadesDe(clave)[0] ?? '';
  }

  private renglonVacio(): Renglon {
    return { clave: '', cantidad: null, unidad: '' };
  }

  agregarRenglon(lista: typeof this.renglonesTransferencia): void {
    lista.set([...lista(), this.renglonVacio()]);
  }

  quitarRenglon(lista: typeof this.renglonesTransferencia, i: number): void {
    const nueva = lista().filter((_, j) => j !== i);
    lista.set(nueva.length ? nueva : [this.renglonVacio()]);
  }

  listos(renglones: Renglon[]): boolean {
    return renglones.length > 0 && renglones.every((r) => r.clave && Number(r.cantidad) > 0);
  }

  private aCuerpo(r: Renglon) {
    const [tipo, id] = r.clave.split(':');
    return {
      ingredientId: tipo === 'I' ? id : null,
      productId: tipo === 'P' ? id : null,
      cantidad: Number(r.cantidad),
      unidad: tipo === 'I' ? r.unidad : null,
    };
  }

  // ------------------------------------------------------------------ conteo

  contar(a: Articulo, valor: number | null): void {
    this.contado.set({ ...this.contado(), [this.clave(a)]: valor === null || `${valor}` === '' ? null : Number(valor) });
  }

  diferencia(a: Articulo): string {
    const v = this.contado()[this.clave(a)];
    if (v === null || v === undefined) return '';
    const d = Math.round((v - a.existencia) * 1000) / 1000;
    if (d === 0) return 'cuadra';
    return (d > 0 ? '+' : '−') + this.legible(Math.abs(d), a);
  }

  claseDiferencia(a: Articulo): string {
    const v = this.contado()[this.clave(a)];
    if (v === null || v === undefined) return 'text-slate-600';
    const d = v - a.existencia;
    return d === 0 ? 'text-emerald-400' : d < 0 ? 'text-rose-300' : 'text-sky-300';
  }

  guardarConteo(): void {
    const renglones = this.activos()
      .map((a) => ({ a, v: this.contado()[this.clave(a)] }))
      .filter((x) => x.v !== null && x.v !== undefined)
      .map(({ a, v }) => ({
        ingredientId: a.tipo === 'INGREDIENTE' ? a.id : null,
        productId: a.tipo === 'PRODUCTO' ? a.id : null,
        cantidad: v,
        unidad: null,
        costoTotal: null,
      }));
    if (!renglones.length) return;
    this.guardando.set(true);
    this.http.post<{ mensaje: string }>(this.api('conteos'), { nota: this.notaConteo().trim() || null, renglones }).subscribe({
      next: (r) => {
        this.guardando.set(false);
        this.avisos.exito(r.mensaje);
        this.contado.set({});
        this.notaConteo.set('');
        this.cargarExistencias();
      },
      error: (err) => {
        this.guardando.set(false);
        this.avisos.error(err.error?.error || 'No se pudo guardar el conteo.');
      },
    });
  }

  // ------------------------------------------------------------------ preparaciones

  cargarPreparaciones(): void {
    this.http.get<Preparacion[]>(this.api('preparaciones')).subscribe({ next: (p) => this.preparaciones.set(p) });
  }

  describirComponentes(p: Preparacion): string {
    return p.componentes.map((c) => `${c.cantidad} ${c.unidad} de ${c.nombre}`).join(' · ');
  }

  nombreDe(tipo: string, id: string): string {
    return this.articulos().find((a) => a.tipo === tipo && a.id === id)?.nombre ?? '';
  }

  esPreparacionExistente(id: string): boolean {
    return this.preparaciones().some((p) => p.preparadoId === id);
  }

  ingredientesParaPreparar(): Articulo[] {
    return this.articulos().filter((a) => a.tipo === 'INGREDIENTE' && a.activo);
  }

  componentesPosibles(preparadoId: string): Articulo[] {
    // Otra preparación también vale (el chile tatemado de la salsa); que no se contengan lo revisa el servidor.
    return this.articulos().filter((a) => a.tipo === 'INGREDIENTE' && a.activo && a.id !== preparadoId);
  }

  unidadDePreparado(id: string): string {
    return this.articulos().find((a) => a.id === id)?.unidad ?? '';
  }

  unidadDeIngrediente(id: string): string {
    return this.articulos().find((a) => a.id === id)?.unidad ?? '';
  }

  unidadesDeIngrediente(id: string): string[] {
    const u = this.unidadDeIngrediente(id);
    return u ? unidadesCompatibles(u) : [];
  }

  nuevaPreparacion(): void {
    this.editandoPrep.set({ preparadoId: '', rinde: null, componentes: [{ componenteId: '', cantidad: null, unidad: '' }], prepararAlVender: false });
  }

  editarPreparacion(p: Preparacion): void {
    this.editandoPrep.set({
      preparadoId: p.preparadoId,
      rinde: p.rinde,
      componentes: p.componentes.map((c) => ({ componenteId: c.componenteId, cantidad: c.cantidad, unidad: c.unidad })),
      prepararAlVender: p.prepararAlVender,
    });
  }

  guardarPreparacion(): void {
    const e = this.editandoPrep();
    if (!e) return;
    if (!e.preparadoId) {
      this.avisos.error('Elige qué ingrediente se prepara.');
      return;
    }
    this.guardando.set(true);
    this.http.put(this.api(`preparaciones/${e.preparadoId}`), {
      rinde: e.rinde === null || `${e.rinde}` === '' ? null : Number(e.rinde),
      componentes: e.componentes.filter((c) => c.componenteId).map((c) => ({
        componenteId: c.componenteId, cantidad: Number(c.cantidad), unidad: c.unidad || null,
      })),
      prepararAlVender: e.prepararAlVender,
    }).subscribe({
      next: () => {
        this.guardando.set(false);
        this.editandoPrep.set(null);
        this.avisos.exito('Receta de preparación guardada.');
        this.cargarPreparaciones();
        this.cargarExistencias();
      },
      error: (err) => {
        this.guardando.set(false);
        this.avisos.error(err.error?.error || 'No se pudo guardar.');
      },
    });
  }

  quitarPreparacion(id: string): void {
    this.http.delete(this.api(`preparaciones/${id}`)).subscribe({
      next: () => {
        this.editandoPrep.set(null);
        this.cargarPreparaciones();
        this.cargarExistencias();
      },
      error: (err) => this.avisos.error(err.error?.error || 'No se pudo cambiar.'),
    });
  }

  /**
   * Antes de registrar: cuánto se va a usar de cada ingrediente y si alcanza.
   * Null mientras no se escriba cuánto se preparó.
   */
  previsto(p: Preparacion): UsoPrevisto[] | null {
    const cantidad = Number(this.aProducir()[p.preparadoId]);
    if (!(cantidad > 0) || !p.rinde) return null;
    const tandas = cantidad / p.rinde;
    return p.componentes.map((c) => {
      const art = this.articulos().find((a) => a.tipo === 'INGREDIENTE' && a.id === c.componenteId);
      const unidad = art?.unidad ?? c.unidad;
      const usa = convertirUnidad(Number(c.cantidad) || 0, c.unidad || unidad, unidad) * tandas;
      const hay = art?.existencia ?? 0;
      return { nombre: c.nombre ?? art?.nombre ?? '', usa, hay, unidad, alcanza: hay >= usa - 1e-9 };
    });
  }

  legibleU(n: number, unidad: string): string {
    return cantidadLegible(Math.round(n * 1000) / 1000, unidad);
  }

  fijarProducir(id: string, valor: number): void {
    this.aProducir.set({ ...this.aProducir(), [id]: Number(valor) || 0 });
  }

  producir(p: Preparacion): void {
    const cantidad = Number(this.aProducir()[p.preparadoId]);
    if (!(cantidad > 0)) return;
    this.guardando.set(true);
    this.http.post<{ mensaje: string }>(this.api('producir'), { preparadoId: p.preparadoId, cantidad }).subscribe({
      next: (r) => {
        this.guardando.set(false);
        this.avisos.exito(r.mensaje);
        this.aProducir.set({ ...this.aProducir(), [p.preparadoId]: 0 });
        this.cargarPreparaciones();
        this.cargarExistencias();
      },
      error: (err) => {
        this.guardando.set(false);
        this.avisos.error(err.error?.error || 'No se pudo registrar.');
      },
    });
  }

  // ------------------------------------------------------------------ transferencias

  transferir(): void {
    if (!this.destino() || !this.listos(this.renglonesTransferencia())) return;
    this.guardando.set(true);
    this.http.post<{ mensaje: string }>(this.api('transferencias'), {
      destinoId: this.destino(),
      nota: this.notaTransferencia().trim() || null,
      renglones: this.renglonesTransferencia().map((r) => this.aCuerpo(r)),
    }).subscribe({
      next: (r) => {
        this.guardando.set(false);
        this.avisos.exito(r.mensaje);
        this.renglonesTransferencia.set([this.renglonVacio()]);
        this.notaTransferencia.set('');
        this.cargarExistencias();
      },
      error: (err) => {
        this.guardando.set(false);
        this.avisos.error(err.error?.error || 'No se pudo pasar la mercancía.');
      },
    });
  }

  // ------------------------------------------------------------------ reporte

  cargarReporte(dias: number): void {
    this.dias.set(dias);
    this.reporte.set(null);
    const hasta = new Date();
    const desde = new Date(hasta.getTime() - (dias - 1) * 86400000);
    const iso = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });
    const periodo = `desde=${iso(desde)}&hasta=${iso(hasta)}`;
    this.http.get<Reporte>(this.api(`reporte?${periodo}`)).subscribe({
      next: (r) => this.reporte.set(r),
      error: (err) => this.avisos.error(err.error?.error || 'No se pudo cargar el reporte.'),
    });
    // El dueño ve también el de todas sus sucursales; cada gerente, solo el suyo.
    if (this.esDueno()) {
      this.http.get<CosteoRestaurante>(`${environment.apiUrl}/inventario/costeo-sucursales?${periodo}`).subscribe({
        next: (t) => this.costeoTodas.set(t),
        error: () => this.costeoTodas.set(null),
      });
    }
  }

  /** Cambia la sucursal de todo el panel: el detalle de abajo pasa a ser el de esa. */
  verSucursal(id: string): void {
    if (id !== this.branchId()) this.sucursal.elegirSucursal(id);
  }

  nombreSucursal(): string {
    return this.costeoTodas()?.sucursales.find((s) => s.branchId === this.branchId())?.sucursal ?? 'esta sucursal';
  }
}
