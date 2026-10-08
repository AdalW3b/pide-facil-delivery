import { AgotadosCocinaComponent } from './agotados-cocina.component';
import { SonidosService } from '../../core/services/sonidos.service';
import { TituloPaginaComponent } from '../../shared/components/titulo-pagina.component';
import { AvisosService } from '../../core/services/avisos.service';
import { SucursalActivaService } from '../../core/services/sucursal-activa.service';
import { Component, ChangeDetectionStrategy, signal, computed, inject, OnInit, OnDestroy, effect, untracked } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { timer, Subscription } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { WebSocketService } from '../../core/services/websocket.service';
import { EstadoEnVivoComponent } from '../../shared/components/estado-en-vivo.component';
import { environment } from '../../../environments/environment';
import { Restaurant, Branch } from '../admin-core/models/admin.model';
import {
  LucideChefHat,
  LucideTriangleAlert,
  LucideClock,
  LucideCheckCircle,
  LucideVolume2,
  LucideVolumeX,
  LucideBuilding,
  LucideX
} from '@lucide/angular';

export type KitchenItemStatus = 'PENDING' | 'PREPARING' | 'READY' | 'DELIVERED';

export interface KitchenTicketItemDTO {
  itemId: string;
  productName: string;
  quantity: number;
  specialInstructions: string | null;
  kitchenStatus: KitchenItemStatus;
  /** "Tortilla: Harina", "Extras: Carne extra, Queso". Vacía si no lleva. */
  adicionales?: string[];
}

export interface KitchenTicketDTO {
  orderId: string;
  tableNumber: number;
  createdAt: string; // ISO LocalDateTime string
  items: KitchenTicketItemDTO[];
}

@Component({
  selector: 'app-kitchen',
  standalone: true,
  imports: [AgotadosCocinaComponent, TituloPaginaComponent, EstadoEnVivoComponent, 
    LucideChefHat,
    LucideTriangleAlert,
    LucideClock,
    LucideCheckCircle,
    LucideVolume2,
    LucideVolumeX,
    LucideBuilding,
    LucideX
  ],
  template: `
    <div class="space-y-8 select-none min-h-screen bg-slate-950 text-slate-100 p-2 sm:p-4">
      <app-estado-en-vivo [branchId]="activeBranchId()" />
      @if (sonidoQuerido() && audioBlocked()) {
        <button
          (click)="enableAudio()"
          class="sticky top-0 z-20 w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-bold shadow-lg cursor-pointer"
        >
          <svg lucideVolumeX class="w-5 h-5 shrink-0"></svg>
          <span>El navegador bloqueó el sonido. Toca aquí para oír las comandas nuevas.</span>
        </button>
      }
      <!-- Top Navbar / Header -->
      <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800/60 pb-6">
        <div>
          <app-titulo-pagina titulo="Cocina" descripcion="Comandas por preparar, en orden de llegada." />
        </div>

        <div class="flex flex-wrap items-center gap-3">
          <!-- Se acabó un platillo: deja de ofrecerse hoy -->
          <app-agotados-cocina [branchId]="activeBranchId()" />

          <!-- Sonido de comandas nuevas: se recuerda en este equipo -->
          @if (sonidoQuerido()) {
            <button
              (click)="silenciar()"
              class="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
              title="Silenciar las comandas nuevas"
            >
              <svg lucideVolume2 class="w-4 h-4 text-emerald-400"></svg>
              <span>Sonido encendido</span>
            </button>
          } @else {
            <button
              (click)="enableAudio()"
              class="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 rounded-xl text-xs font-semibold cursor-pointer"
            >
              <svg lucideVolumeX class="w-4 h-4"></svg>
              <span>Sonido apagado · Encender</span>
            </button>
          }

          <!-- WebSocket Status Badge -->
          @if (isWsConnected()) {
            <div class="flex items-center gap-1.5 px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-[11px] font-bold uppercase tracking-wider">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              En Vivo
            </div>
          } @else {
            <div class="flex items-center gap-1.5 px-3 py-2 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-[11px] font-bold uppercase tracking-wider">
              <span class="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
              Reconectando
            </div>
          }
        </div>
      </div>


      <!-- Stats overview banner -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div class="p-4 bg-slate-900/30 border border-slate-800/80 rounded-xl">
          <p class="text-[11px] text-slate-450 uppercase tracking-wider font-bold">Total Comandas</p>
          <p class="text-2xl font-black text-white mt-1">{{ totalTickets() }}</p>
        </div>
        <div class="p-4 bg-slate-900/30 border border-slate-800/80 rounded-xl">
          <p class="text-[11px] text-slate-450 uppercase tracking-wider font-bold">Items Pendientes</p>
          <p class="text-2xl font-black text-indigo-400 mt-1">{{ pendingItemsCount() }}</p>
        </div>
        <div class="p-4 bg-slate-900/30 border border-slate-800/80 rounded-xl">
          <p class="text-[11px] text-slate-450 uppercase tracking-wider font-bold">En Preparación</p>
          <p class="text-2xl font-black text-amber-400 mt-1">{{ preparingItemsCount() }}</p>
        </div>
        <div class="p-4 bg-slate-900/30 border border-slate-800/80 rounded-xl">
          <p class="text-[11px] text-slate-450 uppercase tracking-wider font-bold">Eficiencia (Completados)</p>
          <p class="text-2xl font-black text-emerald-400 mt-1">{{ completedSessionItemsCount() }}</p>
        </div>
      </div>

      <!-- Main Display Area -->
      @if (isSuperAdmin() && !selectedBranchId()) {
        <!-- Select Branch State for Super Admins -->
        <div class="py-24 border border-dashed border-slate-800 rounded-3xl flex flex-col items-center justify-center text-center gap-4 bg-slate-900/10">
          <div class="w-16 h-16 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <svg lucideBuilding class="w-8 h-8"></svg>
          </div>
          <div>
            <h3 class="font-bold text-white text-lg">Selecciona una sucursal</h3>
            <p class="text-xs text-slate-400 max-w-sm mt-1">Debes seleccionar una sucursal para poder visualizar y gestionar las comandas en tiempo real.</p>
          </div>
        </div>
      } @else if (errorMessage()) {
        <!-- Error Alert -->
        <div class="p-8 rounded-3xl bg-rose-500/5 border border-rose-500/10 text-rose-400 flex flex-col items-center justify-center text-center gap-3">
          <svg lucideTriangleAlert class="w-12 h-12 text-rose-500/80"></svg>
          <h3 class="font-bold text-white">Error de Conexión</h3>
          <p class="text-xs text-slate-400 max-w-md">{{ errorMessage() }}</p>
          <button
            (click)="retryLoading()"
            class="px-5 py-2.5 mt-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-450 rounded-xl text-xs font-bold transition-all cursor-pointer border border-rose-500/20"
          >
            Reintentar Conexión
          </button>
        </div>
      } @else if (isLoading()) {
        <!-- Loading skeletons -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 animate-pulse">
          @for (x of [1, 2, 3]; track x) {
            <div class="w-full h-96 bg-slate-900/20 border border-slate-850 rounded-2xl p-5 flex flex-col gap-4">
              <div class="h-8 w-full bg-slate-800 rounded-xl"></div>
              <div class="h-40 w-full bg-slate-800/60 rounded-xl"></div>
              <div class="h-40 w-full bg-slate-800/60 rounded-xl"></div>
            </div>
          }
        </div>
      } @else {
        <!-- Kitchen Kanban Board -->
        @if (tickets().length === 0) {
          <div class="py-24 border border-dashed border-slate-800 rounded-3xl flex flex-col items-center justify-center text-center gap-4 bg-slate-900/10">
            <div class="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <svg lucideChefHat class="w-8 h-8"></svg>
            </div>
            <div>
              <h3 class="font-bold text-white text-lg">¡Todo al día!</h3>
              <p class="text-xs text-slate-400 max-w-sm mt-1">No hay tickets de comida activos pendientes de preparación en este momento.</p>
            </div>
          </div>
        } @else {
          <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
            
            <!-- Column 1: Pendientes -->
            <div class="bg-slate-900/40 border border-slate-800/80 backdrop-blur-md rounded-2xl p-4 space-y-4">
              <div class="flex items-center justify-between px-2 pb-3 border-b border-slate-800/80">
                <div class="flex items-center gap-2">
                  <span class="w-3 h-3 rounded-full bg-indigo-500 shadow-md shadow-indigo-500/50"></span>
                  <h3 class="font-black text-sm uppercase tracking-wider text-white">Pendientes</h3>
                </div>
                <span class="px-2.5 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-xs font-black text-indigo-400">
                  {{ kanbanPending().length }}
                </span>
              </div>

              @if (kanbanPending().length === 0) {
                <div class="py-12 border border-dashed border-slate-800/60 rounded-xl text-center text-slate-600 text-xs font-medium bg-slate-950/20">
                  Sin comandas pendientes
                </div>
              } @else {
                <div class="space-y-4">
                  @for (ticket of kanbanPending(); track ticket.orderId) {
                    <div class="bg-slate-900/80 border border-slate-800 rounded-2xl shadow-xl p-4 flex flex-col justify-between hover:border-slate-700/80 transition-all duration-200">
                      <div>
                        <!-- Card Header -->
                        <div class="flex items-start justify-between gap-2 flex-wrap border-b border-slate-800/60 pb-3.5 mb-4">
                          <div>
                            <span class="text-xl font-black text-white bg-indigo-500/10 border border-indigo-500/20 px-3 py-1.5 rounded-xl whitespace-nowrap">
                              Mesa {{ ticket.tableNumber }}
                            </span>
                            <p class="text-[11px] text-slate-500 font-mono mt-2.5 uppercase tracking-wider">Orden: #{{ ticket.orderId.substring(0, 8) }}</p>
                          </div>
                          <span 
                            [class.bg-emerald-500/10]="getElapsedTimeMinutes(ticket.createdAt) < 10"
                            [class.text-emerald-400]="getElapsedTimeMinutes(ticket.createdAt) < 10"
                            [class.border-emerald-500/20]="getElapsedTimeMinutes(ticket.createdAt) < 10"
                            [class.bg-amber-500/10]="getElapsedTimeMinutes(ticket.createdAt) >= 10 && getElapsedTimeMinutes(ticket.createdAt) < 20"
                            [class.text-amber-400]="getElapsedTimeMinutes(ticket.createdAt) >= 10 && getElapsedTimeMinutes(ticket.createdAt) < 20"
                            [class.border-amber-500/20]="getElapsedTimeMinutes(ticket.createdAt) >= 10 && getElapsedTimeMinutes(ticket.createdAt) < 20"
                            [class.bg-rose-500/10]="getElapsedTimeMinutes(ticket.createdAt) >= 20"
                            [class.text-rose-450]="getElapsedTimeMinutes(ticket.createdAt) >= 20"
                            [class.border-rose-500/20]="getElapsedTimeMinutes(ticket.createdAt) >= 20"
                            class="px-2.5 py-1 rounded-full border text-[11px] font-bold uppercase tracking-wider flex items-center gap-1 shrink-0"
                          >
                            <svg lucideClock class="w-3 h-3"></svg>
                            {{ getElapsedTimeLabel(ticket.createdAt) }}
                          </span>
                        </div>

                        <!-- Card Items List -->
                        <div class="space-y-2">
                          @for (item of getSortedItems(ticket.items); track item.itemId) {
                            <button
                              (click)="toggleItemStatus(item)"
                              [class.bg-slate-950]="item.kitchenStatus === 'PENDING'"
                              [class.text-slate-100]="item.kitchenStatus === 'PENDING'"
                              [class.border-slate-800]="item.kitchenStatus === 'PENDING'"
                              [class.hover:border-amber-500/40]="item.kitchenStatus === 'PENDING'"
                              [class.from-amber-500/10]="item.kitchenStatus === 'PREPARING'"
                              [class.to-orange-500/10]="item.kitchenStatus === 'PREPARING'"
                              [class.text-amber-300]="item.kitchenStatus === 'PREPARING'"
                              [class.border-amber-500/30]="item.kitchenStatus === 'PREPARING'"
                              [class.hover:border-emerald-500/40]="item.kitchenStatus === 'PREPARING'"
                              [class.bg-emerald-950/10]="item.kitchenStatus === 'READY'"
                              [class.text-emerald-500/50]="item.kitchenStatus === 'READY'"
                              [class.border-emerald-500/10]="item.kitchenStatus === 'READY'"
                              [class.line-through]="item.kitchenStatus === 'READY' || item.kitchenStatus === 'DELIVERED'"
                              [class.bg-slate-900/40]="item.kitchenStatus === 'DELIVERED'"
                              [class.text-slate-600]="item.kitchenStatus === 'DELIVERED'"
                              [class.border-slate-800/60]="item.kitchenStatus === 'DELIVERED'"
                              class="w-full text-left p-3 rounded-xl border flex flex-col justify-between hover:scale-[1.01] active:scale-[0.99] transition-all duration-150 cursor-pointer select-none outline-none"
                            >
                              <div class="flex items-start justify-between w-full gap-2 flex-wrap">
                                <span class="font-bold text-sm leading-tight basis-full min-w-0">
                                  <span class="text-indigo-400 font-extrabold mr-1.5">{{ item.quantity }}x</span>
                                  {{ item.productName }}
                                </span>
                                <div class="flex items-center gap-1.5 shrink-0 ml-auto">
                                  @if (item.kitchenStatus === 'PENDING') {
                                    <span class="text-[10px] font-black px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 uppercase tracking-widest shrink-0">Pendiente</span>
                                  } @else if (item.kitchenStatus === 'PREPARING') {
                                    <span class="text-[10px] font-black px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 uppercase tracking-widest flex items-center gap-1 shrink-0">
                                      <span class="w-1 h-1 rounded-full bg-amber-400 animate-pulse"></span>
                                      Preparando
                                    </span>
                                  } @else if (item.kitchenStatus === 'READY') {
                                    <span class="text-[10px] font-black px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 uppercase tracking-widest shrink-0">Listo</span>
                                  } @else {
                                    <span class="text-[10px] font-black px-1.5 py-0.5 rounded bg-slate-800 text-slate-500 uppercase tracking-widest shrink-0">Entregado</span>
                                  }
                                  <button
                                    type="button"
                                    (click)="$event.stopPropagation(); cancelItem(item)"
                                    class="text-slate-500 hover:text-rose-400 p-1 hover:bg-rose-500/20 rounded transition-colors cursor-pointer"
                                    title="Cancelar platillo"
                                  >
                                    <svg lucideX class="w-3.5 h-3.5"></svg>
                                  </button>
                                </div>
                              </div>
                              @if (item.adicionales?.length) {
                                <ul class="mt-2 w-full space-y-0.5 text-left">
                                  @for (a of item.adicionales; track a) {
                                    <li class="text-[11px] font-semibold text-sky-300 bg-sky-500/10 px-2.5 py-1 rounded-md border border-sky-500/20">+ {{ a }}</li>
                                  }
                                </ul>
                              }
                              @if (item.specialInstructions) {
                                <div class="mt-2 text-[11px] text-amber-500/80 bg-amber-500/5 px-2.5 py-1.5 rounded-lg border border-amber-500/10 w-full italic">
                                  💡 {{ item.specialInstructions }}
                                </div>
                              }
                            </button>
                          }
                        </div>
                      </div>

                      <!-- Card Footer Info -->
                      <div class="mt-5 pt-3 border-t border-slate-800/40 flex items-center justify-between text-[11px] text-slate-500 font-medium">
                        <div class="flex items-center gap-1.5">
                          <svg lucideCheckCircle class="w-3.5 h-3.5 text-emerald-500/75"></svg>
                          <span>{{ getCompletedCount(ticket) }} / {{ ticket.items.length }} Listos</span>
                        </div>
                        <span>Ref: {{ ticket.orderId.substring(28) }}</span>
                      </div>
                    </div>
                  }
                </div>
              }
            </div>

            <!-- Column 2: En Preparación -->
            <div class="bg-slate-900/40 border border-slate-800/80 backdrop-blur-md rounded-2xl p-4 space-y-4">
              <div class="flex items-center justify-between px-2 pb-3 border-b border-slate-800/80">
                <div class="flex items-center gap-2">
                  <span class="w-3 h-3 rounded-full bg-amber-400 animate-pulse shadow-md shadow-amber-400/50"></span>
                  <h3 class="font-black text-sm uppercase tracking-wider text-white">En Preparación</h3>
                </div>
                <span class="px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-xs font-black text-amber-400">
                  {{ kanbanPreparing().length }}
                </span>
              </div>

              @if (kanbanPreparing().length === 0) {
                <div class="py-12 border border-dashed border-slate-800/60 rounded-xl text-center text-slate-600 text-xs font-medium bg-slate-950/20">
                  Sin comandas en preparación
                </div>
              } @else {
                <div class="space-y-4">
                  @for (ticket of kanbanPreparing(); track ticket.orderId) {
                    <div class="bg-slate-900/80 border border-amber-500/30 backdrop-blur-md rounded-2xl shadow-xl p-4 flex flex-col justify-between hover:border-amber-500/50 transition-all duration-200">
                      <div>
                        <!-- Card Header -->
                        <div class="flex items-start justify-between gap-2 flex-wrap border-b border-slate-800/60 pb-3.5 mb-4">
                          <div>
                            <span class="text-xl font-black text-white bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-xl whitespace-nowrap">
                              Mesa {{ ticket.tableNumber }}
                            </span>
                            <p class="text-[11px] text-slate-500 font-mono mt-2.5 uppercase tracking-wider">Orden: #{{ ticket.orderId.substring(0, 8) }}</p>
                          </div>
                          <span 
                            [class.bg-emerald-500/10]="getElapsedTimeMinutes(ticket.createdAt) < 10"
                            [class.text-emerald-400]="getElapsedTimeMinutes(ticket.createdAt) < 10"
                            [class.border-emerald-500/20]="getElapsedTimeMinutes(ticket.createdAt) < 10"
                            [class.bg-amber-500/10]="getElapsedTimeMinutes(ticket.createdAt) >= 10 && getElapsedTimeMinutes(ticket.createdAt) < 20"
                            [class.text-amber-400]="getElapsedTimeMinutes(ticket.createdAt) >= 10 && getElapsedTimeMinutes(ticket.createdAt) < 20"
                            [class.border-amber-500/20]="getElapsedTimeMinutes(ticket.createdAt) >= 10 && getElapsedTimeMinutes(ticket.createdAt) < 20"
                            [class.bg-rose-500/10]="getElapsedTimeMinutes(ticket.createdAt) >= 20"
                            [class.text-rose-450]="getElapsedTimeMinutes(ticket.createdAt) >= 20"
                            [class.border-rose-500/20]="getElapsedTimeMinutes(ticket.createdAt) >= 20"
                            class="px-2.5 py-1 rounded-full border text-[11px] font-bold uppercase tracking-wider flex items-center gap-1 shrink-0"
                          >
                            <svg lucideClock class="w-3 h-3"></svg>
                            {{ getElapsedTimeLabel(ticket.createdAt) }}
                          </span>
                        </div>

                        <!-- Card Items List -->
                        <div class="space-y-2">
                          @for (item of getSortedItems(ticket.items); track item.itemId) {
                            <button
                              (click)="toggleItemStatus(item)"
                              [class.bg-slate-950]="item.kitchenStatus === 'PENDING'"
                              [class.text-slate-100]="item.kitchenStatus === 'PENDING'"
                              [class.border-slate-800]="item.kitchenStatus === 'PENDING'"
                              [class.hover:border-amber-500/40]="item.kitchenStatus === 'PENDING'"
                              [class.from-amber-500/10]="item.kitchenStatus === 'PREPARING'"
                              [class.to-orange-500/10]="item.kitchenStatus === 'PREPARING'"
                              [class.text-amber-300]="item.kitchenStatus === 'PREPARING'"
                              [class.border-amber-500/30]="item.kitchenStatus === 'PREPARING'"
                              [class.hover:border-emerald-500/40]="item.kitchenStatus === 'PREPARING'"
                              [class.bg-emerald-950/10]="item.kitchenStatus === 'READY'"
                              [class.text-emerald-500/50]="item.kitchenStatus === 'READY'"
                              [class.border-emerald-500/10]="item.kitchenStatus === 'READY'"
                              [class.line-through]="item.kitchenStatus === 'READY' || item.kitchenStatus === 'DELIVERED'"
                              [class.bg-slate-900/40]="item.kitchenStatus === 'DELIVERED'"
                              [class.text-slate-600]="item.kitchenStatus === 'DELIVERED'"
                              [class.border-slate-800/60]="item.kitchenStatus === 'DELIVERED'"
                              class="w-full text-left p-3 rounded-xl border flex flex-col justify-between hover:scale-[1.01] active:scale-[0.99] transition-all duration-150 cursor-pointer select-none outline-none"
                            >
                              <div class="flex items-start justify-between w-full gap-2 flex-wrap">
                                <span class="font-bold text-sm leading-tight basis-full min-w-0">
                                  <span class="text-indigo-400 font-extrabold mr-1.5">{{ item.quantity }}x</span>
                                  {{ item.productName }}
                                </span>
                                <div class="flex items-center gap-1.5 shrink-0 ml-auto">
                                  @if (item.kitchenStatus === 'PENDING') {
                                    <span class="text-[10px] font-black px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 uppercase tracking-widest shrink-0">Pendiente</span>
                                  } @else if (item.kitchenStatus === 'PREPARING') {
                                    <span class="text-[10px] font-black px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 uppercase tracking-widest flex items-center gap-1 shrink-0">
                                      <span class="w-1 h-1 rounded-full bg-amber-400 animate-pulse"></span>
                                      Preparando
                                    </span>
                                  } @else if (item.kitchenStatus === 'READY') {
                                    <span class="text-[10px] font-black px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 uppercase tracking-widest shrink-0">Listo</span>
                                  } @else {
                                    <span class="text-[10px] font-black px-1.5 py-0.5 rounded bg-slate-800 text-slate-500 uppercase tracking-widest shrink-0">Entregado</span>
                                  }
                                  <button
                                    type="button"
                                    (click)="$event.stopPropagation(); cancelItem(item)"
                                    class="text-slate-500 hover:text-rose-400 p-1 hover:bg-rose-500/20 rounded transition-colors cursor-pointer"
                                    title="Cancelar platillo"
                                  >
                                    <svg lucideX class="w-3.5 h-3.5"></svg>
                                  </button>
                                </div>
                              </div>
                              @if (item.adicionales?.length) {
                                <ul class="mt-2 w-full space-y-0.5 text-left">
                                  @for (a of item.adicionales; track a) {
                                    <li class="text-[11px] font-semibold text-sky-300 bg-sky-500/10 px-2.5 py-1 rounded-md border border-sky-500/20">+ {{ a }}</li>
                                  }
                                </ul>
                              }
                              @if (item.specialInstructions) {
                                <div class="mt-2 text-[11px] text-amber-500/80 bg-amber-500/5 px-2.5 py-1.5 rounded-lg border border-amber-500/10 w-full italic">
                                  💡 {{ item.specialInstructions }}
                                </div>
                              }
                            </button>
                          }
                        </div>
                      </div>

                      <!-- Card Footer Info -->
                      <div class="mt-5 pt-3 border-t border-slate-800/40 flex items-center justify-between text-[11px] text-slate-500 font-medium">
                        <div class="flex items-center gap-1.5">
                          <svg lucideCheckCircle class="w-3.5 h-3.5 text-emerald-500/75"></svg>
                          <span>{{ getCompletedCount(ticket) }} / {{ ticket.items.length }} Listos</span>
                        </div>
                        <span>Ref: {{ ticket.orderId.substring(28) }}</span>
                      </div>
                    </div>
                  }
                </div>
              }
            </div>

            <!-- Column 3: Listos -->
            <div class="bg-slate-900/40 border border-slate-800/80 backdrop-blur-md rounded-2xl p-4 space-y-4">
              <div class="flex items-center justify-between px-2 pb-3 border-b border-slate-800/80">
                <div class="flex items-center gap-2">
                  <span class="w-3 h-3 rounded-full bg-emerald-500 shadow-md shadow-emerald-500/50"></span>
                  <h3 class="font-black text-sm uppercase tracking-wider text-white">Listos</h3>
                </div>
                <span class="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-black text-emerald-400">
                  {{ kanbanReady().length }}
                </span>
              </div>

              @if (kanbanReady().length === 0) {
                <div class="py-12 border border-dashed border-slate-800/60 rounded-xl text-center text-slate-600 text-xs font-medium bg-slate-950/20">
                  Sin comandas listas
                </div>
              } @else {
                <div class="space-y-4">
                  @for (ticket of kanbanReady(); track ticket.orderId) {
                    <div class="bg-slate-900/40 border border-emerald-500/30 backdrop-blur-md rounded-2xl shadow-xl p-4 flex flex-col justify-between opacity-85 hover:opacity-100 hover:border-emerald-500/50 transition-all duration-200">
                      <div>
                        <!-- Card Header -->
                        <div class="flex items-start justify-between gap-2 flex-wrap border-b border-slate-800/60 pb-3.5 mb-4">
                          <div>
                            <span class="text-xl font-black text-white bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-xl whitespace-nowrap">
                              Mesa {{ ticket.tableNumber }}
                            </span>
                            <p class="text-[11px] text-slate-500 font-mono mt-2.5 uppercase tracking-wider">Orden: #{{ ticket.orderId.substring(0, 8) }}</p>
                          </div>
                          <span 
                            [class.bg-emerald-500/10]="getElapsedTimeMinutes(ticket.createdAt) < 10"
                            [class.text-emerald-400]="getElapsedTimeMinutes(ticket.createdAt) < 10"
                            [class.border-emerald-500/20]="getElapsedTimeMinutes(ticket.createdAt) < 10"
                            [class.bg-amber-500/10]="getElapsedTimeMinutes(ticket.createdAt) >= 10 && getElapsedTimeMinutes(ticket.createdAt) < 20"
                            [class.text-amber-400]="getElapsedTimeMinutes(ticket.createdAt) >= 10 && getElapsedTimeMinutes(ticket.createdAt) < 20"
                            [class.border-amber-500/20]="getElapsedTimeMinutes(ticket.createdAt) >= 10 && getElapsedTimeMinutes(ticket.createdAt) < 20"
                            [class.bg-rose-500/10]="getElapsedTimeMinutes(ticket.createdAt) >= 20"
                            [class.text-rose-450]="getElapsedTimeMinutes(ticket.createdAt) >= 20"
                            [class.border-rose-500/20]="getElapsedTimeMinutes(ticket.createdAt) >= 20"
                            class="px-2.5 py-1 rounded-full border text-[11px] font-bold uppercase tracking-wider flex items-center gap-1 shrink-0"
                          >
                            <svg lucideClock class="w-3 h-3"></svg>
                            {{ getElapsedTimeLabel(ticket.createdAt) }}
                          </span>
                        </div>

                        <!-- Card Items List -->
                        <div class="space-y-2">
                          @for (item of getSortedItems(ticket.items); track item.itemId) {
                            <button
                              (click)="toggleItemStatus(item)"
                              [class.bg-slate-950]="item.kitchenStatus === 'PENDING'"
                              [class.text-slate-100]="item.kitchenStatus === 'PENDING'"
                              [class.border-slate-800]="item.kitchenStatus === 'PENDING'"
                              [class.hover:border-amber-500/40]="item.kitchenStatus === 'PENDING'"
                              [class.from-amber-500/10]="item.kitchenStatus === 'PREPARING'"
                              [class.to-orange-500/10]="item.kitchenStatus === 'PREPARING'"
                              [class.text-amber-300]="item.kitchenStatus === 'PREPARING'"
                              [class.border-amber-500/30]="item.kitchenStatus === 'PREPARING'"
                              [class.hover:border-emerald-500/40]="item.kitchenStatus === 'PREPARING'"
                              [class.bg-emerald-950/10]="item.kitchenStatus === 'READY'"
                              [class.text-emerald-500/50]="item.kitchenStatus === 'READY'"
                              [class.border-emerald-500/10]="item.kitchenStatus === 'READY'"
                              [class.line-through]="item.kitchenStatus === 'READY' || item.kitchenStatus === 'DELIVERED'"
                              [class.bg-slate-900/40]="item.kitchenStatus === 'DELIVERED'"
                              [class.text-slate-600]="item.kitchenStatus === 'DELIVERED'"
                              [class.border-slate-800/60]="item.kitchenStatus === 'DELIVERED'"
                              class="w-full text-left p-3 rounded-xl border flex flex-col justify-between hover:scale-[1.01] active:scale-[0.99] transition-all duration-150 cursor-pointer select-none outline-none"
                            >
                              <div class="flex items-start justify-between w-full gap-2 flex-wrap">
                                <span class="font-bold text-sm leading-tight basis-full min-w-0">
                                  <span class="text-indigo-400 font-extrabold mr-1.5">{{ item.quantity }}x</span>
                                  {{ item.productName }}
                                </span>
                                <div class="flex items-center gap-1.5 shrink-0 ml-auto">
                                  @if (item.kitchenStatus === 'PENDING') {
                                    <span class="text-[10px] font-black px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 uppercase tracking-widest shrink-0">Pendiente</span>
                                  } @else if (item.kitchenStatus === 'PREPARING') {
                                    <span class="text-[10px] font-black px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 uppercase tracking-widest flex items-center gap-1 shrink-0">
                                      <span class="w-1 h-1 rounded-full bg-amber-400 animate-pulse"></span>
                                      Preparando
                                    </span>
                                  } @else if (item.kitchenStatus === 'READY') {
                                    <span class="text-[10px] font-black px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 uppercase tracking-widest shrink-0">Listo</span>
                                  } @else {
                                    <span class="text-[10px] font-black px-1.5 py-0.5 rounded bg-slate-800 text-slate-500 uppercase tracking-widest shrink-0">Entregado</span>
                                  }
                                  <button
                                    type="button"
                                    (click)="$event.stopPropagation(); cancelItem(item)"
                                    class="text-slate-500 hover:text-rose-400 p-1 hover:bg-rose-500/20 rounded transition-colors cursor-pointer"
                                    title="Cancelar platillo"
                                  >
                                    <svg lucideX class="w-3.5 h-3.5"></svg>
                                  </button>
                                </div>
                              </div>
                              @if (item.adicionales?.length) {
                                <ul class="mt-2 w-full space-y-0.5 text-left">
                                  @for (a of item.adicionales; track a) {
                                    <li class="text-[11px] font-semibold text-sky-300 bg-sky-500/10 px-2.5 py-1 rounded-md border border-sky-500/20">+ {{ a }}</li>
                                  }
                                </ul>
                              }
                              @if (item.specialInstructions) {
                                <div class="mt-2 text-[11px] text-amber-500/80 bg-amber-500/5 px-2.5 py-1.5 rounded-lg border border-amber-500/10 w-full italic">
                                  💡 {{ item.specialInstructions }}
                                </div>
                              }
                            </button>
                          }
                        </div>
                      </div>

                      <!-- Card Footer Info -->
                      <div class="mt-5 pt-3 border-t border-slate-800/40 flex items-center justify-between text-[11px] text-slate-500 font-medium">
                        <div class="flex items-center gap-1.5">
                          <svg lucideCheckCircle class="w-3.5 h-3.5 text-emerald-500/75"></svg>
                          <span>{{ getCompletedCount(ticket) }} / {{ ticket.items.length }} Listos</span>
                        </div>
                        <span>Ref: {{ ticket.orderId.substring(28) }}</span>
                      </div>
                    </div>
                  }
                </div>
              }
            </div>

            <!-- Column 4: Entregados -->
            <div class="bg-slate-900/40 border border-slate-800/80 backdrop-blur-md rounded-2xl p-4 space-y-4">
              <div class="flex items-center justify-between px-2 pb-3 border-b border-slate-800/80">
                <div class="flex items-center gap-2">
                  <span class="w-3 h-3 rounded-full bg-slate-500 shadow-md shadow-slate-500/40"></span>
                  <h3 class="font-black text-sm uppercase tracking-wider text-white">Entregados</h3>
                </div>
                <span class="px-2.5 py-0.5 rounded-full bg-slate-500/10 border border-slate-500/20 text-xs font-black text-slate-400">
                  {{ kanbanDelivered().length }}
                </span>
              </div>

              @if (kanbanDelivered().length === 0) {
                <div class="py-12 border border-dashed border-slate-800/60 rounded-xl text-center text-slate-600 text-xs font-medium bg-slate-950/20">
                  Sin comandas entregadas
                </div>
              } @else {
                <div class="space-y-4">
                  @for (ticket of kanbanDelivered(); track ticket.orderId) {
                    <div class="bg-slate-900/40 border border-slate-700/40 backdrop-blur-md rounded-2xl shadow-xl p-4 flex flex-col justify-between opacity-60 hover:opacity-100 hover:border-slate-600/60 transition-all duration-200">
                      <div>
                        <!-- Card Header -->
                        <div class="flex items-start justify-between gap-2 flex-wrap border-b border-slate-800/60 pb-3.5 mb-4">
                          <div>
                            <span class="text-xl font-black text-white bg-slate-500/10 border border-slate-500/20 px-3 py-1.5 rounded-xl whitespace-nowrap">
                              Mesa {{ ticket.tableNumber }}
                            </span>
                            <p class="text-[11px] text-slate-500 font-mono mt-2.5 uppercase tracking-wider">Orden: #{{ ticket.orderId.substring(0, 8) }}</p>
                          </div>
                          <span 
                            [class.bg-emerald-500/10]="getElapsedTimeMinutes(ticket.createdAt) < 10"
                            [class.text-emerald-400]="getElapsedTimeMinutes(ticket.createdAt) < 10"
                            [class.border-emerald-500/20]="getElapsedTimeMinutes(ticket.createdAt) < 10"
                            [class.bg-amber-500/10]="getElapsedTimeMinutes(ticket.createdAt) >= 10 && getElapsedTimeMinutes(ticket.createdAt) < 20"
                            [class.text-amber-400]="getElapsedTimeMinutes(ticket.createdAt) >= 10 && getElapsedTimeMinutes(ticket.createdAt) < 20"
                            [class.border-amber-500/20]="getElapsedTimeMinutes(ticket.createdAt) >= 10 && getElapsedTimeMinutes(ticket.createdAt) < 20"
                            [class.bg-rose-500/10]="getElapsedTimeMinutes(ticket.createdAt) >= 20"
                            [class.text-rose-450]="getElapsedTimeMinutes(ticket.createdAt) >= 20"
                            [class.border-rose-500/20]="getElapsedTimeMinutes(ticket.createdAt) >= 20"
                            class="px-2.5 py-1 rounded-full border text-[11px] font-bold uppercase tracking-wider flex items-center gap-1 shrink-0"
                          >
                            <svg lucideClock class="w-3 h-3"></svg>
                            {{ getElapsedTimeLabel(ticket.createdAt) }}
                          </span>
                        </div>

                        <!-- Card Items List -->
                        <div class="space-y-2">
                          @for (item of getSortedItems(ticket.items); track item.itemId) {
                            <button
                              (click)="toggleItemStatus(item)"
                              [class.bg-slate-950]="item.kitchenStatus === 'PENDING'"
                              [class.text-slate-100]="item.kitchenStatus === 'PENDING'"
                              [class.border-slate-800]="item.kitchenStatus === 'PENDING'"
                              [class.hover:border-amber-500/40]="item.kitchenStatus === 'PENDING'"
                              [class.from-amber-500/10]="item.kitchenStatus === 'PREPARING'"
                              [class.to-orange-500/10]="item.kitchenStatus === 'PREPARING'"
                              [class.text-amber-300]="item.kitchenStatus === 'PREPARING'"
                              [class.border-amber-500/30]="item.kitchenStatus === 'PREPARING'"
                              [class.hover:border-emerald-500/40]="item.kitchenStatus === 'PREPARING'"
                              [class.bg-emerald-950/10]="item.kitchenStatus === 'READY'"
                              [class.text-emerald-500/50]="item.kitchenStatus === 'READY'"
                              [class.border-emerald-500/10]="item.kitchenStatus === 'READY'"
                              [class.line-through]="item.kitchenStatus === 'READY' || item.kitchenStatus === 'DELIVERED'"
                              [class.bg-slate-900/40]="item.kitchenStatus === 'DELIVERED'"
                              [class.text-slate-600]="item.kitchenStatus === 'DELIVERED'"
                              [class.border-slate-800/60]="item.kitchenStatus === 'DELIVERED'"
                              class="w-full text-left p-3 rounded-xl border flex flex-col justify-between hover:scale-[1.01] active:scale-[0.99] transition-all duration-150 cursor-pointer select-none outline-none"
                            >
                              <div class="flex items-start justify-between w-full gap-2 flex-wrap">
                                <span class="font-bold text-sm leading-tight basis-full min-w-0">
                                  <span class="text-indigo-400 font-extrabold mr-1.5">{{ item.quantity }}x</span>
                                  {{ item.productName }}
                                </span>
                                <div class="flex items-center gap-1.5 shrink-0 ml-auto">
                                  @if (item.kitchenStatus === 'PENDING') {
                                    <span class="text-[10px] font-black px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 uppercase tracking-widest shrink-0">Pendiente</span>
                                  } @else if (item.kitchenStatus === 'PREPARING') {
                                    <span class="text-[10px] font-black px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 uppercase tracking-widest flex items-center gap-1 shrink-0">
                                      <span class="w-1 h-1 rounded-full bg-amber-400 animate-pulse"></span>
                                      Preparando
                                    </span>
                                  } @else if (item.kitchenStatus === 'READY') {
                                    <span class="text-[10px] font-black px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 uppercase tracking-widest shrink-0">Listo</span>
                                  } @else {
                                    <span class="text-[10px] font-black px-1.5 py-0.5 rounded bg-slate-800 text-slate-500 uppercase tracking-widest shrink-0">Entregado</span>
                                  }
                                  <button
                                    type="button"
                                    (click)="$event.stopPropagation(); cancelItem(item)"
                                    class="text-slate-500 hover:text-rose-400 p-1 hover:bg-rose-500/20 rounded transition-colors cursor-pointer"
                                    title="Cancelar platillo"
                                  >
                                    <svg lucideX class="w-3.5 h-3.5"></svg>
                                  </button>
                                </div>
                              </div>
                              @if (item.adicionales?.length) {
                                <ul class="mt-2 w-full space-y-0.5 text-left">
                                  @for (a of item.adicionales; track a) {
                                    <li class="text-[11px] font-semibold text-sky-300 bg-sky-500/10 px-2.5 py-1 rounded-md border border-sky-500/20">+ {{ a }}</li>
                                  }
                                </ul>
                              }
                              @if (item.specialInstructions) {
                                <div class="mt-2 text-[11px] text-amber-500/80 bg-amber-500/5 px-2.5 py-1.5 rounded-lg border border-amber-500/10 w-full italic">
                                  💡 {{ item.specialInstructions }}
                                </div>
                              }
                            </button>
                          }
                        </div>
                      </div>

                      <!-- Card Footer Info -->
                      <div class="mt-5 pt-3 border-t border-slate-800/40 flex items-center justify-between text-[11px] text-slate-500 font-medium">
                        <div class="flex items-center gap-1.5">
                          <svg lucideCheckCircle class="w-3.5 h-3.5 text-emerald-500/75"></svg>
                          <span>{{ getCompletedCount(ticket) }} / {{ ticket.items.length }} Listos</span>
                        </div>
                        <span>Ref: {{ ticket.orderId.substring(28) }}</span>
                      </div>
                    </div>
                  }
                </div>
              }
            </div>

          </div>
        }
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KitchenComponent implements OnInit, OnDestroy {
  private readonly avisos = inject(AvisosService);
  private readonly sonidos = inject(SonidosService);
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly webSocketService = inject(WebSocketService);

  private timerSubscription: Subscription | null = null;
  private wsSubscription: Subscription | null = null;

  // State Signals
  readonly tickets = signal<KitchenTicketDTO[]>([]);
  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  /** El estado real de la conexión lo lleva el servicio, no esta pantalla. */
  readonly isWsConnected = this.webSocketService.connected;
  /**
   * El navegador solo deja sonar después de que alguien tocó la página. Si se
   * llegó a Cocina desde el menú, ya hubo toque y suena desde el principio; si
   * se recargó, hay que tocar una vez.
   */
  readonly audioBlocked = this.sonidos.bloqueado;
  /** Quien trabaja en este equipo quiere oír las comandas (se recuerda). */
  readonly sonidoQuerido = signal(this.leerPreferenciaSonido());

  readonly currentTime = signal<number>(Date.now());
  readonly completedSessionItemsCount = signal<number>(0);

  // SUPER_ADMIN dropdown bindings
  // Restaurante y sucursal: los mismos para todo el panel (se eligen en la barra superior).
  private readonly sucursalActiva = inject(SucursalActivaService);
  readonly restaurants = this.sucursalActiva.restaurantes;
  readonly selectedRestaurantId = this.sucursalActiva.restaurantId;
  readonly selectedBranchId = this.sucursalActiva.branchId;

  // Active branch ID resolved dynamically based on role/selection
  readonly activeBranchId = computed<string | null>(() => {
    if (this.isSuperAdmin()) {
      return this.selectedBranchId() || null;
    }
    const token = this.authService.decodedToken() as any;
    const tokenBranch = token?.branchId || token?.branch_id || null;
    return tokenBranch ? String(tokenBranch) : null;
  });

  // El operador de la plataforma también elige sucursal: entra en modo soporte.
  readonly isSuperAdmin = computed(() => this.authService.userRole() === 'SUPER_ADMIN' || this.authService.userRole() === 'SYSTEM_ADMIN');

  readonly availableBranches = computed(() => {
    const rId = this.selectedRestaurantId();
    if (!rId) return [];
    const matched = this.restaurants().find((r) => r.id === rId);
    return matched ? matched.branches : [];
  });

  // Stats computed from active branch tickets
  readonly totalTickets = computed(() => this.tickets().length);

  readonly pendingItemsCount = computed(() =>
    this.tickets().reduce(
      (sum, ticket) =>
        sum + ticket.items.filter((i) => i.kitchenStatus === 'PENDING').length,
      0
    )
  );

  readonly preparingItemsCount = computed(() =>
    this.tickets().reduce(
      (sum, ticket) =>
        sum + ticket.items.filter((i) => i.kitchenStatus === 'PREPARING').length,
      0
    )
  );

  readonly readyItemsCount = computed(() =>
    this.tickets().reduce(
      (sum, ticket) =>
        sum + ticket.items.filter((i) => i.kitchenStatus === 'READY').length,
      0
    )
  );

  // Tickets sorted so that oldest command (longest elapsed time) is first, filtering out empty tickets
  readonly sortedTickets = computed(() => {
    return [...this.tickets()]
      .filter((t) => t.items.length > 0)
      .sort((a, b) => {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });
  });

  // Kanban column computed signals
  readonly kanbanPending = computed(() => {
    return this.sortedTickets().filter((t) =>
      t.items.length > 0 && t.items.every((i) => i.kitchenStatus === 'PENDING')
    );
  });

  readonly kanbanPreparing = computed(() => {
    return this.sortedTickets().filter((t) => {
      if (t.items.length === 0) return false;
      const todosPendientes = t.items.every((i) => i.kitchenStatus === 'PENDING');
      const nadaEnCocina = t.items.every((i) => i.kitchenStatus === 'READY' || i.kitchenStatus === 'DELIVERED');
      return !todosPendientes && !nadaEnCocina;
    });
  });

  // Listos: ya no queda nada por cocinar, aunque algún platillo ya se haya entregado.
  readonly kanbanReady = computed(() => {
    return this.sortedTickets().filter((t) => {
      if (t.items.length === 0) return false;
      const nadaEnCocina = t.items.every((i) => i.kitchenStatus === 'READY' || i.kitchenStatus === 'DELIVERED');
      const todosEntregados = t.items.every((i) => i.kitchenStatus === 'DELIVERED');
      return nadaEnCocina && !todosEntregados;
    });
  });

  readonly kanbanDelivered = computed(() => {
    return this.sortedTickets().filter((t) =>
      t.items.length > 0 && t.items.every((i) => i.kitchenStatus === 'DELIVERED')
    );
  });

  constructor() {
    effect(() => {
      const branchId = this.activeBranchId();
      if (branchId) {
        this.loadTickets(branchId);
        this.setupWebSocket(branchId);
      } else {
        this.unsubscribeWebSocket();
        this.tickets.set([]);
        this.isLoading.set(false);
      }
    });


    // Tras una reconexión, o cada 20 s mientras no hay conexión en vivo, se
    // vuelve a pedir todo: lo que pasó durante la caída no llegó por el canal.
    effect(() => {
      if (this.webSocketService.sincronizar() === 0) return;
      const branchId = untracked(this.activeBranchId);
      if (branchId) untracked(() => this.loadTickets(branchId, true));
    });

  }

  ngOnInit(): void {
    // Tick clock every 10 seconds for elapsed time updates
    this.timerSubscription = timer(0, 10000).subscribe(() => {
      this.currentTime.set(Date.now());
    });
  }

  ngOnDestroy(): void {
    this.unsubscribeWebSocket();
    if (this.timerSubscription) {
      this.timerSubscription.unsubscribe();
    }
  }

  retryLoading(): void {
    const branchId = this.activeBranchId();
    if (branchId) {
      this.loadTickets(branchId);
      this.setupWebSocket(branchId);
    }
  }

  /**
   * Sort items inside each ticket so PENDING are first, then PREPARING, and READY items are at the bottom
   */
  getSortedItems(items: KitchenTicketItemDTO[]): KitchenTicketItemDTO[] {
    const order: Record<KitchenItemStatus, number> = { PENDING: 0, PREPARING: 1, READY: 2, DELIVERED: 3 };
    return [...items].sort((a, b) => order[a.kitchenStatus] - order[b.kitchenStatus]);
  }

  getCompletedCount(ticket: KitchenTicketDTO): number {
    return ticket.items.filter((i) => i.kitchenStatus === 'READY').length;
  }

  getElapsedTimeMinutes(createdAtStr: string): number {
    if (!createdAtStr) return 0;
    const created = new Date(createdAtStr);
    const diffMs = this.currentTime() - created.getTime();
    return Math.max(0, Math.floor(diffMs / 60000));
  }

  getElapsedTimeLabel(createdAtStr: string): string {
    const mins = this.getElapsedTimeMinutes(createdAtStr);
    if (mins < 1) {
      return 'Hace instantes';
    } else if (mins < 60) {
      return `Hace ${mins} min`;
    } else {
      const hours = Math.floor(mins / 60);
      const remainingMins = mins % 60;
      return `Hace ${hours}h ${remainingMins}m`;
    }
  }

  /**
   * Loads list of restaurants for SUPER_ADMIN selector
   */
  loadRestaurants(): void {
    this.http.get<Restaurant[]>(`${environment.apiUrl}/admin/restaurants`).subscribe({
      next: (data) => {
        const sorted = data.sort((a, b) => a.name.localeCompare(b.name));
        this.restaurants.set(sorted);
        this.preseleccionarPrimeraSucursal(sorted);
      },
      error: (err) => {
        console.error('Error fetching restaurants in KDS selector', err);
      },
    });
  }

  /**
   * Deja elegido el primer restaurante y su primera sucursal, para no abrir
   * el módulo en blanco esperando que el super admin seleccione.
   * El efecto sobre activeBranchId se encarga de cargar las comandas.
   */
  private preseleccionarPrimeraSucursal(lista: Restaurant[]): void {
    if (this.selectedRestaurantId() || lista.length === 0) return;

    // La sucursal del propio usuario primero: antes se abría la primera de la
    // lista, y quien trabajaba en otra veía una sucursal ajena y no le llegaban
    // sus pedidos ni sus avisos.
    const propia = this.authService.userBranchId();
    const conPropia = propia ? lista.find((r) => r.branches?.some((b) => b.id === propia)) : undefined;
    const restaurante = conPropia ?? lista[0];
    const sucursal = conPropia ? restaurante.branches!.find((b) => b.id === propia)! : restaurante.branches?.[0];
    if (!sucursal) return;
    this.selectedRestaurantId.set(restaurante.id);
    this.selectedBranchId.set(sucursal.id);
  }

  onRestaurantChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.selectedRestaurantId.set(select.value);
    this.selectedBranchId.set('');
    this.tickets.set([]);
  }

  onBranchChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.selectedBranchId.set(select.value);
  }

  /**
   * Initial GET load of active tickets for a branch
   */
  loadTickets(branchId: string, silencioso = false): void {
    if (!silencioso) {
      this.isLoading.set(true);
      this.errorMessage.set(null);
    }

    this.http.get<KitchenTicketDTO[]>(`${environment.apiUrl}/branches/${branchId}/kitchen/tickets`).subscribe({
      next: (data) => {
        // Una recarga silenciosa entra por el mismo camino que un aviso en
        // vivo, así un pedido recuperado tras una caída también hace sonar la campana.
        if (silencioso) {
          this.handleIncomingTickets(data);
        } else {
          this.tickets.set(data);
        }
        this.isLoading.set(false);
      },
      error: (err) => {
        this.isLoading.set(false);
        if (silencioso) return; // Se queda con lo que ya mostraba.
        console.error('Error fetching active kitchen tickets', err);
        if (err.status === 0) {
          this.errorMessage.set('No se pudo conectar con el servidor.');
        } else {
          this.errorMessage.set('Error al cargar comandas de la cocina.');
        }
      },
    });
  }

  /**
   * Avanza el platillo: pendiente -> preparando -> listo -> entregado, y desde
   * entregado regresa a listo, por si se marcó por error.
   */
  toggleItemStatus(item: KitchenTicketItemDTO): void {
    let nextStatus: KitchenItemStatus;

    if (item.kitchenStatus === 'PENDING') {
      nextStatus = 'PREPARING';
    } else if (item.kitchenStatus === 'PREPARING') {
      nextStatus = 'READY';
    } else if (item.kitchenStatus === 'READY') {
      nextStatus = 'DELIVERED';
    } else {
      nextStatus = 'READY';
    }

    const prevStatus = item.kitchenStatus;
    this.updateLocalItemStatus(item.itemId, nextStatus);

    if (nextStatus === 'READY') {
      this.completedSessionItemsCount.update(c => c + 1);
    }

    this.http.patch<void>(`${environment.apiUrl}/branches/${this.activeBranchId()}/kitchen/items/${item.itemId}/status`, null, {
      params: { status: nextStatus }
    }).subscribe({
      error: (err) => {
        console.error('Error updating kitchen item status', err);
        this.updateLocalItemStatus(item.itemId, prevStatus);
        this.avisos.error('Ocurrió un error al actualizar el estado del plato en cocina.');
      }
    });
  }

  /**
   * Cancels an individual kitchen item, removing it locally and notifying backend / client
   */
  async cancelItem(item: KitchenTicketItemDTO): Promise<void> {
    if (!(await this.avisos.confirmar({ titulo: `¿Cancelar ${item.productName}?`, mensaje: 'Desaparece de la comanda y se le avisa al cliente.', confirmar: 'Cancelar platillo', cancelar: 'Volver', peligro: true }))) {
      return;
    }

    this.http.patch<void>(`${environment.apiUrl}/branches/${this.activeBranchId()}/kitchen/items/${item.itemId}/status`, null, {
      params: { status: 'CANCELLED' }
    }).subscribe({
      next: () => {
        this.removeLocalItem(item.itemId);
      },
      error: (err) => {
        console.error('Error cancelling kitchen item', err);
        this.avisos.error(err.error?.message || 'Ocurrió un error al cancelar el platillo.');
      }
    });
  }

  private updateLocalItemStatus(itemId: string, status: KitchenItemStatus): void {
    const list = this.tickets();
    const updated = list.map((t) => {
      const items = t.items.map((i) => {
        if (i.itemId === itemId) {
          return { ...i, kitchenStatus: status };
        }
        return i;
      });
      return { ...t, items };
    });
    this.tickets.set(updated);
  }

  private removeLocalItem(itemId: string): void {
    const list = this.tickets();
    const updated = list.map((t) => {
      const items = t.items.filter((i) => i.itemId !== itemId);
      return { ...t, items };
    });
    this.tickets.set(updated);
  }

  /**
   * Connects to branch WebSocket for kitchen updates
   */
  private setupWebSocket(branchId: string): void {
    this.unsubscribeWebSocket();

    console.log(`Setting up KDS WebSocket subscription for branch: ${branchId}`);
    const topic = `/topic/branches/${branchId}/kitchen`;

    this.wsSubscription = this.webSocketService.subscribe<KitchenTicketDTO[]>(topic).subscribe({
      next: (newTickets) => {
        this.handleIncomingTickets(newTickets);
      },
      error: (err) => {
        console.error('KDS WebSocket subscription error:', err);
      }
    });
  }

  private unsubscribeWebSocket(): void {
    if (this.wsSubscription) {
      console.log('Unsubscribing from branch kitchen WebSocket topic');
      this.wsSubscription.unsubscribe();
      this.wsSubscription = null;
    }
  }

  /**
   * Handles WebSocket payloads, checking for new PENDING items to trigger bell alerts
   */
  private handleIncomingTickets(newTickets: KitchenTicketDTO[]): void {
    // 1. Gather all local PENDING item IDs
    const currentPendingIds = new Set<string>();
    this.tickets().forEach((t) =>
      t.items.forEach((i) => {
        if (i.kitchenStatus === 'PENDING') {
          currentPendingIds.add(i.itemId);
        }
      })
    );

    // 2. Scan incoming tickets for new PENDING items that we don't have
    let hasNewPending = false;
    newTickets.forEach((t) =>
      t.items.forEach((i) => {
        if (i.kitchenStatus === 'PENDING' && !currentPendingIds.has(i.itemId)) {
          hasNewPending = true;
        }
      })
    );

    // 3. Play audio if new items arrived
    if (hasNewPending) {
      console.log('New PENDING items detected! Playing notification sound...');
      this.playNotificationSound();
    }

    // 4. Update local tickets state
    this.tickets.set(newTickets);
  }

  /**
   * Unblocks browser audio APIs
   */
  enableAudio(): void {
    this.guardarPreferenciaSonido(true);
    this.sonidos.desbloquear();
    // Una muestra, para confirmar que se oye y a qué volumen.
    this.sonidos.tocar('comanda');
  }

  /**
   * Triggers the bell notification sound
   */
  silenciar(): void {
    this.guardarPreferenciaSonido(false);
  }

  private leerPreferenciaSonido(): boolean {
    try {
      return localStorage.getItem('pidefacil.cocina.sonido') !== 'no';
    } catch {
      return true;
    }
  }

  private guardarPreferenciaSonido(si: boolean): void {
    this.sonidoQuerido.set(si);
    try {
      localStorage.setItem('pidefacil.cocina.sonido', si ? 'si' : 'no');
    } catch {
      /* sin almacenamiento: vale solo esta visita */
    }
  }

  playNotificationSound(): void {
    if (!this.sonidoQuerido()) return;
    this.sonidos.tocar('comanda');
  }
}
