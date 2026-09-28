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
import { AnalyticsService } from '../../core/services/analytics.service';
import { DailySaleData } from '../../core/models/analytics.model';
import { AuthService } from '../../core/services/auth.service';
import { Restaurant, Branch } from '../admin-core/models/admin.model';
import { environment } from '../../../environments/environment';
import {
  LucideTrendingUp,
  LucideUsers,
  LucideDollarSign,
  LucideShoppingBag,
  LucideRefreshCw,
  LucideBarChart3,
  LucideCalendar,
  LucideClock,
  LucideFlame,
  LucideChefHat
} from '@lucide/angular';

export type FilterRange = 'today' | '7d' | '30d' | 'all' | 'custom';

export interface EmployeePerformance {
  employeeId: string;
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
}

export interface TurnaroundTime {
  tableNumber: number;
  averageMinutes: number;
  totalOrders: number;
  branchName?: string;
}

export interface PeakHour {
  hourOfDay: number;
  totalOrders: number;
  totalRevenue: number;
}

export interface KdsEfficiency {
  productName: string;
  avgMinutes: number;
  branchName: string;
}

@Component({
  selector: 'app-analytics-dashboard',
  standalone: true,
  imports: [TituloPaginaComponent, PesosPipe, 
    CommonModule,
    FormsModule,
    NgxEchartsModule,
    LucideTrendingUp,
    LucideUsers,
    LucideDollarSign,
    LucideShoppingBag,
    LucideRefreshCw,
    LucideBarChart3,
    LucideCalendar,
    LucideClock,
    LucideFlame,
    LucideChefHat
  ],
  template: `
    <div class="space-y-8 select-none">
      <!-- Header Section with Context Controls (Restaurante y Sucursal) -->
      <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
        <div>
          <div class="flex items-center gap-3">
            <div>
              <app-titulo-pagina titulo="Reportes" descripcion="Ingresos, mesas atendidas y lo más vendido." />
            </div>
          </div>
        </div>

        <!-- Alcance: la sucursal de la barra superior o todas las del restaurante -->
        @if (sucursalesDelRestaurante() > 1) {
          <div class="inline-flex p-1 bg-slate-900/60 rounded-xl border border-slate-800" role="group" aria-label="Alcance del reporte">
            <button type="button" (click)="alcance.set('sucursal')" [attr.aria-pressed]="alcance() === 'sucursal'"
              class="px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
              [class]="alcance() === 'sucursal' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'">
              Esta sucursal
            </button>
            <button type="button" (click)="alcance.set('todas')" [attr.aria-pressed]="alcance() === 'todas'"
              class="px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
              [class]="alcance() === 'todas' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'">
              Todas las sucursales
            </button>
          </div>
        }
      </div>

      <!-- Time Filter Control Bar -->
      <div class="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div class="flex items-center gap-2 text-xs font-semibold text-slate-400">
          <span>Rango de análisis:</span>
        </div>

        <!-- Filters Container -->
        <div class="flex flex-wrap items-center gap-3">
          <!-- Filter Buttons Group -->
          <div class="flex items-center p-1 bg-slate-900 border border-slate-800 rounded-xl flex-wrap">
            <button
              (click)="setFilterRange('today')"
              [class.bg-indigo-600]="selectedRange() === 'today'"
              [class.text-white]="selectedRange() === 'today'"
              [class.text-slate-400]="selectedRange() !== 'today'"
              class="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer"
            >
              Hoy
            </button>
            <button
              (click)="setFilterRange('7d')"
              [class.bg-indigo-600]="selectedRange() === '7d'"
              [class.text-white]="selectedRange() === '7d'"
              [class.text-slate-400]="selectedRange() !== '7d'"
              class="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer"
            >
              7 Días
            </button>
            <button
              (click)="setFilterRange('30d')"
              [class.bg-indigo-600]="selectedRange() === '30d'"
              [class.text-white]="selectedRange() === '30d'"
              [class.text-slate-400]="selectedRange() !== '30d'"
              class="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer"
            >
              30 Días
            </button>
            <button
              (click)="setFilterRange('all')"
              [class.bg-indigo-600]="selectedRange() === 'all'"
              [class.text-white]="selectedRange() === 'all'"
              [class.text-slate-400]="selectedRange() !== 'all'"
              class="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer"
            >
              Histórico
            </button>
            <button
              (click)="setFilterRange('custom')"
              [class.bg-indigo-600]="selectedRange() === 'custom'"
              [class.text-white]="selectedRange() === 'custom'"
              [class.text-slate-400]="selectedRange() !== 'custom'"
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer"
            >
              <svg lucideCalendar class="w-3.5 h-3.5"></svg>
              <span>Rango</span>
            </button>
          </div>

          <!-- Custom Date Range Picker Container -->
          @if (selectedRange() === 'custom') {
            <div class="flex items-center gap-2 p-1.5 bg-slate-900 border border-indigo-500/30 rounded-xl animate-fadeIn">
              <div class="flex items-center gap-1.5">
                <span class="text-[11px] uppercase font-bold text-slate-400 pl-1">Desde:</span>
                <input aria-label="Desde"
                  type="date"
                  [value]="customStartDate()"
                  (change)="onStartDateChange($event)"
                  class="bg-slate-950/80 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-white outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
              <div class="flex items-center gap-1.5">
                <span class="text-[11px] uppercase font-bold text-slate-400">Hasta:</span>
                <input aria-label="Hasta"
                  type="date"
                  [value]="customEndDate()"
                  (change)="onEndDateChange($event)"
                  class="bg-slate-950/80 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-white outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
              <button
                (click)="applyCustomRange()"
                class="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-md transition-all cursor-pointer"
              >
                Aplicar
              </button>
            </div>
          }

          <!-- Refresh Button -->
          <button
            (click)="loadAnalyticsData()"
            [disabled]="isLoading()"
            class="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer disabled:opacity-50"
            title="Actualizar métricas"
          >
            <svg
              lucideRefreshCw
              [class.animate-spin]="isLoading()"
              class="w-4 h-4"
            ></svg>
            <span class="hidden sm:inline">Actualizar</span>
          </button>
        </div>
      </div>

      <!-- Top KPI Cards Grid (4 Widget Style Cards) -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <!-- Card 1: Ventas del Periodo -->
        <div class="p-5 bg-slate-900/90 border border-slate-700/50 hover:border-slate-600/60 rounded-2xl shadow-xl backdrop-blur-md transition-all duration-300 group hover:-translate-y-0.5">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-slate-400 uppercase tracking-wider">Ventas del Periodo</span>
            <div class="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 group-hover:scale-110 transition-transform">
              <svg lucideDollarSign class="w-4 h-4"></svg>
            </div>
          </div>
          <div class="mt-3 flex items-baseline justify-between">
            <span class="text-2xl lg:text-3xl font-extrabold text-white tracking-tight tabular-nums">
              {{ summaryMetrics().totalSalesToday | pesos }}
            </span>
          </div>
          <div class="mt-3 flex items-center gap-2">
            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border tabular-nums" [class]="tendencia(summaryMetrics().salesGrowthPercentage).clase">{{ tendencia(summaryMetrics().salesGrowthPercentage).texto }}</span>
            <span class="text-xs text-slate-400">vs. periodo anterior</span>
          </div>
        </div>

        <!-- Card 2: Mesas Atendidas -->
        <div class="p-5 bg-slate-900/90 border border-slate-700/50 hover:border-slate-600/60 rounded-2xl shadow-xl backdrop-blur-md transition-all duration-300 group hover:-translate-y-0.5">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-slate-400 uppercase tracking-wider">Mesas Atendidas</span>
            <div class="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 group-hover:scale-110 transition-transform">
              <svg lucideUsers class="w-4 h-4"></svg>
            </div>
          </div>
          <div class="mt-3 flex items-baseline justify-between">
            <span class="text-2xl lg:text-3xl font-extrabold text-white tracking-tight tabular-nums">
              {{ summaryMetrics().tablesServedToday }} <span class="text-sm font-normal text-slate-400">mesas</span>
            </span>
          </div>
          <div class="mt-3 flex items-center gap-2">
            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border tabular-nums" [class]="tendencia(summaryMetrics().tablesGrowthPercentage).clase">{{ tendencia(summaryMetrics().tablesGrowthPercentage).texto }}</span>
            <span class="text-xs text-slate-400">vs. periodo anterior</span>
          </div>
        </div>

        <!-- Card 3: Ticket Promedio -->
        <div class="p-5 bg-slate-900/90 border border-slate-700/50 hover:border-slate-600/60 rounded-2xl shadow-xl backdrop-blur-md transition-all duration-300 group hover:-translate-y-0.5">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-slate-400 uppercase tracking-wider">Ticket Promedio</span>
            <div class="p-2 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400 group-hover:scale-110 transition-transform">
              <svg lucideTrendingUp class="w-4 h-4"></svg>
            </div>
          </div>
          <div class="mt-3 flex items-baseline justify-between">
            <span class="text-2xl lg:text-3xl font-extrabold text-white tracking-tight tabular-nums">
              {{ summaryMetrics().averageTicket | pesos }}
            </span>
          </div>
          <div class="mt-3 flex items-center gap-2">
            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border tabular-nums" [class]="tendencia(summaryMetrics().ticketGrowthPercentage).clase">{{ tendencia(summaryMetrics().ticketGrowthPercentage).texto }}</span>
            <span class="text-xs text-slate-400">vs. periodo anterior</span>
          </div>
        </div>

        <!-- Card 4: Pedidos Totales -->
        <div class="p-5 bg-slate-900/90 border border-slate-700/50 hover:border-slate-600/60 rounded-2xl shadow-xl backdrop-blur-md transition-all duration-300 group hover:-translate-y-0.5">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-slate-400 uppercase tracking-wider">Pedidos Totales</span>
            <div class="p-2 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 group-hover:scale-110 transition-transform">
              <svg lucideShoppingBag class="w-4 h-4"></svg>
            </div>
          </div>
          <div class="mt-3 flex items-baseline justify-between">
            <span class="text-2xl lg:text-3xl font-extrabold text-white tracking-tight tabular-nums">
              {{ summaryMetrics().totalOrdersToday }} <span class="text-sm font-normal text-slate-400">órdenes</span>
            </span>
          </div>
          <div class="mt-3 flex items-center gap-2">
            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border tabular-nums" [class]="tendencia(summaryMetrics().ordersGrowthPercentage).clase">{{ tendencia(summaryMetrics().ordersGrowthPercentage).texto }}</span>
            <span class="text-xs text-slate-400">vs. periodo anterior</span>
          </div>
        </div>
      </div>

      <!-- Main ECharts Area Chart Container -->
      <div class="p-6 bg-slate-900 border border-slate-700/50 rounded-2xl shadow-2xl space-y-6 relative overflow-hidden">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 class="text-lg font-bold text-white tracking-tight">Tendencia de Ingresos</h2>
            <p class="text-xs text-slate-400 mt-1">
              Filtro activo: <span class="text-indigo-400 font-semibold">{{ getFilterLabel() }}</span>
              <span class="text-slate-500 ml-1">
                · {{ nombreSucursalSeleccionada() }}
              </span>
            </p>
          </div>
          <div class="flex items-center gap-4">
            <div class="flex items-center gap-2">
              <span class="w-3 h-3 rounded-full bg-indigo-500"></span>
              <span class="text-xs font-medium text-slate-300">Ingresos Totales (\$)</span>
            </div>
          </div>
        </div>

        <!-- ECharts Render Canvas Container -->
        <div class="w-full relative min-h-[380px]">
          @if (isLoading()) {
            <div class="absolute inset-0 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm z-10 rounded-xl">
              <div class="flex flex-col items-center gap-3 text-indigo-400">
                <svg lucideRefreshCw class="w-8 h-8 animate-spin"></svg>
                <span class="text-xs font-semibold text-slate-300">Cargando datos de analítica...</span>
              </div>
            </div>
          }

          @if (!isLoading() && sinVentas()) {
            <div class="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 text-center px-6">
              <svg lucideBarChart3 class="w-8 h-8 text-slate-600"></svg>
              <p class="text-sm font-semibold text-slate-200">Sin ventas en este periodo ({{ getFilterLabel().toLowerCase() }})</p>
              <p class="text-xs text-slate-400 max-w-sm">Cuando se cierren cuentas en este periodo, aquí verás cómo van los ingresos día por día.</p>
              @if (selectedRange() !== 'all') {
                <button (click)="setFilterRange('all')" class="mt-1 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white cursor-pointer">Ver todo el histórico</button>
              }
            </div>
          }
          <div
            echarts
            [options]="chartOption()"
            class="w-full h-[380px]"
            [class.opacity-20]="!isLoading() && sinVentas()"
          ></div>
        </div>
      </div>

      <!-- 2-Column Grid for 4 Leaderboards (2x2 Layout) -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <!-- Employee Performance Leaderboard -->
        <div class="p-6 bg-slate-900 border border-slate-700/50 rounded-2xl shadow-2xl space-y-6 flex flex-col">
          <div class="flex items-center justify-between border-b border-slate-800/80 pb-4 shrink-0">
            <div>
              <h2 class="text-lg font-bold text-white tracking-tight">Rendimiento del Personal</h2>
              <p class="text-xs text-slate-400 mt-1">Mejores meseros por volumen de ventas y órdenes despachadas</p>
            </div>
            <div class="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 shrink-0">
              <svg lucideUsers class="w-5 h-5"></svg>
            </div>
          </div>

          @if (employeePerformance().length === 0) {
            <div class="py-8 text-center text-xs text-slate-400 italic border border-dashed border-slate-800 rounded-xl flex-1 flex items-center justify-center">
              No hay datos de rendimiento registrados para este periodo.
            </div>
          } @else {
            <div class="flex flex-col gap-4 max-h-[360px] overflow-y-auto pr-2">
              @for (emp of employeePerformance(); track emp.employeeId; let idx = $index) {
                <div class="flex items-center justify-between p-4 bg-slate-950/50 border border-slate-800 rounded-xl hover:border-indigo-500/30 transition-colors">
                  <div class="flex items-center gap-3 min-w-0">
                    <div 
                      class="w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs shrink-0 border"
                      [class.bg-amber-500/20]="idx === 0" [class.text-amber-400]="idx === 0" [class.border-amber-500/30]="idx === 0"
                      [class.bg-slate-800]="idx !== 0" [class.text-slate-300]="idx !== 0" [class.border-slate-700]="idx !== 0"
                    >
                      {{ idx === 0 ? '🏆 1' : emp.employeeName.charAt(0).toUpperCase() }}
                    </div>
                    <div class="min-w-0">
                      <p class="text-sm font-bold text-white truncate">{{ emp.employeeName }}</p>
                      <p class="text-[11px] text-slate-400 mt-0.5">{{ emp.totalOrders }} órdenes <span class="opacity-50">•</span> <span class="text-indigo-400 font-semibold">{{ emp.branchName }}</span></p>
                    </div>
                  </div>
                  <div class="text-right shrink-0 pl-2">
                    <p class="text-sm font-black text-emerald-400">{{ emp.totalRevenue | pesos }}</p>
                  </div>
                </div>
              }
            </div>
          }
        </div>

        <!-- Table Performance Leaderboard -->
        <div class="p-6 bg-slate-900 border border-slate-700/50 rounded-2xl shadow-2xl space-y-6 flex flex-col">
          <div class="flex items-center justify-between border-b border-slate-800/80 pb-4 shrink-0">
            <div>
              <h2 class="text-lg font-bold text-white tracking-tight">Rendimiento por Mesa</h2>
              <p class="text-xs text-slate-400 mt-1">Mesas que generan mayor volumen de ventas</p>
            </div>
            <div class="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shrink-0">
              <svg lucideBarChart3 class="w-5 h-5"></svg> 
            </div>
          </div>

          @if (tablePerformance().length === 0) {
            <div class="py-8 text-center text-xs text-slate-400 italic border border-dashed border-slate-800 rounded-xl flex-1 flex items-center justify-center">
              No hay datos de mesas para este periodo.
            </div>
          } @else {
            <div class="flex flex-col gap-4 max-h-[360px] overflow-y-auto pr-2">
              @for (table of tablePerformance(); track table.tableNumber; let idx = $index) {
                <div class="flex items-center justify-between p-4 bg-slate-950/50 border border-slate-800 rounded-xl hover:border-emerald-500/30 transition-colors">
                  <div class="flex items-center gap-3 min-w-0">
                    <div 
                      class="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 border"
                      [class.bg-emerald-500/20]="idx === 0" [class.text-emerald-400]="idx === 0" [class.border-emerald-500/30]="idx === 0"
                      [class.bg-slate-800]="idx !== 0" [class.text-slate-300]="idx !== 0" [class.border-slate-700]="idx !== 0"
                    >
                      #{{ table.tableNumber }}
                    </div>
                    <div class="min-w-0">
                      <p class="text-sm font-bold text-white truncate">Mesa {{ table.tableNumber }}</p>
                      <p class="text-[11px] text-slate-400 mt-0.5">{{ table.totalOrders }} tickets <span class="opacity-50">•</span> <span class="text-emerald-400 font-semibold">{{ table.branchName }}</span></p>
                    </div>
                  </div>
                  <div class="text-right shrink-0 pl-2">
                    <p class="text-sm font-black text-emerald-400">{{ table.totalRevenue | pesos }}</p>
                  </div>
                </div>
              }
            </div>
          }
        </div>

        <!-- Top Selling Products Leaderboard -->
        <div class="p-6 bg-slate-900 border border-slate-700/50 rounded-2xl shadow-2xl space-y-6 flex flex-col">
          <div class="flex items-center justify-between border-b border-slate-800/80 pb-4 shrink-0">
            <div>
              <h2 class="text-lg font-bold text-white tracking-tight">Productos Estrella</h2>
              <p class="text-xs text-slate-400 mt-1">Platillos más vendidos y rentables</p>
            </div>
            <div class="p-2 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 shrink-0">
              <svg lucideShoppingBag class="w-5 h-5"></svg> 
            </div>
          </div>

          @if (productPerformance().length === 0) {
            <div class="py-8 text-center text-xs text-slate-400 italic border border-dashed border-slate-800 rounded-xl flex-1 flex items-center justify-center">
              No hay datos de productos para este periodo.
            </div>
          } @else {
            <div class="flex flex-col gap-4 max-h-[360px] overflow-y-auto pr-2">
              @for (prod of productPerformance(); track prod.productId; let idx = $index) {
                <div class="flex items-center justify-between p-4 bg-slate-950/50 border border-slate-800 rounded-xl hover:border-sky-500/30 transition-colors">
                  <div class="flex items-center gap-3 min-w-0">
                    <div 
                      class="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 border"
                      [class.bg-sky-500/20]="idx === 0" [class.text-sky-400]="idx === 0" [class.border-sky-500/30]="idx === 0"
                      [class.bg-slate-800]="idx !== 0" [class.text-slate-300]="idx !== 0" [class.border-slate-700]="idx !== 0"
                    >
                      #{{ idx + 1 }}
                    </div>
                    <div class="min-w-0">
                      <p class="text-sm font-bold text-white truncate" [title]="prod.productName">{{ prod.productName }}</p>
                      <p class="text-[11px] text-slate-400 mt-0.5">{{ prod.quantitySold }} unidades <span class="opacity-50">•</span> <span class="text-sky-400 font-semibold">{{ prod.branchName }}</span></p>
                    </div>
                  </div>
                  <div class="text-right shrink-0 pl-2">
                    <p class="text-sm font-black text-sky-400">{{ prod.totalRevenue | pesos }}</p>
                  </div>
                </div>
              }
            </div>
          }
        </div>

        <!-- Table Turnaround Time Leaderboard -->
        <div class="p-6 bg-slate-900 border border-slate-700/50 rounded-2xl shadow-2xl space-y-6 flex flex-col">
          <div class="flex items-center justify-between border-b border-slate-800/80 pb-4 shrink-0">
            <div>
              <h2 class="text-lg font-bold text-white tracking-tight">Tiempo de Ocupación</h2>
              <p class="text-xs text-slate-400 mt-1">Promedio en minutos desde la apertura al cobro</p>
            </div>
            <div class="p-2 rounded-xl bg-fuchsia-500/10 border border-fuchsia-500/20 text-fuchsia-400 shrink-0">
              <svg lucideClock class="w-5 h-5"></svg> 
            </div>
          </div>

          @if (tableTurnaround().length === 0) {
            <div class="py-8 text-center text-xs text-slate-400 italic border border-dashed border-slate-800 rounded-xl flex-1 flex items-center justify-center">
              No hay datos de tiempo para este periodo.
            </div>
          } @else {
            <div class="flex flex-col gap-4 max-h-[360px] overflow-y-auto pr-2">
              @for (table of tableTurnaround(); track table.tableNumber; let idx = $index) {
                <div class="flex items-center justify-between p-4 bg-slate-950/50 border border-slate-800 rounded-xl hover:border-fuchsia-500/30 transition-colors">
                  <div class="flex items-center gap-3 min-w-0">
                    <div 
                      class="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 border"
                      [class.bg-fuchsia-500/20]="idx === 0" [class.text-fuchsia-400]="idx === 0" [class.border-fuchsia-500/30]="idx === 0"
                      [class.bg-slate-800]="idx !== 0" [class.text-slate-300]="idx !== 0" [class.border-slate-700]="idx !== 0"
                    >
                      #{{ table.tableNumber }}
                    </div>
                    <div class="min-w-0">
                      <p class="text-sm font-bold text-white truncate">Mesa {{ table.tableNumber }}</p>
                      <p class="text-[11px] text-slate-400 mt-0.5">{{ table.totalOrders }} tickets <span class="opacity-50">•</span> <span class="text-fuchsia-400 font-semibold">{{ table.branchName }}</span></p>
                    </div>
                  </div>
                  <div class="text-right shrink-0 pl-2">
                    <p class="text-sm font-black text-fuchsia-400">{{ table.averageMinutes }} min</p>
                  </div>
                </div>
              }
            </div>
          }
        </div>
      </div>

      <!-- Fila Inferior: Mapa de Calor (2/3) + KDS Efficiency (1/3) -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        <!-- Peak Hours Heatmap Chart -->
        <div class="lg:col-span-2 p-6 bg-slate-900 border border-slate-700/50 rounded-2xl shadow-2xl space-y-4">
          <div class="flex items-center justify-between">
            <div>
              <h2 class="text-lg font-bold text-white tracking-tight">Mapa de Calor: Horas Pico</h2>
              <p class="text-xs text-slate-400 mt-1">Intensidad de atención y creación de órdenes por hora del día</p>
            </div>
            <div class="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
              <svg lucideFlame class="w-5 h-5"></svg>
            </div>
          </div>
          <div class="w-full relative min-h-[220px]">
            @if (isLoading()) {
              <div class="absolute inset-0 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm z-10 rounded-xl">
                <svg lucideLoader2 class="w-6 h-6 animate-spin text-rose-400"></svg>
              </div>
            }
            <div echarts [options]="peakHoursChartOption()" class="w-full h-[220px]"></div>
          </div>
        </div>

        <!-- KDS Efficiency Leaderboard -->
        <div class="lg:col-span-1 p-6 bg-slate-900 border border-slate-700/50 rounded-2xl shadow-2xl flex flex-col">
          <div class="flex items-center justify-between border-b border-slate-800/80 pb-4 shrink-0">
            <div>
              <h2 class="text-lg font-bold text-white tracking-tight">Tiempos de Cocina</h2>
              <p class="text-xs text-slate-400 mt-1">Platillos que más tardan en prepararse</p>
            </div>
            <div class="p-2 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-400 shrink-0">
              <svg lucideChefHat class="w-5 h-5"></svg> 
            </div>
          </div>

          @if (kdsEfficiency().length === 0) {
            <div class="py-8 text-center text-xs text-slate-400 italic border border-dashed border-slate-800 rounded-xl flex-1 flex items-center justify-center mt-6">
              Esperando datos de preparación...
            </div>
          } @else {
            <div class="flex flex-col gap-4 flex-1 content-start mt-6 max-h-[260px] overflow-y-auto pr-2">
              @for (item of kdsEfficiency(); track item.productName; let idx = $index) {
                <div class="flex items-center justify-between p-4 bg-slate-950/50 border border-slate-800 rounded-xl hover:border-orange-500/30 transition-colors">
                  <div class="flex items-center gap-3 min-w-0">
                    <div 
                      class="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 border"
                      [class.bg-orange-500/20]="idx === 0" [class.text-orange-400]="idx === 0" [class.border-orange-500/30]="idx === 0"
                      [class.bg-slate-800]="idx !== 0" [class.text-slate-300]="idx !== 0" [class.border-slate-700]="idx !== 0"
                    >
                      #{{ idx + 1 }}
                    </div>
                    <div class="min-w-0">
                      <p class="text-sm font-bold text-white truncate" [title]="item.productName">{{ item.productName }}</p>
                      <p class="text-[11px] text-slate-400 mt-0.5">Promedio <span class="opacity-50">•</span> <span class="text-orange-400 font-semibold">{{ item.branchName }}</span></p>
                    </div>
                  </div>
                  <div class="text-right shrink-0 pl-2">
                    <p class="text-sm font-black text-orange-400">{{ item.avgMinutes }} min</p>
                  </div>
                </div>
              }
            </div>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    @keyframes fadeIn {
      from { opacity: 0; transform: scale(0.98); }
      to { opacity: 1; transform: scale(1); }
    }
    .animate-fadeIn {
      animation: fadeIn 0.2s ease-out forwards;
    }
    :host {
      display: block;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnalyticsDashboardComponent implements OnInit {
  private readonly avisos = inject(AvisosService);
  private readonly analyticsService = inject(AnalyticsService);
  private readonly authService = inject(AuthService);
  private readonly http = inject(HttpClient);

  // Writable Signals for State & Filters
  readonly salesData = signal<DailySaleData[]>([]);
  readonly employeePerformance = signal<EmployeePerformance[]>([]);
  readonly tablePerformance = signal<TablePerformance[]>([]);
  readonly productPerformance = signal<ProductPerformance[]>([]);
  readonly tableTurnaround = signal<TurnaroundTime[]>([]);
  readonly peakHoursData = signal<PeakHour[]>([]);
  readonly kdsEfficiency = signal<KdsEfficiency[]>([]);
  readonly isLoading = signal<boolean>(true);
  readonly selectedRange = signal<FilterRange>('7d');
  
  // Custom Date Range inputs signals
  readonly customStartDate = signal<string>('');
  readonly customEndDate = signal<string>('');

  // Context Dropdowns State Signals
  // Restaurante y sucursal: los de la barra superior. Aquí solo se elige si el
  // reporte es de esa sucursal o de todas las del restaurante.
  private readonly sucursalActiva = inject(SucursalActivaService);
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

  readonly isSuperAdmin = computed(() => this.authService.userRole() === 'SUPER_ADMIN');

  readonly availableBranches = computed<Branch[]>(() => {
    const rId = this.selectedRestaurantId();
    if (!rId) return [];
    const matched = this.restaurants().find((r) => r.id === rId);
    return matched?.branches || [];
  });

  readonly summaryMetrics = signal({
    totalSalesToday: 0,
    salesGrowthPercentage: 0,
    tablesServedToday: 0,
    tablesGrowthPercentage: 0,
    averageTicket: 0,
    ticketGrowthPercentage: 0,
    totalOrdersToday: 0,
    ordersGrowthPercentage: 0,
  });

  ngOnInit(): void {
    // Set default custom dates (last 30 days)
    const today = new Date();
    const past = new Date();
    past.setDate(today.getDate() - 30);
    this.customEndDate.set(today.toISOString().split('T')[0]);
    this.customStartDate.set(past.toISOString().split('T')[0]);

  }

  /**
   * Triggers dynamic data reload when context (Restaurante / Sucursal) changes
   */
  onContextChange(): void {
    this.loadAnalyticsData();
  }

  setFilterRange(range: FilterRange): void {
    this.selectedRange.set(range);
    if (range !== 'custom') {
      this.loadAnalyticsData();
    }
  }

  onStartDateChange(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.customStartDate.set(val);
  }

  onEndDateChange(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.customEndDate.set(val);
  }

  applyCustomRange(): void {
    if (!this.customStartDate() || !this.customEndDate()) {
      this.avisos.error('Por favor selecciona ambas fechas (Inicio y Fin).');
      return;
    }
    this.loadAnalyticsData();
  }

  getFilterLabel(): string {
    switch (this.selectedRange()) {
      case 'today': return 'Hoy';
      case '7d': return 'Últimos 7 Días';
      case '30d': return 'Últimos 30 Días';
      case 'all': return 'Histórico Completo';
      case 'custom': return 'Rango Personalizado';
      default: return '';
    }
  }

  private toLocalDateString(d: Date): string {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private getDateParams(): { startDate?: string; endDate?: string } {
    const today = new Date();
    const todayStr = this.toLocalDateString(today);

    switch (this.selectedRange()) {
      case 'today':
        return { startDate: todayStr, endDate: todayStr };
      case '7d': {
        const d = new Date(today);
        d.setDate(d.getDate() - 6);
        return { startDate: this.toLocalDateString(d), endDate: todayStr };
      }
      case '30d': {
        const d = new Date(today);
        d.setDate(d.getDate() - 29);
        return { startDate: this.toLocalDateString(d), endDate: todayStr };
      }
      case 'all':
        return {};
      case 'custom':
        return {
          startDate: this.customStartDate() || undefined,
          endDate: this.customEndDate() || undefined
        };
      default:
        return {};
    }
  }

  loadKPIs(branchId?: string, restaurantId?: string): void {
    const { startDate, endDate } = this.getDateParams();
    const bId = branchId !== undefined ? branchId : (this.selectedBranchId() || '');
    const rId = restaurantId !== undefined ? restaurantId : (this.selectedRestaurantId() || '');

    let query = [];
    if (rId) query.push(`restaurantId=${rId}`);
    if (bId) query.push(`branchId=${bId}`);
    if (startDate) query.push(`startDate=${startDate}`);
    if (endDate) query.push(`endDate=${endDate}`);
    const queryString = query.length > 0 ? `?${query.join('&')}` : '';

    this.http.get<any>(`${environment.apiUrl}/analytics/summary${queryString}`).subscribe({
      next: (summary) => {
        if (summary) {
          this.summaryMetrics.set({
            totalSalesToday: summary.totalSalesToday ?? 0,
            salesGrowthPercentage: summary.salesGrowthPercentage ?? 0,
            tablesServedToday: summary.tablesServedToday ?? 0,
            tablesGrowthPercentage: summary.tablesGrowthPercentage ?? 0,
            averageTicket: summary.averageTicket ?? 0,
            ticketGrowthPercentage: summary.ticketGrowthPercentage ?? 0,
            totalOrdersToday: summary.totalOrdersToday ?? 0,
            ordersGrowthPercentage: summary.ordersGrowthPercentage ?? 0,
          });
        }
      },
      error: (err) => console.error('Error al cargar KPIs:', err)
    });
  }

  loadChartData(branchId?: string, restaurantId?: string): void {
    this.isLoading.set(true);
    const { startDate, endDate } = this.getDateParams();
    const bId = branchId !== undefined ? branchId : (this.selectedBranchId() || '');
    const rId = restaurantId !== undefined ? restaurantId : (this.selectedRestaurantId() || '');

    let query = [];
    if (rId) query.push(`restaurantId=${rId}`);
    if (bId) query.push(`branchId=${bId}`);
    if (startDate) query.push(`startDate=${startDate}`);
    if (endDate) query.push(`endDate=${endDate}`);
    const queryString = query.length > 0 ? `?${query.join('&')}` : '';

    this.http.get<DailySaleData[]>(`${environment.apiUrl}/analytics/sales/daily${queryString}`).subscribe({
      next: (data) => {
        let filteredData = (data && Array.isArray(data)) ? data : [];
        if (startDate && endDate && filteredData.length > 0) {
          const match = filteredData.filter((d) => d.date >= startDate && d.date <= endDate);
          if (match.length > 0) {
            filteredData = match;
          }
        }
        this.salesData.set(filteredData);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Error al cargar la gráfica:', err);
        this.salesData.set([]);
        this.isLoading.set(false);
      }
    });

    this.http.get<EmployeePerformance[]>(`${environment.apiUrl}/analytics/employees/performance${queryString}`).subscribe({
      next: (data) => this.employeePerformance.set(data || []),
      error: (err) => console.error('Error al cargar rendimiento:', err)
    });

    this.http.get<TablePerformance[]>(`${environment.apiUrl}/analytics/tables/performance${queryString}`).subscribe({
      next: (data) => this.tablePerformance.set(data || []),
      error: (err) => console.error('Error al cargar rendimiento de mesas:', err)
    });

    this.http.get<ProductPerformance[]>(`${environment.apiUrl}/analytics/products/performance${queryString}`).subscribe({
      next: (data) => this.productPerformance.set(data || []),
      error: (err) => console.error('Error al cargar rendimiento de productos:', err)
    });

    this.http.get<TurnaroundTime[]>(`${environment.apiUrl}/analytics/tables/turnaround${queryString}`).subscribe({
      next: (data) => this.tableTurnaround.set(data || []),
      error: (err) => console.error('Error al cargar tiempos de ocupación:', err)
    });
  }

  /**
   * Main reload method calling real KPI and chart data endpoints
   */
  loadAnalyticsData(): void {
    const restaurantId = this.selectedRestaurantId() || undefined;
    const branchId = this.selectedBranchId() || undefined;

    this.loadKPIs(branchId, restaurantId);
    this.loadChartData(branchId, restaurantId);
    this.loadPeakHours(branchId, restaurantId);
    this.loadKdsEfficiency(branchId, restaurantId);
  }

  loadPeakHours(branchId?: string, restaurantId?: string): void {
    const { startDate, endDate } = this.getDateParams();
    const bId = branchId !== undefined ? branchId : (this.selectedBranchId() || '');
    const rId = restaurantId !== undefined ? restaurantId : (this.selectedRestaurantId() || '');
    let query = [];
    if (rId) query.push(`restaurantId=${rId}`);
    if (bId) query.push(`branchId=${bId}`);
    if (startDate) query.push(`startDate=${startDate}`);
    if (endDate) query.push(`endDate=${endDate}`);
    const queryString = query.length > 0 ? `?${query.join('&')}` : '';

    this.http.get<PeakHour[]>(`${environment.apiUrl}/analytics/peak-hours${queryString}`).subscribe({
      next: (data) => this.peakHoursData.set(data || []),
      error: (err) => console.error('Error al cargar horas pico:', err)
    });
  }

  loadKdsEfficiency(branchId?: string, restaurantId?: string): void {
    const { startDate, endDate } = this.getDateParams();
    const bId = branchId !== undefined ? branchId : (this.selectedBranchId() || '');
    const rId = restaurantId !== undefined ? restaurantId : (this.selectedRestaurantId() || '');
    let query = [];
    if (rId) query.push(`restaurantId=${rId}`);
    if (bId) query.push(`branchId=${bId}`);
    if (startDate) query.push(`startDate=${startDate}`);
    if (endDate) query.push(`endDate=${endDate}`);
    const queryString = query.length > 0 ? `?${query.join('&')}` : '';

    this.http.get<KdsEfficiency[]>(`${environment.apiUrl}/analytics/kitchen/efficiency${queryString}`).subscribe({
      next: (data) => this.kdsEfficiency.set(data || []),
      error: (err) => console.error('Error al cargar eficiencia KDS:', err)
    });
  }

  formatCurrency(value: number): string {
    return formatearPesos(value).replace('$', '');
  }

  /** «↑ 12%» en verde, «↓ 8%» en rojo y «Sin cambio» en gris. */
  tendencia(pct: number | null | undefined): { texto: string; clase: string } {
    const v = Number(pct);
    if (!Number.isFinite(v) || Math.abs(v) < 0.05) {
      return { texto: 'Sin cambio', clase: 'bg-slate-800/60 text-slate-400 border-slate-700' };
    }
    const cifra = Math.abs(v).toLocaleString('es-MX', { maximumFractionDigits: 1 });
    return v > 0
      ? { texto: `↑ ${cifra}%`, clase: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' }
      : { texto: `↓ ${cifra}%`, clase: 'bg-rose-500/10 text-rose-400 border-rose-500/20' };
  }

  /** Ninguna venta en el rango elegido. */
  readonly sinVentas = computed(() => !this.salesData().some((d) => Number(d.revenue) > 0));

  readonly nombreSucursalSeleccionada = computed(() => {
    const id = this.selectedBranchId();
    if (!id) return 'Todas las sucursales';
    return this.availableBranches().find((b) => String(b.id) === String(id))?.name ?? 'Sucursal seleccionada';
  });

  /**
   * Computed signal configuring ECharts Option object with premium dark theme,
   * subtle grid, and indigo-to-transparent gradient area fill.
   */
  readonly chartOption = computed<EChartsOption>(() => {
    const rawData = this.salesData();
    const xAxisDates = rawData.map((d) => {
      if (!d.date) return '';
      const parts = d.date.split('-');
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}`;
      }
      return d.date;
    });
    const yAxisRevenues = rawData.map((d) => d.revenue);

    // Verificamos si el rango actual es 'today'
    const isToday = this.selectedRange() === 'today';

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#0f172a',
        borderColor: '#334155',
        borderWidth: 1,
        textStyle: {
          color: '#f8fafc',
          fontSize: 12,
          fontFamily: 'sans-serif'
        },
        padding: [10, 14],
        formatter: (params: any) => {
          if (!Array.isArray(params) || params.length === 0) return '';
          const p = params[0];
          const val = formatearPesos(Number(p.value));
          return `
            <div class="font-sans">
              <div class="text-[11px] text-slate-400 font-semibold mb-1">Fecha: ${p.name}</div>
              <div class="flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full bg-indigo-500"></span>
                <span class="text-xs text-slate-200">Ventas:</span>
                <span class="text-xs font-bold text-emerald-400">${val}</span>
              </div>
            </div>
          `;
        }
      },
      grid: {
        top: 25,
        left: 20,
        right: 25,
        bottom: 10,
        containLabel: true
      },
      xAxis: {
        type: 'category',
        boundaryGap: isToday, // True para barras, false para línea
        data: xAxisDates,
        axisLine: {
          lineStyle: {
            color: '#334155'
          }
        },
        axisLabel: {
          color: '#94a3b8',
          fontSize: 11,
          fontFamily: 'sans-serif',
          margin: 12
        },
        axisTick: {
          show: false
        }
      },
      yAxis: {
        type: 'value',
        axisLine: {
          show: false
        },
        axisLabel: {
          color: '#94a3b8',
          fontSize: 11,
          fontFamily: 'sans-serif',
          formatter: (val: number) => `\$${val >= 1000 ? (val / 1000).toFixed(1) + 'k' : val}`
        },
        splitLine: {
          show: true,
          lineStyle: {
            color: 'rgba(255, 255, 255, 0.05)',
            type: 'dashed'
          }
        }
      },
      series: [
        {
          name: 'Ingresos',
          type: isToday ? 'bar' : 'line',
          smooth: true,
          symbol: 'circle',
          symbolSize: 6,
          showSymbol: false,
          barMaxWidth: 80, // Evita que la barra sea excesivamente ancha
          itemStyle: isToday ? {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: '#818cf8' },
              { offset: 1, color: '#4f46e5' }
            ]),
            borderRadius: [6, 6, 0, 0] // Bordes superiores redondeados para las barras
          } : {
            color: '#818cf8',
            borderColor: '#6366f1',
            borderWidth: 2
          },
          lineStyle: isToday ? undefined : {
            color: '#6366f1',
            width: 3
          },
          areaStyle: isToday ? undefined : {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(99, 102, 241, 0.45)' },
              { offset: 1, color: 'rgba(99, 102, 241, 0.0)' }
            ])
          },
          data: yAxisRevenues
        }
      ]
    };
  });

  readonly peakHoursChartOption = computed<EChartsOption>(() => {
    const data = this.peakHoursData();
    const hours = Array.from({ length: 24 }, (_, i) => `${i}:00`);
    const ordersByHour = new Array(24).fill(0);
    
    data.forEach(d => {
      if (d.hourOfDay >= 0 && d.hourOfDay < 24) ordersByHour[d.hourOfDay] = d.totalOrders;
    });

    const maxOrders = Math.max(...ordersByHour, 1);

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#0f172a',
        borderColor: '#334155',
        textStyle: { color: '#f8fafc' },
        formatter: (params: any) => {
          if (!Array.isArray(params) || params.length === 0) return '';
          const p = params[0];
          return `
            <div class="font-sans">
              <div class="text-[11px] text-slate-400 font-semibold mb-1">Hora: ${p.name}</div>
              <div class="flex items-center gap-2">
                <span class="text-xs text-slate-200">Órdenes creadas:</span>
                <span class="text-xs font-bold text-rose-400">${p.value}</span>
              </div>
            </div>
          `;
        }
      },
      grid: { top: 10, left: 15, right: 15, bottom: 20, containLabel: true },
      xAxis: {
        type: 'category',
        data: hours,
        axisLabel: { color: '#94a3b8', fontSize: 10 },
        axisLine: { lineStyle: { color: '#334155' } }
      },
      yAxis: { show: false },
      visualMap: {
        orient: 'horizontal',
        left: 'center',
        min: 0,
        max: maxOrders,
        show: false,
        inRange: {
          color: ['#1e293b', '#6366f1', '#d946ef', '#f43f5e']
        }
      },
      series: [{
        type: 'bar',
        data: ordersByHour,
        barMaxWidth: 30,
        itemStyle: { borderRadius: [4, 4, 0, 0] }
      }]
    };
  });
}
