import { TituloPaginaComponent } from '../../shared/components/titulo-pagina.component';
import { AvisosService } from '../../core/services/avisos.service';
import { SucursalActivaService } from '../../core/services/sucursal-activa.service';
import { PesosPipe, formatearPesos } from '../../shared/utils/pesos';
import { Component, ChangeDetectionStrategy, signal, computed, inject, OnInit, effect, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { NgxEchartsModule } from 'ngx-echarts';
import * as echarts from 'echarts';
import { EChartsOption } from 'echarts';
import { Branch } from '../admin-core/models/admin.model';
import { environment } from '../../../environments/environment';
import { IngresosEgresosComponent } from './ingresos-egresos.component';
import {
  LucideUsers,
  LucideRefreshCw,
  LucideBarChart3,
  LucideCalendar,
  LucideClock,
  LucideFlame,
  LucideChefHat,
  LucideDownload,
  LucideTruck,
  LucideReceipt,
} from '@lucide/angular';

export type FilterRange = 'today' | '7d' | '30d' | 'all' | 'custom';

export interface Resumen {
  totalSalesToday: number;
  salesGrowthPercentage: number | null;
  tablesServedToday: number;
  tablesGrowthPercentage: number | null;
  averageTicket: number;
  ticketGrowthPercentage: number | null;
  totalOrdersToday: number;
  ordersGrowthPercentage: number | null;
  envioCobrado: number;
  propinas: number;
  canceladas: number;
  costoVendido: number;
  utilidadBruta: number;
  margenPorcentaje: number | null;
  costoCompleto: boolean;
  platillosSinCosto: number;
}

export interface VentaDelDia {
  date: string;
  revenue: number;
  ordersCount: number;
}

export interface Canal {
  tipo: 'SALON' | 'PARA_LLEVAR' | 'DOMICILIO' | string;
  origen: string | null;
  ordenes: number;
  ventas: number;
  envioCobrado: number;
  propinas: number;
}

export interface EmployeePerformance {
  employeeName: string;
  totalOrders: number;
  totalRevenue: number;
  branchName?: string;
}

export interface TablePerformance {
  tableNumber: number;
  totalOrders: number;
  totalRevenue: number;
  branchName?: string;
}

export interface ProductPerformance {
  productId: string;
  productName: string;
  quantitySold: number;
  totalRevenue: number;
  branchName?: string;
  categoria: string | null;
  costoUnitario: number | null;
  costoTotal: number | null;
  utilidad: number | null;
  margenPorcentaje: number | null;
  costoCompleto: boolean;
}

export interface TurnaroundTime {
  tableNumber: number;
  averageMinutes: number;
  totalOrders: number;
  branchName?: string;
}

export interface PeakHour {
  hourOfDay: number;
  diaSemana: number;
  totalOrders: number;
  totalRevenue: number;
}

export interface KdsEfficiency {
  productName: string;
  avgMinutes: number;
  branchName: string;
  piezas: number;
}

const RESUMEN_VACIO: Resumen = {
  totalSalesToday: 0, salesGrowthPercentage: null, tablesServedToday: 0, tablesGrowthPercentage: null,
  averageTicket: 0, ticketGrowthPercentage: null, totalOrdersToday: 0, ordersGrowthPercentage: null,
  envioCobrado: 0, propinas: 0, canceladas: 0, costoVendido: 0, utilidadBruta: 0, margenPorcentaje: null,
  costoCompleto: false, platillosSinCosto: 0,
};

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

const TARJETA = 'p-5 bg-slate-900/90 border border-slate-700/50 rounded-2xl shadow-xl';
const PANEL = 'p-6 bg-slate-900 border border-slate-700/50 rounded-2xl shadow-2xl';
const VACIO = 'py-8 text-center text-xs text-slate-400 italic border border-dashed border-slate-800 rounded-xl';

@Component({
  selector: 'app-analytics-dashboard',
  standalone: true,
  imports: [
    TituloPaginaComponent, PesosPipe, CommonModule, FormsModule, NgxEchartsModule, IngresosEgresosComponent,
    LucideUsers, LucideRefreshCw, LucideBarChart3,
    LucideCalendar, LucideClock, LucideFlame, LucideChefHat, LucideDownload, LucideTruck, LucideReceipt,
  ],
  template: `
    <div class="space-y-8">
      <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
        <app-titulo-pagina titulo="Reportes" descripcion="Ventas, utilidad, ingresos y egresos, canales, personal y cocina." />

        @if (sucursalesDelRestaurante() > 1) {
          <div class="inline-flex p-1 bg-slate-900/60 rounded-xl border border-slate-800" role="group" aria-label="Alcance del reporte">
            <button type="button" (click)="alcance.set('sucursal')" [attr.aria-pressed]="alcance() === 'sucursal'"
              class="px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
              [class]="alcance() === 'sucursal' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'">Esta sucursal</button>
            <button type="button" (click)="alcance.set('todas')" [attr.aria-pressed]="alcance() === 'todas'"
              class="px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
              [class]="alcance() === 'todas' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'">Todas las sucursales</button>
          </div>
        }
      </div>

      <!-- Vista: ventas o el dinero que entró y salió -->
      <div class="flex flex-wrap gap-2 -mt-2" role="tablist" aria-label="Vista del reporte">
        @for (v of vistas; track v.id) {
          <button type="button" role="tab" (click)="vista.set(v.id)" [attr.aria-selected]="vista() === v.id"
            class="px-4 py-2 rounded-xl text-sm font-semibold cursor-pointer transition-colors min-h-[40px]"
            [class]="vista() === v.id ? 'bg-indigo-600 text-white' : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'">{{ v.nombre }}</button>
        }
      </div>

      <!-- Rango, actualizar y exportar -->
      <div class="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div class="flex flex-wrap items-center gap-3">
          <div class="flex items-center p-1 bg-slate-900 border border-slate-800 rounded-xl flex-wrap" role="group" aria-label="Rango de fechas">
            @for (r of rangos; track r.id) {
              <button type="button" (click)="setFilterRange(r.id)" [attr.aria-pressed]="selectedRange() === r.id"
                class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                [class]="selectedRange() === r.id ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'">
                @if (r.id === 'custom') { <svg lucideCalendar class="w-3.5 h-3.5"></svg> }
                {{ r.texto }}
              </button>
            }
          </div>

          @if (selectedRange() === 'custom') {
            <div class="flex flex-wrap items-center gap-2 p-1.5 bg-slate-900 border border-indigo-500/30 rounded-xl">
              <label class="flex items-center gap-1.5 text-[11px] uppercase font-bold text-slate-400 pl-1">Desde
                <input type="date" [value]="customStartDate()" (change)="customStartDate.set($any($event.target).value)"
                  class="bg-slate-950/80 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-white [color-scheme:dark] outline-none focus:border-indigo-500" />
              </label>
              <label class="flex items-center gap-1.5 text-[11px] uppercase font-bold text-slate-400">Hasta
                <input type="date" [value]="customEndDate()" (change)="customEndDate.set($any($event.target).value)"
                  class="bg-slate-950/80 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-white [color-scheme:dark] outline-none focus:border-indigo-500" />
              </label>
              <button type="button" (click)="applyCustomRange()" class="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold cursor-pointer">Aplicar</button>
            </div>
          }
        </div>

        <div class="flex flex-wrap items-center gap-2">
          @if (vista() === 'ventas') {
          <span class="text-xs text-slate-400 flex items-center gap-1"><svg lucideDownload class="w-3.5 h-3.5"></svg> Exportar:</span>
          <button type="button" (click)="exportarDias()" [disabled]="isLoading()" class="px-3 py-1.5 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-50">Ventas por día</button>
          <button type="button" (click)="exportarPlatillos()" [disabled]="isLoading()" class="px-3 py-1.5 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-50">Platillos</button>
          <button type="button" (click)="exportarMeseros()" [disabled]="isLoading()" class="px-3 py-1.5 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-50">Meseros</button>
          }
          <button type="button" (click)="loadAnalyticsData()" [disabled]="isLoading()" title="Actualizar"
            class="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl text-xs font-semibold cursor-pointer disabled:opacity-50">
            <svg lucideRefreshCw [class.animate-spin]="isLoading()" class="w-4 h-4"></svg>
            <span class="hidden sm:inline">Actualizar</span>
          </button>
        </div>
      </div>

      @if (vista() === 'dinero') {
        <app-ingresos-egresos [consulta]="consultaAplicada()" [recarga]="recargas()" [etiqueta]="getFilterLabel()" [sufijo]="sufijoArchivo()" />
      }

      @if (vista() === 'ventas') {
      <!-- Indicadores principales -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        @for (k of indicadores(); track k.titulo) {
          <div class="${TARJETA}">
            <span class="text-xs font-bold text-slate-400 uppercase tracking-wider">{{ k.titulo }}</span>
            <p class="mt-3 text-2xl lg:text-3xl font-extrabold text-white tracking-tight tabular-nums">
              {{ k.valor }} @if (k.unidad) { <span class="text-sm font-normal text-slate-400">{{ k.unidad }}</span> }
            </p>
            <div class="mt-3 flex items-center gap-2">
              <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border tabular-nums" [class]="tendencia(k.cambio).clase">{{ tendencia(k.cambio).texto }}</span>
              <span class="text-xs text-slate-400">{{ k.cambio === null ? comparacion() : 'vs. periodo anterior' }}</span>
            </div>
          </div>
        }
      </div>

      <!-- Utilidad, envío, propinas y cancelados -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="col-span-2 ${TARJETA}">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-slate-400 uppercase tracking-wider">Utilidad bruta</span>
            @if (resumen().margenPorcentaje !== null) {
              <span class="px-2 py-0.5 rounded-full text-xs font-bold border tabular-nums" [class]="claseMargen(resumen().margenPorcentaje)">margen {{ resumen().margenPorcentaje }}%</span>
            }
          </div>
          <p class="mt-2 text-2xl font-extrabold text-white tabular-nums">{{ resumen().utilidadBruta | pesos }}</p>
          <p class="mt-1 text-xs text-slate-400">Ventas {{ resumen().totalSalesToday | pesos }} − costo de lo vendido {{ resumen().costoVendido | pesos }}</p>
          @if (resumen().platillosSinCosto > 0 || (!resumen().costoCompleto && resumen().totalOrdersToday > 0)) {
            <p class="mt-2 text-[11px] text-amber-300/90">
              @if (resumen().platillosSinCosto > 0) {
                {{ resumen().platillosSinCosto }} {{ resumen().platillosSinCosto === 1 ? 'platillo vendido no tiene' : 'platillos vendidos no tienen' }} costo:
              } @else { Faltan costos de algunos ingredientes: }
              la utilidad real es menor. Captura los costos en Inventario.
            </p>
          }
        </div>
        <div class="${TARJETA}">
          <span class="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5"><svg lucideTruck class="w-3.5 h-3.5"></svg> Envío cobrado</span>
          <p class="mt-2 text-xl font-extrabold text-white tabular-nums">{{ resumen().envioCobrado | pesos }}</p>
          <p class="mt-1 text-[11px] text-slate-400">Aparte de las ventas</p>
        </div>
        <div class="${TARJETA}">
          <span class="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5"><svg lucideReceipt class="w-3.5 h-3.5"></svg> Propinas · cancelados</span>
          <p class="mt-2 text-xl font-extrabold text-white tabular-nums">{{ resumen().propinas | pesos }}</p>
          <p class="mt-1 text-[11px]" [class]="resumen().canceladas ? 'text-rose-300' : 'text-slate-400'">
            {{ resumen().canceladas }} {{ resumen().canceladas === 1 ? 'pedido cancelado' : 'pedidos cancelados' }}
          </p>
        </div>
      </div>

      <!-- Tendencia + canales -->
      <div class="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div class="xl:col-span-2 ${PANEL} space-y-4">
          <div>
            <h2 class="text-lg font-bold text-white tracking-tight">Ventas por día</h2>
            <p class="text-xs text-slate-400 mt-1">
              <span class="text-indigo-400 font-semibold">{{ getFilterLabel() }}</span> · {{ nombreSucursalSeleccionada() }}
            </p>
          </div>
          <div class="w-full relative min-h-[340px]">
            @if (isLoading()) {
              <div class="absolute inset-0 flex items-center justify-center bg-slate-900/60 z-10 rounded-xl">
                <svg lucideRefreshCw class="w-8 h-8 animate-spin text-indigo-400"></svg>
              </div>
            }
            @if (!isLoading() && sinVentas()) {
              <div class="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 text-center px-6">
                <svg lucideBarChart3 class="w-8 h-8 text-slate-600"></svg>
                <p class="text-sm font-semibold text-slate-200">Sin ventas en este periodo</p>
                @if (selectedRange() !== 'all') {
                  <button type="button" (click)="setFilterRange('all')" class="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white cursor-pointer">Ver todo el histórico</button>
                }
              </div>
            }
            <div echarts [options]="chartOption()" class="w-full h-[340px]" [class.opacity-20]="!isLoading() && sinVentas()"></div>
          </div>
        </div>

        <div class="${PANEL} flex flex-col">
          <h2 class="text-lg font-bold text-white tracking-tight">Por canal</h2>
          <p class="text-xs text-slate-400 mt-1 mb-5">De dónde vinieron las ventas</p>
          @if (canales().length === 0) {
            <div class="${VACIO} flex-1 flex items-center justify-center">Sin ventas en este periodo.</div>
          } @else {
            <ul class="space-y-4">
              @for (c of canales(); track c.tipo + (c.origen ?? '')) {
                <li>
                  <div class="flex items-baseline justify-between gap-2 text-sm">
                    <span class="font-semibold text-white">{{ nombreCanal(c) }}</span>
                    <span class="font-bold text-emerald-400 tabular-nums">{{ c.ventas | pesos }}</span>
                  </div>
                  <div class="mt-1.5 h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div class="h-full rounded-full bg-indigo-500" [style.width.%]="porcentajeCanal(c)"></div>
                  </div>
                  <p class="mt-1 text-[11px] text-slate-400 tabular-nums">
                    {{ porcentajeCanal(c) }}% · {{ c.ordenes }} {{ c.ordenes === 1 ? 'orden' : 'órdenes' }} · ticket {{ (c.ordenes ? c.ventas / c.ordenes : 0) | pesos }}
                    @if (c.envioCobrado > 0) { · envío {{ c.envioCobrado | pesos }} }
                  </p>
                </li>
              }
            </ul>
          }
        </div>
      </div>

      <!-- Platillos con costo y margen -->
      <div class="${PANEL} space-y-5">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 class="text-lg font-bold text-white tracking-tight">Platillos</h2>
            <p class="text-xs text-slate-400 mt-1">Lo más vendido, cuánto deja cada uno y su margen con los costos de hoy</p>
          </div>
          @if (productPerformance().length > 10) {
            <button type="button" (click)="verTodosPlatillos.set(!verTodosPlatillos())" class="text-xs font-semibold text-indigo-400 hover:text-indigo-300 cursor-pointer self-start">
              {{ verTodosPlatillos() ? 'Ver solo los 10 primeros' : 'Ver los ' + productPerformance().length }}
            </button>
          }
        </div>
        @if (productPerformance().length === 0) {
          <div class="${VACIO}">No hay platillos vendidos en este periodo.</div>
        } @else {
          <div class="overflow-x-auto -mx-2">
            <table class="w-full text-sm min-w-[560px]">
              <thead>
                <tr class="text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
                  <th class="text-left font-semibold px-2 py-2">Platillo</th>
                  <th class="text-right font-semibold px-2 py-2">Vendidos</th>
                  <th class="text-right font-semibold px-2 py-2">Ventas</th>
                  <th class="text-right font-semibold px-2 py-2">Costo c/u</th>
                  <th class="text-right font-semibold px-2 py-2">Utilidad</th>
                  <th class="text-right font-semibold px-2 py-2">Margen</th>
                </tr>
              </thead>
              <tbody>
                @for (p of platillosVisibles(); track p.productId; let i = $index) {
                  <tr class="border-b border-slate-800/60 hover:bg-slate-800/30">
                    <td class="px-2 py-2.5">
                      <span class="text-slate-500 tabular-nums mr-2">{{ i + 1 }}</span>
                      <span class="font-semibold text-white">{{ p.productName }}</span>
                      @if (p.categoria) { <span class="text-[11px] text-slate-500 ml-1">· {{ p.categoria }}</span> }
                    </td>
                    <td class="px-2 py-2.5 text-right tabular-nums text-slate-200">{{ p.quantitySold }}</td>
                    <td class="px-2 py-2.5 text-right tabular-nums font-semibold text-sky-300">{{ p.totalRevenue | pesos }}</td>
                    <td class="px-2 py-2.5 text-right tabular-nums text-slate-300">{{ p.costoUnitario === null ? '—' : (p.costoUnitario | pesos) }}</td>
                    <td class="px-2 py-2.5 text-right tabular-nums text-slate-200">{{ p.utilidad === null ? '—' : (p.utilidad | pesos) }}</td>
                    <td class="px-2 py-2.5 text-right">
                      @if (p.margenPorcentaje === null) {
                        <span class="text-[11px] text-slate-500">Sin costo</span>
                      } @else {
                        <span class="px-2 py-0.5 rounded-full text-xs font-bold border tabular-nums" [class]="claseMargen(p.margenPorcentaje)"
                          [title]="p.costoCompleto ? '' : 'A algún ingrediente le falta costo'">{{ p.margenPorcentaje }}%{{ p.costoCompleto ? '' : '*' }}</span>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          @if (hayCostoParcial()) {
            <p class="text-[11px] text-slate-500">* A algún ingrediente de ese platillo le falta costo; el margen real es menor.</p>
          }
        }
      </div>

      <!-- Personal y mesas -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="${PANEL} space-y-5 flex flex-col">
          <div class="flex items-center justify-between border-b border-slate-800/80 pb-4">
            <div>
              <h2 class="text-lg font-bold text-white tracking-tight">Meseros</h2>
              <p class="text-xs text-slate-400 mt-1">Según quién atendía la mesa al cobrar; si eran dos, la venta se reparte</p>
            </div>
            <svg lucideUsers class="w-5 h-5 text-amber-400 shrink-0"></svg>
          </div>
          @if (employeePerformance().length === 0) {
            <div class="${VACIO} flex-1 flex items-center justify-center">No hay cuentas de mesa cobradas en este periodo.</div>
          } @else {
            <div class="flex flex-col gap-3 max-h-[360px] overflow-y-auto pr-1">
              @for (emp of employeePerformance(); track emp.employeeName; let idx = $index) {
                <div class="flex items-center justify-between p-4 bg-slate-950/50 border border-slate-800 rounded-xl">
                  <div class="flex items-center gap-3 min-w-0">
                    <div class="w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs shrink-0 border"
                      [class]="idx === 0 ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-slate-800 text-slate-300 border-slate-700'">
                      {{ idx + 1 }}
                    </div>
                    <div class="min-w-0">
                      <p class="text-sm font-bold truncate" [class]="emp.employeeName === 'Sin asignar' ? 'text-slate-400 italic' : 'text-white'">{{ emp.employeeName }}</p>
                      <p class="text-[11px] text-slate-400 mt-0.5 tabular-nums">{{ emp.totalOrders }} cuentas · ticket {{ (emp.totalOrders ? emp.totalRevenue / emp.totalOrders : 0) | pesos }}
                        @if (alcance() === 'todas' && emp.branchName) { · {{ emp.branchName }} }</p>
                    </div>
                  </div>
                  <p class="text-sm font-black text-emerald-400 tabular-nums shrink-0 pl-2">{{ emp.totalRevenue | pesos }}</p>
                </div>
              }
            </div>
          }
        </div>

        <div class="${PANEL} space-y-5 flex flex-col">
          <div class="flex items-center justify-between border-b border-slate-800/80 pb-4">
            <div>
              <h2 class="text-lg font-bold text-white tracking-tight">Mesas</h2>
              <p class="text-xs text-slate-400 mt-1">Lo que vendió cada mesa y cuánto tiempo estuvo ocupada en promedio</p>
            </div>
            <svg lucideClock class="w-5 h-5 text-fuchsia-400 shrink-0"></svg>
          </div>
          @if (tablePerformance().length === 0) {
            <div class="${VACIO} flex-1 flex items-center justify-center">No hay cuentas de mesa en este periodo.</div>
          } @else {
            <div class="flex flex-col gap-3 max-h-[360px] overflow-y-auto pr-1">
              @for (t of tablePerformance(); track $index) {
                <div class="flex items-center justify-between p-4 bg-slate-950/50 border border-slate-800 rounded-xl">
                  <div class="min-w-0">
                    <p class="text-sm font-bold text-white">Mesa {{ t.tableNumber }}
                      @if (alcance() === 'todas') { <span class="text-[11px] font-normal text-slate-400">· {{ t.branchName }}</span> }</p>
                    <p class="text-[11px] text-slate-400 mt-0.5 tabular-nums">{{ t.totalOrders }} cuentas
                      @if (minutosDeMesa(t); as m) { · <span class="text-fuchsia-300">{{ m }} min ocupada</span> }</p>
                  </div>
                  <p class="text-sm font-black text-emerald-400 tabular-nums shrink-0 pl-2">{{ t.totalRevenue | pesos }}</p>
                </div>
              }
            </div>
          }
        </div>
      </div>

      <!-- Horas pico + cocina -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div class="lg:col-span-2 ${PANEL} space-y-4">
          <div class="flex items-center justify-between">
            <div>
              <h2 class="text-lg font-bold text-white tracking-tight">Horas pico</h2>
              <p class="text-xs text-slate-400 mt-1">Órdenes abiertas por día de la semana y hora. Úsalo para armar los turnos.</p>
            </div>
            <svg lucideFlame class="w-5 h-5 text-rose-400 shrink-0"></svg>
          </div>
          @if (horaMasFuerte(); as h) {
            <p class="text-xs text-slate-300">Lo más fuerte: <span class="font-bold text-rose-300">{{ h }}</span></p>
          }
          <div class="overflow-x-auto">
            <div echarts [options]="peakHoursChartOption()" class="h-[260px] min-w-[560px]"></div>
          </div>
        </div>

        <div class="${PANEL} flex flex-col">
          <div class="flex items-center justify-between border-b border-slate-800/80 pb-4">
            <div>
              <h2 class="text-lg font-bold text-white tracking-tight">Tiempos de cocina</h2>
              <p class="text-xs text-slate-400 mt-1">Minutos de que se pide a que está listo</p>
            </div>
            <svg lucideChefHat class="w-5 h-5 text-orange-400 shrink-0"></svg>
          </div>
          @if (kdsEfficiency().length === 0) {
            <div class="${VACIO} flex-1 flex items-center justify-center mt-5">Sin platillos marcados como listos en este periodo.</div>
          } @else {
            <div class="flex flex-col gap-3 mt-5 max-h-[300px] overflow-y-auto pr-1">
              @for (item of kdsEfficiency(); track item.productName) {
                <div class="flex items-center justify-between p-3 bg-slate-950/50 border border-slate-800 rounded-xl">
                  <div class="min-w-0">
                    <p class="text-sm font-bold text-white truncate" [title]="item.productName">{{ item.productName }}</p>
                    <p class="text-[11px] text-slate-400 mt-0.5">{{ item.piezas }} {{ item.piezas === 1 ? 'pieza' : 'piezas' }}</p>
                  </div>
                  <p class="text-sm font-black tabular-nums shrink-0 pl-2" [class]="item.avgMinutes >= 25 ? 'text-rose-400' : item.avgMinutes >= 15 ? 'text-orange-400' : 'text-emerald-400'">{{ item.avgMinutes }} min</p>
                </div>
              }
            </div>
          }
        </div>
      </div>
      }
    </div>
  `,
  styles: [`:host { display: block; }`],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnalyticsDashboardComponent implements OnInit {
  private readonly avisos = inject(AvisosService);
  private readonly http = inject(HttpClient);
  private readonly sucursalActiva = inject(SucursalActivaService);

  readonly rangos: { id: FilterRange; texto: string }[] = [
    { id: 'today', texto: 'Hoy' },
    { id: '7d', texto: '7 días' },
    { id: '30d', texto: '30 días' },
    { id: 'all', texto: 'Histórico' },
    { id: 'custom', texto: 'Rango' },
  ];

  readonly resumen = signal<Resumen>(RESUMEN_VACIO);
  readonly salesData = signal<VentaDelDia[]>([]);
  readonly canales = signal<Canal[]>([]);
  readonly employeePerformance = signal<EmployeePerformance[]>([]);
  readonly tablePerformance = signal<TablePerformance[]>([]);
  readonly productPerformance = signal<ProductPerformance[]>([]);
  readonly tableTurnaround = signal<TurnaroundTime[]>([]);
  readonly peakHoursData = signal<PeakHour[]>([]);
  readonly kdsEfficiency = signal<KdsEfficiency[]>([]);
  readonly isLoading = signal(true);
  readonly vistas: { id: 'ventas' | 'dinero'; nombre: string }[] = [
    { id: 'ventas', nombre: 'Ventas' },
    { id: 'dinero', nombre: 'Ingresos y egresos' },
  ];
  readonly vista = signal<'ventas' | 'dinero'>('ventas');
  /** La consulta del último "Actualizar" o cambio de rango, para Ingresos y egresos. */
  readonly consultaAplicada = signal('');
  readonly recargas = signal(0);
  readonly selectedRange = signal<FilterRange>('7d');
  readonly verTodosPlatillos = signal(false);

  readonly customStartDate = signal('');
  readonly customEndDate = signal('');

  // Restaurante y sucursal: los de la barra superior. Aquí solo se elige si el
  // reporte es de esa sucursal o de todas las del restaurante.
  readonly restaurants = this.sucursalActiva.restaurantes;
  readonly selectedRestaurantId = this.sucursalActiva.restaurantId;
  readonly alcance = signal<'sucursal' | 'todas'>('sucursal');
  readonly selectedBranchId = computed<string | null>(() =>
    this.alcance() === 'todas' ? null : this.sucursalActiva.branchId() || null,
  );
  readonly sucursalesDelRestaurante = computed(() => this.sucursalActiva.sucursales().length);

  /** Cambió la sucursal (barra superior) o el alcance: se vuelve a pedir el reporte. */
  private readonly recargarAlCambiarContexto = effect(() => {
    this.selectedBranchId();
    this.selectedRestaurantId();
    untracked(() => this.loadAnalyticsData());
  });

  readonly availableBranches = computed<Branch[]>(() => {
    const rId = this.selectedRestaurantId();
    return this.restaurants().find((r) => r.id === rId)?.branches || [];
  });

  /**
   * Cada recarga lleva un número; las respuestas de una recarga vieja se tiran.
   * Sin esto, cambiar rápido de "Hoy" a "30 días" podía dejar en pantalla los
   * números del rango anterior si esa respuesta llegaba al último.
   */
  private recarga = 0;
  private pendientes = 0;
  private huboError = false;

  ngOnInit(): void {
    const hoy = new Date();
    const antes = new Date();
    antes.setDate(hoy.getDate() - 29);
    this.customEndDate.set(this.fecha(hoy));
    this.customStartDate.set(this.fecha(antes));
  }

  setFilterRange(range: FilterRange): void {
    this.selectedRange.set(range);
    if (range !== 'custom') this.loadAnalyticsData();
  }

  applyCustomRange(): void {
    const desde = this.customStartDate();
    const hasta = this.customEndDate();
    if (!desde || !hasta) {
      this.avisos.error('Elige las dos fechas.');
      return;
    }
    if (desde > hasta) {
      this.avisos.error('La fecha "desde" es posterior a "hasta".');
      return;
    }
    this.loadAnalyticsData();
  }

  getFilterLabel(): string {
    if (this.selectedRange() === 'custom') {
      return `Del ${this.fechaCorta(this.customStartDate())} al ${this.fechaCorta(this.customEndDate())}`;
    }
    return { today: 'Hoy', '7d': 'Últimos 7 días', '30d': 'Últimos 30 días', all: 'Histórico completo', custom: '' }[this.selectedRange()];
  }

  /** Texto junto al indicador cuando no hay porcentaje. */
  comparacion(): string {
    return this.selectedRange() === 'all' ? 'histórico completo' : 'sin ventas en el periodo anterior';
  }

  private fecha(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  private fechaCorta(iso: string): string {
    const [, m, d] = iso.split('-');
    return d && m ? `${d}/${m}` : iso;
  }

  private getDateParams(): { startDate?: string; endDate?: string } {
    const hoy = new Date();
    const diasAtras = (n: number) => {
      const d = new Date(hoy);
      d.setDate(d.getDate() - n);
      return this.fecha(d);
    };
    switch (this.selectedRange()) {
      case 'today': return { startDate: this.fecha(hoy), endDate: this.fecha(hoy) };
      case '7d': return { startDate: diasAtras(6), endDate: this.fecha(hoy) };
      case '30d': return { startDate: diasAtras(29), endDate: this.fecha(hoy) };
      case 'custom': return { startDate: this.customStartDate() || undefined, endDate: this.customEndDate() || undefined };
      default: return {};
    }
  }

  private consulta(extra: Record<string, string | number> = {}): string {
    const { startDate, endDate } = this.getDateParams();
    const q = new URLSearchParams();
    const rId = this.selectedRestaurantId();
    const bId = this.selectedBranchId();
    if (rId) q.set('restaurantId', rId);
    if (bId) q.set('branchId', bId);
    if (startDate) q.set('startDate', startDate);
    if (endDate) q.set('endDate', endDate);
    for (const [k, v] of Object.entries(extra)) q.set(k, String(v));
    const s = q.toString();
    return s ? `?${s}` : '';
  }

  private pedir<T>(ruta: string, guardar: (datos: T) => void, extra: Record<string, string | number> = {}): void {
    const esta = this.recarga;
    this.pendientes++;
    this.http.get<T>(`${environment.apiUrl}/analytics/${ruta}${this.consulta(extra)}`).subscribe({
      next: (datos) => {
        if (esta === this.recarga) guardar(datos);
      },
      error: () => {
        if (esta === this.recarga && !this.huboError) {
          this.huboError = true;
          this.avisos.error('No se pudo cargar parte del reporte. Intenta con "Actualizar".');
        }
      },
    }).add(() => {
      if (esta !== this.recarga) return;
      if (--this.pendientes === 0) this.isLoading.set(false);
    });
  }

  loadAnalyticsData(): void {
    this.consultaAplicada.set(this.consulta());
    this.recargas.update((n) => n + 1);
    this.recarga++;
    this.pendientes = 0;
    this.huboError = false;
    this.isLoading.set(true);
    this.pedir<Resumen>('summary', (r) => this.resumen.set({ ...RESUMEN_VACIO, ...r }));
    this.pedir<VentaDelDia[]>('sales/daily', (d) => this.salesData.set(d ?? []));
    this.pedir<Canal[]>('sales/channels', (d) => this.canales.set(d ?? []));
    this.pedir<ProductPerformance[]>('products/performance', (d) => this.productPerformance.set(d ?? []), { limit: 500 });
    this.pedir<EmployeePerformance[]>('employees/performance', (d) => this.employeePerformance.set(d ?? []));
    this.pedir<TablePerformance[]>('tables/performance', (d) => this.tablePerformance.set(d ?? []));
    this.pedir<TurnaroundTime[]>('tables/turnaround', (d) => this.tableTurnaround.set(d ?? []));
    this.pedir<PeakHour[]>('peak-hours', (d) => this.peakHoursData.set(d ?? []));
    this.pedir<KdsEfficiency[]>('kitchen/efficiency', (d) => this.kdsEfficiency.set(d ?? []));
  }

  // ------------------------------------------------------------ indicadores

  readonly indicadores = computed(() => {
    const r = this.resumen();
    return [
      { titulo: 'Ventas', valor: formatearPesos(r.totalSalesToday), unidad: '', cambio: r.salesGrowthPercentage },
      { titulo: 'Órdenes', valor: String(r.totalOrdersToday), unidad: 'cobradas', cambio: r.ordersGrowthPercentage },
      { titulo: 'Ticket promedio', valor: formatearPesos(r.averageTicket), unidad: '', cambio: r.ticketGrowthPercentage },
      { titulo: 'Mesas atendidas', valor: String(r.tablesServedToday), unidad: 'cuentas', cambio: r.tablesGrowthPercentage },
    ];
  });

  /** «↑ 12%» en verde, «↓ 8%» en rojo, «Sin cambio» en gris y «—» si no hay con qué comparar. */
  tendencia(pct: number | null | undefined): { texto: string; clase: string } {
    if (pct === null || pct === undefined) {
      return { texto: '—', clase: 'bg-slate-800/60 text-slate-400 border-slate-700' };
    }
    const v = Number(pct);
    if (!Number.isFinite(v) || Math.abs(v) < 0.05) {
      return { texto: 'Sin cambio', clase: 'bg-slate-800/60 text-slate-400 border-slate-700' };
    }
    const cifra = Math.abs(v).toLocaleString('es-MX', { maximumFractionDigits: 1 });
    return v > 0
      ? { texto: `↑ ${cifra}%`, clase: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' }
      : { texto: `↓ ${cifra}%`, clase: 'bg-rose-500/10 text-rose-400 border-rose-500/20' };
  }

  claseMargen(m: number | null): string {
    if (m === null) return 'bg-slate-800 text-slate-400 border-slate-700';
    if (m >= 60) return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    if (m >= 40) return 'bg-amber-500/10 text-amber-300 border-amber-500/20';
    return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
  }

  readonly sinVentas = computed(() => !this.salesData().some((d) => Number(d.revenue) > 0));

  readonly nombreSucursalSeleccionada = computed(() => {
    const id = this.selectedBranchId();
    if (!id) return 'Todas las sucursales';
    return this.availableBranches().find((b) => String(b.id) === String(id))?.name ?? 'Sucursal seleccionada';
  });

  // ------------------------------------------------------------ canales, platillos y mesas

  private readonly totalCanales = computed(() => this.canales().reduce((s, c) => s + Number(c.ventas), 0));

  porcentajeCanal(c: Canal): number {
    const total = this.totalCanales();
    return total > 0 ? Math.round((Number(c.ventas) / total) * 100) : 0;
  }

  nombreCanal(c: Canal): string {
    const por: Record<string, string> = { WEB: 'menú en línea', TELEFONO: 'teléfono', WHATSAPP: 'WhatsApp', RAPPI: 'Rappi' };
    if (c.tipo === 'SALON') return 'Salón';
    const base = c.tipo === 'PARA_LLEVAR' ? 'Para llevar' : 'Domicilio';
    return c.origen ? `${base} · ${por[c.origen] ?? c.origen.toLowerCase()}` : base;
  }

  readonly platillosVisibles = computed(() =>
    this.verTodosPlatillos() ? this.productPerformance() : this.productPerformance().slice(0, 10),
  );

  readonly hayCostoParcial = computed(() =>
    this.platillosVisibles().some((p) => p.margenPorcentaje !== null && !p.costoCompleto),
  );

  private readonly minutosPorMesa = computed(() => {
    const m = new Map<string, number>();
    for (const t of this.tableTurnaround()) m.set(`${t.branchName}|${t.tableNumber}`, t.averageMinutes);
    return m;
  });

  minutosDeMesa(t: TablePerformance): number | null {
    return this.minutosPorMesa().get(`${t.branchName}|${t.tableNumber}`) ?? null;
  }

  readonly horaMasFuerte = computed(() => {
    const datos = this.peakHoursData();
    if (!datos.length) return null;
    const max = datos.reduce((a, b) => (b.totalOrders > a.totalOrders ? b : a));
    return `${DIAS[max.diaSemana - 1]} de ${max.hourOfDay}:00 a ${max.hourOfDay + 1}:00 (${max.totalOrders} órdenes)`;
  });

  // ------------------------------------------------------------ gráficas

  readonly chartOption = computed<EChartsOption>(() => {
    const datos = this.salesData();
    const barras = datos.length <= 1;
    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#0f172a',
        borderColor: '#334155',
        textStyle: { color: '#f8fafc', fontSize: 12 },
        formatter: (params: any) => {
          const p = Array.isArray(params) ? params[0] : null;
          if (!p) return '';
          const d = datos[p.dataIndex];
          return `<div style="font-size:11px;color:#94a3b8;margin-bottom:4px">${p.name}</div>
            <div>Ventas: <b style="color:#34d399">${formatearPesos(Number(p.value))}</b></div>
            <div>Órdenes: <b>${d?.ordersCount ?? 0}</b></div>`;
        },
      },
      grid: { top: 25, left: 20, right: 25, bottom: 10, containLabel: true },
      xAxis: {
        type: 'category',
        boundaryGap: barras,
        data: datos.map((d) => this.fechaCorta(d.date)),
        axisLine: { lineStyle: { color: '#334155' } },
        axisLabel: { color: '#94a3b8', fontSize: 11, margin: 12 },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          color: '#94a3b8',
          fontSize: 11,
          formatter: (v: number) => `$${v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v}`,
        },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)', type: 'dashed' } },
      },
      series: [
        {
          name: 'Ventas',
          type: barras ? 'bar' : 'line',
          smooth: true,
          showSymbol: datos.length <= 31,
          symbolSize: 6,
          barMaxWidth: 80,
          itemStyle: { color: '#818cf8', borderRadius: barras ? [6, 6, 0, 0] : 0 },
          lineStyle: { color: '#6366f1', width: 3 },
          areaStyle: barras ? undefined : {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(99, 102, 241, 0.45)' },
              { offset: 1, color: 'rgba(99, 102, 241, 0)' },
            ]),
          },
          data: datos.map((d) => Number(d.revenue)),
        },
      ],
    };
  });

  /** Mapa de calor real: días de la semana contra horas. */
  readonly peakHoursChartOption = computed<EChartsOption>(() => {
    const datos = this.peakHoursData();
    const horas = datos.map((d) => d.hourOfDay);
    const desde = horas.length ? Math.min(...horas) : 8;
    const hasta = horas.length ? Math.max(...horas) : 23;
    const columnas = Array.from({ length: hasta - desde + 1 }, (_, i) => `${desde + i}:00`);
    const celdas = datos.map((d) => [d.hourOfDay - desde, d.diaSemana - 1, d.totalOrders]);
    const max = Math.max(1, ...datos.map((d) => d.totalOrders));
    return {
      backgroundColor: 'transparent',
      tooltip: {
        backgroundColor: '#0f172a',
        borderColor: '#334155',
        textStyle: { color: '#f8fafc', fontSize: 12 },
        formatter: (p: any) => {
          const [h, dia, n] = p.value as number[];
          const d = datos.find((x) => x.diaSemana === dia + 1 && x.hourOfDay === h + desde);
          return `${DIAS[dia]} ${h + desde}:00<br/>Órdenes: <b>${n}</b><br/>Ventas: <b>${formatearPesos(Number(d?.totalRevenue ?? 0))}</b>`;
        },
      },
      grid: { top: 5, left: 10, right: 10, bottom: 45, containLabel: true },
      xAxis: { type: 'category', data: columnas, splitArea: { show: false }, axisLabel: { color: '#94a3b8', fontSize: 10 }, axisLine: { lineStyle: { color: '#334155' } } },
      yAxis: { type: 'category', data: DIAS, inverse: true, axisLabel: { color: '#94a3b8', fontSize: 11 }, axisLine: { show: false }, axisTick: { show: false } },
      visualMap: {
        min: 0,
        max,
        calculable: false,
        orient: 'horizontal',
        left: 'center',
        bottom: 0,
        itemHeight: 120,
        textStyle: { color: '#94a3b8', fontSize: 10 },
        text: ['Más', 'Menos'],
        inRange: { color: ['#1e293b', '#4f46e5', '#d946ef', '#f43f5e'] },
      },
      series: [{
        type: 'heatmap',
        data: celdas,
        label: { show: true, color: '#e2e8f0', fontSize: 10, formatter: (p: any) => (p.value[2] ? String(p.value[2]) : '') },
        itemStyle: { borderColor: '#0f172a', borderWidth: 2, borderRadius: 3 },
      }],
    };
  });

  // ------------------------------------------------------------ exportar

  /** Descarga un CSV que Excel abre con acentos (BOM UTF-8). */
  private descargarCsv(nombre: string, filas: (string | number | null)[][]): void {
    const celda = (v: string | number | null) => {
      const s = v === null || v === undefined ? '' : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const texto = '﻿' + filas.map((f) => f.map(celda).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([texto], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${nombre}-${this.sufijoArchivo()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  sufijoArchivo(): string {
    const { startDate, endDate } = this.getDateParams();
    return startDate ? `${startDate}_a_${endDate}` : `historico-al-${this.fecha(new Date())}`;
  }

  exportarDias(): void {
    this.descargarCsv('ventas-por-dia', [
      ['Fecha', 'Órdenes', 'Ventas'],
      ...this.salesData().map((d) => [d.date, d.ordersCount, Number(d.revenue).toFixed(2)]),
    ]);
  }

  exportarPlatillos(): void {
    const n = (v: number | null) => (v === null ? null : Number(v).toFixed(2));
    this.descargarCsv('platillos', [
      ['Platillo', 'Categoría', 'Vendidos', 'Ventas', 'Costo unitario', 'Costo total', 'Utilidad', 'Margen %', 'Costo completo'],
      ...this.productPerformance().map((p) => [
        p.productName, p.categoria, p.quantitySold, n(p.totalRevenue), n(p.costoUnitario), n(p.costoTotal),
        n(p.utilidad), p.margenPorcentaje, p.costoUnitario === null ? 'sin costo' : p.costoCompleto ? 'sí' : 'no',
      ]),
    ]);
  }

  exportarMeseros(): void {
    this.descargarCsv('meseros', [
      ['Mesero', 'Cuentas', 'Ventas', 'Ticket promedio', 'Sucursal'],
      ...this.employeePerformance().map((e) => [
        e.employeeName, e.totalOrders, Number(e.totalRevenue).toFixed(2),
        e.totalOrders ? (Number(e.totalRevenue) / e.totalOrders).toFixed(2) : '0.00', e.branchName ?? '',
      ]),
    ]);
  }
}
