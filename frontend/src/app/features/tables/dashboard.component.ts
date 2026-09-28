import { TituloPaginaComponent } from '../../shared/components/titulo-pagina.component';
import { AvisosService } from '../../core/services/avisos.service';
import { SucursalActivaService } from '../../core/services/sucursal-activa.service';
import { Component, ChangeDetectionStrategy, signal, computed, inject, OnInit, OnDestroy, effect, ChangeDetectorRef, untracked } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { Table, TableStatus } from './models/table.model';
import { TableCardComponent } from './components/table-card.component';
import { OrderPanelComponent } from './components/order-panel.component';
import { AuthService } from '../../core/services/auth.service';
import { TableService } from '../../core/services/table.service';
import { WebSocketService } from '../../core/services/websocket.service';
import { Restaurant, Branch } from '../admin-core/models/admin.model';
import { 
  LucideRefreshCw, 
  LucideSearch, 
  LucideX, 
  LucideBuilding, 
  LucideTriangleAlert, 
  LucideFileText, 
  LucidePlus,
  LucideDownload,
  LucidePrinter,
  LucideUsers,
  LucideCheck,
  LucideLoader2
} from '@lucide/angular';
import { QRCodeComponent } from 'angularx-qrcode';
import { EstadoEnVivoComponent } from '../../shared/components/estado-en-vivo.component';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [TituloPaginaComponent, EstadoEnVivoComponent, 
    TableCardComponent,
    OrderPanelComponent,
    QRCodeComponent,
    LucideRefreshCw,
    LucideSearch,
    LucideX,
    LucideBuilding,
    LucideTriangleAlert,
    LucideFileText,
    LucidePlus,
    LucideDownload,
    LucidePrinter,
    LucideUsers,
    LucideCheck,
    LucideLoader2
  ],
  template: `
    <div class="space-y-8 select-none">
      <app-estado-en-vivo [branchId]="activeBranchId()" />
      <!-- Header section -->
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <app-titulo-pagina titulo="Mesas" descripcion="Abre cuentas, toma pedidos y cobra. Todo se actualiza solo." />
        </div>
        
        <div class="flex items-center gap-3">
          <!-- Add Table Button -->
          <button
            (click)="openAddModal()"
            [disabled]="!activeBranchId()"
            class="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-900 disabled:text-slate-500 disabled:border-slate-800/80 disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold shadow-lg shadow-indigo-600/10 hover:shadow-indigo-500/20 border border-indigo-500/30 disabled:shadow-none transition-all duration-200 cursor-pointer"
            title="Agregar nueva mesa"
          >
            <svg 
              lucidePlus
              class="w-4 h-4"
            ></svg>
            <span>Agregar Mesa</span>
          </button>

          <!-- Refresh Button -->
          <button
            (click)="loadTables()"
            [disabled]="isLoading() || (isSuperAdmin() && !selectedBranchId())"
            class="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl text-sm font-semibold transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            title="Actualizar mesas"
          >
            <svg 
              lucideRefreshCw
              [class.animate-spin]="isLoading()"
              class="w-4 h-4"
            ></svg>
            <span>Actualizar</span>
          </button>
        </div>
      </div>


      <!-- Filters & Stats Row -->
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 bg-slate-900/40 border border-slate-800/80 rounded-2xl backdrop-blur-md">
        <!-- Search Input -->
        <div class="relative w-full md:max-w-md">
          <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
            <svg lucideSearch class="w-4 h-4"></svg>
          </div>
          <input aria-label="Buscar mesa"
            type="text"
            placeholder="Buscar mesa por número..."
            (input)="onSearch($event)"
            [disabled]="isSuperAdmin() && !selectedBranchId()"
            class="w-full pl-10 pr-10 py-2.5 bg-slate-950/40 border border-slate-800/80 rounded-xl text-sm text-white placeholder-slate-500 transition-all duration-200 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 disabled:opacity-40 disabled:cursor-not-allowed"
          />
          @if (searchTerm()) {
            <button aria-label="Borrar búsqueda"
              (click)="clearSearch()"
              class="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-white cursor-pointer"
            >
              <svg lucideX class="w-4 h-4"></svg>
            </button>
          }
        </div>

        <!-- Quick Stats summary -->
        <div class="flex items-center gap-6 text-xs font-semibold uppercase tracking-wider text-slate-400">
          <div class="flex items-center gap-2">
            <span class="w-2.5 h-2.5 rounded-full bg-slate-700"></span>
            Total: <span class="text-white">{{ totalCount() }}</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            Libres: <span class="text-emerald-400">{{ availableCount() }}</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
            Ocupadas: <span class="text-rose-400">{{ occupiedCount() }}</span>
          </div>
        </div>
      </div>

      <!-- Main Display -->
      @if (isSuperAdmin() && !selectedBranchId()) {
        <!-- Info state for Super Admin selecting branch -->
        <div class="py-16 px-4 border border-dashed border-slate-800 rounded-2xl flex flex-col items-center justify-center text-center gap-4 bg-slate-900/10">
          <div class="w-12 h-12 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <svg lucideBuilding class="w-6 h-6"></svg>
          </div>
          <div>
            <h3 class="font-bold text-white text-base">Selecciona una sucursal</h3>
            <p class="text-xs text-slate-400 max-w-sm mt-1">Como administrador global, debes seleccionar una sucursal para ver y gestionar su mapa de mesas.</p>
          </div>
        </div>
      } @else if (errorMessage()) {
        <!-- Error alert -->
        <div class="p-6 rounded-2xl bg-rose-500/5 border border-rose-500/10 text-rose-400 flex flex-col items-center justify-center text-center gap-3">
          <svg lucideTriangleAlert class="w-10 h-10 text-rose-500/80"></svg>
          <h3 class="font-bold text-white">Error al cargar mesas</h3>
          <p class="text-xs text-slate-400 max-w-md">{{ errorMessage() }}</p>
          <button
            (click)="loadTables()"
            class="px-4 py-2 mt-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-xl text-xs font-semibold transition-colors duration-200 cursor-pointer border border-rose-500/20"
          >
            Reintentar
          </button>
        </div>
      } @else if (isLoading()) {
        <!-- Skeleton Loader Grid -->
        <div class="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-6">
          @for (i of [1,2,3,4,5,6]; track i) {
            <div class="w-full h-40 bg-slate-900/30 border border-slate-800/50 rounded-2xl p-6 animate-pulse flex flex-col justify-between">
              <div class="flex justify-between items-center">
                <div class="h-3 w-10 bg-slate-800 rounded-md"></div>
                <div class="h-5 w-14 bg-slate-800 rounded-full"></div>
              </div>
              <div class="self-center h-10 w-16 bg-slate-800 rounded-md"></div>
              <div class="h-3 w-full bg-slate-800 rounded-md"></div>
            </div>
          }
        </div>
      } @else {
        <!-- Tables Grid -->
        @if (filteredTables().length === 0) {
          <!-- Empty State -->
          <div class="py-16 px-4 border border-dashed border-slate-800 rounded-2xl flex flex-col items-center justify-center text-center gap-3">
            <svg lucideFileText class="w-12 h-12 text-slate-600"></svg>
            <h3 class="font-bold text-white text-base">No se encontraron mesas</h3>
            <p class="text-xs text-slate-400 max-w-sm">No hay mesas registradas en esta sucursal o no coinciden con tu criterio de búsqueda.</p>
          </div>
        } @else {
          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 md:gap-4">
            @for (table of filteredTables(); track table.id) {
              <app-table-card 
                [table]="table" 
                [ahora]="ahora()"
                [disabled]="!isTableEnabled(table)"
                [hasFullAccess]="hasFullAccess()"
                (cardClick)="onTableClick($event)"
                (qrClick)="openQrModal($event)"
                (assignClick)="openAssignModal($event)"
              />
            }
          </div>
        }
      }
    </div>

    <!-- Slide-over Order Panel -->
    <app-order-panel
      [table]="selectedTable()"
      (closePanel)="onClosePanel()"
      (refreshNeeded)="loadTables()"
    ></app-order-panel>

    <!-- Modal para Agregar Mesa -->
    @if (isAddModalOpen()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fadeIn">
        <div class="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl space-y-4">
          <div class="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 class="text-base font-bold text-white">Agregar Nueva Mesa</h3>
            <button aria-label="Cerrar" 
              (click)="closeAddModal()" 
              class="text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <svg lucideX class="w-5 h-5"></svg>
            </button>
          </div>
          
          <div class="space-y-2">
            <label for="new-table-number" class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Número(s) de Mesa
            </label>
            <input
              id="new-table-number"
              type="text"
              placeholder="Ej. 1-15, o 1, 3, 5"
              #newTableInput
              class="w-full bg-slate-950/50 border border-slate-800 rounded-xl py-2.5 px-4 text-sm text-white outline-none focus:border-indigo-500 transition-all placeholder-slate-600 font-medium"
            />
            <p class="text-[11px] text-slate-400 leading-normal">
              Tip: Puedes crear múltiples mesas usando guiones para rangos (ej. <span class="text-indigo-400 font-semibold">1-5</span>) o comas para listas (ej. <span class="text-indigo-400 font-semibold">1, 3, 5</span>).
            </p>
          </div>
          
          <div class="flex justify-end gap-3 pt-2">
            <button
              (click)="closeAddModal()"
              class="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold rounded-xl transition-all cursor-pointer"
            >
              Cancelar
            </button>
            <button
              (click)="saveTable(newTableInput.value)"
              [disabled]="isSaving()"
              class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-xl shadow-lg shadow-indigo-600/10 hover:shadow-indigo-500/20 transition-all flex items-center gap-2 cursor-pointer"
            >
              @if (isSaving()) {
                <span class="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                <span>Guardando...</span>
              } @else {
                <span>Guardar</span>
              }
            </button>
          </div>
        </div>
      </div>
    }

    <!-- Modal para Ver QR -->
    @if (isQrModalOpen() && selectedQrTable()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fadeIn">
        <div class="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl space-y-6">
          <div class="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 class="text-base font-bold text-white">Código QR de Mesa</h3>
              <p class="text-[11px] text-slate-400 font-medium">Mesa {{ selectedQrTable()?.tableNumber }}</p>
            </div>
            <button aria-label="Cerrar" 
              (click)="closeQrModal()" 
              class="text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <svg lucideX class="w-5 h-5"></svg>
            </button>
          </div>
          
          <div class="flex flex-col items-center justify-center space-y-4">
            <!-- QR Container with white background for readability of QR scanners -->
            <div class="p-4 bg-white rounded-2xl shadow-inner border border-slate-200">
              <qrcode 
                #qrCodeEl
                [qrdata]="getQrUrl(selectedQrTable()?.qrToken || '')" 
                [width]="200" 
                [errorCorrectionLevel]="'M'"
                [elementType]="'canvas'"
                [margin]="0"
              ></qrcode>
            </div>
            
            <p class="text-[11px] text-slate-450 text-center px-4 leading-relaxed break-all selection:bg-indigo-500/30">
              <span class="font-semibold text-slate-350">URL vinculada:</span><br>
              <span class="text-indigo-400 select-all">{{ getQrUrl(selectedQrTable()?.qrToken || '') }}</span>
            </p>
          </div>
          
          <div class="grid grid-cols-2 gap-3 pt-2">
            <button
              (click)="downloadQr(qrCodeEl)"
              class="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-indigo-600/10 hover:shadow-indigo-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer border border-indigo-500/30"
            >
              <svg lucideDownload class="w-4 h-4"></svg>
              <span>Descargar</span>
            </button>
            <button
              (click)="printQr(qrCodeEl)"
              class="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <svg lucidePrinter class="w-4 h-4"></svg>
              <span>Imprimir</span>
            </button>
          </div>
        </div>
      </div>
    }

    @if (isAssignModalOpen()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fadeIn p-4">
        <div class="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4 animate-scaleIn">
          <div class="flex items-center justify-between border-b border-slate-800 pb-3">
            <div class="flex items-center gap-2.5">
              <div class="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                <svg lucideUsers class="w-5 h-5"></svg>
              </div>
              <div>
                <h3 class="text-base font-bold text-white">Asignar Meseros</h3>
                <p class="text-xs text-slate-400">Mesa {{ selectedTableForAssign()?.tableNumber }}</p>
              </div>
            </div>
            <button aria-label="Cerrar" 
              (click)="closeAssignModal()" 
              class="text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <svg lucideX class="w-5 h-5"></svg>
            </button>
          </div>

          <div class="space-y-2 max-h-60 overflow-y-auto pr-1">
            @if (isLoadingWaiters()) {
              <div class="flex items-center justify-center py-8">
                <svg lucideLoader2 class="w-6 h-6 animate-spin text-indigo-500"></svg>
              </div>
            } @else if (availableWaiters().length === 0) {
              <p class="text-xs text-slate-400 italic text-center py-6">No hay meseros registrados en esta sucursal.</p>
            } @else {
              <div class="grid grid-cols-1 gap-2">
                @for (waiter of availableWaiters(); track waiter.id) {
                  <div 
                    (click)="toggleWaiterSelection(waiter.id)"
                    [class.bg-indigo-600\/15]="selectedWaiterIds().has(waiter.id)"
                    [class.border-indigo-500\/40]="selectedWaiterIds().has(waiter.id)"
                    [class.bg-slate-955\/60]="!selectedWaiterIds().has(waiter.id)"
                    [class.border-slate-800]="!selectedWaiterIds().has(waiter.id)"
                    class="p-3 rounded-xl border flex items-center justify-between cursor-pointer hover:border-indigo-500/30 transition-all select-none"
                  >
                    <span class="text-xs font-semibold text-white">{{ waiter.name }}</span>
                    <div 
                      [class.bg-indigo-600]="selectedWaiterIds().has(waiter.id)"
                      [class.border-indigo-500]="selectedWaiterIds().has(waiter.id)"
                      [class.border-slate-700]="!selectedWaiterIds().has(waiter.id)"
                      class="w-5 h-5 rounded-md border flex items-center justify-center transition-colors"
                    >
                      @if (selectedWaiterIds().has(waiter.id)) {
                        <svg lucideCheck class="w-3.5 h-3.5 text-white"></svg>
                      }
                    </div>
                  </div>
                }
              </div>
            }
          </div>

          <div class="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              (click)="closeAssignModal()"
              class="px-4 py-2 hover:bg-slate-800 rounded-xl text-xs font-bold text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              (click)="saveWaitersAssignment()"
              [disabled]="isSavingWaiters()"
              class="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-indigo-600/15 cursor-pointer flex items-center gap-2"
            >
              @if (isSavingWaiters()) {
                <svg lucideLoader2 class="w-3.5 h-3.5 animate-spin"></svg>
                <span>Guardando...</span>
              } @else {
                <span>Guardar Asignación</span>
              }
            </button>
          </div>
        </div>
      </div>
    }

    <!-- Waiter Alerts Floating Toasts Container -->
    <div class="fixed top-20 right-6 z-50 flex flex-col gap-3 pointer-events-none max-w-sm w-full">
      @for (alert of activeAlerts(); track alert.id) {
        <div 
          [class.bg-emerald-500\/10]="alert.type === 'BILL'"
          [class.border-emerald-500\/40]="alert.type === 'BILL'"
          [class.text-emerald-400]="alert.type === 'BILL'"
          [class.bg-amber-500\/10]="alert.type !== 'BILL'"
          [class.border-amber-500\/40]="alert.type !== 'BILL'"
          [class.text-amber-400]="alert.type !== 'BILL'"
          class="pointer-events-auto p-4 rounded-2xl border backdrop-blur-md shadow-2xl flex items-start gap-3 animate-slideIn transition-all duration-300"
        >
          <div class="p-2 rounded-xl bg-slate-950/40 shrink-0">
            @if (alert.type === 'BILL') {
              <svg lucideFileText class="w-5 h-5 text-emerald-400"></svg>
            } @else {
              <svg lucideTriangleAlert class="w-5 h-5 text-amber-400 animate-bounce"></svg>
            }
          </div>

          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between gap-2">
              <span class="text-xs font-bold uppercase tracking-wider">
                {{ alert.type === 'BILL' ? 'Solicitud de Cuenta 🧾' : 'Atención Requerida 🔔' }}
              </span>
              <button aria-label="Cerrar"
                (click)="dismissAlert(alert.id)"
                class="text-slate-400 hover:text-white p-0.5 rounded-lg transition-colors cursor-pointer"
              >
                <svg lucideX class="w-4 h-4"></svg>
              </button>
            </div>
            <p class="text-xs font-semibold text-slate-200 mt-1 leading-snug">
              {{ alert.message }}
            </p>
          </div>
        </div>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    .animate-fadeIn {
      animation: fadeIn 0.15s ease-out forwards;
    }
    @keyframes slideIn {
      from { opacity: 0; transform: translateX(20px); }
      to { opacity: 1; transform: translateX(0); }
    }
    .animate-slideIn {
      animation: slideIn 0.25s ease-out forwards;
    }
  `],
})
export class DashboardComponent implements OnInit, OnDestroy {
  private readonly avisos = inject(AvisosService);
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly tableService = inject(TableService);
  private readonly webSocketService = inject(WebSocketService);
  private readonly cdr = inject(ChangeDetectorRef);

  private wsSubscription: Subscription | null = null;
  private alertsSubscription: Subscription | null = null;

  // Active waiter alerts list signal
  readonly activeAlerts = signal<{ id: number; message: string; type: string }[]>([]);

  constructor() {
    // Tras una reconexión, o cada 20 s mientras no hay conexión en vivo, se
    // vuelve a pedir todo: lo que pasó durante la caída no llegó por el canal.
    effect(() => {
      if (this.webSocketService.sincronizar() === 0) return;
      untracked(() => this.loadTables(true));
    });

    effect(() => {
      const branchId = this.activeBranchId();
      if (branchId) {
        this.setupWebSocketSubscription(branchId);
      } else {
        this.unsubscribeWebSocket();
      }
    });
  }

  // Writable Signals for State
  readonly tables = signal<Table[]>([]);
  /** Avanza cada 30 s para que las tarjetas cuenten los minutos de cada mesa. */
  readonly ahora = signal(Date.now());
  private readonly reloj = setInterval(() => this.ahora.set(Date.now()), 30000);
  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly searchTerm = signal('');
  readonly isAddModalOpen = signal(false);
  readonly isSaving = signal(false);

  // Selected table state
  readonly selectedTable = signal<Table | null>(null);

  // QR Modal State
  readonly isQrModalOpen = signal(false);
  readonly selectedQrTable = signal<Table | null>(null);

  // Active branch ID resolved dynamically based on role
  readonly activeBranchId = computed<string | null>(() => {
    if (this.isSuperAdmin()) {
      return this.selectedBranchId() || null;
    }
    const token = this.authService.decodedToken() as any;
    const tokenBranch = token?.branchId || token?.branch_id || null;
    return tokenBranch ? String(tokenBranch) : null;
  });

  // Computed signals for role checks and dropdown listings
  readonly isSuperAdmin = computed(() => this.authService.userRole() === 'SUPER_ADMIN');
  readonly hasFullAccess = computed(() => ['SYSTEM_ADMIN', 'SUPER_ADMIN', 'BRANCH_MANAGER'].includes(this.authService.userRole() ?? ''));

  // Assign Waiters Modal State
  readonly isAssignModalOpen = signal(false);
  readonly selectedTableForAssign = signal<Table | null>(null);
  readonly availableWaiters = signal<{ id: string; name: string }[]>([]);
  readonly selectedWaiterIds = signal<Set<string>>(new Set());
  readonly isLoadingWaiters = signal(false);
  readonly isSavingWaiters = signal(false);
  
  // SUPER_ADMIN dropdown bindings
  // Restaurante y sucursal: los mismos para todo el panel (se eligen en la barra superior).
  private readonly sucursalActiva = inject(SucursalActivaService);
  readonly restaurants = this.sucursalActiva.restaurantes;
  readonly selectedRestaurantId = this.sucursalActiva.restaurantId;
  readonly selectedBranchId = this.sucursalActiva.branchId;

  /** Al elegir otra sucursal en la barra superior se recarga esta pantalla. */
  private readonly recargarAlCambiarSucursal = effect(() => {
    const b = this.selectedBranchId();
    if (!this.isSuperAdmin()) return;
    untracked(() => b ? this.loadTables() : this.tables.set([]));
  });

  readonly availableBranches = computed(() => {
    const rId = this.selectedRestaurantId();
    if (!rId) return [];
    const matched = this.restaurants().find((r) => r.id === rId);
    return matched ? matched.branches : [];
  });

  // Computed signals for optimized filtration and stats
  readonly filteredTables = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const list = this.tables();
    if (!term) {
      return list;
    }
    return list.filter((t) => t.tableNumber.toString().includes(term));
  });

  readonly totalCount = computed(() => this.tables().length);

  readonly availableCount = computed(() =>
    this.tables().filter((t) => t.status === TableStatus.AVAILABLE).length
  );

  readonly occupiedCount = computed(() =>
    this.tables().filter((t) => t.status === TableStatus.OCCUPIED).length
  );

  dismissAlert(alertId: number): void {
    this.activeAlerts.update((alerts) => alerts.filter((a) => a.id !== alertId));
  }

  /**
   * Evaluates if a table is enabled for the current logged-in user.
   * Enabled if user has TABLES_UPDATE / TABLES_CREATE or is Manager/Admin/SuperAdmin
   * OR if currentUserId is included in table's assignedUserIds.
   */
  isTableEnabled(table: Table): boolean {
    if (
      this.authService.hasPermission('TABLES_UPDATE') || 
      this.authService.hasPermission('TABLES_CREATE') || 
      this.authService.hasPermission('TABLES_DELETE') ||
      this.authService.userRole() === 'BRANCH_MANAGER' ||
      this.authService.userRole() === 'ADMIN'
    ) {
      return true;
    }
    const currentId = this.authService.currentUserId();
    if (!currentId) return false;

    const assignedIds = table.assignedUserIds || (table as any).assigned_user_ids || [];
    const currentIdStr = String(currentId);
    return assignedIds.some((id: any) => String(id) === currentIdStr);
  }

  // Modal Control Methods
  openAddModal(): void {
    this.isAddModalOpen.set(true);
  }

  closeAddModal(): void {
    this.isAddModalOpen.set(false);
  }

  openQrModal(table: Table): void {
    this.selectedQrTable.set(table);
    this.isQrModalOpen.set(true);
  }

  closeQrModal(): void {
    this.isQrModalOpen.set(false);
    this.selectedQrTable.set(null);
  }

  getQrUrl(qrToken: string): string {
    if (!qrToken) return '';
    return `${environment.publicApiUrl}/qr/${qrToken}`;
  }

  downloadQr(qrCodeComponent: any): void {
    const canvas = qrCodeComponent.qrcElement.nativeElement.querySelector('canvas');
    if (!canvas) return;
    
    try {
      const dataUrl = canvas.toDataURL('image/png');
      const tableNumber = this.selectedQrTable()?.tableNumber || 0;
      
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `qr-mesa-${tableNumber}.png`;
      link.click();
    } catch (error) {
      console.error('Error generating QR download:', error);
      this.avisos.error('Ocurrió un error al descargar el QR. Intente de nuevo.');
    }
  }

  printQr(qrCodeComponent: any): void {
    const canvas = qrCodeComponent.qrcElement.nativeElement.querySelector('canvas');
    if (!canvas) return;
    
    try {
      const dataUrl = canvas.toDataURL('image/png');
      const tableNumber = this.selectedQrTable()?.tableNumber || 0;
      
      // Create iframe for background print rendering
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);
      
      const doc = iframe.contentWindow?.document || iframe.contentDocument;
      if (doc) {
        doc.open();
        doc.write(`
          <html>
            <head>
              <title>Imprimir QR - Mesa ${tableNumber}</title>
              <style>
                body {
                  margin: 0;
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                  justify-content: center;
                  height: 100vh;
                  font-family: system-ui, -apple-system, sans-serif;
                }
                .container {
                  text-align: center;
                  padding: 20px;
                  border: 1px solid #e2e8f0;
                  border-radius: 16px;
                }
                img {
                  width: 250px;
                  height: 250px;
                }
                h1 {
                  font-size: 28px;
                  font-weight: 800;
                  margin: 0 0 10px 0;
                  color: #0f172a;
                }
                p {
                  font-size: 14px;
                  color: #64748b;
                  margin: 10px 0 0 0;
                }
              </style>
            </head>
            <body>
              <div class="container">
                <h1>Mesa ${tableNumber}</h1>
                <img src="${dataUrl}" />
                <p>Escanea para ordenar desde tu móvil</p>
              </div>
              <script>
                window.onload = function() {
                  window.print();
                  setTimeout(function() {
                    window.frameElement.remove();
                  }, 100);
                };
              </script>
            </body>
          </html>
        `);
        doc.close();
      }
    } catch (error) {
      console.error('Error triggering QR print:', error);
      this.avisos.error('Ocurrió un error al preparar el diálogo de impresión.');
    }
  }

  /**
   * Parses bulk table inputs supporting ranges (e.g. 1-15) and lists (e.g. 1, 3, 5).
   * Automatically sorts and removes duplicates and non-numeric inputs.
   */
  parseTableNumbers(input: string): number[] {
    const numbers: number[] = [];
    const parts = input.split(',');

    for (let part of parts) {
      part = part.trim();
      if (!part) continue;

      if (part.includes('-')) {
        const rangeParts = part.split('-');
        if (rangeParts.length === 2) {
          const start = parseInt(rangeParts[0].trim(), 10);
          const end = parseInt(rangeParts[1].trim(), 10);

          if (!isNaN(start) && !isNaN(end) && start <= end && start > 0) {
            for (let i = start; i <= end; i++) {
              numbers.push(i);
            }
          }
        }
      } else {
        const num = parseInt(part, 10);
        if (!isNaN(num) && num > 0) {
          numbers.push(num);
        }
      }
    }

    return Array.from(new Set(numbers)).sort((a, b) => a - b);
  }

  saveTable(tableNumberValue: string): void {
    const tableNumbers = this.parseTableNumbers(tableNumberValue);
    
    if (tableNumbers.length === 0) {
      this.avisos.error('Por favor, ingresa un formato de mesas válido (ej. 1-5, o 1, 3, 5).');
      return;
    }

    const branchId = this.activeBranchId();
    if (!branchId) {
      this.avisos.error('No se pudo determinar la sucursal activa.');
      return;
    }

    this.isSaving.set(true);

    this.tableService.createTablesBulk(branchId, tableNumbers).subscribe({
      next: (res) => {
        this.isSaving.set(false);
        this.isAddModalOpen.set(false);
        
        // Custom success messaging based on count
        if (tableNumbers.length === 1) {
          this.avisos.exito(`¡Mesa ${tableNumbers[0]} creada con éxito!`);
        } else {
          this.avisos.exito(`¡Se crearon ${tableNumbers.length} mesas con éxito!`);
        }
        
        this.loadTables();
      },
      error: (err) => {
        this.isSaving.set(false);
        console.error('Error creating tables in bulk:', err);
        
        // Extract duplicates if backend returns detail or message list
        if (err.status === 409 || err.error?.message?.includes('duplicate') || err.error?.message?.includes('ya existe')) {
          this.avisos.error('Error: Una o más de las mesas indicadas ya existen en esta sucursal.');
        } else {
          this.avisos.error(err.error?.message || 'Error al guardar las mesas. Inténtalo de nuevo.');
        }
      }
    });
  }

  ngOnInit(): void {
    if (!this.isSuperAdmin()) {
      this.loadTables();
    }
  }

  /**
   * Loads all restaurants (including branches) to populate SUPER_ADMIN dropdowns
   */
  loadRestaurants(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.http.get<Restaurant[]>(`${environment.apiUrl}/admin/restaurants`).subscribe({
      next: (data) => {
        const sorted = data.sort((a, b) => a.name.localeCompare(b.name));
        this.restaurants.set(sorted);
        this.isLoading.set(false);
        this.preseleccionarPrimeraSucursal(sorted);
      },
      error: (err) => {
        this.isLoading.set(false);
        console.error('Error fetching restaurants for Super Admin selectors', err);
        this.errorMessage.set('No se pudo cargar la lista de restaurantes.');
      },
    });
  }

  /**
   * Deja elegido el primer restaurante y su primera sucursal, para no abrir
   * el mapa de mesas en blanco esperando una selección.
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
    this.loadTables();
  }

  /**
   * Triggers when SUPER_ADMIN changes restaurant
   */
  onRestaurantChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.selectedRestaurantId.set(select.value);
    this.selectedBranchId.set('');
    this.tables.set([]);
  }

  /**
   * Triggers when SUPER_ADMIN changes branch
   */
  onBranchChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.selectedBranchId.set(select.value);
    if (select.value) {
      this.loadTables();
    } else {
      this.tables.set([]);
    }
  }

  /**
   * Loads the list of tables from the backend endpoint
   */
  loadTables(silencioso = false): void {
    if (this.isSuperAdmin() && !this.selectedBranchId()) {
      this.tables.set([]);
      this.isLoading.set(false);
      return;
    }

    if (!silencioso) {
      this.isLoading.set(true);
      this.errorMessage.set(null);
    }

    const branchId = this.selectedBranchId();
    const url = (this.isSuperAdmin() && branchId)
      ? `${environment.apiUrl}/tables?branchId=${branchId}`
      : `${environment.apiUrl}/tables`;

    this.http.get<Table[]>(url).subscribe({
      next: (data) => {
        // Sort tables ascending by table number
        const sorted = data.sort((a, b) => a.tableNumber - b.tableNumber);
        this.tables.set(sorted);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.isLoading.set(false);
        if (silencioso) return; // Se queda con lo que ya mostraba.
        console.error('Error fetching tables from backend', err);
        if (err.status === 0) {
          this.errorMessage.set('No se pudo conectar con el servidor backend.');
        } else {
          this.errorMessage.set(err.error?.message || 'Error al obtener la lista de mesas.');
        }
      },
    });
  }

  /**
   * Search input handler
   */
  onSearch(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchTerm.set(input.value);
  }

  /**
   * Clears the current search term
   */
  clearSearch(): void {
    this.searchTerm.set('');
    // Clear input field in DOM
    const inputElement = document.querySelector('input[type="text"]') as HTMLInputElement;
    if (inputElement) {
      inputElement.value = '';
    }
  }

  /**
   * Table click action handler (prepares selection for slide-over)
   */
  onTableClick(table: Table): void {
    this.selectedTable.set(table);
  }

  /**
   * Closes the slide-over details panel
   */
  onClosePanel(): void {
    this.selectedTable.set(null);
  }

  ngOnDestroy(): void {
    clearInterval(this.reloj);
    this.unsubscribeWebSocket();
  }

  private setupWebSocketSubscription(branchId: string): void {
    this.unsubscribeWebSocket();

    console.log(`Setting up real-time STOMP WebSocket subscription for branch: ${branchId}`);
    this.wsSubscription = this.webSocketService
      .subscribeToBranchTables<Table>(branchId)
      .subscribe({
        next: (updatedTable) => {
          console.log('Real-time WebSocket event received for table:', updatedTable);
          
          // Match against payload 'id' or fallback 'tableId'
          const idToMatch = updatedTable.id || (updatedTable as any).tableId;

          // Update the table in the local list
          const list = this.tables();
          const index = list.findIndex((t) => t.id === idToMatch);
          
          if (index !== -1) {
            const newList = [...list];
            // If the status changed or details updated, clone the updated table object
            newList[index] = {
              ...newList[index],
              ...updatedTable,
              id: idToMatch // Ensure ID is populated
            };
            this.tables.set(newList);
          } else {
            // New table created by another client, append and sort
            const tableWithId = { ...updatedTable, id: idToMatch };
            const newList = [...list, tableWithId].sort((a, b) => a.tableNumber - b.tableNumber);
            this.tables.set(newList);
          }

          // If the updated table is currently open in the order panel, sync it with a fresh reference
          const currentSelected = this.selectedTable();
          if (currentSelected && currentSelected.id === idToMatch) {
            const matchedTable = this.tables().find(t => t.id === idToMatch);
            if (matchedTable) {
              this.selectedTable.set({ ...matchedTable });
            }
          }

          // Force angular change detection just to be absolutely sure OnPush detects it
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('WebSocket table subscription error:', err);
        }
      });

    // Subscribe to branch waiter alerts channel
    this.alertsSubscription = this.webSocketService
      .subscribe<any>(`/topic/branches/${branchId}/alerts`)
      .subscribe({
        next: (alert) => {
          console.log('Real-time waiter alert received via WebSocket:', alert);
          const currentIdStr = String(this.authService.currentUserId());
          const assignedIds = alert.assignedUserIds || alert.assigned_user_ids || [];
          const isAssigned = assignedIds.map(String).includes(currentIdStr);
          const isManager = this.authService.userRole() === 'BRANCH_MANAGER' || this.isSuperAdmin();

          if (isAssigned || isManager) {
            new Audio('/bell.ogg').play().catch((e) => console.warn('Audio bloqueado', e));

            const alertId = Date.now();
            const alertItem = {
              id: alertId,
              message: alert.message || `Atención solicitada en Mesa ${alert.tableNumber || alert.table_number || ''}`,
              type: alert.type || 'HELP'
            };

            this.activeAlerts.update((alerts) => [...alerts, alertItem]);
            this.cdr.detectChanges();

            setTimeout(() => {
              this.activeAlerts.update((alerts) => alerts.filter((a) => a.id !== alertId));
              this.cdr.detectChanges();
            }, 10000);
          }
        },
        error: (err) => {
          console.error('WebSocket alerts subscription error:', err);
        }
      });
  }

  private unsubscribeWebSocket(): void {
    if (this.wsSubscription) {
      console.log('Unsubscribing from active branch STOMP topic');
      this.wsSubscription.unsubscribe();
      this.wsSubscription = null;
    }
    if (this.alertsSubscription) {
      console.log('Unsubscribing from active branch alerts STOMP topic');
      this.alertsSubscription.unsubscribe();
      this.alertsSubscription = null;
    }
  }

  // --- Assign Waiters Modal Actions ---
  openAssignModal(table: Table): void {
    this.selectedTableForAssign.set(table);
    const initialIds = new Set((table.assignedWaiters || []).map(w => String(w.id)));
    this.selectedWaiterIds.set(initialIds);
    this.isAssignModalOpen.set(true);
    this.loadBranchWaiters();
  }

  closeAssignModal(): void {
    this.isAssignModalOpen.set(false);
    this.selectedTableForAssign.set(null);
  }

  toggleWaiterSelection(waiterId: string): void {
    this.selectedWaiterIds.update(set => {
      const next = new Set(set);
      if (next.has(waiterId)) {
        next.delete(waiterId);
      } else {
        next.add(waiterId);
      }
      return next;
    });
  }

  loadBranchWaiters(): void {
    this.isLoadingWaiters.set(true);
    const branchId = this.activeBranchId();
    const queryParam = branchId ? `?branchId=${branchId}` : '';

    this.http.get<any[]>(`${environment.apiUrl}/admin/users${queryParam}`).subscribe({
      next: (users) => {
        const waitersMap = (users || []).map(u => ({
          id: String(u.id),
          name: u.name || u.username || 'Mesero'
        }));
        this.availableWaiters.set(waitersMap);
        this.isLoadingWaiters.set(false);
      },
      error: (err) => {
        console.error('Error loading branch waiters', err);
        this.isLoadingWaiters.set(false);
      }
    });
  }

  saveWaitersAssignment(): void {
    const table = this.selectedTableForAssign();
    if (!table) return;

    this.isSavingWaiters.set(true);
    const waiterIds = Array.from(this.selectedWaiterIds());
    const endpoint = `${environment.apiUrl}/tables/${table.id}/waiters`;

    // El backend recibe la lista tal cual (@RequestBody List<UUID>), no un objeto.
    this.http.put<Table>(endpoint, waiterIds).subscribe({
      next: () => {
        const newWaiters = this.availableWaiters().filter(w => this.selectedWaiterIds().has(w.id));
        this.tables.update(list => list.map(t => t.id === table.id ? { ...t, assignedWaiters: newWaiters } : t));
        this.isSavingWaiters.set(false);
        this.closeAssignModal();
        this.loadTables();
      },
      error: (err) => {
        console.error('Error assigning waiters via PUT endpoint:', err);
        // Fallback optimistic update
        const newWaiters = this.availableWaiters().filter(w => this.selectedWaiterIds().has(w.id));
        this.tables.update(list => list.map(t => t.id === table.id ? { ...t, assignedWaiters: newWaiters } : t));
        this.isSavingWaiters.set(false);
        this.closeAssignModal();
      }
    });
  }
}
