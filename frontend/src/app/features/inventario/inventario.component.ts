import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { environment } from '../../../environments/environment';
import { AvisosService } from '../../core/services/avisos.service';
import { AuthService } from '../../core/services/auth.service';
import { SucursalActivaService } from '../../core/services/sucursal-activa.service';
import { TituloPaginaComponent } from '../../shared/components/titulo-pagina.component';
import { PesosPipe } from '../../shared/utils/pesos';
import { cantidadLegible, unidadesCompatibles } from '../../shared/utils/unidades';
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
  zona: string | null;
  activo: boolean;
  usos: number;
  esPreparado: boolean;
}

interface Renglon {
  clave: string;
  cantidad: number | null;
  unidad: string;
  costoTotal: number | null;
}

interface CompraHecha {
  id: string;
  proveedor: string | null;
  nota: string | null;
  total: number | null;
  usuario: string | null;
  creadoEn: string;
  renglones: string[];
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
}

interface Reporte {
  desde: string;
  hasta: string;
  costoConsumo: number;
  costoMerma: number;
  renglones: RenglonReporte[];
}

type Pestana = 'existencias' | 'compras' | 'conteo' | 'preparaciones' | 'transferencias' | 'reporte';

const PESTANAS: { id: Pestana; nombre: string }[] = [
  { id: 'existencias', nombre: 'Existencias' },
  { id: 'compras', nombre: 'Compras' },
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
  imports: [FormsModule, DatePipe, TituloPaginaComponent, PesosPipe, MovimientoInventarioComponent, HistorialInventarioComponent, ControlInventarioComponent],
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
                @for (z of zonas(); track z) { <option [value]="z">{{ z }}</option> }
              </select>
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
          <section class="grid grid-cols-1 xl:grid-cols-5 gap-6">
            <div class="xl:col-span-3 space-y-4 rounded-xl border border-slate-800 bg-slate-900/40 p-4">
              <h2 class="text-sm font-bold text-white">Registrar compra</h2>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label for="c-prov" class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Proveedor</label>
                  <input id="c-prov" [ngModel]="proveedor()" (ngModelChange)="proveedor.set($event)" maxlength="120" class="${INPUT}" placeholder="Ej. Carnicería López" />
                </div>
                <div>
                  <label for="c-nota" class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Nota</label>
                  <input id="c-nota" [ngModel]="notaCompra()" (ngModelChange)="notaCompra.set($event)" maxlength="300" class="${INPUT}" placeholder="Opcional (folio, factura…)" />
                </div>
              </div>
              <div class="space-y-2">
                @for (r of renglonesCompra(); track $index) {
                  <div class="grid grid-cols-12 gap-2 items-center">
                    <select [ngModel]="r.clave" (ngModelChange)="cambiarArticulo(r, $event)" aria-label="Artículo" class="col-span-12 sm:col-span-5 ${INPUT} [color-scheme:dark]">
                      <option value="">Elige un artículo</option>
                      @for (a of activos(); track a.tipo + a.id) { <option [value]="clave(a)">{{ a.nombre }}</option> }
                    </select>
                    <input type="number" min="0" step="any" [ngModel]="r.cantidad" (ngModelChange)="r.cantidad = $event; renglonesCompra.set([...renglonesCompra()])" aria-label="Cantidad" placeholder="Cant." class="col-span-4 sm:col-span-2 ${INPUT} tabular-nums" />
                    <select [ngModel]="r.unidad" (ngModelChange)="r.unidad = $event" aria-label="Unidad" class="col-span-3 sm:col-span-2 ${INPUT} [color-scheme:dark]">
                      @for (u of unidadesDe(r.clave); track u) { <option [value]="u">{{ u }}</option> }
                    </select>
                    <input type="number" min="0" step="any" [ngModel]="r.costoTotal" (ngModelChange)="r.costoTotal = $event; renglonesCompra.set([...renglonesCompra()])" aria-label="Pagado" placeholder="$ total" class="col-span-4 sm:col-span-2 ${INPUT} tabular-nums" />
                    <button type="button" (click)="quitarRenglon(renglonesCompra, $index)" aria-label="Quitar renglón" class="col-span-1 text-slate-500 hover:text-rose-400 cursor-pointer">✕</button>
                  </div>
                }
              </div>
              <div class="flex flex-wrap items-center gap-3">
                <button type="button" (click)="agregarRenglon(renglonesCompra)" class="text-xs font-bold text-indigo-400 hover:text-indigo-300 cursor-pointer">+ Agregar artículo</button>
                <span class="ml-auto text-sm text-slate-300">Total: <strong class="tabular-nums">{{ totalCompra() | pesos }}</strong></span>
                <button (click)="guardarCompra()" [disabled]="!listos(renglonesCompra()) || guardando()"
                  class="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
                  {{ guardando() ? 'Guardando…' : 'Registrar compra' }}
                </button>
              </div>
            </div>
            <div class="xl:col-span-2 space-y-3">
              <h2 class="text-sm font-bold text-white">Últimas compras</h2>
              @for (c of compras(); track c.id) {
                <article class="rounded-xl border border-slate-800 bg-slate-900/40 p-3 text-xs space-y-1">
                  <div class="flex items-baseline gap-2">
                    <strong class="text-slate-200">{{ c.proveedor || 'Sin proveedor' }}</strong>
                    <span class="text-slate-500">{{ c.creadoEn | date: 'd MMM, HH:mm' }}</span>
                    @if (c.total) { <span class="ml-auto font-bold text-emerald-300 tabular-nums">{{ c.total | pesos }}</span> }
                  </div>
                  <p class="text-slate-400">{{ c.renglones.join(' · ') }}</p>
                  @if (c.nota || c.usuario) { <p class="text-slate-500">{{ c.nota }}{{ c.nota && c.usuario ? ' · ' : '' }}{{ c.usuario }}</p> }
                </article>
              } @empty {
                <p class="text-xs text-slate-500">Todavía no hay compras registradas.</p>
              }
            </div>
          </section>
        }

        <!-- ============================== CONTEO -->
        @if (pestana() === 'conteo') {
          <section class="space-y-4 max-w-3xl">
            <p class="text-xs text-slate-400">Ve a la zona, cuenta lo que hay y escríbelo. Lo que dejes vacío no se toca; lo que cuentes queda en el historial con la diferencia.</p>
            <div class="flex flex-wrap gap-2">
              <select [value]="zonaConteo()" (change)="zonaConteo.set($any($event.target).value)" aria-label="Zona a contar"
                class="bg-slate-900 border border-slate-800 rounded-lg py-2 px-3 text-sm text-white cursor-pointer [color-scheme:dark]">
                <option value="">Todas las zonas</option>
                @for (z of zonas(); track z) { <option [value]="z">{{ z }}</option> }
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
                      @for (a of componentesPosibles(e.preparadoId); track a.id) { <option [value]="a.id">{{ a.nombre }}</option> }
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
            @if (reporte(); as r) {
              <dl class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div class="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
                  <dt class="text-[11px] uppercase tracking-wider text-slate-400 font-bold">Costo de lo consumido</dt>
                  <dd class="text-2xl font-black text-white tabular-nums mt-1">{{ r.costoConsumo | pesos }}</dd>
                </div>
                <div class="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
                  <dt class="text-[11px] uppercase tracking-wider text-slate-400 font-bold">Costo de la merma</dt>
                  <dd class="text-2xl font-black text-rose-300 tabular-nums mt-1">{{ r.costoMerma | pesos }}</dd>
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

              <div class="overflow-x-auto border border-slate-800 rounded-xl">
                <table class="w-full text-sm">
                  <thead class="bg-slate-900 text-[11px] uppercase tracking-wider text-slate-400 text-left">
                    <tr>
                      <th class="py-3 px-4">Artículo</th>
                      <th class="py-3 px-4 text-right">Consumo</th>
                      <th class="py-3 px-4 text-right">Merma</th>
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
                        <td class="py-2.5 px-4 text-right tabular-nums text-slate-300">{{ x.costoConsumo !== null ? (x.costoConsumo | pesos) : '—' }}</td>
                        <td class="py-2.5 px-4 text-right tabular-nums" [class]="x.existencia < 0 ? 'text-rose-300' : 'text-slate-300'">{{ legibleR(x.existencia, x) }}</td>
                        <td class="py-2.5 px-4 text-right tabular-nums" [class]="x.diasQueAlcanza !== null && x.diasQueAlcanza < 3 ? 'text-amber-300 font-bold' : 'text-slate-400'">
                          {{ x.diasQueAlcanza !== null ? x.diasQueAlcanza + ' días' : '—' }}
                        </td>
                      </tr>
                    } @empty {
                      <tr><td colspan="6" class="py-10 text-center text-slate-500">Sin movimientos en este periodo.</td></tr>
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

      <!-- Editar mínimo, zona y costo -->
      @if (editando(); as e) {
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="ed-titulo">
          <div (click)="editando.set(null)" class="absolute inset-0 bg-slate-950/70"></div>
          <div class="relative w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
            <h3 id="ed-titulo" class="text-base font-bold text-white">{{ e.nombre }}</h3>
            <div>
              <label for="ed-min" class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Mínimo ({{ unidadCorta(e) }})</label>
              <input id="ed-min" type="number" min="0" step="any" [ngModel]="e.minimo" (ngModelChange)="e.minimo = $event" class="${INPUT} tabular-nums" />
            </div>
            <div>
              <label for="ed-zona" class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Zona</label>
              <input id="ed-zona" list="zonas-conocidas" maxlength="40" [ngModel]="e.zona" (ngModelChange)="e.zona = $event" placeholder="Ej. Refri, Almacén, Barra" class="${INPUT}" />
              <datalist id="zonas-conocidas">@for (z of zonas(); track z) { <option [value]="z"></option> }</datalist>
            </div>
            <div>
              <label for="ed-costo" class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Costo por {{ unidadCorta(e) }} ($)</label>
              <input id="ed-costo" type="number" min="0" step="any" [ngModel]="e.costo" (ngModelChange)="e.costo = $event" class="${INPUT} tabular-nums" />
              <p class="text-[11px] text-slate-500 mt-1">Se actualiza solo con cada compra que registre lo que pagaste.</p>
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
  readonly zonas = computed(() => [...new Set(this.articulos().map((a) => a.zona).filter((z): z is string => !!z))].sort());
  readonly visibles = computed(() => {
    const q = this.busqueda().trim().toLowerCase();
    return this.articulos().filter((a) =>
      (!q || a.nombre.toLowerCase().includes(q)) &&
      (!this.zonaFiltro() || a.zona === this.zonaFiltro()) &&
      this.cumple(a, this.filtro()));
  });

  // Compras
  readonly proveedor = signal('');
  readonly notaCompra = signal('');
  readonly renglonesCompra = signal<Renglon[]>([this.renglonVacio()]);
  readonly compras = signal<CompraHecha[]>([]);
  readonly totalCompra = computed(() => this.renglonesCompra().reduce((s, r) => s + (Number(r.costoTotal) || 0), 0));

  // Conteo
  readonly zonaConteo = signal('');
  readonly notaConteo = signal('');
  readonly contado = signal<Record<string, number | null>>({});
  readonly contados = computed(() => Object.values(this.contado()).filter((v) => v !== null && `${v}` !== '').length);
  readonly paraContar = computed(() => this.activos().filter((a) => {
    const z = this.zonaConteo();
    return !z || (z === '__sin' ? !a.zona : a.zona === z);
  }));

  // Preparaciones
  readonly preparaciones = signal<Preparacion[]>([]);
  readonly editandoPrep = signal<{ preparadoId: string; rinde: number | null; componentes: Componente[] } | null>(null);
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
  readonly porComprar = computed(() => (this.reporte()?.renglones ?? []).filter((r) => r.sugerido > 0));

  constructor() {
    effect(() => {
      const id = this.branchId();
      const p = this.pestana();
      untracked(() => {
        if (!id) return;
        this.cargarExistencias();
        if (p === 'compras') this.cargarCompras();
        if (p === 'preparaciones') this.cargarPreparaciones();
        if (p === 'reporte') this.cargarReporte(this.dias());
      });
    });
  }

  private api(ruta: string): string {
    return `${environment.apiUrl}/branches/${this.branchId()}/inventario/${ruta}`;
  }

  // ------------------------------------------------------------------ existencias

  cargarExistencias(): void {
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
      zona: e.zona?.trim() || null,
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

  // ------------------------------------------------------------------ renglones (compras y transferencias)

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
    return { clave: '', cantidad: null, unidad: '', costoTotal: null };
  }

  agregarRenglon(lista: typeof this.renglonesCompra): void {
    lista.set([...lista(), this.renglonVacio()]);
  }

  quitarRenglon(lista: typeof this.renglonesCompra, i: number): void {
    const nueva = lista().filter((_, j) => j !== i);
    lista.set(nueva.length ? nueva : [this.renglonVacio()]);
  }

  listos(renglones: Renglon[]): boolean {
    return renglones.length > 0 && renglones.every((r) => r.clave && Number(r.cantidad) > 0);
  }

  private aCuerpo(r: Renglon, conCosto: boolean) {
    const [tipo, id] = r.clave.split(':');
    return {
      ingredientId: tipo === 'I' ? id : null,
      productId: tipo === 'P' ? id : null,
      cantidad: Number(r.cantidad),
      unidad: tipo === 'I' ? r.unidad : null,
      costoTotal: conCosto && r.costoTotal ? Number(r.costoTotal) : null,
    };
  }

  // ------------------------------------------------------------------ compras

  cargarCompras(): void {
    this.http.get<CompraHecha[]>(this.api('compras')).subscribe({ next: (c) => this.compras.set(c) });
  }

  guardarCompra(): void {
    if (!this.listos(this.renglonesCompra())) return;
    this.guardando.set(true);
    this.http.post<{ mensaje: string }>(this.api('compras'), {
      proveedor: this.proveedor().trim() || null,
      nota: this.notaCompra().trim() || null,
      renglones: this.renglonesCompra().map((r) => this.aCuerpo(r, true)),
    }).subscribe({
      next: (r) => {
        this.guardando.set(false);
        this.avisos.exito(r.mensaje);
        this.proveedor.set('');
        this.notaCompra.set('');
        this.renglonesCompra.set([this.renglonVacio()]);
        this.cargarCompras();
        this.cargarExistencias();
      },
      error: (err) => {
        this.guardando.set(false);
        this.avisos.error(err.error?.error || 'No se pudo registrar la compra.');
      },
    });
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
    return this.articulos().filter((a) => a.tipo === 'INGREDIENTE' && a.activo && !a.esPreparado && a.id !== preparadoId);
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
    this.editandoPrep.set({ preparadoId: '', rinde: null, componentes: [{ componenteId: '', cantidad: null, unidad: '' }] });
  }

  editarPreparacion(p: Preparacion): void {
    this.editandoPrep.set({
      preparadoId: p.preparadoId,
      rinde: p.rinde,
      componentes: p.componentes.map((c) => ({ componenteId: c.componenteId, cantidad: c.cantidad, unidad: c.unidad })),
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
      renglones: this.renglonesTransferencia().map((r) => this.aCuerpo(r, false)),
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
    this.http.get<Reporte>(this.api(`reporte?desde=${iso(desde)}&hasta=${iso(hasta)}`)).subscribe({
      next: (r) => this.reporte.set(r),
      error: (err) => this.avisos.error(err.error?.error || 'No se pudo cargar el reporte.'),
    });
  }
}
