import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { LucideBan, LucideLoader2, LucidePackagePlus, LucideUserPlus, LucideX } from '@lucide/angular';
import { environment } from '../../../environments/environment';
import { AvisosService } from '../../core/services/avisos.service';
import { PesosPipe, formatearPesos } from '../../shared/utils/pesos';
import { convertirUnidad, unidadCanonica, unidadesCompatibles } from '../../shared/utils/unidades';
import { SelectorFechaComponent, hoyIso } from '../../shared/components/selector-fecha.component';
import { PedidosProveedorComponent } from './pedidos-proveedor.component';
import { PorPagarComponent } from './por-pagar.component';

/** Lo que la compra necesita saber de un artículo del inventario. */
export interface ArticuloCompra {
  tipo: 'INGREDIENTE' | 'PRODUCTO' | string;
  id: string;
  nombre: string;
  unidad: string;
  activo: boolean;
}

export interface Proveedor {
  id: string;
  nombre: string;
  contacto: string | null;
  telefono: string | null;
  diasCredito: number;
  diasVisita: string[];
  notas: string | null;
  activo: boolean;
  surte: { tipo: string; id: string; nombre: string | null }[];
  debemos: number;
}

export interface Presentacion {
  id: string;
  tipo: string;
  articuloId: string;
  nombre: string;
  factor: number;
}

interface UltimoPrecio {
  tipo: string;
  articuloId: string;
  costoUnitario: number;
  fecha: string;
  proveedor: string | null;
}

export interface Compra {
  id: string;
  proveedorId: string | null;
  proveedor: string | null;
  folio: string | null;
  fecha: string;
  formaPago: string | null;
  iva: string | null;
  subtotal: number | null;
  ivaMonto: number | null;
  total: number | null;
  usuario: string | null;
  creadoEn: string;
  renglones: string[];
  vence: string | null;
  pagada: boolean;
  anulada: boolean;
  anuladaPor: string | null;
  pagoForma: string | null;
  pedidoId: string | null;
}

export interface RenglonDePedido {
  id: string;
  tipo: string;
  articuloId: string;
  cantidad: number;
  unidad: string | null;
  presentacionId: string | null;
  descripcion: string;
  recibido: number | null;
  motivo: string | null;
}

export interface Pedido {
  id: string;
  proveedorId: string | null;
  proveedor: string;
  telefono: string | null;
  para: string | null;
  nota: string | null;
  estado: 'PENDIENTE' | 'RECIBIDO' | 'CANCELADO';
  creadoPor: string | null;
  creadoEn: string;
  cerradoEn: string | null;
  compraId: string | null;
  renglones: RenglonDePedido[];
  mensaje: string;
  /** Cuándo salió por el WhatsApp de la sucursal; null si no se ha mandado. */
  enviadoEn: string | null;
  enviadoA: string | null;
}

/** Un renglón de la nota. "u:kg" = unidad suelta; "p:<id>" = presentación del proveedor. */
interface Linea {
  articulo: ArticuloCompra;
  cantidad: number | null;
  como: string;
  importe: number | null;
  /** Al recibir un pedido: el renglón, cuánto se pidió y cómo. */
  renglonId?: string;
  pedida?: number;
  comoPedido?: string;
  motivo?: 'FALTO' | 'MAL_ESTADO';
}

type Vista = 'registrar' | 'pedidos' | 'porpagar';

type FormaPago = 'CAJA' | 'TRANSFERENCIA' | 'CREDITO';
type Iva = 'INCLUIDO' | 'APARTE' | 'SIN';

const TASA_IVA = 0.16;
const PLAZO_DEFAULT = 15;
const CAMPO = 'w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-sm text-white outline-none focus:border-indigo-500 min-h-[40px]';

/**
 * Registrar una compra como llega la nota: proveedor, folio y fecha, cómo se
 * pagó y con qué IVA, y cada artículo en la presentación del proveedor ("2
 * cajas de 24"). Avisa si algo subió de precio. El IVA se recupera: al
 * inventario entra el costo sin IVA.
 */
@Component({
  selector: 'app-compras-inventario',
  standalone: true,
  imports: [FormsModule, PesosPipe, SelectorFechaComponent, PedidosProveedorComponent, PorPagarComponent, LucideBan, LucideLoader2, LucidePackagePlus, LucideUserPlus, LucideX],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="flex flex-wrap gap-2 mb-4" aria-label="Compras">
      @for (v of vistas; track v.id) {
        <button type="button" (click)="vista.set(v.id)" [attr.aria-current]="vista() === v.id ? 'page' : null"
          class="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold cursor-pointer min-h-[40px]"
          [class]="vista() === v.id ? 'bg-slate-700 text-white' : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'">
          {{ v.nombre }}
          @if (v.id === 'pedidos' && pendientes() > 0) {
            <span class="px-1.5 rounded-md bg-indigo-500/20 text-indigo-200 text-xs font-bold tabular-nums">{{ pendientes() }}</span>
          }
          @if (v.id === 'porpagar' && deuda() > 0) {
            <span class="px-1.5 rounded-md bg-amber-500/20 text-amber-200 text-xs font-bold tabular-nums">{{ deuda() | pesos }}</span>
          }
        </button>
      }
    </nav>

    @if (vista() === 'pedidos') {
      <app-pedidos-proveedor [branchId]="branchId" [articulos]="articulos" [proveedores]="proveedores()" [presentaciones]="presentaciones()"
        [pedidos]="pedidos()" (cambio)="cargarPedidos()" (recibir)="recibir($event)" />
    }
    @if (vista() === 'porpagar') {
      <app-por-pagar [branchId]="branchId" [compras]="porPagar()" [cajaAbierta]="cajaAbierta()" [puedePagar]="puedeAnular" (pagado)="cargar()" />
    }

    @if (vista() === 'registrar') {
    <section class="grid grid-cols-1 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-6 items-start">
      <form ngNoForm class="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 sm:p-5 space-y-5" (submit)="registrar($event)" novalidate>
        <h2 class="text-base font-bold text-white">{{ recibiendo() ? 'Recibir pedido' : 'Registrar compra' }}</h2>
        @if (recibiendo(); as rp) {
          <div class="flex flex-wrap items-center gap-3 rounded-xl border border-indigo-500/40 bg-indigo-500/10 px-3.5 py-2.5 text-sm" role="status">
            <p class="text-indigo-100 flex-1 min-w-0">Recibiendo el pedido a <strong>{{ rp.proveedor }}</strong>. Escribe cuánto llegó de cada cosa y lo que dice la nota; lo que no llegó no entra al inventario.</p>
            <button type="button" (click)="cancelarRecepcion()" class="text-xs font-semibold text-slate-300 hover:text-white cursor-pointer">Dejar de recibir</button>
          </div>
        }

        <!-- La nota -->
        <div class="grid grid-cols-1 md:grid-cols-[minmax(0,1.4fr)_minmax(0,.8fr)_minmax(0,1fr)] gap-3">
          <div class="relative">
            <label for="cp-prov" class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Proveedor</label>
            <input id="cp-prov" autocomplete="off" [ngModel]="textoProveedor()" (ngModelChange)="escribirProveedor($event)"
              (focus)="verSugerencias.set(true)" (blur)="cerrarSugerencias()" placeholder="Escribe para buscar" class="${CAMPO}" />
            @if (verSugerencias() && (sugerencias().length || textoProveedor().trim())) {
              <div class="absolute inset-x-0 top-[calc(100%+4px)] z-30 rounded-xl border border-slate-700 bg-slate-900 p-1 shadow-2xl max-h-64 overflow-y-auto">
                @for (p of sugerencias(); track p.id) {
                  <button type="button" (mousedown)="$event.preventDefault(); elegirProveedor(p)" class="w-full flex justify-between gap-3 text-left px-3 py-2 rounded-lg text-sm text-slate-200 hover:bg-slate-800 cursor-pointer">
                    <span class="truncate">{{ p.nombre }}</span>
                    <span class="shrink-0 text-xs text-slate-500">{{ diasTexto(p) }}</span>
                  </button>
                }
                @if (textoProveedor().trim() && !existeProveedor()) {
                  <button type="button" (mousedown)="$event.preventDefault(); abrirAlta()" class="w-full flex items-center gap-2 text-left px-3 py-2 rounded-lg text-sm font-semibold text-indigo-300 hover:bg-slate-800 cursor-pointer">
                    <svg lucideUserPlus class="w-4 h-4"></svg> Dar de alta "{{ textoProveedor().trim() }}"
                  </button>
                }
              </div>
            }
            @if (proveedor(); as p) {
              <p class="text-[11px] text-slate-500 mt-1 truncate">{{ resumenProveedor(p) }}</p>
            }
          </div>
          <div>
            <label for="cp-folio" class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Folio de la nota</label>
            <input id="cp-folio" [ngModel]="folio()" (ngModelChange)="folio.set($event)" maxlength="40" placeholder="Opcional" class="${CAMPO}" />
          </div>
          <div>
            <span class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1" id="cp-fecha-lbl">Fecha de la nota</span>
            <app-selector-fecha idBoton="cp-fecha" [valor]="fecha()" (valorChange)="fecha.set($event)" />
          </div>
        </div>

        <!-- Cómo se pagó -->
        <div>
          <span class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">¿Cómo se pagó?</span>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-2" role="radiogroup" aria-label="Forma de pago">
            @for (f of formas; track f.id) {
              <button type="button" role="radio" [attr.aria-checked]="pago() === f.id" (click)="pago.set(f.id)"
                class="text-left rounded-xl border px-3 py-2.5 cursor-pointer min-h-[56px]"
                [class]="pago() === f.id ? 'border-indigo-500 bg-indigo-500/10' : 'border-slate-800 bg-slate-950 hover:border-slate-600'">
                <span class="block text-sm font-bold text-white">{{ f.nombre }}</span>
                <span class="block text-[11px] text-slate-400">{{ f.ayuda }}</span>
              </button>
            }
          </div>
          <p class="mt-2 rounded-lg px-3 py-2 text-xs" [class]="avisoPago().clase" role="status">{{ avisoPago().texto }}</p>
        </div>

        <!-- IVA -->
        <div>
          <span class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">IVA de la nota</span>
          <div class="flex flex-wrap gap-2" role="radiogroup" aria-label="IVA de la nota">
            @for (o of ivas; track o.id) {
              <button type="button" role="radio" [attr.aria-checked]="iva() === o.id" (click)="iva.set(o.id)"
                class="px-3 py-2 rounded-lg border text-xs font-semibold cursor-pointer min-h-[40px]"
                [class]="iva() === o.id ? 'border-indigo-500 bg-indigo-500/10 text-white' : 'border-slate-800 bg-slate-950 text-slate-300 hover:border-slate-600'">{{ o.nombre }}</button>
            }
          </div>
          <p class="text-[11px] text-slate-500 mt-1">El IVA se recupera: al inventario entra el costo sin IVA.</p>
        </div>

        <!-- Artículos -->
        <div class="space-y-2">
          <div class="relative">
            <label for="cp-buscar" class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Agregar artículo</label>
            <input id="cp-buscar" autocomplete="off" [ngModel]="busqueda()" (ngModelChange)="busqueda.set($event)" (blur)="cerrarBusqueda()"
              placeholder="Busca: carne, coca, tortilla…" class="${CAMPO}" />
            @if (resultados().length) {
              <div class="absolute inset-x-0 top-[calc(100%+4px)] z-30 rounded-xl border border-slate-700 bg-slate-900 p-1 shadow-2xl max-h-64 overflow-y-auto">
                @for (a of resultados(); track a.tipo + a.id) {
                  <button type="button" (mousedown)="$event.preventDefault(); agregar(a)" class="w-full flex justify-between gap-3 text-left px-3 py-2 rounded-lg text-sm text-slate-200 hover:bg-slate-800 cursor-pointer">
                    <span class="truncate">{{ a.nombre }}</span>
                    <span class="shrink-0 text-xs text-slate-500 tabular-nums">{{ ultimoTexto(a) }}</span>
                  </button>
                }
              </div>
            }
          </div>

          @for (l of lineas(); track $index; let i = $index) {
            <div class="rounded-xl border border-slate-800 bg-slate-950/50 p-3 space-y-2">
              <div class="grid grid-cols-2 sm:grid-cols-[minmax(0,1.4fr)_80px_minmax(0,1.2fr)_110px_auto] gap-2 items-end">
                <div class="col-span-2 sm:col-span-1 min-w-0">
                  <p class="text-sm font-bold text-white truncate">{{ l.articulo.nombre }}</p>
                  <p class="text-[11px] text-slate-500">{{ l.renglonId ? 'Pediste ' + legible(l.pedida ?? 0) + ' ' + nombreComo(l.articulo, l.comoPedido ?? '') : 'Se lleva en ' + l.articulo.unidad }}</p>
                </div>
                <div>
                  <label [for]="'cp-c' + i" class="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">{{ l.renglonId ? 'Llegó' : 'Cant.' }}</label>
                  <input [id]="'cp-c' + i" type="number" min="0" step="any" inputmode="decimal" [ngModel]="l.cantidad" (ngModelChange)="cambiar(i, { cantidad: $event })" class="${CAMPO} tabular-nums" />
                </div>
                <div>
                  <label [for]="'cp-p' + i" class="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Presentación</label>
                  <select #sel [id]="'cp-p' + i" [ngModel]="l.como" (ngModelChange)="elegirComo(i, $event, sel)" class="${CAMPO} [color-scheme:dark] cursor-pointer">
                    @for (o of opcionesDe(l.articulo); track o.valor) { <option [value]="o.valor">{{ o.nombre }}</option> }
                    <option value="__nueva">+ Nueva presentación…</option>
                  </select>
                </div>
                <div>
                  <label [for]="'cp-i' + i" class="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">$ en la nota</label>
                  <input [id]="'cp-i' + i" type="number" min="0" step="any" inputmode="decimal" [ngModel]="l.importe" (ngModelChange)="cambiar(i, { importe: $event })" placeholder="0.00" class="${CAMPO} tabular-nums" />
                </div>
                <button type="button" (click)="quitar(i)" [class.invisible]="!!l.renglonId" class="h-10 w-10 rounded-lg border border-slate-800 text-slate-500 hover:text-rose-400 flex items-center justify-center cursor-pointer" [attr.aria-label]="'Quitar ' + l.articulo.nombre">
                  <svg lucideX class="w-4 h-4"></svg>
                </button>
              </div>
              <p class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400" aria-live="polite">
                @if (llegada(l); as e) {
                  <span class="px-1.5 py-0.5 rounded font-bold" [class]="e.clase">{{ e.texto }}</span>
                  @if (e.falta) {
                    <label class="inline-flex items-center gap-1.5">
                      <span class="sr-only">Por qué llegó menos</span>
                      <select [ngModel]="l.motivo ?? 'FALTO'" (ngModelChange)="cambiar(i, { motivo: $event })" class="bg-slate-950 border border-slate-800 rounded-md py-1 px-2 text-xs text-white [color-scheme:dark] cursor-pointer">
                        <option value="FALTO">No lo trajo</option>
                        <option value="MAL_ESTADO">Llegó mal, se regresó</option>
                      </select>
                    </label>
                  }
                }
                @if (unidadesInv(l); as u) {
                  <span>= <strong class="text-slate-200">{{ legible(u) }} {{ l.articulo.unidad }}</strong> al inventario</span>
                }
                @if (comparacion(l); as c) {
                  <span class="tabular-nums">{{ c.actual | pesos }} / {{ l.articulo.unidad }} sin IVA · antes {{ c.antes | pesos }}</span>
                  <span class="px-1.5 py-0.5 rounded font-bold tabular-nums" [class]="c.dif >= 1 ? 'bg-rose-500/15 text-rose-300' : c.dif <= -1 ? 'bg-emerald-500/15 text-emerald-300' : 'bg-slate-800 text-slate-300'">
                    {{ c.dif >= 1 ? '▲ ' + c.dif + '%' : c.dif <= -1 ? '▼ ' + (-c.dif) + '%' : '= igual' }}
                  </span>
                  @if (c.dif >= 10) { <span class="text-rose-300">Subió: revisa la nota o el margen de los platillos que lo usan.</span> }
                }
              </p>
            </div>
          } @empty {
            <p class="rounded-xl border border-dashed border-slate-800 py-6 text-center text-sm text-slate-500">Busca los artículos de la nota y agrégalos aquí.</p>
          }
        </div>

        <!-- Totales y registrar -->
        <div class="flex flex-wrap items-end justify-between gap-4 border-t border-slate-800 pt-4">
          <dl class="text-sm tabular-nums space-y-0.5">
            @if (iva() !== 'SIN') {
              <div class="flex gap-3 text-slate-400"><dt class="w-20">Subtotal</dt><dd>{{ totales().subtotal | pesos }}</dd></div>
              <div class="flex gap-3 text-slate-400"><dt class="w-20">IVA 16%</dt><dd>{{ totales().iva | pesos }}</dd></div>
            }
            <div class="flex gap-3 text-white text-lg font-black"><dt class="w-20">Total</dt><dd>{{ totales().total | pesos }}</dd></div>
          </dl>
          <button type="submit" [disabled]="!sePuede() || guardando()"
            class="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed min-h-[48px]">
            @if (guardando()) { <svg lucideLoader2 class="w-4 h-4 animate-spin"></svg> }
            {{ recibiendo() ? 'Recibir y registrar compra' : 'Registrar compra' }}
          </button>
        </div>
        @if (faltante(); as f) { <p class="text-xs text-amber-300 text-right -mt-3">{{ f }}</p> }
      </form>

      <!-- Últimas compras -->
      <aside class="space-y-3">
        <h2 class="text-sm font-bold text-white">Últimas compras</h2>
        @for (c of compras(); track c.id) {
          <article class="rounded-xl border border-slate-800 bg-slate-900/40 p-3.5 space-y-1" [class.opacity-55]="c.anulada">
            <div class="flex items-baseline justify-between gap-3">
              <strong class="text-sm text-white truncate">{{ c.proveedor || 'Sin proveedor' }}</strong>
              <span class="text-sm font-bold tabular-nums" [class]="c.anulada ? 'text-slate-500 line-through' : 'text-emerald-300'">{{ c.total !== null ? (c.total | pesos) : '—' }}</span>
            </div>
            <p class="text-[11px] text-slate-500">{{ c.pedidoId ? 'Pedido recibido · ' : '' }}{{ c.folio ? 'Nota ' + c.folio + ' · ' : '' }}{{ fechaCorta(c.fecha) }}{{ c.usuario ? ' · ' + c.usuario : '' }}</p>
            <p class="text-xs text-slate-300" [class.line-through]="c.anulada">{{ c.renglones.join(' · ') }}</p>
            <div class="flex flex-wrap items-center gap-2 pt-1">
              @if (c.anulada) {
                <span class="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-300">Anulada{{ c.anuladaPor ? ' por ' + c.anuladaPor : '' }}</span>
              } @else {
                <span class="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded" [class]="pillPago(c).clase">{{ pillPago(c).texto }}</span>
                @if (c.iva && c.iva !== 'SIN' && c.ivaMonto) { <span class="text-[10px] text-slate-500 tabular-nums">IVA {{ c.ivaMonto | pesos }}</span> }
                @if (puedeAnular) {
                  <button type="button" (click)="anular(c)" class="ml-auto inline-flex items-center gap-1 text-xs text-slate-400 hover:text-rose-300 cursor-pointer">
                    <svg lucideBan class="w-3.5 h-3.5"></svg> Anular
                  </button>
                }
              }
            </div>
          </article>
        } @empty {
          <p class="text-xs text-slate-500">Todavía no hay compras registradas.</p>
        }
      </aside>
    </section>
    }

    <!-- Alta rápida de proveedor -->
    @if (alta(); as a) {
      <div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" (click)="alta.set(null)">
        <form ngNoForm class="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-5 space-y-3" role="dialog" aria-modal="true" aria-labelledby="alta-titulo"
          (click)="$event.stopPropagation()" (submit)="darDeAlta($event)" novalidate>
          <h3 id="alta-titulo" class="text-base font-bold text-white">Dar de alta proveedor</h3>
          <p class="text-xs text-slate-400">Con el nombre basta para seguir con la compra. El resto se completa en Inventario › Proveedores.</p>
          <div>
            <label for="alta-nombre" class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Nombre *</label>
            <input id="alta-nombre" [ngModel]="a.nombre" (ngModelChange)="alta.set({ nombre: $event, telefono: a.telefono })" maxlength="120" class="${CAMPO}" />
          </div>
          <div>
            <label for="alta-tel" class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">WhatsApp</label>
            <input id="alta-tel" type="tel" inputmode="tel" [ngModel]="a.telefono" (ngModelChange)="alta.set({ nombre: a.nombre, telefono: $event })" placeholder="Opcional" class="${CAMPO}" />
          </div>
          <div class="flex justify-end gap-2 pt-1">
            <button type="button" (click)="alta.set(null)" class="px-4 py-2.5 rounded-lg border border-slate-700 text-sm text-slate-300 cursor-pointer">Cancelar</button>
            <button type="submit" [disabled]="!a.nombre.trim() || guardando()" class="px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold cursor-pointer disabled:opacity-40">Dar de alta y usar</button>
          </div>
        </form>
      </div>
    }

    <!-- Nueva presentación -->
    @if (nuevaPres(); as np) {
      <div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" (click)="nuevaPres.set(null)">
        <form ngNoForm class="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-5 space-y-3" role="dialog" aria-modal="true" aria-labelledby="pres-titulo"
          (click)="$event.stopPropagation()" (submit)="guardarPresentacion($event)" novalidate>
          <h3 id="pres-titulo" class="flex items-center gap-2 text-base font-bold text-white"><svg lucidePackagePlus class="w-5 h-5 text-indigo-300"></svg> Presentación de {{ lineas()[np.linea].articulo.nombre }}</h3>
          <p class="text-xs text-slate-400">Cómo lo vende el proveedor. Se guarda para las siguientes compras.</p>
          <div class="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-2">
            <div>
              <label for="pres-nombre" class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Se llama</label>
              <input id="pres-nombre" [ngModel]="np.nombre" (ngModelChange)="nuevaPres.set({ linea: np.linea, nombre: $event, factor: np.factor })" maxlength="60" placeholder="caja de 24, costal…" class="${CAMPO}" />
            </div>
            <div>
              <label for="pres-factor" class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Trae ({{ lineas()[np.linea].articulo.unidad }})</label>
              <input id="pres-factor" type="number" min="0" step="any" inputmode="decimal" [ngModel]="np.factor" (ngModelChange)="nuevaPres.set({ linea: np.linea, nombre: np.nombre, factor: $event })" placeholder="24" class="${CAMPO} tabular-nums" />
            </div>
          </div>
          <div class="flex justify-end gap-2 pt-1">
            <button type="button" (click)="nuevaPres.set(null)" class="px-4 py-2.5 rounded-lg border border-slate-700 text-sm text-slate-300 cursor-pointer">Cancelar</button>
            <button type="submit" [disabled]="!np.nombre.trim() || !((np.factor ?? 0) > 0) || guardando()" class="px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold cursor-pointer disabled:opacity-40">Guardar y usar</button>
          </div>
        </form>
      </div>
    }
  `,
})
export class ComprasInventarioComponent implements OnChanges {
  private readonly http = inject(HttpClient);
  private readonly avisos = inject(AvisosService);

  @Input({ required: true }) branchId!: string;
  @Input({ required: true }) articulos: ArticuloCompra[] = [];
  @Input() puedeAnular = true;
  /** Entró mercancía: Inventario recarga las existencias. */
  @Output() registrada = new EventEmitter<void>();

  readonly formas: { id: FormaPago; nombre: string; ayuda: string }[] = [
    { id: 'CAJA', nombre: 'Efectivo de caja', ayuda: 'Sale del cajón' },
    { id: 'TRANSFERENCIA', nombre: 'Transferencia', ayuda: 'No toca la caja' },
    { id: 'CREDITO', nombre: 'A crédito', ayuda: 'Queda por pagar' },
  ];
  readonly ivas: { id: Iva; nombre: string }[] = [
    { id: 'INCLUIDO', nombre: 'Precios con IVA incluido' },
    { id: 'APARTE', nombre: 'IVA aparte (+16%)' },
    { id: 'SIN', nombre: 'Sin IVA' },
  ];

  readonly vistas: { id: Vista; nombre: string }[] = [
    { id: 'registrar', nombre: 'Registrar compra' },
    { id: 'pedidos', nombre: 'Pedidos' },
    { id: 'porpagar', nombre: 'Por pagar' },
  ];
  readonly vista = signal<Vista>('registrar');
  readonly pedidos = signal<Pedido[]>([]);
  readonly porPagar = signal<Compra[]>([]);
  readonly recibiendo = signal<Pedido | null>(null);
  readonly pendientes = computed(() => this.pedidos().filter((p) => p.estado === 'PENDIENTE').length);
  readonly deuda = computed(() => this.porPagar().reduce((n, c) => n + (c.total ?? 0), 0));

  readonly proveedores = signal<Proveedor[]>([]);
  readonly presentaciones = signal<Presentacion[]>([]);
  readonly ultimos = signal<Map<string, UltimoPrecio>>(new Map());
  readonly compras = signal<Compra[]>([]);
  readonly cajaAbierta = signal<boolean | null>(null);
  readonly guardando = signal(false);

  readonly proveedor = signal<Proveedor | null>(null);
  readonly textoProveedor = signal('');
  readonly verSugerencias = signal(false);
  readonly folio = signal('');
  readonly fecha = signal(hoyIso());
  readonly pago = signal<FormaPago>('CAJA');
  readonly iva = signal<Iva>('INCLUIDO');
  readonly busqueda = signal('');
  readonly lineas = signal<Linea[]>([]);
  readonly alta = signal<{ nombre: string; telefono: string } | null>(null);
  readonly nuevaPres = signal<{ linea: number; nombre: string; factor: number | null } | null>(null);

  readonly sugerencias = computed(() => {
    const q = normal(this.textoProveedor());
    return this.proveedores().filter((p) => p.activo && (!q || normal(p.nombre).includes(q))).slice(0, 8);
  });
  readonly existeProveedor = computed(() => this.proveedores().some((p) => normal(p.nombre) === normal(this.textoProveedor())));

  readonly resultados = computed(() => {
    const q = normal(this.busqueda());
    if (!q) return [];
    return this.articulos.filter((a) => a.activo && normal(a.nombre).includes(q)).slice(0, 10);
  });

  /** Con IVA incluido los importes ya lo traen; aparte, se suma; sin IVA, no hay. */
  readonly totales = computed(() => {
    const suma = this.lineas().reduce((n, l) => n + (Number(l.importe) || 0), 0);
    const r = (n: number) => Math.round(n * 100) / 100;
    if (this.iva() === 'INCLUIDO') {
      const subtotal = r(suma / (1 + TASA_IVA));
      return { subtotal, iva: r(suma - subtotal), total: r(suma) };
    }
    if (this.iva() === 'APARTE') {
      const iva = r(suma * TASA_IVA);
      return { subtotal: r(suma), iva, total: r(suma + iva) };
    }
    return { subtotal: r(suma), iva: 0, total: r(suma) };
  });

  readonly avisoPago = computed(() => {
    const total = formatearPesos(this.totales().total);
    const nombre = this.proveedor()?.nombre ?? (this.textoProveedor().trim() || 'el proveedor');
    if (this.pago() === 'CAJA') {
      if (this.cajaAbierta() === false) {
        return { clase: 'bg-rose-500/10 text-rose-300', texto: 'La caja está cerrada: ábrela en Caja para pagar con efectivo, o elige transferencia o crédito.' };
      }
      return { clase: 'bg-emerald-500/10 text-emerald-200', texto: `Saldrán ${total} de la caja abierta como compra a ${nombre}. El arqueo lo descuenta solo.` };
    }
    if (this.pago() === 'TRANSFERENCIA') {
      return { clase: 'bg-sky-500/10 text-sky-200', texto: 'Queda anotada como pagada por transferencia. No toca la caja.' };
    }
    const dias = this.proveedor()?.diasCredito || PLAZO_DEFAULT;
    return { clase: 'bg-amber-500/10 text-amber-200', texto: `Queda por pagar ${total} a ${nombre}; vence en ${dias} días.` };
  });

  readonly faltante = computed(() => {
    if (!this.lineas().length) return 'Agrega al menos un artículo.';
    if (this.lineas().some((l) => !l.renglonId && !(Number(l.cantidad) > 0))) return 'Falta la cantidad de algún artículo.';
    if (this.lineas().some((l) => l.renglonId && !(Number(l.cantidad) >= 0))) return 'Escribe cuánto llegó (0 si no llegó).';
    if (!this.lineas().some((l) => Number(l.cantidad) > 0)) return 'No llegó nada: si el pedido ya no va a llegar, cancélalo en Pedidos.';
    if (this.pago() === 'CAJA' && this.cajaAbierta() === false) return 'Con la caja cerrada no se puede pagar en efectivo.';
    if (this.pago() === 'CREDITO' && !this.proveedor() && !this.textoProveedor().trim()) return 'A crédito, elige a quién se le debe.';
    return null;
  });
  readonly sePuede = computed(() => this.faltante() === null);

  ngOnChanges(): void {
    if (!this.branchId) return;
    this.cargar();
  }

  private api(ruta: string): string {
    return `${environment.apiUrl}/branches/${this.branchId}/${ruta}`;
  }

  cargar(): void {
    this.http.get<Proveedor[]>(this.api('inventario/proveedores')).subscribe({ next: (p) => this.proveedores.set(p) });
    this.http.get<Presentacion[]>(this.api('inventario/presentaciones')).subscribe({ next: (p) => this.presentaciones.set(p) });
    this.http.get<UltimoPrecio[]>(this.api('inventario/ultimos-precios')).subscribe({
      next: (u) => this.ultimos.set(new Map(u.map((x) => [x.tipo + ':' + x.articuloId, x]))),
    });
    this.http.get<Compra[]>(this.api('inventario/compras')).subscribe({ next: (c) => this.compras.set(c) });
    this.http.get<Compra[]>(this.api('inventario/compras/por-pagar')).subscribe({ next: (c) => this.porPagar.set(c) });
    this.cargarPedidos();
    this.http.get<{ abierta: boolean }>(this.api('caja/abierta')).subscribe({
      next: (r) => this.cajaAbierta.set(r.abierta),
      error: () => this.cajaAbierta.set(null),
    });
  }

  cargarPedidos(): void {
    this.http.get<Pedido[]>(this.api('inventario/pedidos')).subscribe({
      // Los que faltan por llegar, arriba.
      next: (p) => this.pedidos.set([...p].sort((a, b) => Number(b.estado === 'PENDIENTE') - Number(a.estado === 'PENDIENTE'))),
    });
  }

  // ------------------------------------------------------------------ recibir un pedido

  /** Lleva el pedido a la captura: cada renglón con lo pedido, para corregir lo que no llegó. */
  recibir(p: Pedido): void {
    const lineas: Linea[] = [];
    for (const r of p.renglones) {
      const a = this.articulos.find((x) => x.id === r.articuloId && (x.tipo === 'PRODUCTO') === (r.tipo === 'PRODUCTO'));
      if (!a) continue;
      const como = r.presentacionId ? 'p:' + r.presentacionId : 'u:' + (r.unidad || this.unidadesDe(a)[0]);
      lineas.push({ articulo: a, cantidad: r.cantidad, como, importe: null, renglonId: r.id, pedida: r.cantidad, comoPedido: como });
    }
    this.recibiendo.set(p);
    this.lineas.set(lineas);
    const prov = this.proveedores().find((x) => x.id === p.proveedorId);
    if (prov) this.elegirProveedor(prov);
    else this.textoProveedor.set(p.proveedor);
    if (prov && prov.diasCredito > 0) this.pago.set('CREDITO');
    this.folio.set('');
    this.fecha.set(hoyIso());
    this.vista.set('registrar');
  }

  cancelarRecepcion(): void {
    this.recibiendo.set(null);
    this.lineas.set([]);
  }

  /** Cuánto del inventario trae 1 de "como" (1 caja = 24 piezas; 1 g = 0.001 kg). */
  private factorDe(a: ArticuloCompra, como: string): number {
    if (como.startsWith('p:')) return this.presentaciones().find((x) => x.id === como.slice(2))?.factor ?? 1;
    return convertirUnidad(1, como.slice(2), a.unidad);
  }

  /** Lo que llegó, en la misma unidad o presentación en que se pidió. */
  private recibidoDe(l: Linea): number {
    const cant = Number(l.cantidad) || 0;
    if (!l.comoPedido || l.como === l.comoPedido) return cant;
    return (cant * this.factorDe(l.articulo, l.como)) / this.factorDe(l.articulo, l.comoPedido);
  }

  llegada(l: Linea): { texto: string; clase: string; falta: boolean } | null {
    if (!l.renglonId || l.pedida === undefined) return null;
    const llego = this.recibidoDe(l);
    const como = this.nombreComo(l.articulo, l.comoPedido ?? '');
    if (llego <= 0) return { texto: 'No llegó', clase: 'bg-rose-500/15 text-rose-300', falta: true };
    if (Math.abs(llego - l.pedida) < 0.0005) return { texto: 'Completo', clase: 'bg-emerald-500/15 text-emerald-300', falta: false };
    if (llego < l.pedida) return { texto: `Faltan ${legible(l.pedida - llego)} ${como}`, clase: 'bg-amber-500/15 text-amber-300', falta: true };
    return { texto: `Llegó de más: ${legible(llego - l.pedida)} ${como}`, clase: 'bg-sky-500/15 text-sky-300', falta: false };
  }

  nombreComo(a: ArticuloCompra, como: string): string {
    if (como.startsWith('p:')) return this.presentaciones().find((x) => x.id === como.slice(2))?.nombre ?? '';
    return como.slice(2) || a.unidad;
  }

  // ------------------------------------------------------------------ proveedor

  escribirProveedor(texto: string): void {
    this.textoProveedor.set(texto);
    this.verSugerencias.set(true);
    if (this.proveedor() && normal(this.proveedor()!.nombre) !== normal(texto)) this.proveedor.set(null);
  }

  elegirProveedor(p: Proveedor): void {
    this.proveedor.set(p);
    this.textoProveedor.set(p.nombre);
    this.verSugerencias.set(false);
  }

  cerrarSugerencias(): void {
    setTimeout(() => this.verSugerencias.set(false), 120);
  }

  diasTexto(p: Proveedor): string {
    return p.diasVisita.length ? 'viene ' + p.diasVisita.map(diaCorto).join(', ') : '';
  }

  resumenProveedor(p: Proveedor): string {
    const surte = p.surte.map((s) => s.nombre).filter(Boolean).join(', ');
    return [surte && 'Surte ' + surte, this.diasTexto(p), p.debemos > 0 ? 'le debemos ' + formatearPesos(p.debemos) : '']
      .filter(Boolean).join(' · ');
  }

  abrirAlta(): void {
    this.verSugerencias.set(false);
    this.alta.set({ nombre: this.textoProveedor().trim(), telefono: '' });
  }

  darDeAlta(e: Event): void {
    e.preventDefault();
    const a = this.alta();
    if (!a || !a.nombre.trim()) return;
    this.guardando.set(true);
    this.http.post<Proveedor>(this.api('inventario/proveedores'), { nombre: a.nombre.trim(), telefono: a.telefono.trim() || null }).subscribe({
      next: (p) => {
        this.guardando.set(false);
        this.proveedores.update((l) => [...l, p].sort((x, y) => x.nombre.localeCompare(y.nombre)));
        this.elegirProveedor(p);
        this.alta.set(null);
      },
      error: (err) => {
        this.guardando.set(false);
        this.avisos.error(err.error?.error || 'No se pudo dar de alta el proveedor.');
      },
    });
  }

  // ------------------------------------------------------------------ renglones

  agregar(a: ArticuloCompra): void {
    const pres = this.presentacionesDe(a);
    this.lineas.update((l) => [...l, {
      articulo: a, cantidad: 1, importe: null,
      // Si el artículo tiene presentación del proveedor, se ofrece primero.
      como: pres.length ? 'p:' + pres[0].id : 'u:' + this.unidadesDe(a)[0],
    }]);
    this.busqueda.set('');
  }

  cerrarBusqueda(): void {
    setTimeout(() => this.busqueda.set(''), 150);
  }

  quitar(i: number): void {
    this.lineas.update((l) => l.filter((_, j) => j !== i));
  }

  cambiar(i: number, cambio: Partial<Linea>): void {
    this.lineas.update((l) => l.map((x, j) => (j === i ? { ...x, ...cambio } : x)));
  }

  elegirComo(i: number, valor: string, select: HTMLSelectElement): void {
    if (valor === '__nueva') {
      // El select vuelve a lo que tenía mientras se captura la nueva.
      select.value = this.lineas()[i].como;
      this.nuevaPres.set({ linea: i, nombre: '', factor: null });
      return;
    }
    this.cambiar(i, { como: valor });
  }

  guardarPresentacion(e: Event): void {
    e.preventDefault();
    const np = this.nuevaPres();
    if (!np || !np.nombre.trim() || !(Number(np.factor) > 0)) return;
    const a = this.lineas()[np.linea].articulo;
    this.guardando.set(true);
    this.http.post<Presentacion>(this.api('inventario/presentaciones'), {
      tipo: a.tipo, articuloId: a.id, nombre: np.nombre.trim(), factor: Number(np.factor),
    }).subscribe({
      next: (p) => {
        this.guardando.set(false);
        this.presentaciones.update((l) => [...l, p]);
        this.cambiar(np.linea, { como: 'p:' + p.id });
        this.nuevaPres.set(null);
      },
      error: (err) => {
        this.guardando.set(false);
        this.avisos.error(err.error?.error || 'No se pudo guardar la presentación.');
      },
    });
  }

  presentacionesDe(a: ArticuloCompra): Presentacion[] {
    return this.presentaciones().filter((p) => p.articuloId === a.id);
  }

  unidadesDe(a: ArticuloCompra): string[] {
    return a.tipo === 'PRODUCTO' ? ['pieza'] : unidadesCompatibles(a.unidad);
  }

  opcionesDe(a: ArticuloCompra): { valor: string; nombre: string }[] {
    return [
      ...this.presentacionesDe(a).map((p) => ({ valor: 'p:' + p.id, nombre: `${p.nombre} (${legible(p.factor)} ${a.unidad})` })),
      ...this.unidadesDe(a).map((u) => ({ valor: 'u:' + u, nombre: u })),
    ];
  }

  /** Lo que entra al inventario, en su unidad. */
  unidadesInv(l: Linea): number | null {
    const cant = Number(l.cantidad);
    if (!(cant > 0)) return null;
    if (l.como.startsWith('p:')) {
      const p = this.presentaciones().find((x) => x.id === l.como.slice(2));
      return p ? cant * p.factor : null;
    }
    return convertirUnidad(cant, l.como.slice(2), l.articulo.unidad);
  }

  /** Precio por unidad sin IVA contra lo último que se pagó. */
  comparacion(l: Linea): { actual: number; antes: number; dif: number } | null {
    const unidades = this.unidadesInv(l);
    const importe = Number(l.importe);
    const ultimo = this.ultimos().get(l.articulo.tipo + ':' + l.articulo.id);
    if (!unidades || !(importe > 0) || !ultimo || !(ultimo.costoUnitario > 0)) return null;
    const sinIva = this.iva() === 'INCLUIDO' ? importe / (1 + TASA_IVA) : importe;
    const actual = sinIva / unidades;
    return { actual, antes: ultimo.costoUnitario, dif: Math.round(((actual - ultimo.costoUnitario) / ultimo.costoUnitario) * 100) };
  }

  ultimoTexto(a: ArticuloCompra): string {
    const u = this.ultimos().get(a.tipo + ':' + a.id);
    return u ? `última vez ${formatearPesos(u.costoUnitario)} / ${a.unidad}` : '';
  }

  legible = legible;

  // ------------------------------------------------------------------ registrar y anular

  registrar(e: Event): void {
    e.preventDefault();
    if (!this.sePuede() || this.guardando()) return;
    this.guardando.set(true);
    const pedido = this.recibiendo();
    const renglones = this.lineas().filter((l) => Number(l.cantidad) > 0).map((l) => ({
      ingredientId: l.articulo.tipo === 'PRODUCTO' ? null : l.articulo.id,
      productId: l.articulo.tipo === 'PRODUCTO' ? l.articulo.id : null,
      cantidad: Number(l.cantidad),
      unidad: l.como.startsWith('u:') ? unidadCanonica(l.como.slice(2)) : null,
      presentacionId: l.como.startsWith('p:') ? l.como.slice(2) : null,
      importe: Number(l.importe) || 0,
    }));
    this.http.post<{ mensaje: string }>(this.api('inventario/compras'), {
      proveedorId: this.proveedor()?.id ?? null,
      proveedor: this.proveedor() ? null : this.textoProveedor().trim() || null,
      folio: this.folio().trim() || null,
      fecha: this.fecha(),
      formaPago: this.pago(),
      iva: this.iva(),
      renglones,
      pedidoId: pedido?.id ?? null,
      recepcion: pedido ? this.lineas().filter((l) => l.renglonId).map((l) => {
        const recibido = Math.round(this.recibidoDe(l) * 1000) / 1000;
        return { renglonId: l.renglonId, recibido, motivo: recibido < (l.pedida ?? 0) ? l.motivo ?? 'FALTO' : null };
      }) : null,
    }).subscribe({
      next: (r) => {
        this.guardando.set(false);
        this.avisos.exito(r.mensaje);
        this.recibiendo.set(null);
        this.lineas.set([]);
        this.folio.set('');
        this.fecha.set(hoyIso());
        this.cargar();
        this.registrada.emit();
      },
      error: (err) => {
        this.guardando.set(false);
        this.avisos.error(err.error?.error || err.error?.message || 'No se pudo registrar la compra.');
      },
    });
  }

  async anular(c: Compra): Promise<void> {
    const efectivo = c.formaPago === 'CAJA';
    if (!(await this.avisos.confirmar({
      titulo: `¿Anular la compra de ${formatearPesos(c.total ?? 0)}?`,
      mensaje: 'Se quita del inventario lo que entró' + (efectivo ? ' y el efectivo regresa a la caja abierta.' : '.') + ' Queda en el historial como anulada.',
      confirmar: 'Anular compra', cancelar: 'Volver', peligro: true,
    }))) return;
    this.http.post<{ mensaje: string }>(this.api(`inventario/compras/${c.id}/anular`), {}).subscribe({
      next: (r) => {
        this.avisos.exito(r.mensaje);
        this.cargar();
        this.registrada.emit();
      },
      error: (err) => this.avisos.error(err.error?.error || 'No se pudo anular la compra.'),
    });
  }

  pillPago(c: Compra): { texto: string; clase: string } {
    if (c.formaPago === 'CAJA') return { texto: 'Efectivo de caja', clase: 'bg-emerald-500/15 text-emerald-300' };
    if (c.formaPago === 'TRANSFERENCIA') return { texto: 'Transferencia', clase: 'bg-sky-500/15 text-sky-300' };
    if (c.formaPago === 'CREDITO') {
      return c.pagada ? { texto: 'Crédito pagado', clase: 'bg-slate-800 text-slate-300' }
        : { texto: 'A crédito' + (c.vence ? ' · vence ' + this.fechaCorta(c.vence) : ''), clase: 'bg-amber-500/15 text-amber-300' };
    }
    return { texto: 'Sin forma de pago', clase: 'bg-slate-800 text-slate-400' };
  }

  fechaCorta(iso: string): string {
    const [a, m, d] = iso.slice(0, 10).split('-').map(Number);
    return new Date(a, m - 1, d).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
  }
}

function normal(s: string): string {
  return (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

function legible(n: number): string {
  return new Intl.NumberFormat('es-MX', { maximumFractionDigits: 3 }).format(n);
}

function diaCorto(d: string): string {
  return ({ LUN: 'lun', MAR: 'mar', MIE: 'mié', JUE: 'jue', VIE: 'vie', SAB: 'sáb', DOM: 'dom' } as Record<string, string>)[d] ?? d;
}
