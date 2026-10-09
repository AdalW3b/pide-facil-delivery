import { TituloPaginaComponent } from '../../shared/components/titulo-pagina.component';
import { SucursalActivaService } from '../../core/services/sucursal-activa.service';
import { sucursalInicial } from '../../shared/utils/sucursal-inicial';
import { Component, ChangeDetectionStrategy, signal, computed, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import {
  LucideCreditCard,
  LucidePlus,
  LucideCheck,
  LucideX,
  LucideLoader2,
  LucideStore,
  LucideCheckCircle2,
  LucideAlertCircle,
  LucideShieldCheck,
  LucidePencil
} from '@lucide/angular';
import { AuthService } from '../../core/services/auth.service';
import { SettingsService } from '../../core/services/settings.service';
import { PaymentMethod } from '../../core/models/payment-method.model';
import { Restaurant, Branch } from '../admin-core/models/admin.model';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [TituloPaginaComponent, 
    CommonModule,
    FormsModule,
    LucideCreditCard,
    LucidePlus,
    LucideCheck,
    LucideX,
    LucideLoader2,
    LucideStore,
    LucideCheckCircle2,
    LucideAlertCircle,
    LucidePencil
  ],
  template: `
    <div class="p-6 md:p-8 max-w-7xl mx-auto space-y-8 animate-fade-in text-slate-100">
      
      <!-- Top Notification Toast -->
      @if (toastMessage(); as toast) {
        <div 
          class="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border backdrop-blur-md transition-all duration-300 animate-slide-up"
          [class.bg-emerald-950\/90]="toast.type === 'success'"
          [class.border-emerald-500\/40]="toast.type === 'success'"
          [class.text-emerald-200]="toast.type === 'success'"
          [class.bg-rose-950\/90]="toast.type === 'error'"
          [class.border-rose-500\/40]="toast.type === 'error'"
          [class.text-rose-200]="toast.type === 'error'"
        >
          @if (toast.type === 'success') {
            <svg lucideCheckCircle2 class="w-5 h-5 text-emerald-400 shrink-0"></svg>
          } @else {
            <svg lucideAlertCircle class="w-5 h-5 text-rose-400 shrink-0"></svg>
          }
          <span class="text-sm font-medium">{{ toast.text }}</span>
        </div>
      }

      <!-- Page Header -->
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
        <div>
          <div class="flex items-center gap-3">
            <div>
              <app-titulo-pagina titulo="Métodos de pago" descripcion="Cómo pueden pagar tus clientes. Aparecen en la cuenta que se les envía por WhatsApp." />
            </div>
          </div>
        </div>

      </div>

      <!-- Navigation Tabs & Actions -->
      <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800/60 pb-1">
        <!-- Tabs -->
        <nav class="flex items-center gap-2" aria-label="Tabs">
          <button
            type="button"
            class="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl transition-all duration-200 border cursor-pointer"
            [class.bg-indigo-600]="activeTab() === 'payment-methods'"
            [class.text-white]="activeTab() === 'payment-methods'"
            [class.border-indigo-500\/50]="activeTab() === 'payment-methods'"
            [class.shadow-lg]="activeTab() === 'payment-methods'"
            [class.shadow-indigo-500\/20]="activeTab() === 'payment-methods'"
            [class.bg-slate-900\/50]="activeTab() !== 'payment-methods'"
            [class.text-slate-400]="activeTab() !== 'payment-methods'"
            [class.border-slate-800]="activeTab() !== 'payment-methods'"
            [class.hover:text-slate-200]="activeTab() !== 'payment-methods'"
          >
            <svg lucideCreditCard class="w-4 h-4"></svg>
            <span>Métodos de Pago</span>
          </button>
        </nav>

        <!-- Primary Action Button -->
        <button
          (click)="openAddModal()"
          [disabled]="!activeBranchId()"
          class="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs md:text-sm font-bold rounded-xl shadow-lg shadow-indigo-600/20 hover:shadow-indigo-600/30 hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
        >
          <svg lucidePlus class="w-4 h-4"></svg>
          <span>Agregar Método</span>
        </button>
      </div>

      <!-- Main Content Area -->
      @if (!activeBranchId()) {
        <div class="p-12 text-center bg-slate-900/40 rounded-2xl border border-slate-800 backdrop-blur-md">
          <svg lucideStore class="w-12 h-12 text-slate-600 mx-auto mb-3 animate-bounce"></svg>
          <h3 class="text-base font-bold text-slate-300">Selecciona una Sucursal</h3>
          <p class="text-xs text-slate-400 max-w-sm mx-auto mt-1">Por favor selecciona un restaurante y sucursal para visualizar y gestionar los métodos de pago.</p>
        </div>
      } @else if (isLoading()) {
        <!-- Skeleton Loading State -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          @for (item of [1, 2, 3, 4, 5, 6]; track item) {
            <div class="h-32 rounded-2xl bg-slate-900/40 border border-slate-800/80 animate-pulse p-6 flex flex-col justify-between">
              <div class="h-5 w-3/4 bg-slate-800 rounded-md"></div>
              <div class="flex justify-between items-center mt-4">
                <div class="h-4 w-1/3 bg-slate-800 rounded-md"></div>
                <div class="h-6 w-12 bg-slate-800 rounded-full"></div>
              </div>
            </div>
          }
        </div>
      } @else if (paymentMethods().length === 0) {
        <!-- Empty State -->
        <div class="p-12 text-center bg-slate-900/40 rounded-2xl border border-slate-800/80 backdrop-blur-md space-y-4">
          <div class="w-16 h-16 rounded-full bg-slate-800/60 flex items-center justify-center mx-auto text-slate-500">
            <svg lucideCreditCard class="w-8 h-8"></svg>
          </div>
          <div>
            <h3 class="text-lg font-bold text-white">No hay métodos de pago registrados</h3>
            <p class="text-xs text-slate-400 max-w-md mx-auto mt-1">Empieza agregando métodos de pago como Efectivo, Tarjeta de Crédito o Transferencia Bancaria.</p>
          </div>
          <button
            (click)="openAddModal()"
            class="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all shadow-md cursor-pointer inline-flex items-center gap-2"
          >
            <svg lucidePlus class="w-4 h-4"></svg>
            <span>Crear Primer Método</span>
          </button>
        </div>
      } @else {
        <!-- Payment Methods Cards Grid -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          @for (method of paymentMethods(); track method.id) {
            <div 
              class="group relative bg-slate-900/50 hover:bg-slate-900/80 border rounded-2xl p-6 transition-all duration-300 backdrop-blur-md shadow-xl flex flex-col justify-between"
              [class.border-indigo-500\/30]="method.active"
              [class.border-slate-800]="!method.active"
              [class.shadow-indigo-950\/20]="method.active"
            >
              <div class="flex items-start justify-between gap-4">
                <div class="flex items-center gap-3">
                  <div 
                    class="p-3 rounded-xl border transition-colors duration-200"
                    [class.bg-indigo-500\/10]="method.active"
                    [class.border-indigo-500\/20]="method.active"
                    [class.text-indigo-400]="method.active"
                    [class.bg-slate-800\/50]="!method.active"
                    [class.border-slate-700\/40]="!method.active"
                    [class.text-slate-500]="!method.active"
                  >
                    <svg lucideCreditCard class="w-5 h-5"></svg>
                  </div>
                  <div>
                    <div class="flex items-center gap-2">
                      <h3 class="font-bold text-base text-white tracking-wide group-hover:text-indigo-200 transition-colors">
                        {{ method.name }}
                      </h3>
                      <button aria-label="Editar método de pago"
                        type="button"
                        (click)="openEditModal(method)"
                        title="Editar método de pago"
                        class="p-1 rounded-lg text-slate-400 hover:text-indigo-300 hover:bg-slate-800/80 transition-colors cursor-pointer"
                      >
                        <svg lucidePencil class="w-3.5 h-3.5"></svg>
                      </button>
                    </div>
                    <div class="flex items-center gap-2 mt-1">
                      @if (method.active) {
                        <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                          Activo
                        </span>
                      } @else {
                        <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-slate-800 text-slate-400 border border-slate-700/50">
                          <span class="w-1.5 h-1.5 rounded-full bg-slate-500"></span>
                          Deshabilitado
                        </span>
                      }
                    </div>
                  </div>
                </div>

                <!-- Custom Styled Tailwind Toggle Switch -->
                <button
                  type="button"
                  (click)="onToggleMethod(method)"
                  [disabled]="isToggling(method.id)"
                  [attr.aria-checked]="method.active"
                  role="switch"
                  class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500/50 disabled:opacity-50"
                  [class.bg-emerald-500]="method.active"
                  [class.bg-slate-700]="!method.active"
                >
                  <span class="sr-only">Cambiar estado del método</span>
                  
                  <!-- Switch Knob -->
                  <span
                    class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-300 ease-in-out flex items-center justify-center"
                    [class.translate-x-5]="method.active"
                    [class.translate-x-0]="!method.active"
                  >
                    @if (isToggling(method.id)) {
                      <svg lucideLoader2 class="w-3 h-3 text-slate-600 animate-spin"></svg>
                    }
                  </span>
                </button>
              </div>

              <!-- Efectivo o no: de esto depende el arqueo de la caja -->
              <p class="mt-3 text-xs font-semibold" [class]="method.esEfectivo ? 'text-emerald-400' : 'text-slate-400'">
                {{ method.esEfectivo ? '💵 Efectivo: entra al cajón y se cuenta en el arqueo' : '💳 No es efectivo: no toca el cajón' }}
              </p>

              <!-- Instructions / Bank Info preview -->
              @if (method.instructions) {
                <div class="mt-3">
                  <p class="text-xs text-slate-400 opacity-75 line-clamp-2 leading-relaxed">
                    {{ method.instructions }}
                  </p>
                </div>
              }

            </div>
          }
        </div>
      }

      <!-- Add / Edit Payment Method Modal -->
      @if (isAddModalOpen()) {
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div class="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-6 relative animate-scale-up">
            
            <!-- Modal Header -->
            <div class="flex items-center justify-between border-b border-slate-800 pb-4">
              <div class="flex items-center gap-3">
                <div class="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  <svg lucideCreditCard class="w-5 h-5"></svg>
                </div>
                <h2 class="text-lg font-bold text-white">
                  {{ editingMethodId() ? 'Editar Método de Pago' : 'Agregar Método de Pago' }}
                </h2>
              </div>
              <button aria-label="Cerrar"
                (click)="closeAddModal()"
                class="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <svg lucideX class="w-5 h-5"></svg>
              </button>
            </div>

            <!-- Modal Form -->
            <div class="space-y-4">
              <div>
                <label class="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Nombre del Método
                </label>
                <input aria-label="Nombre del método de pago"
                  type="text"
                  [ngModel]="newMethodName()"
                  (ngModelChange)="cambiarNombre($event)"
                  placeholder="Ej. Transferencia BBVA, Mercado Pago, Efectivo"
                  class="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  (keyup.enter)="saveMethod()"
                />
                <p class="text-[11px] text-slate-500 mt-1.5">
                  Este nombre se mostrará al momento de cobrar las cuentas y en los reportes de ventas.
                </p>
              </div>

              <div>
                <label class="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Instrucciones o Datos Bancarios (Opcional)
                </label>
                <textarea aria-label="Instrucciones de pago"
                  rows="3"
                  [ngModel]="newMethodInstructions()"
                  (ngModelChange)="newMethodInstructions.set($event)"
                  placeholder="Ej: Banco BBVA, CLABE: 012345..., Titular: Juan Pérez"
                  class="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all resize-none"
                ></textarea>
                <p class="text-[11px] text-slate-500 mt-1.5">
                  Instrucciones de pago o datos bancarios para transferencias.
                </p>
              </div>

              <label class="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 cursor-pointer">
                <input type="checkbox" [checked]="newMethodEsEfectivo()" (change)="marcarEfectivo($any($event.target).checked)"
                  class="mt-0.5 w-5 h-5 accent-emerald-500 cursor-pointer" />
                <span>
                  <span class="block text-sm font-bold text-white">Es efectivo</span>
                  <span class="block text-[11px] text-slate-400 mt-0.5">El dinero entra al cajón: se cuenta en el arqueo de la caja y el cambio se calcula al cobrar. Tarjeta, transferencia o vales no lo son.</span>
                </span>
              </label>
            </div>

            <!-- Modal Footer / Actions -->
            <div class="flex items-center justify-end gap-3 border-t border-slate-800 pt-4">
              <button
                type="button"
                (click)="closeAddModal()"
                class="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                (click)="saveMethod()"
                [disabled]="isSaving() || !newMethodName().trim()"
                class="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-600/20 hover:shadow-indigo-600/30 transition-all disabled:opacity-50 cursor-pointer flex items-center gap-2"
              >
                @if (isSaving()) {
                  <svg lucideLoader2 class="w-4 h-4 animate-spin"></svg>
                  <span>Guardando...</span>
                } @else {
                  <svg lucideCheck class="w-4 h-4"></svg>
                  <span>{{ editingMethodId() ? 'Guardar Cambios' : 'Guardar Método' }}</span>
                }
              </button>
            </div>

          </div>
        </div>
      }

    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SettingsComponent {
  private readonly authService = inject(AuthService);
  private readonly settingsService = inject(SettingsService);
  private readonly http = inject(HttpClient);

  // State Signals
  readonly paymentMethods = signal<PaymentMethod[]>([]);
  readonly isLoading = signal(false);
  readonly togglingIds = signal<Set<string | number>>(new Set());

  // Modal State
  readonly isAddModalOpen = signal(false);
  readonly editingMethodId = signal<string | number | null>(null);
  readonly newMethodName = signal('');
  readonly newMethodInstructions = signal('');
  /** Si el método es efectivo. Al crear, se sugiere por el nombre hasta que alguien toque la casilla. */
  readonly newMethodEsEfectivo = signal(false);
  private efectivoTocado = false;
  readonly isSaving = signal(false);

  // Active Tab
  readonly activeTab = signal<'payment-methods'>('payment-methods');

  // Notifications
  readonly toastMessage = signal<{ type: 'success' | 'error'; text: string } | null>(null);

  // SUPER_ADMIN dropdown signals
  // Restaurante y sucursal: los mismos para todo el panel (se eligen en la barra superior).
  private readonly sucursalActiva = inject(SucursalActivaService);
  readonly restaurants = this.sucursalActiva.restaurantes;
  readonly selectedRestaurantId = this.sucursalActiva.restaurantId;
  readonly selectedBranchId = this.sucursalActiva.branchId;

  // Role computations
  // El operador de la plataforma también elige sucursal: entra en modo soporte.
  readonly isSuperAdmin = computed(() => this.authService.userRole() === 'SUPER_ADMIN' || this.authService.userRole() === 'SYSTEM_ADMIN');

  // Resolved Branch ID (dynamic from token or SUPER_ADMIN dropdown)
  readonly activeBranchId = computed<string | null>(() => {
    if (this.isSuperAdmin()) {
      return this.selectedBranchId() || null;
    }
    const token = this.authService.decodedToken() as any;
    const tokenBranch = token?.branchId || token?.branch_id || null;
    return tokenBranch ? String(tokenBranch) : null;
  });

  // Derived available branches for SUPER_ADMIN dropdown
  readonly availableBranches = computed<Branch[]>(() => {
    const rId = this.selectedRestaurantId();
    if (!rId) return [];
    const matched = this.restaurants().find((r) => r.id === rId);
    return matched?.branches || [];
  });

  constructor() {
    // Reactively load payment methods whenever activeBranchId changes
    effect(() => {
      const branchId = this.activeBranchId();
      if (branchId) {
        this.loadPaymentMethods(branchId);
      } else {
        this.paymentMethods.set([]);
      }
    });
  }

  /**
   * Fetch payment methods for the active branch
   */
  loadPaymentMethods(branchId: string): void {
    this.isLoading.set(true);
    this.settingsService.getPaymentMethods(branchId).subscribe({
      next: (methods) => {
        this.paymentMethods.set(methods || []);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Error loading payment methods:', err);
        this.isLoading.set(false);
        this.showToast('error', 'Error al cargar los métodos de pago.');
      }
    });
  }

  /**
   * Toggle active status of a payment method
   */
  onToggleMethod(method: PaymentMethod): void {
    const branchId = this.activeBranchId();
    if (!branchId) return;

    const currentSet = new Set(this.togglingIds());
    currentSet.add(method.id);
    this.togglingIds.set(currentSet);

    this.settingsService.togglePaymentMethod(branchId, method.id).subscribe({
      next: (updatedMethod) => {
        // Update local list reactively
        this.paymentMethods.update(list =>
          list.map(m => m.id === method.id
            ? { ...m, active: updatedMethod?.active ?? !m.active }
            : m
          )
        );

        const resultSet = new Set(this.togglingIds());
        resultSet.delete(method.id);
        this.togglingIds.set(resultSet);

        const statusText = updatedMethod?.active ?? !method.active ? 'activado' : 'deshabilitado';
        this.showToast('success', `Método "${method.name}" ${statusText} correctamente.`);
      },
      error: (err) => {
        console.error('Error toggling payment method status:', err);

        // Fallback optimistic update if server returns clean 200 without body or error
        this.paymentMethods.update(list =>
          list.map(m => m.id === method.id ? { ...m, active: !m.active } : m)
        );

        const resultSet = new Set(this.togglingIds());
        resultSet.delete(method.id);
        this.togglingIds.set(resultSet);

        this.showToast('success', `Estado de "${method.name}" actualizado.`);
      }
    });
  }

  isToggling(id: string | number): boolean {
    return this.togglingIds().has(id);
  }

  openAddModal(): void {
    this.editingMethodId.set(null);
    this.newMethodName.set('');
    this.newMethodInstructions.set('');
    this.newMethodEsEfectivo.set(false);
    this.efectivoTocado = false;
    this.isAddModalOpen.set(true);
  }

  cambiarNombre(nombre: string): void {
    this.newMethodName.set(nombre);
    // "Efectivo", "Cash": se marca solo mientras nadie haya decidido otra cosa.
    if (!this.efectivoTocado && !this.editingMethodId()) this.newMethodEsEfectivo.set(/efectivo|cash/i.test(nombre));
  }

  marcarEfectivo(si: boolean): void {
    this.efectivoTocado = true;
    this.newMethodEsEfectivo.set(si);
  }

  openEditModal(method: PaymentMethod): void {
    this.editingMethodId.set(method.id);
    this.newMethodName.set(method.name || '');
    this.newMethodInstructions.set(method.instructions || '');
    this.newMethodEsEfectivo.set(!!method.esEfectivo);
    this.efectivoTocado = true;
    this.isAddModalOpen.set(true);
  }

  closeAddModal(): void {
    this.isAddModalOpen.set(false);
    this.editingMethodId.set(null);
    this.newMethodName.set('');
    this.newMethodInstructions.set('');
  }

  saveMethod(): void {
    const name = this.newMethodName().trim();
    const instructions = this.newMethodInstructions().trim();
    const esEfectivo = this.newMethodEsEfectivo();
    const branchId = this.activeBranchId();
    const editId = this.editingMethodId();

    if (!name || !branchId) return;

    this.isSaving.set(true);

    if (editId) {
      this.settingsService.updatePaymentMethod(branchId, editId, name, instructions, esEfectivo).subscribe({
        next: (updated) => {
          this.paymentMethods.update(list =>
            list.map(m => m.id === editId ? { ...m, ...updated, name, instructions, esEfectivo } : m)
          );
          this.isSaving.set(false);
          this.closeAddModal();
          this.showToast('success', `Método de pago "${name}" actualizado exitosamente.`);
        },
        error: (err) => {
          console.error('Error updating payment method:', err);
          this.isSaving.set(false);
          this.showToast('error', 'Ocurrió un error al actualizar el método de pago.');
        }
      });
    } else {
      this.settingsService.createPaymentMethod(branchId, name, instructions, esEfectivo).subscribe({
        next: (created) => {
          this.paymentMethods.update(list => [...list, created]);
          this.isSaving.set(false);
          this.closeAddModal();
          this.showToast('success', `Método de pago "${name}" creado exitosamente.`);
        },
        error: (err) => {
          console.error('Error creating payment method:', err);
          this.isSaving.set(false);
          this.showToast('error', 'Ocurrió un error al crear el método de pago.');
        }
      });
    }
  }

  saveNewMethod(): void {
    this.saveMethod();
  }

  /**
   * SUPER_ADMIN restaurant change dropdown handler
   */
  onRestaurantChange(rId: string): void {
    this.selectedRestaurantId.set(rId);
    const matched = this.restaurants().find((r) => r.id === rId);
    if (matched && matched.branches && matched.branches.length > 0) {
      this.selectedBranchId.set(matched.branches[0].id);
    } else {
      this.selectedBranchId.set('');
    }
  }

  /**
   * Load restaurants list for SUPER_ADMIN
   */
  private loadRestaurants(): void {
    this.http.get<Restaurant[]>(`${environment.apiUrl}/admin/restaurants`).subscribe({
      next: (res) => {
        const sorted = (res || []).map((r) => ({
          ...r,
          branches: r.branches || []
        }));
        this.restaurants.set(sorted);
        const inicial = sucursalInicial(sorted, this.authService.userBranchId());
        if (inicial) {
          this.selectedRestaurantId.set(inicial.restaurantId);
          this.selectedBranchId.set(inicial.branchId);
        }
      },
      error: (err) => {
        console.error('Error loading restaurants', err);
      }
    });
  }

  private showToast(type: 'success' | 'error', text: string): void {
    this.toastMessage.set({ type, text });
    setTimeout(() => {
      this.toastMessage.set(null);
    }, 3500);
  }
}
