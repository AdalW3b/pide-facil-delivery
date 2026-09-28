import {
  Component,
  ChangeDetectionStrategy,
  signal,
  computed,
  inject,
  Output,
  EventEmitter,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { Subscription } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { ReactiveFormsModule, FormBuilder, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Restaurant, Branch, CreatedUser } from './models/admin.model';
import { environment } from '../../../environments/environment';

const API = environment.apiUrl;

// ─── Custom Validators ────────────────────────────────────────────────────────

function passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
  const password = control.get('password');
  const confirm  = control.get('confirmPassword');
  if (password && confirm && password.value !== confirm.value) {
    confirm.setErrors({ mismatch: true });
    return { mismatch: true };
  }
  return null;
}

// ─── Component ────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-create-restaurant-wizard',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <!-- Backdrop -->
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8">
      <div (click)="onCancel()" class="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"></div>

      <!-- Dialog -->
      <div class="relative z-10 w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl shadow-black/60 flex flex-col overflow-hidden animate-slideUp">

        <!-- Wizard Header + Step Indicator -->
        <div class="px-8 pt-8 pb-6 border-b border-slate-800/80">
          <div class="flex items-center justify-between mb-6">
            <div>
              <h2 class="text-lg font-extrabold text-white tracking-tight">Crear Nuevo Restaurante</h2>
              <p class="text-xs text-slate-400 mt-0.5">Configura el restaurante, su primera sucursal y su gerente.</p>
            </div>
            <button aria-label="Cerrar" (click)="onCancel()" class="p-1.5 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-white transition-colors cursor-pointer">
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Step Progress Bar -->
          <div class="flex items-center gap-2">
            @for (step of steps; track step.num) {
              <div class="flex-1 flex flex-col items-center gap-1.5">
                <div
                  [class.bg-indigo-600]="currentStep() >= step.num"
                  [class.border-indigo-500]="currentStep() >= step.num"
                  [class.text-white]="currentStep() >= step.num"
                  [class.border-slate-700]="currentStep() < step.num"
                  [class.text-slate-600]="currentStep() < step.num"
                  [class.bg-slate-800]="currentStep() < step.num"
                  class="w-7 h-7 rounded-full border-2 flex items-center justify-center text-[11px] font-bold transition-all duration-300"
                >
                  @if (currentStep() > step.num) {
                    <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  } @else {
                    {{ step.num }}
                  }
                </div>
                <span class="text-[11px] font-semibold uppercase tracking-wider"
                  [class.text-indigo-400]="currentStep() === step.num"
                  [class.text-slate-500]="currentStep() !== step.num"
                >{{ step.label }}</span>
              </div>
              @if (step.num < steps.length) {
                <div class="flex-1 h-px mb-4"
                  [class.bg-indigo-600]="currentStep() > step.num"
                  [class.bg-slate-800]="currentStep() <= step.num"
                ></div>
              }
            }
          </div>
        </div>

        <!-- Step Content -->
        <div class="flex-1 px-8 py-7 overflow-y-auto max-h-[60vh]">

          <!-- Global error alert -->
          @if (httpError()) {
            <div class="mb-5 p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-start gap-3 text-rose-400 text-xs animate-fadeIn">
              <svg class="w-4 h-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>{{ httpError() }}</span>
            </div>
          }

          <!-- ─── STEP 1: Restaurant Data ───────────────────────────────── -->
          @if (currentStep() === 1) {
            <form [formGroup]="step1Form" class="space-y-5 animate-fadeIn">
              <div>
                <label for="restaurantName" class="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Nombre del Restaurante <span class="text-rose-500">*</span>
                </label>
                <input
                  id="restaurantName"
                  formControlName="restaurantName"
                  type="text"
                  placeholder="ej. Pizzería Don Marco"
                  class="w-full bg-slate-950/50 border border-slate-800 rounded-xl py-3 px-4 text-sm text-white placeholder-slate-600 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all"
                />
                @if (step1Form.get('restaurantName')?.touched && step1Form.get('restaurantName')?.hasError('required')) {
                  <p class="text-rose-400 text-[11px] mt-1.5 ml-1">El nombre del restaurante es requerido.</p>
                }
                @if (step1Form.get('restaurantName')?.touched && step1Form.get('restaurantName')?.hasError('maxlength')) {
                  <p class="text-rose-400 text-[11px] mt-1.5 ml-1">El nombre no puede superar 100 caracteres.</p>
                }
              </div>
              <p class="text-xs text-slate-400 leading-relaxed">
                Este será el nombre principal del restaurante que agrupa todas sus sucursales.
                Podrás añadir más sucursales después de la creación.
              </p>
            </form>
          }

          <!-- ─── STEP 2: Branch Data ───────────────────────────────────── -->
          @if (currentStep() === 2) {
            <form [formGroup]="step2Form" class="space-y-5 animate-fadeIn">
              <div>
                <label for="branchName" class="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Nombre de la Sucursal <span class="text-rose-500">*</span>
                </label>
                <input
                  id="branchName"
                  formControlName="branchName"
                  type="text"
                  placeholder="ej. Sucursal Centro"
                  class="w-full bg-slate-950/50 border border-slate-800 rounded-xl py-3 px-4 text-sm text-white placeholder-slate-600 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all"
                />
                @if (step2Form.get('branchName')?.touched && step2Form.get('branchName')?.hasError('required')) {
                  <p class="text-rose-400 text-[11px] mt-1.5 ml-1">El nombre de la sucursal es requerido.</p>
                }
              </div>
              <div>
                <label for="branchAddress" class="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Dirección</label>
                <input
                  id="branchAddress"
                  formControlName="branchAddress"
                  type="text"
                  placeholder="ej. Av. Reforma 456, Col. Juárez"
                  class="w-full bg-slate-950/50 border border-slate-800 rounded-xl py-3 px-4 text-sm text-white placeholder-slate-600 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all"
                />
              </div>
              <div>
                <label for="whatsappNumber" class="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Número de WhatsApp
                </label>
                <div class="relative">
                  <span class="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-500 text-sm">+</span>
                  <input
                    id="whatsappNumber"
                    formControlName="whatsappNumber"
                    type="tel"
                    placeholder="521234567890"
                    class="w-full bg-slate-950/50 border border-slate-800 rounded-xl py-3 pl-7 pr-4 text-sm text-white placeholder-slate-600 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all"
                  />
                </div>
                <p class="text-slate-500 text-[11px] mt-1.5 ml-1">Incluye código de país sin el símbolo +. Ej: 521234567890</p>
                @if (step2Form.get('whatsappNumber')?.touched && step2Form.get('whatsappNumber')?.hasError('pattern')) {
                  <p class="text-rose-400 text-[11px] mt-1 ml-1">Formato de número inválido.</p>
                }
              </div>
            </form>
          }

          <!-- ─── STEP 3: Branch Manager User ──────────────────────────── -->
          @if (currentStep() === 3) {
            <form [formGroup]="step3Form" class="space-y-5 animate-fadeIn">
              <div class="p-3.5 bg-indigo-500/5 border border-indigo-500/20 rounded-xl text-xs text-indigo-400">
                Se creará un usuario <strong>BRANCH_MANAGER</strong> asignado automáticamente a la sucursal que configuraste en el paso anterior.
              </div>
              <div>
                <label for="managerUsername" class="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Nombre de usuario <span class="text-rose-500">*</span>
                </label>
                <input
                  id="managerUsername"
                  formControlName="username"
                  type="text"
                  placeholder="ej. gerente_centro"
                  autocomplete="off"
                  class="w-full bg-slate-950/50 border border-slate-800 rounded-xl py-3 px-4 text-sm text-white placeholder-slate-600 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all"
                />
                @if (step3Form.get('username')?.touched && step3Form.get('username')?.hasError('required')) {
                  <p class="text-rose-400 text-[11px] mt-1.5 ml-1">El nombre de usuario es requerido.</p>
                }
                @if (step3Form.get('username')?.touched && step3Form.get('username')?.hasError('minlength')) {
                  <p class="text-rose-400 text-[11px] mt-1.5 ml-1">Mínimo 3 caracteres.</p>
                }
              </div>
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label for="managerPassword" class="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Contraseña <span class="text-rose-500">*</span>
                  </label>
                  <input
                    id="managerPassword"
                    formControlName="password"
                    type="password"
                    placeholder="••••••••"
                    autocomplete="new-password"
                    class="w-full bg-slate-950/50 border border-slate-800 rounded-xl py-3 px-4 text-sm text-white placeholder-slate-600 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all"
                  />
                  @if (step3Form.get('password')?.touched && step3Form.get('password')?.hasError('minlength')) {
                    <p class="text-rose-400 text-[11px] mt-1.5 ml-1">Mínimo 6 caracteres.</p>
                  }
                </div>
                <div>
                  <label for="managerConfirm" class="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Confirmar <span class="text-rose-500">*</span>
                  </label>
                  <input
                    id="managerConfirm"
                    formControlName="confirmPassword"
                    type="password"
                    placeholder="••••••••"
                    autocomplete="new-password"
                    class="w-full bg-slate-950/50 border border-slate-800 rounded-xl py-3 px-4 text-sm text-white placeholder-slate-600 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all"
                  />
                  @if (step3Form.get('confirmPassword')?.touched && step3Form.get('confirmPassword')?.hasError('mismatch')) {
                    <p class="text-rose-400 text-[11px] mt-1.5 ml-1">Las contraseñas no coinciden.</p>
                  }
                </div>
              </div>
            </form>
          }

          <!-- ─── SUCCESS STATE ─────────────────────────────────────────── -->
          @if (currentStep() === 4) {
            <div class="py-6 flex flex-col items-center text-center gap-4 animate-fadeIn">
              <div class="w-16 h-16 rounded-full bg-emerald-500/10 border-2 border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <svg class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div class="space-y-1">
                <h3 class="text-base font-bold text-white">¡Restaurante creado exitosamente!</h3>
                <p class="text-xs text-slate-400">El restaurante, su sucursal y el gerente han sido configurados.</p>
              </div>
              <div class="w-full p-4 bg-slate-950/50 border border-slate-800 rounded-xl text-xs text-left space-y-2 text-slate-400">
                <div class="flex justify-between">
                  <span>Restaurante</span>
                  <span class="font-semibold text-white">{{ step1Form.get('restaurantName')?.value }}</span>
                </div>
                <div class="flex justify-between">
                  <span>Sucursal</span>
                  <span class="font-semibold text-white">{{ step2Form.get('branchName')?.value }}</span>
                </div>
                <div class="flex justify-between">
                  <span>Usuario Gerente</span>
                  <span class="font-semibold text-indigo-400">{{ step3Form.get('username')?.value }}</span>
                </div>
              </div>
            </div>
          }
        </div>

        <!-- Footer Navigation -->
        <div class="px-8 py-5 border-t border-slate-800/80 flex items-center justify-between gap-4">
          <button
            (click)="prevStep()"
            [class.invisible]="currentStep() === 1 || currentStep() === 4"
            [disabled]="isSubmitting()"
            class="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-sm font-semibold transition-all duration-200 cursor-pointer disabled:opacity-40"
          >
            ← Anterior
          </button>

          @if (currentStep() < 3) {
            <button
              id="wizard-next-btn"
              (click)="nextStep()"
              [disabled]="!isCurrentStepValid()"
              class="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-xl shadow-md shadow-indigo-600/10 hover:shadow-indigo-500/20 transition-all duration-200 cursor-pointer"
            >
              Siguiente →
            </button>
          } @else if (currentStep() === 3) {
            <button
              id="wizard-submit-btn"
              (click)="submitWizard()"
              [disabled]="!step3Form.valid || isSubmitting()"
              class="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-xl shadow-md shadow-emerald-600/10 hover:shadow-emerald-500/20 transition-all duration-200 flex items-center gap-2 cursor-pointer"
            >
              @if (isSubmitting()) {
                <span class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                <span>Creando...</span>
              } @else {
                <span>✓ Crear Restaurante</span>
              }
            </button>
          } @else {
            <!-- Step 4 success — close -->
            <button
              id="wizard-done-btn"
              (click)="onDone()"
              class="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm rounded-xl transition-all duration-200 cursor-pointer"
            >
              Ver en la tabla
            </button>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    @keyframes slideUp {
      from { opacity: 0; transform: translateY(16px) scale(0.98); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(4px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .animate-slideUp  { animation: slideUp  0.25s ease-out forwards; }
    .animate-fadeIn   { animation: fadeIn   0.2s  ease-out forwards; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreateRestaurantWizardComponent implements OnInit, OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly fb   = inject(FormBuilder);

  @Output() wizardDone   = new EventEmitter<void>();
  @Output() wizardCancel = new EventEmitter<void>();

  // ─── Step Control ─────────────────────────────────────────────────────────

  readonly currentStep  = signal(1);
  readonly isSubmitting = signal(false);
  readonly httpError    = signal<string | null>(null);

  /** Tracks form validity reactively — updated by statusChanges subscriptions */
  private readonly step1Valid = signal(false);
  private readonly step2Valid = signal(false);
  private readonly step3Valid = signal(false);

  private subs = new Subscription();

  readonly steps = [
    { num: 1, label: 'Restaurante' },
    { num: 2, label: 'Sucursal'    },
    { num: 3, label: 'Gerente'     },
  ];

  // ─── Forms ────────────────────────────────────────────────────────────────

  readonly step1Form = this.fb.group({
    restaurantName: ['', [Validators.required, Validators.maxLength(100)]],
  });

  readonly step2Form = this.fb.group({
    branchName    : ['', [Validators.required, Validators.maxLength(100)]],
    branchAddress : [''],
    whatsappNumber: ['', [Validators.pattern(/^\+?[1-9]\d{6,14}$/)]],
  });

  readonly step3Form = this.fb.group(
    {
      username       : ['', [Validators.required, Validators.minLength(3), Validators.maxLength(50)]],
      password       : ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: passwordMatchValidator }
  );

  // ─── Computed ─────────────────────────────────────────────────────────────

  /** Reads from Signals updated by statusChanges — reactive to form state */
  readonly isCurrentStepValid = computed(() => {
    if (this.currentStep() === 1) return this.step1Valid();
    if (this.currentStep() === 2) return this.step2Valid();
    if (this.currentStep() === 3) return this.step3Valid();
    return true;
  });

  // ─── Created entity IDs (stored for chaining API calls) ──────────────────

  private createdRestaurantId: string | null = null;
  private createdBranchId: string | null = null;

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  ngOnInit(): void {
    // Bridge Angular reactive form status → Signals so computed() can react
    this.subs.add(
      this.step1Form.statusChanges.subscribe(() =>
        this.step1Valid.set(this.step1Form.valid)
      )
    );
    this.subs.add(
      this.step2Form.statusChanges.subscribe(() =>
        this.step2Valid.set(this.step2Form.valid)
      )
    );
    this.subs.add(
      this.step3Form.statusChanges.subscribe(() =>
        this.step3Valid.set(this.step3Form.valid)
      )
    );
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  // ─── Navigation ───────────────────────────────────────────────────────────

  nextStep(): void {
    this.markCurrentFormTouched();
    if (!this.isCurrentStepValid()) return;
    this.httpError.set(null);
    this.currentStep.update(s => s + 1);
  }

  prevStep(): void {
    this.httpError.set(null);
    this.currentStep.update(s => Math.max(1, s - 1));
  }

  // ─── Submission ───────────────────────────────────────────────────────────

  submitWizard(): void {
    this.step3Form.markAllAsTouched();
    if (!this.step3Form.valid || this.isSubmitting()) return;

    this.isSubmitting.set(true);
    this.httpError.set(null);

    // Step A: Create Restaurant
    const restaurantName = this.step1Form.get('restaurantName')!.value!;
    this.http.post<Restaurant>(`${API}/admin/restaurants`, { name: restaurantName }).subscribe({
      next: (restaurant) => {
        this.createdRestaurantId = restaurant.id;
        this.createBranch(restaurant.id);
      },
      error: (err) => this.handleError(err),
    });
  }

  private createBranch(restaurantId: string): void {
    const { branchName, branchAddress, whatsappNumber } = this.step2Form.value;
    this.http.post<Branch>(
      `${API}/admin/restaurants/${restaurantId}/branches`,
      {
        name: branchName,
        address: branchAddress || null,
        whatsappNumber: whatsappNumber ? `+${whatsappNumber.replace(/^\+/, '')}` : null,
      }
    ).subscribe({
      next: (branch) => {
        this.createdBranchId = branch.id;
        this.createManager(restaurantId, branch.id);
      },
      error: (err) => this.handleError(err),
    });
  }

  private createManager(restaurantId: string, branchId: string): void {
    const { username, password } = this.step3Form.value;
    // /admin/users crea usuarios en el restaurante de quien llama y exige roleId:
    // este endpoint crea el encargado dentro del restaurante recien dado de alta.
    this.http.post(`${API}/admin/restaurants/${restaurantId}/branches/${branchId}/manager`, {
      username,
      password,
    }).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.currentStep.set(4); // Success step
      },
      error: (err) => this.handleError(err),
    });
  }

  private handleError(err: any): void {
    this.isSubmitting.set(false);
    const msg = err.error?.message || err.error?.error || 'Error inesperado. Intenta de nuevo.';
    this.httpError.set(msg);
  }

  private markCurrentFormTouched(): void {
    if (this.currentStep() === 1) this.step1Form.markAllAsTouched();
    if (this.currentStep() === 2) this.step2Form.markAllAsTouched();
    if (this.currentStep() === 3) this.step3Form.markAllAsTouched();
  }

  // ─── Events ───────────────────────────────────────────────────────────────

  onCancel(): void { this.wizardCancel.emit(); }
  onDone()  : void { this.wizardDone.emit(); }
}
