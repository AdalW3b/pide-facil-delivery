import { MarcaService } from '../../core/services/marca.service';
import { TituloPaginaComponent } from '../../shared/components/titulo-pagina.component';
import { SucursalActivaService } from '../../core/services/sucursal-activa.service';
import { sucursalInicial } from '../../shared/utils/sucursal-inicial';
import { PesosPipe } from '../../shared/utils/pesos';
import { Component, ChangeDetectionStrategy, signal, computed, inject, OnInit, effect, untracked } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { environment } from '../../../environments/environment';
import { Restaurant, Branch } from '../admin-core/models/admin.model';
import {
  LucideReceipt,
  LucideCalendar,
  LucideDollarSign,
  LucidePrinter,
  LucideX,
  LucideLoader2,
  LucideSearch,
  LucideRefreshCw,
  LucideCheckCircle,
  LucideXCircle,
  LucideBuilding
} from '@lucide/angular';

export interface OrderHistoryDTO {
  id: string;
  tableNumber?: number;
  table_number?: number;
  status: 'COMPLETED' | 'CLOSED' | 'CANCELLED' | string;
  totalAmount?: number;
  total_amount?: number;
  closedAt?: string;
  closed_at?: string;
  createdAt?: string;
  created_at?: string;
}

export interface BillSummary {
  orderId: string;
  tableNumber: number;
  items: any[];
  totalAmount: number;
  formattedBillText: string;
}

@Component({
  selector: 'app-sales-history',
  standalone: true,
  imports: [TituloPaginaComponent, PesosPipe, 
    CommonModule,
    FormsModule,
    LucideReceipt,
    LucideCalendar,
    LucidePrinter,
    LucideX,
    LucideLoader2,
    LucideSearch,
    LucideRefreshCw,
    LucideCheckCircle,
    LucideXCircle,
    LucideBuilding
  ],
  template: `
    <div class="space-y-6 select-none">
      <!-- Header -->
      <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <app-titulo-pagina titulo="Historial de ventas" descripcion="Cuentas cerradas y canceladas, con su ticket." />
        </div>

        <div class="flex items-center gap-3">
          <button
            (click)="loadHistory()"
            [disabled]="isLoading() || !activeBranchId()"
            class="px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <svg lucideRefreshCw [class.animate-spin]="isLoading()" class="w-4 h-4"></svg>
            <span>Actualizar</span>
          </button>
        </div>
      </div>


      <!-- Stats Overview Cards -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div class="p-4 bg-slate-900/40 border border-slate-800/80 rounded-2xl">
          <p class="text-[11px] font-bold text-slate-450 uppercase tracking-wider">Total Registros</p>
          <p class="text-2xl font-black text-white mt-1">{{ filteredHistory().length }}</p>
        </div>
        <div class="p-4 bg-slate-900/40 border border-slate-800/80 rounded-2xl">
          <p class="text-[11px] font-bold text-slate-450 uppercase tracking-wider">Monto Total Acumulado</p>
          <p class="text-2xl font-black text-emerald-400 mt-1">{{ totalSalesSum() | pesos }}</p>
        </div>
        <div class="p-4 bg-slate-900/40 border border-slate-800/80 rounded-2xl">
          <p class="text-[11px] font-bold text-slate-450 uppercase tracking-wider">Ordenes Canceladas</p>
          <p class="text-2xl font-black text-rose-400 mt-1">{{ cancelledOrdersCount() }}</p>
        </div>
      </div>

      <!-- Search & Filters Bar -->
      <div class="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-slate-900/40 border border-slate-800/80 rounded-2xl backdrop-blur-md">
        <div class="relative w-full sm:w-80">
          <svg lucideSearch class="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"></svg>
          <input aria-label="Buscar orden o mesa"
            type="text"
            placeholder="Buscar por ID de orden o mesa..."
            [ngModel]="searchQuery()"
            (ngModelChange)="searchQuery.set($event)"
            class="w-full pl-10 pr-4 py-2 bg-slate-955 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-500 transition-all"
          />
        </div>

        <div class="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
          <button
            (click)="statusFilter.set('ALL')"
            [class.bg-indigo-600]="statusFilter() === 'ALL'"
            [class.text-white]="statusFilter() === 'ALL'"
            [class.bg-slate-900]="statusFilter() !== 'ALL'"
            [class.text-slate-400]="statusFilter() !== 'ALL'"
            class="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border border-slate-800 cursor-pointer"
          >
            Todas
          </button>
          <button
            (click)="statusFilter.set('COMPLETED')"
            [class.bg-emerald-600]="statusFilter() === 'COMPLETED'"
            [class.text-white]="statusFilter() === 'COMPLETED'"
            [class.bg-slate-900]="statusFilter() !== 'COMPLETED'"
            [class.text-slate-400]="statusFilter() !== 'COMPLETED'"
            class="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border border-slate-800 cursor-pointer"
          >
            Completadas
          </button>
          <button
            (click)="statusFilter.set('CANCELLED')"
            [class.bg-rose-600]="statusFilter() === 'CANCELLED'"
            [class.text-white]="statusFilter() === 'CANCELLED'"
            [class.bg-slate-900]="statusFilter() !== 'CANCELLED'"
            [class.text-slate-400]="statusFilter() !== 'CANCELLED'"
            class="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border border-slate-800 cursor-pointer"
          >
            Canceladas
          </button>
        </div>
      </div>

      <!-- Main History Table Area -->
      @if (isSuperAdmin() && !selectedBranchId()) {
        <!-- Select Branch State for Super Admins -->
        <div class="py-24 border border-dashed border-slate-800 rounded-3xl flex flex-col items-center justify-center text-center gap-4 bg-slate-900/10">
          <div class="w-16 h-16 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <svg lucideBuilding class="w-8 h-8"></svg>
          </div>
          <div>
            <h3 class="font-bold text-white text-lg">Selecciona una sucursal</h3>
            <p class="text-xs text-slate-400 max-w-sm mt-1">Debes seleccionar una sucursal para ver su historial de ventas...</p>
          </div>
        </div>
      } @else if (isLoading()) {
        <!-- Loading State -->
        <div class="flex flex-col items-center justify-center py-20 space-y-3">
          <svg lucideLoader2 class="animate-spin h-8 w-8 text-indigo-500"></svg>
          <span class="text-xs text-slate-400">Cargando historial de ventas...</span>
        </div>
      } @else if (errorMessage()) {
        <!-- Error State -->
        <div class="p-8 rounded-2xl bg-rose-500/5 border border-rose-500/10 text-rose-400 flex flex-col items-center justify-center text-center gap-3">
          <span class="font-bold text-white">Error de Conexión</span>
          <p class="text-xs text-slate-400 max-w-md">{{ errorMessage() }}</p>
          <button
            (click)="loadHistory()"
            class="px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-xl text-xs font-bold transition-all cursor-pointer border border-rose-500/20"
          >
            Reintentar
          </button>
        </div>
      } @else if (filteredHistory().length === 0) {
        <!-- Empty State -->
        <div class="py-20 border border-dashed border-slate-800 rounded-3xl flex flex-col items-center justify-center text-center gap-3 bg-slate-900/10">
          <svg lucideReceipt class="w-10 h-10 text-slate-600"></svg>
          <h3 class="font-bold text-white text-sm">No se encontraron ventas</h3>
          <p class="text-xs text-slate-400 max-w-xs">No hay registros de órdenes cerradas o canceladas que coincidan con los criterios seleccionados.</p>
        </div>
      } @else {
        <!-- History Table -->
        <div class="bg-slate-900/40 border border-slate-800/80 rounded-2xl overflow-hidden backdrop-blur-md shadow-xl">
          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs text-slate-300">
              <thead class="bg-slate-950/70 border-b border-slate-800/80 uppercase text-[11px] font-bold text-slate-450 tracking-wider">
                <tr>
                  <th class="py-3.5 px-5">Fecha y Hora</th>
                  <th class="py-3.5 px-5">ID Orden</th>
                  <th class="py-3.5 px-5">Mesa</th>
                  <th class="py-3.5 px-5">Estado</th>
                  <th class="py-3.5 px-5 text-right">Total</th>
                  <th class="py-3.5 px-5 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-800/60 font-medium">
                @for (order of filteredHistory(); track order.id) {
                  <tr class="hover:bg-slate-800/40 transition-colors">
                    <!-- Fecha y hora de cierre -->
                    <td class="py-3.5 px-5 whitespace-nowrap">
                      <div class="flex items-center gap-2">
                        <svg lucideCalendar class="w-3.5 h-3.5 text-slate-500"></svg>
                        <span>{{ formatDate(order.closedAt || order.closed_at || order.createdAt || order.created_at) }}</span>
                      </div>
                    </td>

                    <!-- ID Orden resumido -->
                    <td class="py-3.5 px-5 font-mono text-indigo-300 font-bold whitespace-nowrap">
                      #{{ order.id.substring(0, 8) }}
                    </td>

                    <!-- Mesa -->
                    <td class="py-3.5 px-5 whitespace-nowrap">
                      <span class="px-2.5 py-1 rounded-lg bg-slate-800/80 text-white font-bold border border-slate-700/60">
                        Mesa {{ order.tableNumber ?? order.table_number ?? '-' }}
                      </span>
                    </td>

                    <!-- Estado -->
                    <td class="py-3.5 px-5 whitespace-nowrap">
                      @if (isCompletedStatus(order.status)) {
                        <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px] font-bold uppercase tracking-wider">
                          <svg lucideCheckCircle class="w-3 h-3"></svg>
                          Completada
                        </span>
                      } @else if (order.status === 'CANCELLED') {
                        <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[11px] font-bold uppercase tracking-wider">
                          <svg lucideXCircle class="w-3 h-3"></svg>
                          Cancelada
                        </span>
                      } @else {
                        <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 text-[11px] font-bold uppercase tracking-wider">
                          {{ order.status }}
                        </span>
                      }
                    </td>

                    <!-- Total -->
                    <td class="py-3.5 px-5 text-right font-black text-white whitespace-nowrap">
                      {{ (order.totalAmount ?? order.total_amount ?? 0) | pesos }}
                    </td>

                    <!-- Botón Ver Ticket -->
                    <td class="py-3.5 px-5 text-center whitespace-nowrap">
                      <button
                        (click)="viewTicket(order.id)"
                        class="px-3 py-1.5 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 hover:text-indigo-300 border border-indigo-500/20 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer flex items-center justify-center gap-1.5 mx-auto"
                      >
                        <svg lucideReceipt class="w-3.5 h-3.5"></svg>
                        <span>Ver Ticket</span>
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      }

      <!-- Modal de Ticket Térmico -->
      @if (isTicketModalOpen()) {
        <div class="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
          <!-- Backdrop -->
          <div
            (click)="closeTicketModal()"
            class="fixed inset-0 bg-slate-955/70 backdrop-blur-sm transition-opacity"
          ></div>

          <!-- Modal Container -->
          <div class="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-6 relative z-10 space-y-5 animate-fadeIn">
            <!-- Modal Header -->
            <div class="flex items-center justify-between border-b border-slate-800/80 pb-4">
              <div class="flex items-center gap-2.5">
                <svg lucideReceipt class="w-5 h-5 text-indigo-400"></svg>
                <h3 class="font-bold text-white text-base">Ticket de Venta</h3>
              </div>
              <button aria-label="Cerrar"
                (click)="closeTicketModal()"
                class="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <svg lucideX class="w-5 h-5"></svg>
              </button>
            </div>

            <!-- Modal Content (Thermal Ticket PRE) -->
            <div class="space-y-3">
              @if (isLoadingTicket()) {
                <div class="py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
                  <svg lucideLoader2 class="animate-spin w-6 h-6 text-indigo-500"></svg>
                  <span class="text-xs">Cargando datos del ticket...</span>
                </div>
              } @else if (ticketText()) {
                <pre class="p-4 bg-slate-955 border border-slate-800 rounded-xl text-xs font-mono text-indigo-300 leading-relaxed overflow-x-auto whitespace-pre-wrap select-text max-h-96 shadow-inner">{{ ticketText() }}</pre>
              } @else {
                <p class="text-xs text-slate-400 text-center py-6">No hay información de ticket disponible para esta orden.</p>
              }
            </div>

            <!-- Modal Footer Actions -->
            <div class="flex items-center justify-end gap-3 pt-4 border-t border-slate-800/80">
              <button
                (click)="closeTicketModal()"
                class="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-all cursor-pointer"
              >
                Cerrar
              </button>
              <button
                (click)="printTicket()"
                [disabled]="!ticketText() || isLoadingTicket()"
                class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg lucidePrinter class="w-4 h-4"></svg>
                <span>Imprimir Ticket</span>
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SalesHistoryComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);

  // State Signals
  readonly ordersHistory = signal<OrderHistoryDTO[]>([]);
  readonly isLoading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly searchQuery = signal('');
  readonly statusFilter = signal<'ALL' | 'COMPLETED' | 'CANCELLED'>('ALL');

  // Ticket Modal Signals
  readonly isTicketModalOpen = signal(false);
  readonly isLoadingTicket = signal(false);
  readonly ticketText = signal<string | null>(null);

  // SUPER_ADMIN dropdown bindings
  // El operador de la plataforma también elige sucursal: entra en modo soporte.
  readonly isSuperAdmin = computed(() => this.authService.userRole() === 'SUPER_ADMIN' || this.authService.userRole() === 'SYSTEM_ADMIN');
  // Restaurante y sucursal: los mismos para todo el panel (se eligen en la barra superior).
  private readonly sucursalActiva = inject(SucursalActivaService);
  private readonly marca = inject(MarcaService);
  readonly restaurants = this.sucursalActiva.restaurantes;
  readonly selectedRestaurantId = this.sucursalActiva.restaurantId;
  readonly selectedBranchId = this.sucursalActiva.branchId;

  /** Al elegir otra sucursal en la barra superior se recarga esta pantalla. */
  private readonly recargarAlCambiarSucursal = effect(() => {
    const b = this.selectedBranchId();
    if (!this.isSuperAdmin()) return;
    untracked(() => b ? this.loadHistory() : this.ordersHistory.set([]));
  });

  readonly availableBranches = computed(() => {
    const rId = this.selectedRestaurantId();
    if (!rId) return [];
    const matched = this.restaurants().find((r) => r.id === rId);
    return matched ? matched.branches : [];
  });

  // Active Branch ID resolved dynamically
  readonly activeBranchId = computed<string | null>(() => {
    if (this.isSuperAdmin()) {
      return this.selectedBranchId() || null;
    }
    const token = this.authService.decodedToken() as any;
    return token?.branchId || token?.branch_id ? String(token.branchId || token.branch_id) : null;
  });

  // Filtered orders list computed signal
  readonly filteredHistory = computed(() => {
    const list = this.ordersHistory();
    const query = this.searchQuery().trim().toLowerCase();
    const status = this.statusFilter();

    return list.filter((order) => {
      // Status filter
      if (status === 'COMPLETED' && !this.isCompletedStatus(order.status)) {
        return false;
      }
      if (status === 'CANCELLED' && order.status !== 'CANCELLED') {
        return false;
      }

      // Query filter
      if (!query) return true;
      const orderIdMatch = order.id.toLowerCase().includes(query);
      const tableNumber = order.tableNumber ?? order.table_number;
      const tableMatch = tableNumber !== undefined && tableNumber !== null && String(tableNumber).includes(query);

      return orderIdMatch || tableMatch;
    });
  });

  readonly totalSalesSum = computed(() => {
    return this.filteredHistory()
      .filter((o) => this.isCompletedStatus(o.status))
      .reduce((sum, o) => sum + (o.totalAmount ?? o.total_amount ?? 0), 0);
  });

  readonly cancelledOrdersCount = computed(() => {
    return this.filteredHistory().filter((o) => o.status === 'CANCELLED').length;
  });

  ngOnInit(): void {
    if (!this.isSuperAdmin()) {
      this.loadHistory();
    }
  }

  loadRestaurants(): void {
    this.http.get<Restaurant[]>(`${environment.apiUrl}/admin/restaurants`).subscribe({
      next: (data) => {
        const sorted = data.sort((a, b) => a.name.localeCompare(b.name));
        this.restaurants.set(sorted);
        this.preseleccionarPrimeraSucursal(sorted);
      },
      error: (err) => {
        console.error('Error fetching restaurants selector', err);
      },
    });
  }

  /**
   * Deja elegido el primer restaurante y su primera sucursal, para no abrir
   * el historial en blanco esperando una selección.
   */
  private preseleccionarPrimeraSucursal(lista: Restaurant[]): void {
    if (this.selectedRestaurantId() || lista.length === 0) return;
    const inicial = sucursalInicial(lista, this.authService.userBranchId());
    if (!inicial) return;
    this.selectedRestaurantId.set(inicial.restaurantId);
    this.selectedBranchId.set(inicial.branchId);
    this.loadHistory();
  }

  onRestaurantChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.selectedRestaurantId.set(select.value);
    this.selectedBranchId.set('');
    this.ordersHistory.set([]);
  }

  onBranchChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.selectedBranchId.set(select.value);
    if (select.value) {
      this.loadHistory();
    } else {
      this.ordersHistory.set([]);
    }
  }

  isCompletedStatus(status: string): boolean {
    return status === 'COMPLETED' || status === 'CLOSED';
  }

  formatDate(dateStr?: string): string {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleString('es-MX', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  }

  /**
   * Loads sales order history for active branch
   */
  loadHistory(): void {
    const branchId = this.activeBranchId();
    if (!branchId) {
      this.ordersHistory.set([]);
      this.isLoading.set(false);
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    // Pedimos la página 0 con un tamaño de 100 como base para la vista (puedes ajustar el size después)
    this.http.get<any>(`${environment.apiUrl}/branches/${branchId}/orders/history?page=0&size=100`).subscribe({
      next: (response) => {
        // Spring Boot 'Page' devuelve el array dentro de 'content'
        const data = response.content || []; 
        
        // Ordenamos del más reciente al más antiguo
        const sorted = data.sort((a: any, b: any) => {
          const dateA = new Date(a.closedAt || a.closed_at || a.createdAt || a.created_at || 0).getTime();
          const dateB = new Date(b.closedAt || b.closed_at || b.createdAt || b.created_at || 0).getTime();
          return dateB - dateA;
        });
        
        this.ordersHistory.set(sorted);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.isLoading.set(false);
        console.error('Error fetching sales history', err);
        if (err.status === 0) {
          this.errorMessage.set('No se pudo conectar con el servidor.');
        } else {
          this.errorMessage.set(err.error?.message || 'Error al obtener el historial de ventas.');
        }
      },
    });
  }

  /**
   * Loads formatted bill text and opens ticket modal
   */
  viewTicket(orderId: string): void {
    this.isTicketModalOpen.set(true);
    this.isLoadingTicket.set(true);
    this.ticketText.set(null);

    // /webhooks/** es solo para el bot (exige X-Bot-Token): desde el panel daba 403.
    const branchId = this.activeBranchId();
    if (!branchId) {
      this.isLoadingTicket.set(false);
      return;
    }

    this.http.get<BillSummary>(`${environment.apiUrl}/branches/${branchId}/orders/${orderId}/bill`).subscribe({
      next: (data) => {
        this.ticketText.set(data.formattedBillText);
        this.isLoadingTicket.set(false);
      },
      error: (err) => {
        this.isLoadingTicket.set(false);
        console.error('Error fetching order bill text', err);
      },
    });
  }

  closeTicketModal(): void {
    this.isTicketModalOpen.set(false);
    this.ticketText.set(null);
  }

  /**
   * Generates a hidden printing iframe to trigger browser print dialog
   */
  printTicket(): void {
    const text = this.ticketText();
    if (!text) return;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.width = '0px';
    iframe.style.height = '0px';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Ticket ${this.marca.marca()?.nombre ?? 'Pide Facil'}</title>
            <style>
              body {
                font-family: 'Courier New', Courier, monospace;
                font-size: 11px;
                line-height: 1.3;
                white-space: pre-wrap;
                margin: 0;
                padding: 10px;
                color: #000;
              }
              @media print {
                @page { margin: 0; size: auto; }
                body { margin: 0; padding: 5px; }
              }
            </style>
          </head>
          <body>${text}</body>
        </html>
      `);
      doc.close();

      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
        }, 1000);
      }, 250);
    }
  }
}
