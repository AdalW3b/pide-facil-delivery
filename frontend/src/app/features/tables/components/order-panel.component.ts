import { AvisosService } from '../../../core/services/avisos.service';
import { PesosPipe, formatearPesos } from '../../../shared/utils/pesos';
import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, signal, computed, inject, OnChanges, SimpleChanges } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Table, TableStatus } from '../models/table.model';
import { AuthService } from '../../../core/services/auth.service';
import { LucideX, LucideCheckCircle, LucideLoader2, LucideShoppingCart, LucidePlus, LucideChevronRight, LucideCheckSquare, LucideBan } from '@lucide/angular';
import { environment } from '../../../../environments/environment';

export interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  specialInstructions: string;
  adicionales?: string[];
}

export interface BillSummary {
  orderId: string;
  tableNumber: number;
  items: OrderItem[];
  totalAmount: number;
  formattedBillText: string;
  /** WhatsApp del cliente de la mesa; null si no se sabe. */
  telefonoCliente?: string | null;
  /** Cuándo se le mandó la cuenta por WhatsApp. */
  cuentaEnviadaEn?: string | null;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  description: string;
  active: boolean;
  isCombo?: boolean;
  comboItems?: { productId: string; cantidad: number; nombre: string }[] | null;
  /** false = combo fuera de sus días de promoción: hoy no se vende. */
  vigenteHoy?: boolean;
}

/** Grupo de adicionales de un platillo, tal como lo da el menú público. */
export interface GrupoAdicional {
  id: string;
  nombre: string;
  minimo: number;
  maximo: number;
  opciones: { id: string; nombre: string; precio: number; disponible: boolean }[];
}

@Component({
  selector: 'app-order-panel',
  standalone: true,
  imports: [PesosPipe, CommonModule, FormsModule, LucideX, LucideCheckCircle, LucideLoader2, LucideShoppingCart, LucidePlus, LucideChevronRight, LucideCheckSquare, LucideBan],
  template: `
    <!-- Panel wrapper overlay -->
    <div
      [class.opacity-0]="!table"
      [class.pointer-events-none]="!table"
      class="fixed inset-0 z-50 overflow-hidden transition-opacity duration-300"
    >
      <!-- Backdrop -->
      <div
        (click)="onClose()"
        class="absolute inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity duration-300"
      ></div>

      <!-- Sliding panel container -->
      <div class="fixed inset-y-0 right-0 pl-10 max-w-full flex">
        <div
          [class.translate-x-full]="!table"
          [class.translate-x-0]="table"
          class="w-screen max-w-md bg-slate-900 border-l border-slate-800 text-slate-100 flex flex-col shadow-2xl relative transition-transform duration-300 ease-out h-full"
        >
          @if (table) {
            <!-- Panel Header -->
            <div class="h-16 flex items-center justify-between px-6 border-b border-slate-800/80 shrink-0">
              <div class="flex items-center gap-3">
                <div 
                  [class.bg-emerald-500/10]="table.status === 'AVAILABLE'"
                  [class.text-emerald-400]="table.status === 'AVAILABLE'"
                  [class.bg-rose-500/10]="table.status === 'OCCUPIED'"
                  [class.text-rose-400]="table.status === 'OCCUPIED'"
                  class="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm"
                >
                  {{ table.tableNumber }}
                </div>
                <h2 class="text-base font-bold text-white">Detalle de Mesa</h2>
              </div>
              <button aria-label="Cerrar"
                (click)="onClose()"
                class="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors duration-200 cursor-pointer"
              >
                <svg lucideX class="w-5 h-5"></svg>
              </button>
            </div>

            <!-- Panel Body -->
            <div class="flex-1 overflow-y-auto p-6 space-y-6">
              
              <!-- If Table is Available -->
              @if (table.status === 'AVAILABLE') {
                <div class="flex flex-col items-center justify-center text-center py-12 px-4 space-y-4">
                  <div class="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                    <svg lucideCheckCircle class="w-8 h-8 animate-pulse"></svg>
                  </div>
                  <div>
                    <h3 class="font-bold text-white text-lg">Mesa Disponible</h3>
                    <p class="text-xs text-slate-400 mt-1 max-w-xs">Esta mesa no tiene ninguna orden activa en este momento.</p>
                  </div>
                  <button
                    (click)="openNewOrder()"
                    [disabled]="isActionLoading()"
                    class="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm rounded-xl shadow-lg shadow-emerald-600/15 hover:shadow-emerald-500/25 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    @if (isActionLoading()) {
                      <svg lucideLoader2 class="animate-spin h-5 w-5 text-white"></svg>
                      <span>Abriendo Mesa...</span>
                    } @else {
                      <span>Abrir Mesa / Registrar Orden</span>
                    }
                  </button>
                </div>
              }

              <!-- If Table is Occupied -->
              @if (table.status === 'OCCUPIED') {
                @if (isLoading()) {
                  <!-- Loading details state -->
                  <div class="flex flex-col items-center justify-center py-16 space-y-3">
                    <svg lucideLoader2 class="animate-spin h-8 w-8 text-indigo-500"></svg>
                    <span class="text-xs text-slate-400">Cargando cuenta de la mesa...</span>
                  </div>
                } @else if (errorMessage()) {
                  <!-- Error details state -->
                  <div class="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex flex-col items-center justify-center text-center gap-2">
                    <span class="font-semibold">Error al cargar la cuenta</span>
                    <p class="text-slate-400">{{ errorMessage() }}</p>
                    <button 
                      (click)="loadBill()" 
                      class="px-3 py-1 bg-rose-500/20 hover:bg-rose-500/30 rounded-lg font-semibold transition-colors duration-200 mt-1 cursor-pointer border border-rose-500/30"
                    >
                      Reintentar
                    </button>
                  </div>
                } @else if (bill()) {
                  <!-- Active items list -->
                  <div class="space-y-4">
                    <div class="flex items-center justify-between">
                      <span class="text-xs font-bold text-slate-400 uppercase tracking-wider">Productos en Orden</span>
                      <span class="text-[11px] text-slate-500">ID: {{ bill()?.orderId?.toString()?.substring(0, 8) }}</span>
                    </div>

                    @if (bill()!.items.length === 0) {
                      <div class="py-10 text-center border border-dashed border-slate-800 rounded-xl flex flex-col items-center justify-center gap-2 text-slate-500">
                        <svg lucideShoppingCart class="w-8 h-8"></svg>
                        <span class="text-xs">No hay productos agregados todavía</span>
                      </div>
                    } @else {
                      <div class="divide-y divide-slate-800/60 max-h-72 overflow-y-auto pr-1">
                        @for (item of bill()!.items; track item.id) {
                          <div class="py-3 flex justify-between gap-3 text-sm">
                            <div class="space-y-1">
                              <span class="font-semibold text-white">
                                {{ item.quantity }}x {{ item.productName }}
                              </span>
                              @for (a of item.adicionales ?? []; track a) {
                                <p class="text-xs text-sky-300">+ {{ a }}</p>
                              }
                              @if (item.specialInstructions) {
                                <p class="text-xs text-indigo-400 italic">
                                  ↳ Nota: {{ item.specialInstructions }}
                                </p>
                              }
                            </div>
                            <div class="text-right shrink-0">
                              <span class="font-bold text-white block">
                                {{ (item.unitPrice * item.quantity) | pesos }}
                              </span>
                              <span class="text-[11px] text-slate-500 block">
                                {{ item.unitPrice | pesos }} c/u
                              </span>
                            </div>
                          </div>
                        }
                      </div>
                    }

                    <!-- Total Amount Display -->
                    <div class="p-4 bg-slate-950/40 border border-slate-800/80 rounded-xl flex items-center justify-between">
                      <span class="text-sm font-bold text-slate-300">Total Acumulado</span>
                      <span class="text-xl font-black text-indigo-400">
                        {{ totalAcumulado | pesos }}
                      </span>
                    </div>
                  </div>

                  <!-- Inline Add Product Section -->
                  <div class="border-t border-slate-800/80 pt-5 space-y-4">
                    @if (!isAddingProduct()) {
                      <button
                        (click)="showAddProductForm()"
                        class="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-sm font-semibold transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 border border-slate-700/80"
                      >
                        <svg lucidePlus class="w-4 h-4"></svg>
                        <span>Agregar Producto</span>
                      </button>
                    } @else {
                      <div class="p-4 bg-slate-950/40 border border-slate-800/80 rounded-xl space-y-4 animate-fadeIn">
                        <div class="flex items-center justify-between">
                          <h4 class="text-xs font-bold text-indigo-400 uppercase tracking-wider">Agregar al Pedido</h4>
                          <button
                            (click)="hideAddProductForm()"
                            class="text-xs text-slate-400 hover:text-white cursor-pointer"
                          >
                            Cancelar
                          </button>
                        </div>
                        
                        <!-- Product selection drop-down -->
                        <div>
                          <label class="block text-[11px] font-semibold text-slate-400 uppercase mb-1.5">Producto</label>
                          <select aria-label="Producto"
                            [(ngModel)]="newProductForm.productId"
                            (ngModelChange)="alCambiarProducto()"
                            class="w-full bg-slate-900 border border-slate-800 rounded-lg py-2 px-3 text-xs text-white outline-none focus:border-indigo-500"
                          >
                            <option value="">Selecciona un producto</option>
                            @for (prod of productsList(); track prod.id) {
                              <option [value]="prod.id">
                                {{ prod.isCombo ? 'Combo · ' : '' }}{{ prod.name }} - {{ prod.price | pesos }}
                              </option>
                            }
                          </select>
                          @if (incluyeDe(newProductForm.productId); as incluye) {
                            <p class="text-[11px] text-slate-400 mt-1.5">Incluye: {{ incluye }}</p>
                          }
                        </div>

                        <!-- Adicionales del platillo elegido: los mismos que ve el
                             cliente en el menú en línea, con las mismas reglas. -->
                        @for (grupo of gruposDe(newProductForm.productId); track grupo.id) {
                          <div>
                            <div class="flex items-baseline justify-between mb-1.5">
                              <span class="text-[11px] font-semibold text-slate-400 uppercase">{{ grupo.nombre }}</span>
                              <span class="text-[11px]" [class]="grupo.minimo > 0 && elegidosEn(grupo) < grupo.minimo ? 'text-amber-400' : 'text-slate-500'">
                                {{ grupo.minimo > 0 ? 'Obligatorio' : 'Opcional' }} · {{ grupo.maximo === 1 ? 'elige 1' : 'hasta ' + grupo.maximo }}
                              </span>
                            </div>
                            <div class="flex flex-wrap gap-1.5">
                              @for (op of grupo.opciones; track op.id) {
                                <button
                                  type="button"
                                  (click)="alternarAdicional(grupo, op.id)"
                                  [disabled]="!op.disponible"
                                  [attr.aria-pressed]="elegidos().has(op.id)"
                                  class="px-2.5 py-1.5 rounded-lg text-xs border transition-colors cursor-pointer disabled:opacity-40 disabled:line-through disabled:cursor-not-allowed"
                                  [class]="elegidos().has(op.id)
                                    ? 'bg-indigo-600 border-indigo-500 text-white'
                                    : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-600'"
                                >
                                  {{ op.nombre }}@if (op.precio > 0) { <span class="opacity-70">+\${{ op.precio }}</span> }
                                </button>
                              }
                            </div>
                          </div>
                        }

                        <!-- Quantity and Special Instructions -->
                        <div class="grid grid-cols-3 gap-3">
                          <div class="col-span-1">
                            <label class="block text-[11px] font-semibold text-slate-400 uppercase mb-1.5">Cantidad</label>
                            <input aria-label="Cantidad"
                              type="number"
                              min="1"
                              [(ngModel)]="newProductForm.quantity"
                              class="w-full bg-slate-900 border border-slate-800 rounded-lg py-2 px-3 text-xs text-white outline-none focus:border-indigo-500 text-center"
                            />
                          </div>
                          <div class="col-span-2">
                            <label class="block text-[11px] font-semibold text-slate-400 uppercase mb-1.5">Nota Especial</label>
                            <input aria-label="Instrucciones especiales"
                              type="text"
                              placeholder="Ej: sin hielo, salsa extra"
                              [(ngModel)]="newProductForm.specialInstructions"
                              class="w-full bg-slate-900 border border-slate-800 rounded-lg py-2 px-3 text-xs text-white placeholder-slate-600 outline-none focus:border-indigo-500"
                            />
                          </div>
                        </div>

                        @if (faltaAdicional(); as falta) {
                          <p class="text-[11px] text-amber-400 text-center">{{ falta }}</p>
                        }

                        <!-- Confirm Save Button -->
                        <button
                          (click)="saveAddedProduct()"
                          [disabled]="!newProductForm.productId || newProductForm.quantity < 1 || isActionLoading() || faltaAdicional() !== null"
                          class="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-lg shadow-md shadow-indigo-600/10 hover:shadow-indigo-500/25 transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          @if (isActionLoading()) {
                            <span class="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                            <span>Agregando...</span>
                          } @else {
                            <span>Confirmar Agregar</span>
                          }
                        </button>
                      </div>
                    }
                  </div>

                  <!-- Formatted Bill Preview Accordion -->
                  <div class="border-t border-slate-800/80 pt-5">
                    <button
                      (click)="toggleBillText()"
                      class="flex items-center justify-between w-full text-left text-xs font-semibold text-slate-400 hover:text-white uppercase tracking-wider cursor-pointer"
                    >
                      <span>Ver Vista de Ticket (WhatsApp)</span>
                      <svg
                        lucideChevronRight
                        [class.rotate-90]="isBillTextOpen()"
                        class="w-4 h-4 transition-transform duration-200"
                      ></svg>
                    </button>
                    
                    @if (isBillTextOpen()) {
                      @if (isLoadingTicket()) {
                        <div class="mt-3 flex items-center gap-2 text-xs text-slate-400">
                          <svg lucideLoader2 class="animate-spin w-3.5 h-3.5"></svg>
                          <span>Generando ticket...</span>
                        </div>
                      } @else if (bill()?.formattedBillText) {
                        <pre class="mt-3 p-4 bg-slate-950/70 border border-slate-800/50 rounded-xl text-[11px] font-mono text-indigo-300 leading-relaxed overflow-x-auto whitespace-pre-wrap select-text animate-fadeIn">{{ bill()?.formattedBillText }}</pre>
                      } @else {
                        <p class="mt-3 text-[11px] text-slate-500 italic">No hay vista de ticket disponible.</p>
                      }
                    }
                  </div>
                }
              }
            </div>

            <!-- Panel Actions Footer (Only if occupied) -->
            @if (table.status === 'OCCUPIED' && bill()) {
              <div class="p-6 border-t border-slate-800/80 bg-slate-900/60 shrink-0 space-y-2.5">
                <!-- Mandarle la cuenta al cliente por WhatsApp -->
                @if (bill()!.cuentaEnviadaEn) {
                  <p class="text-[11px] text-emerald-400 text-center">
                    Cuenta enviada a las {{ horaDe(bill()!.cuentaEnviadaEn!) }}{{ bill()!.telefonoCliente ? ' al ' + bill()!.telefonoCliente : '' }}
                  </p>
                }
                @if (pidiendoTelefono()) {
                  <div class="flex gap-2">
                    <input type="tel" inputmode="tel" [ngModel]="telefonoCuenta()" (ngModelChange)="telefonoCuenta.set($event)"
                      placeholder="WhatsApp del cliente" aria-label="WhatsApp del cliente"
                      class="flex-1 min-w-0 bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-xs text-white outline-none focus:border-emerald-500" />
                    <button (click)="enviarCuenta()" [disabled]="enviandoCuenta() || telefonoCuenta().replace(/\D/g, '').length < 10"
                      class="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
                      Enviar
                    </button>
                    <button (click)="pidiendoTelefono.set(false)" class="px-2 text-xs text-slate-400 hover:text-white cursor-pointer">Cancelar</button>
                  </div>
                } @else {
                  <button
                    (click)="enviarCuenta()"
                    [disabled]="enviandoCuenta() || !bill()!.items.length"
                    class="w-full py-2.5 px-4 bg-emerald-600/15 border border-emerald-500/40 hover:bg-emerald-600/25 text-emerald-300 font-semibold text-xs rounded-xl transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {{ enviandoCuenta() ? 'Enviando...' : bill()!.cuentaEnviadaEn ? 'Reenviar cuenta por WhatsApp' : 'Enviar cuenta por WhatsApp' }}
                    <span class="tabular-nums">· {{ bill()!.totalAmount | pesos }}</span>
                  </button>
                }
                @if (errorCuenta()) {
                  <p class="text-[11px] text-rose-400 text-center" role="alert">{{ errorCuenta() }}</p>
                }
                @if (authService.hasPermission('ORDERS_DELETE') || authService.hasPermission('TABLES_UPDATE')) {
                  <button
                    (click)="cancelCurrentOrder()"
                    [disabled]="isActionLoading()"
                    class="w-full py-2.5 px-4 bg-transparent border border-rose-500/50 hover:bg-rose-500/10 text-rose-400 font-semibold text-xs rounded-xl transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    @if (isActionLoading()) {
                      <svg lucideLoader2 class="animate-spin h-4 w-4 text-rose-400"></svg>
                      <span>Cancelando...</span>
                    } @else {
                      <svg lucideBan class="w-4 h-4"></svg>
                      <span>Cancelar Orden Completa</span>
                    }
                  </button>
                }

                <button
                  (click)="closeCurrentTable()"
                  [disabled]="isActionLoading()"
                  class="w-full py-3 px-4 bg-rose-600 hover:bg-rose-500 text-white font-semibold text-sm rounded-xl shadow-lg shadow-rose-600/15 hover:shadow-rose-500/25 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  @if (isActionLoading()) {
                    <svg lucideLoader2 class="animate-spin h-5 w-5 text-white"></svg>
                    <span>Cerrando Mesa...</span>
                  } @else {
                    <svg lucideCheckSquare class="w-4 h-4"></svg>
                    <span>Cerrar Mesa (Liberar)</span>
                  }
                </button>
              </div>
            }
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(4px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .animate-fadeIn {
      animation: fadeIn 0.2s ease-out forwards;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderPanelComponent implements OnChanges {
  private readonly avisos = inject(AvisosService);
  private readonly http = inject(HttpClient);
  readonly authService = inject(AuthService);

  // Inputs & Outputs
  @Input() table: Table | null = null;
  @Output() closePanel = new EventEmitter<void>();
  @Output() refreshNeeded = new EventEmitter<void>();

  // State Signals
  readonly bill = signal<BillSummary | null>(null);
  readonly isLoading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly isAddingProduct = signal(false);
  readonly productsList = signal<Product[]>([]);
  readonly isActionLoading = signal(false);
  readonly isBillTextOpen = signal(false);
  readonly isLoadingTicket = signal(false);

  // Enviar la cuenta por WhatsApp
  readonly enviandoCuenta = signal(false);
  readonly pidiendoTelefono = signal(false);
  readonly telefonoCuenta = signal('');
  readonly errorCuenta = signal<string | null>(null);

  /** productId -> sus grupos de adicionales. Vacío si el platillo no tiene. */
  readonly gruposPorProducto = signal<Map<string, GrupoAdicional[]>>(new Map());
  /** Ids de los adicionales marcados en el formulario. */
  readonly elegidos = signal<Set<string>>(new Set());

  // Add Product Form State
  newProductForm = {
    productId: '',
    quantity: 1,
    specialInstructions: '',
  };

  /**
   * Sums order items unit price dynamically as a visual safety net
   */
  get totalAcumulado(): number {
    const currentBill = this.bill();
    if (!currentBill || !currentBill.items) return 0;
    return currentBill.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['table'] && this.table) {
      if (this.table.status === TableStatus.OCCUPIED) {
        // If the table input comes with items and totalAmount from the WebSocket payload,
        // update the bill items in memory immediately (zero latency)
        if (this.table.items && this.table.totalAmount !== undefined && this.table.totalAmount !== null) {
          const prevFormattedText = this.bill()?.formattedBillText || '';
          const summary: BillSummary = {
            orderId: this.table.activeOrderId || '',
            tableNumber: this.table.tableNumber,
            items: this.table.items,
            totalAmount: this.table.totalAmount,
            formattedBillText: prevFormattedText  // Preserve previous ticket text; loadFormattedBill() will refresh it
          };
          this.bill.set(summary);
          this.errorMessage.set(null);
          this.isAddingProduct.set(false);
          // Always (re)load the formatted ticket text from HTTP to keep it fresh
          this.loadFormattedBill();
        } else {
          // No WebSocket data - do a full HTTP bill load
          this.bill.set(null);
          this.errorMessage.set(null);
          this.isAddingProduct.set(false);
          this.isBillTextOpen.set(false);
          this.loadBill();
        }
      } else {
        // Available: clear states
        this.bill.set(null);
        this.errorMessage.set(null);
        this.isAddingProduct.set(false);
        this.isBillTextOpen.set(false);
      }
    }
  }

  /**
   * Closes the panel
   */
  onClose(): void {
    this.closePanel.emit();
  }

  /**
   * Loads the bill details for the occupied table's activeOrderId
   */
  loadBill(): void {
    const orderId = this.table?.activeOrderId;
    if (!orderId) {
      this.errorMessage.set('Esta mesa está marcada como ocupada pero no tiene un identificador de orden activo.');
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.http.get<BillSummary>(`${environment.apiUrl}/branches/${this.table?.branchId}/orders/${orderId}/bill`).subscribe({
      next: (data) => {
        this.bill.set(data);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.isLoading.set(false);
        console.error('Error fetching order bill', err);
        if (err.status === 404) {
          this.errorMessage.set('No se encontró la orden en el servidor.');
        } else {
          this.errorMessage.set('Error de conexión o fallo al recuperar el ticket.');
        }
      },
    });
  }

  /**
   * Toggles the bill text accordion and loads formatted text on first open
   */
  toggleBillText(): void {
    const opening = !this.isBillTextOpen();
    this.isBillTextOpen.set(opening);
    if (opening && !this.bill()?.formattedBillText) {
      this.loadFormattedBill();
    }
  }

  /**
   * Loads only the formattedBillText from the backend (lightweight refresh)
   */
  loadFormattedBill(): void {
    const orderId = this.table?.activeOrderId;
    if (!orderId) return;

    this.isLoadingTicket.set(true);

    this.http.get<BillSummary>(`${environment.apiUrl}/branches/${this.table?.branchId}/orders/${orderId}/bill`).subscribe({
      next: (data) => {
        // Merge only the formatted text into the existing bill state
        const current = this.bill();
        if (current) {
          // Los avisos en vivo rearman la cuenta sin estos datos: se toman de aquí.
          this.bill.set({
            ...current,
            formattedBillText: data.formattedBillText,
            telefonoCliente: data.telefonoCliente,
            cuentaEnviadaEn: data.cuentaEnviadaEn,
          });
        } else {
          this.bill.set(data);
        }
        this.isLoadingTicket.set(false);
      },
      error: (err) => {
        this.isLoadingTicket.set(false);
        console.error('Error fetching formatted bill text', err);
      },
    });
  }

  /**
   * Le manda la cuenta al cliente por WhatsApp: detalle, total y métodos de
   * pago. Si la mesa no tiene su número, primero lo pide.
   */
  async enviarCuenta(): Promise<void> {
    const b = this.bill();
    const orderId = this.table?.activeOrderId;
    if (!b || !orderId || this.enviandoCuenta()) return;
    this.errorCuenta.set(null);

    const escrito = this.pidiendoTelefono() ? this.telefonoCuenta().trim() : '';
    if (!escrito && !b.telefonoCliente) {
      this.pidiendoTelefono.set(true);
      return;
    }
    const destino = escrito || b.telefonoCliente;
    if (!(await this.avisos.confirmar({ titulo: `¿Enviar la cuenta de ${formatearPesos(b.totalAmount)}?`, mensaje: `Le llega al WhatsApp ${destino} con el detalle y las formas de pago.`, confirmar: 'Enviar cuenta' }))) return;

    this.enviandoCuenta.set(true);
    this.http
      .post<BillSummary>(`${environment.apiUrl}/branches/${this.table?.branchId}/orders/${orderId}/enviar-cuenta`,
        escrito ? { telefono: escrito } : {})
      .subscribe({
        next: (data) => {
          this.enviandoCuenta.set(false);
          this.pidiendoTelefono.set(false);
          this.telefonoCuenta.set('');
          this.bill.update((actual) => (actual ? { ...actual, ...data } : data));
        },
        error: (err) => {
          this.enviandoCuenta.set(false);
          const mensaje = err.error?.error || err.error?.message || 'No se pudo enviar la cuenta.';
          // Sin número registrado: se pide en el mismo panel.
          if (mensaje.includes('no tiene un WhatsApp')) this.pidiendoTelefono.set(true);
          this.errorCuenta.set(mensaje);
        },
      });
  }

  horaDe(fecha: string): string {
    return new Date(fecha).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  }

  /**
   * Opens a new order for a table that is currently AVAILABLE
   */
  openNewOrder(): void {
    if (!this.table) return;

    this.isActionLoading.set(true);
    this.errorMessage.set(null);

    const { branchId, tableNumber } = this.table;

    this.http.post<any>(`${environment.apiUrl}/branches/${branchId}/tables/${tableNumber}/open`, {}).subscribe({
      next: (res) => {
        this.isActionLoading.set(false);
        // Table is now occupied, update local model
        this.table!.status = TableStatus.OCCUPIED;
        this.table!.activeOrderId = res.id;
        // Trigger reload
        this.loadBill();
        this.refreshNeeded.emit();
      },
      error: (err) => {
        this.isActionLoading.set(false);
        console.error('Failed to open order', err);
        this.avisos.error(err.error?.message || 'Error al abrir la mesa.');
      },
    });
  }

  /**
   * Closes the current active order, releasing the table
   */
  async closeCurrentTable(): Promise<void> {
    const orderId = this.table?.activeOrderId;
    if (!orderId) return;

    if (!(await this.avisos.confirmar({ titulo: '¿Cerrar la mesa?', mensaje: 'La cuenta queda pagada y la mesa vuelve a estar libre.', confirmar: 'Cerrar mesa' }))) {
      return;
    }

    this.isActionLoading.set(true);

    this.http.post<any>(`${environment.apiUrl}/branches/${this.table?.branchId}/orders/${orderId}/close`, {}).subscribe({
      next: () => {
        this.isActionLoading.set(false);
        this.onClose();
        this.refreshNeeded.emit();
      },
      error: (err) => {
        this.isActionLoading.set(false);
        console.error('Failed to close order', err);
        this.avisos.error(err.error?.message || 'Error al cerrar la mesa.');
      },
    });
  }

  /**
   * Cancels the current active order, releasing the table and notifying the client via WhatsApp.
   */
  async cancelCurrentOrder(): Promise<void> {
    const orderId = this.table?.activeOrderId;
    const branchId = this.table?.branchId;
    if (!orderId || !branchId) return;

    if (!(await this.avisos.confirmar({ titulo: '¿Cancelar toda la orden?', mensaje: 'Se libera la mesa y se le avisa al cliente por WhatsApp.', confirmar: 'Cancelar orden', cancelar: 'Volver', peligro: true }))) {
      return;
    }

    this.isActionLoading.set(true);

    this.http.patch<any>(`${environment.apiUrl}/branches/${branchId}/orders/${orderId}/cancel`, {}).subscribe({
      next: () => {
        this.isActionLoading.set(false);
        this.avisos.exito('Orden cancelada.');
        this.onClose();
        this.refreshNeeded.emit();
      },
      error: (err) => {
        this.isActionLoading.set(false);
        console.error('Failed to cancel order', err);
        this.avisos.error(err.error?.message || 'Error al cancelar la orden.');
      },
    });
  }

  /**
   * Toggles the inline Add Product form and loads products list if not loaded yet
   */
  showAddProductForm(): void {
    this.isAddingProduct.set(true);
    // Clear form inputs
    this.newProductForm = {
      productId: '',
      quantity: 1,
      specialInstructions: '',
    };
    this.elegidos.set(new Set());
    this.cargarAdicionales();

    // Load active products list if empty
    if (this.productsList().length === 0) {
      this.http.get<Product[]>(`${environment.apiUrl}/products`).subscribe({
        next: (prods) => {
          // Solo lo activo, y los combos solo en los días de su promoción.
          const activeOnly = prods.filter((p) => p.active !== false && p.vigenteHoy !== false);
          this.productsList.set(activeOnly);
        },
        error: (err) => {
          console.error('Failed to load products list', err);
        },
      });
    }
  }

  /** "4 × Taco al pastor, 2 × Refresco" si el producto elegido es combo. */
  incluyeDe(productId: string): string | null {
    const p = this.productsList().find((x) => x.id === productId);
    if (!p?.isCombo || !p.comboItems?.length) return null;
    return p.comboItems.map((c) => `${c.cantidad} × ${c.nombre}`).join(', ');
  }

  /**
   * Los grupos salen del menú público de la sucursal, que ya los trae por
   * platillo: así el mesero y el cliente ven exactamente lo mismo.
   */
  private cargarAdicionales(): void {
    const branchId = this.table?.branchId;
    if (!branchId || this.gruposPorProducto().size > 0) return;
    this.http
      .get<{ items: { id: string; grupos?: GrupoAdicional[] }[] }[]>(`${environment.apiUrl}/public/branches/${branchId}/menu`)
      .subscribe({
        next: (menu) => {
          const mapa = new Map<string, GrupoAdicional[]>();
          menu.forEach((c) => c.items.forEach((i) => mapa.set(i.id, i.grupos ?? [])));
          this.gruposPorProducto.set(mapa);
        },
        error: (err) => console.error('No se pudieron cargar los adicionales', err),
      });
  }

  gruposDe(productId: string): GrupoAdicional[] {
    return productId ? this.gruposPorProducto().get(productId) ?? [] : [];
  }

  elegidosEn(grupo: GrupoAdicional): number {
    return grupo.opciones.filter((o) => this.elegidos().has(o.id)).length;
  }

  /** En un grupo de una sola opción, elegir otra reemplaza la anterior. */
  alternarAdicional(grupo: GrupoAdicional, opcionId: string): void {
    const set = new Set(this.elegidos());
    if (set.has(opcionId)) {
      set.delete(opcionId);
    } else if (grupo.maximo === 1) {
      grupo.opciones.forEach((o) => set.delete(o.id));
      set.add(opcionId);
    } else if (this.elegidosEn(grupo) < grupo.maximo) {
      set.add(opcionId);
    }
    this.elegidos.set(set);
  }

  /** Qué obligatorio falta, para decirlo en vez de dejar el botón gris sin más. */
  faltaAdicional(): string | null {
    for (const g of this.gruposDe(this.newProductForm.productId)) {
      if (this.elegidosEn(g) < g.minimo) return `Falta elegir ${g.nombre.toLowerCase()}`;
    }
    return null;
  }

  /** Al cambiar de platillo, lo marcado del anterior ya no aplica. */
  alCambiarProducto(): void {
    this.elegidos.set(new Set());
  }

  /**
   * Hides the Add Product inline form
   */
  hideAddProductForm(): void {
    this.isAddingProduct.set(false);
  }

  /**
   * Saves the product in the active order
   */
  saveAddedProduct(): void {
    const orderId = this.table?.activeOrderId;
    if (!orderId || !this.newProductForm.productId) return;

    this.isActionLoading.set(true);

    const payload = {
      items: [
        {
          productId: this.newProductForm.productId,
          quantity: this.newProductForm.quantity,
          specialInstructions: this.newProductForm.specialInstructions || '',
          // Solo los que son de este platillo; el precio lo pone el servidor.
          adicionales: this.gruposDe(this.newProductForm.productId)
            .flatMap((g) => g.opciones.map((o) => o.id))
            .filter((id) => this.elegidos().has(id)),
        },
      ],
    };

    this.http.post<any>(`${environment.apiUrl}/branches/${this.table?.branchId}/orders/${orderId}/items`, payload).subscribe({
      next: () => {
        this.isActionLoading.set(false);
        this.isAddingProduct.set(false);
        // Reload bill to show the new items and update total
        this.loadBill();
        // Emit refresh event to update dashboard parent (if it needs to show total changes)
        this.refreshNeeded.emit();
      },
      error: (err) => {
        this.isActionLoading.set(false);
        console.error('Failed to add items to order', err);
        this.avisos.error(err.error?.error || err.error?.message || 'Error al agregar productos.');
      },
    });
  }
}
