import { TituloPaginaComponent } from '../../shared/components/titulo-pagina.component';
import {
  Component,
  ChangeDetectionStrategy,
  signal,
  computed,
  inject,
  OnInit,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Restaurant, Branch } from './models/admin.model';
import { CreateRestaurantWizardComponent } from './create-restaurant-wizard.component';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/services/auth.service';

const API = environment.apiUrl;

@Component({
  selector: 'app-super-admin-dashboard',
  standalone: true,
  imports: [TituloPaginaComponent, CommonModule, ReactiveFormsModule, CreateRestaurantWizardComponent],
  template: `
    <div class="space-y-8">

      <!-- Page Header -->
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <app-titulo-pagina titulo="Super Admin" descripcion="Restaurantes, sucursales y usuarios de toda la plataforma." />
        </div>
        <div class="flex items-center gap-3">
          <!-- Refresh button -->
          <button
            (click)="loadRestaurants()"
            [disabled]="isLoading()"
            class="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl text-sm font-semibold transition-all duration-200 cursor-pointer disabled:opacity-50"
          >
            <svg [class.animate-spin]="isLoading()" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 15.228M15 11.23h5.25v5.25" />
            </svg>
            <span>Actualizar</span>
          </button>
          <!-- Create Restaurant: solo el operador de la plataforma; al dueno el backend le responde 403 -->
          @if (isSystemAdmin()) {
          <button
            id="btn-create-restaurant"
            (click)="openWizard()"
            class="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm rounded-xl shadow-lg shadow-indigo-600/15 hover:shadow-indigo-500/25 transition-all duration-200 cursor-pointer"
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            <span>Crear Restaurante</span>
          </button>
          }
        </div>
      </div>

      <!-- Stats Summary Row -->
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div class="p-5 bg-slate-900/50 border border-slate-800/80 rounded-2xl backdrop-blur-sm">
          <p class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Restaurantes</p>
          <p class="text-3xl font-black text-white">{{ totalRestaurants() }}</p>
        </div>
        <div class="p-5 bg-slate-900/50 border border-slate-800/80 rounded-2xl backdrop-blur-sm">
          <p class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Sucursales</p>
          <p class="text-3xl font-black text-indigo-400">{{ totalBranches() }}</p>
        </div>
        <div class="p-5 bg-slate-900/50 border border-slate-800/80 rounded-2xl backdrop-blur-sm col-span-2 sm:col-span-1">
          <p class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Con WhatsApp</p>
          <p class="text-3xl font-black text-emerald-400">{{ branchesWithWhatsapp() }}</p>
        </div>
      </div>

      <!-- Data Table -->
      <div class="bg-slate-900/50 border border-slate-800/80 rounded-2xl backdrop-blur-sm overflow-hidden">
        <!-- Table Header -->
        <div class="px-6 py-4 border-b border-slate-800/80 flex items-center justify-between">
          <h2 class="text-sm font-bold text-slate-400 uppercase tracking-wider">Todos los Restaurantes</h2>
          <span class="text-[11px] text-slate-600">
            {{ totalRestaurants() }} restaurante(s) · {{ totalBranches() }} sucursal(es)
          </span>
        </div>

        <!-- Loading state -->
        @if (isLoading()) {
          <div class="py-20 flex flex-col items-center justify-center gap-3">
            <svg class="animate-spin h-8 w-8 text-indigo-500" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span class="text-xs text-slate-400">Cargando datos...</span>
          </div>
        }

        <!-- Error state -->
        @if (!isLoading() && errorMessage()) {
          <div class="py-12 flex flex-col items-center justify-center text-center gap-3 px-6">
            <div class="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
              <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <p class="text-sm font-bold text-white">Error al cargar datos</p>
              <p class="text-xs text-slate-400 mt-1 max-w-xs">{{ errorMessage() }}</p>
            </div>
            <button (click)="loadRestaurants()" class="px-4 py-1.5 text-xs font-semibold text-rose-400 border border-rose-500/20 rounded-xl hover:bg-rose-500/10 cursor-pointer transition-colors">
              Reintentar
            </button>
          </div>
        }

        <!-- Empty state -->
        @if (!isLoading() && !errorMessage() && restaurants().length === 0) {
          <div class="py-16 flex flex-col items-center justify-center text-center gap-3">
            <svg class="w-12 h-12 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
              <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 2.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .415.336.75.75.75z" />
            </svg>
            <p class="text-sm font-bold text-slate-500">No hay restaurantes registrados</p>
            <p class="text-xs text-slate-600">Haz clic en "Crear Restaurante" para comenzar.</p>
          </div>
        }

        <!-- Data Table -->
        @if (!isLoading() && !errorMessage() && restaurants().length > 0) {
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b border-slate-800/60">
                  <th class="text-left py-3 px-6 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Restaurante</th>
                  <th class="text-left py-3 px-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Sucursal</th>
                  <th class="text-left py-3 px-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider hidden lg:table-cell">Dirección</th>
                  <th class="text-left py-3 px-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider hidden xl:table-cell">WhatsApp</th>
                  <th class="text-center py-3 px-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Estado</th>
                  <th class="text-right py-3 px-6 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-800/40">
                @for (restaurant of restaurants(); track restaurant.id) {

                  @if (restaurant.branches.length === 0) {
                    <!-- Restaurant row with NO branches -->
                    <tr class="hover:bg-slate-800/20 transition-colors group">
                      <td class="py-4 px-6">
                        <div class="flex items-center gap-3">
                          <div class="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400 font-bold text-xs shrink-0">
                            {{ restaurant.name.charAt(0).toUpperCase() }}
                          </div>
                          <div>
                            <p class="font-bold text-white">{{ restaurant.name }}</p>
                            <p class="text-[11px] text-slate-600 font-mono mt-0.5">{{ restaurant.id | slice:0:8 }}...</p>
                          </div>
                        </div>
                      </td>
                      <td class="py-4 px-4 text-slate-400 italic text-xs" colspan="3">Sin sucursales registradas</td>
                      <td class="py-4 px-4 text-center">
                        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                          Activo
                        </span>
                      </td>
                      <td class="py-4 px-6 text-right">
                        <button
                          (click)="openAddBranch(restaurant)"
                          class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600/10 hover:bg-indigo-600/20 border border-indigo-500/20 hover:border-indigo-500/40 text-indigo-400 hover:text-indigo-300 text-[11px] font-semibold rounded-lg transition-all duration-200 cursor-pointer"
                        >
                          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
                          </svg>
                          Agregar Sucursal
                        </button>
                      </td>
                    </tr>
                  }

                  @for (branch of restaurant.branches; track branch.id; let branchIdx = $index) {
                    <tr class="hover:bg-slate-800/20 transition-colors group">
                      <!-- Restaurant name only on first row -->
                      <td class="py-4 px-6 align-middle">
                        @if (branchIdx === 0) {
                          <div class="flex items-center gap-3">
                            <div class="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400 font-bold text-xs shrink-0">
                              {{ restaurant.name.charAt(0).toUpperCase() }}
                            </div>
                            <div>
                              <p class="font-bold text-white">{{ restaurant.name }}</p>
                              <p class="text-[11px] text-slate-600 font-mono mt-0.5">{{ restaurant.id | slice:0:8 }}...</p>
                            </div>
                          </div>
                        }
                      </td>
                      <!-- Branch data -->
                      <td class="py-4 px-4">
                        <div class="flex items-center gap-2">
                          <div class="w-1.5 h-1.5 rounded-full bg-slate-700 group-hover:bg-indigo-500 transition-colors shrink-0"></div>
                          <div>
                            <p class="font-semibold text-slate-200">{{ branch.name }}</p>
                            <p class="text-[11px] text-slate-600 font-mono mt-0.5">{{ branch.id | slice:0:8 }}...</p>
                          </div>
                        </div>
                      </td>
                      <td class="py-4 px-4 text-xs text-slate-400 hidden lg:table-cell max-w-xs truncate">
                        {{ branch.address || '—' }}
                      </td>
                      <td class="py-4 px-4 hidden xl:table-cell">
                        @if (branch.whatsappNumber) {
                          <span class="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400">
                            <svg class="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                            </svg>
                            {{ branch.whatsappNumber }}
                          </span>
                        } @else {
                          <span class="text-slate-700 text-xs">—</span>
                        }
                      </td>
                      <td class="py-4 px-4 text-center">
                        @if (branch.active) {
                          <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                            Activa
                          </span>
                        } @else {
                          <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-700/30 text-slate-500 border border-slate-700/40">
                            <span class="w-1.5 h-1.5 rounded-full bg-slate-600"></span>
                            Inactiva
                          </span>
                        }
                      </td>
                      <!-- "+" button only on the LAST branch row of each restaurant -->
                      <td class="py-4 px-6 text-right">
                        @if (branchIdx === restaurant.branches.length - 1) {
                          <button
                            (click)="openAddBranch(restaurant)"
                            class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600/10 hover:bg-indigo-600/20 border border-indigo-500/20 hover:border-indigo-500/40 text-indigo-400 hover:text-indigo-300 text-[11px] font-semibold rounded-lg transition-all duration-200 cursor-pointer"
                          >
                            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                              <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
                            </svg>
                            Agregar Sucursal
                          </button>
                        }
                      </td>
                    </tr>
                  }
                }
              </tbody>
            </table>
          </div>
        }
      </div>
    </div>

    <!-- Create Restaurant Wizard -->
    @if (showWizard()) {
      <app-create-restaurant-wizard
        (wizardDone)="onWizardDone()"
        (wizardCancel)="closeWizard()"
      ></app-create-restaurant-wizard>
    }

    <!-- Add Branch Modal -->
    @if (addBranchTarget()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div (click)="closeAddBranch()" class="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"></div>
        <div class="relative z-10 w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl shadow-black/60 animate-slideUp overflow-hidden">

          <!-- Modal Header -->
          <div class="px-6 pt-6 pb-5 border-b border-slate-800/80 flex items-start justify-between gap-3">
            <div>
              <h3 class="text-base font-extrabold text-white">Agregar Sucursal</h3>
              <p class="text-xs text-slate-400 mt-0.5">
                Restaurante: <span class="font-semibold text-violet-400">{{ addBranchTarget()!.name }}</span>
              </p>
            </div>
            <button aria-label="Cerrar" (click)="closeAddBranch()" class="p-1.5 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-white transition-colors cursor-pointer shrink-0">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Modal Body -->
          <form [formGroup]="branchForm" (ngSubmit)="submitAddBranch()" class="p-6 space-y-4">

            <!-- Branch name -->
            <div>
              <label for="newBranchName" class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Nombre de la Sucursal <span class="text-rose-500">*</span>
              </label>
              <input
                id="newBranchName"
                formControlName="name"
                type="text"
                placeholder="ej. Sucursal Norte"
                class="w-full bg-slate-950/50 border border-slate-800 rounded-xl py-2.5 px-4 text-sm text-white placeholder-slate-600 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all"
              />
              @if (branchForm.get('name')?.touched && branchForm.get('name')?.hasError('required')) {
                <p class="text-rose-400 text-[11px] mt-1 ml-1">El nombre es requerido.</p>
              }
            </div>

            <!-- Address -->
            <div>
              <label for="newBranchAddress" class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Dirección</label>
              <input
                id="newBranchAddress"
                formControlName="address"
                type="text"
                placeholder="ej. Av. Insurgentes 123, Col. Roma"
                class="w-full bg-slate-950/50 border border-slate-800 rounded-xl py-2.5 px-4 text-sm text-white placeholder-slate-600 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all"
              />
            </div>

            <!-- WhatsApp -->
            <div>
              <label for="newBranchWa" class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Número WhatsApp</label>
              <div class="relative">
                <span class="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-500 text-sm">+</span>
                <input
                  id="newBranchWa"
                  formControlName="whatsappNumber"
                  type="tel"
                  placeholder="521234567890"
                  class="w-full bg-slate-950/50 border border-slate-800 rounded-xl py-2.5 pl-7 pr-4 text-sm text-white placeholder-slate-600 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all"
                />
              </div>
              @if (branchForm.get('whatsappNumber')?.touched && branchForm.get('whatsappNumber')?.hasError('pattern')) {
                <p class="text-rose-400 text-[11px] mt-1 ml-1">Formato inválido. Incluye código de país. Ej: 521234567890</p>
              }
            </div>

            <!-- HTTP error -->
            @if (branchHttpError()) {
              <div class="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs">
                {{ branchHttpError() }}
              </div>
            }

            <!-- Footer buttons -->
            <div class="flex gap-3 pt-2">
              <button
                type="button"
                (click)="closeAddBranch()"
                class="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-semibold transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                id="btn-save-branch"
                type="submit"
                [disabled]="branchForm.invalid || isBranchSaving()"
                class="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold shadow-md shadow-indigo-600/10 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer"
              >
                @if (isBranchSaving()) {
                  <span class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  <span>Guardando...</span>
                } @else {
                  <span>Crear Sucursal</span>
                }
              </button>
            </div>
          </form>
        </div>
      </div>
    }
  `,
  styles: [`
    @keyframes slideUp {
      from { opacity: 0; transform: translateY(12px) scale(0.98); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }
    .animate-slideUp { animation: slideUp 0.2s ease-out forwards; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SuperAdminDashboardComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly fb   = inject(FormBuilder);
  private readonly authService = inject(AuthService);

  readonly isSystemAdmin = computed(() => this.authService.userRole() === 'SYSTEM_ADMIN');

  // ─── Main Table State ─────────────────────────────────────────────────────
  readonly restaurants  = signal<Restaurant[]>([]);
  readonly isLoading    = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly showWizard   = signal(false);

  // ─── Computed Stats ───────────────────────────────────────────────────────
  readonly totalRestaurants = computed(() => this.restaurants().length);

  readonly totalBranches = computed(() =>
    this.restaurants().reduce((acc, r) => acc + r.branches.length, 0)
  );

  readonly branchesWithWhatsapp = computed(() =>
    this.restaurants()
      .flatMap(r => r.branches)
      .filter(b => !!b.whatsappNumber)
      .length
  );

  // ─── Add Branch Modal State ───────────────────────────────────────────────
  readonly addBranchTarget  = signal<Restaurant | null>(null);
  readonly isBranchSaving   = signal(false);
  readonly branchHttpError  = signal<string | null>(null);

  readonly branchForm = this.fb.group({
    name          : ['', [Validators.required, Validators.maxLength(100)]],
    address       : [''],
    whatsappNumber: ['', [Validators.pattern(/^\+?[1-9]\d{6,14}$/)]],
  });

  // ─── Lifecycle ────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.loadRestaurants();
  }

  // ─── Data ─────────────────────────────────────────────────────────────────
  loadRestaurants(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.http.get<Restaurant[]>(`${API}/admin/restaurants`).subscribe({
      next: (data) => {
        this.restaurants.set(data.sort((a, b) => a.name.localeCompare(b.name)));
        this.isLoading.set(false);
      },
      error: (err) => {
        this.isLoading.set(false);
        if (err.status === 0) {
          this.errorMessage.set('No se pudo conectar con el servidor backend.');
        } else if (err.status === 403) {
          this.errorMessage.set('No tienes permisos para acceder a este recurso (requiere SUPER_ADMIN).');
        } else {
          this.errorMessage.set(err.error?.message || 'Error al cargar los datos.');
        }
      },
    });
  }

  // ─── Restaurant Wizard ────────────────────────────────────────────────────
  openWizard() : void { this.showWizard.set(true);  }
  closeWizard(): void { this.showWizard.set(false); }

  onWizardDone(): void {
    this.closeWizard();
    this.loadRestaurants();
  }

  // ─── Add Branch Modal ─────────────────────────────────────────────────────
  openAddBranch(restaurant: Restaurant): void {
    this.addBranchTarget.set(restaurant);
    this.branchForm.reset();
    this.branchHttpError.set(null);
  }

  closeAddBranch(): void {
    this.addBranchTarget.set(null);
    this.branchHttpError.set(null);
  }

  submitAddBranch(): void {
    this.branchForm.markAllAsTouched();
    const target = this.addBranchTarget();
    if (this.branchForm.invalid || !target || this.isBranchSaving()) return;

    this.isBranchSaving.set(true);
    this.branchHttpError.set(null);

    const { name, address, whatsappNumber } = this.branchForm.value;
    const payload = {
      name,
      address: address || null,
      whatsappNumber: whatsappNumber ? `+${whatsappNumber.replace(/^\+/, '')}` : null,
    };

    this.http.post<Branch>(`${API}/admin/restaurants/${target.id}/branches`, payload).subscribe({
      next: () => {
        this.isBranchSaving.set(false);
        this.closeAddBranch();
        this.loadRestaurants(); // refresh table
      },
      error: (err) => {
        this.isBranchSaving.set(false);
        this.branchHttpError.set(err.error?.message || 'Error al crear la sucursal.');
      },
    });
  }
}
