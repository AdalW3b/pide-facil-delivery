import { Component, ChangeDetectionStrategy, signal, computed, inject, OnInit } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import {
  LucideTriangleAlert,
  LucideUser,
  LucideLock,
  LucideLoader2,
  LucideEye,
  LucideEyeOff,
  LucideArrowRight,
  LucideArrowLeft,
  LucideBuilding2,
  LucideMapPin,
  LucidePhone,
  LucideAtSign,
  LucideMessageCircle,
  LucideCheck,
} from '@lucide/angular';
import { AuthShellComponent } from './auth-shell.component';

/** Las dos contraseñas del paso 2 deben coincidir. */
function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const password = group.get('password')?.value;
  const confirm = group.get('confirmPassword')?.value;
  if (!confirm) return null;
  return password === confirm ? null : { passwordMismatch: true };
}

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    AuthShellComponent,
    LucideTriangleAlert,
    LucideUser,
    LucideLock,
    LucideLoader2,
    LucideEye,
    LucideEyeOff,
    LucideArrowRight,
    LucideArrowLeft,
    LucideBuilding2,
    LucideMapPin,
    LucidePhone,
    LucideAtSign,
    LucideMessageCircle,
    LucideCheck,
  ],
  template: `
    <app-auth-shell
      headline="Pon tu restaurante a trabajar en piloto automático"
      subhead="Crea la cuenta de tu negocio y en minutos estarás recibiendo pedidos por WhatsApp y con la carta en QR."
      [points]="highlights"
      contentWidth="max-w-lg"
    >
      <div class="animate-fade-up">
        <header>
          <h1 class="font-display text-3xl font-extrabold tracking-tight text-white">Crea tu cuenta</h1>
          <p class="mt-2 text-sm text-slate-400">
            Paso {{ step() }} de 2 · {{ step() === 1 ? 'datos del negocio' : 'tu acceso de administrador' }}
          </p>
        </header>

        <!-- Progreso -->
        <div class="mt-6 flex items-center gap-3" aria-hidden="true">
          @for (index of [1, 2]; track index) {
            <div class="flex-1">
              <div
                class="h-1.5 rounded-full transition-all duration-500"
                [class]="step() >= index ? 'bg-gradient-to-r from-indigo-500 to-violet-500' : 'bg-slate-800'"
              ></div>
            </div>
          }
        </div>

        @if (errorMessage()) {
          <div
            role="alert"
            class="animate-fade-in mt-6 flex items-start gap-3 rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-300"
          >
            <svg lucideTriangleAlert class="w-5 h-5 shrink-0 mt-0.5"></svg>
            <span>{{ errorMessage() }}</span>
          </div>
        }

        <form [formGroup]="registerForm" (ngSubmit)="onSubmit()" novalidate class="mt-7">
          <!-- ---------- Paso 1: el negocio ---------- -->
          @if (step() === 1) {
            <div class="animate-fade-in space-y-5">
              <div>
                <label for="restaurantName" class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Nombre del restaurante
                </label>
                <div class="relative">
                  <span class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500">
                    <svg lucideBuilding2 class="w-4.5 h-4.5"></svg>
                  </span>
                  <input
                    id="restaurantName"
                    type="text"
                    formControlName="restaurantName"
                    autocomplete="organization"
                    placeholder="La Trattoria"
                    [attr.aria-invalid]="isInvalid('restaurantName')"
                    class="w-full rounded-xl border bg-slate-900/60 py-3 pl-11 pr-4 text-sm text-white placeholder-slate-600 outline-none transition-all focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                    [class]="isInvalid('restaurantName') ? 'border-rose-500/60' : 'border-slate-800 hover:border-slate-700'"
                  />
                </div>
                @if (isInvalid('restaurantName')) {
                  <p class="mt-1.5 text-xs text-rose-400">Indica cómo se llama tu restaurante.</p>
                }
              </div>

              <div>
                <label for="branchName" class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Primera sucursal
                </label>
                <div class="relative">
                  <span class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500">
                    <svg lucideMapPin class="w-4.5 h-4.5"></svg>
                  </span>
                  <input
                    id="branchName"
                    type="text"
                    formControlName="branchName"
                    placeholder="Centro, Sucursal Norte…"
                    [attr.aria-invalid]="isInvalid('branchName')"
                    class="w-full rounded-xl border bg-slate-900/60 py-3 pl-11 pr-4 text-sm text-white placeholder-slate-600 outline-none transition-all focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                    [class]="isInvalid('branchName') ? 'border-rose-500/60' : 'border-slate-800 hover:border-slate-700'"
                  />
                </div>
                @if (isInvalid('branchName')) {
                  <p class="mt-1.5 text-xs text-rose-400">Ponle un nombre a tu primera sede.</p>
                } @else {
                  <p class="mt-1.5 text-xs text-slate-600">Podrás añadir más sucursales después desde el panel.</p>
                }
              </div>

              <div>
                <label for="branchAddress" class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Dirección <span class="normal-case font-normal text-slate-600">(opcional)</span>
                </label>
                <div class="relative">
                  <span class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500">
                    <svg lucideMapPin class="w-4.5 h-4.5"></svg>
                  </span>
                  <input
                    id="branchAddress"
                    type="text"
                    formControlName="branchAddress"
                    autocomplete="street-address"
                    placeholder="Av. Principal 123"
                    class="w-full rounded-xl border border-slate-800 bg-slate-900/60 py-3 pl-11 pr-4 text-sm text-white placeholder-slate-600 outline-none transition-all hover:border-slate-700 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                  />
                </div>
              </div>

              <div>
                <label for="whatsappNumber" class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  WhatsApp del negocio <span class="normal-case font-normal text-slate-600">(opcional)</span>
                </label>
                <div class="relative">
                  <span class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-emerald-500">
                    <svg lucideMessageCircle class="w-4.5 h-4.5"></svg>
                  </span>
                  <input
                    id="whatsappNumber"
                    type="tel"
                    formControlName="whatsappNumber"
                    inputmode="tel"
                    placeholder="+52 55 1234 5678"
                    class="w-full rounded-xl border border-slate-800 bg-slate-900/60 py-3 pl-11 pr-4 text-sm text-white placeholder-slate-600 outline-none transition-all hover:border-slate-700 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                  />
                </div>
                <p class="mt-1.5 text-xs text-slate-600">
                  Es el número donde te escriben los clientes. Lo conectarás al asistente en el siguiente paso.
                </p>
              </div>

              <button
                type="button"
                (click)="nextStep()"
                class="group flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition-all hover:from-indigo-400 hover:to-violet-500 cursor-pointer"
              >
                Continuar
                <svg lucideArrowRight class="w-4 h-4 transition-transform group-hover:translate-x-1"></svg>
              </button>
            </div>
          }

          <!-- ---------- Paso 2: la cuenta ---------- -->
          @if (step() === 2) {
            <div class="animate-fade-in space-y-5">
              <div class="grid gap-5 sm:grid-cols-2">
                <div>
                  <label for="name" class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                    Tu nombre
                  </label>
                  <div class="relative">
                    <span class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500">
                      <svg lucideUser class="w-4.5 h-4.5"></svg>
                    </span>
                    <input
                      id="name"
                      type="text"
                      formControlName="name"
                      autocomplete="name"
                      placeholder="Ana Pérez"
                      [attr.aria-invalid]="isInvalid('name')"
                      class="w-full rounded-xl border bg-slate-900/60 py-3 pl-11 pr-4 text-sm text-white placeholder-slate-600 outline-none transition-all focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                      [class]="isInvalid('name') ? 'border-rose-500/60' : 'border-slate-800 hover:border-slate-700'"
                    />
                  </div>
                  @if (isInvalid('name')) {
                    <p class="mt-1.5 text-xs text-rose-400">Necesitamos tu nombre.</p>
                  }
                </div>

                <div>
                  <label for="phoneNumber" class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                    Tu teléfono
                  </label>
                  <div class="relative">
                    <span class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500">
                      <svg lucidePhone class="w-4.5 h-4.5"></svg>
                    </span>
                    <input
                      id="phoneNumber"
                      type="tel"
                      formControlName="phoneNumber"
                      autocomplete="tel"
                      inputmode="tel"
                      placeholder="+52 55 8765 4321"
                      [attr.aria-invalid]="isInvalid('phoneNumber')"
                      class="w-full rounded-xl border bg-slate-900/60 py-3 pl-11 pr-4 text-sm text-white placeholder-slate-600 outline-none transition-all focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                      [class]="isInvalid('phoneNumber') ? 'border-rose-500/60' : 'border-slate-800 hover:border-slate-700'"
                    />
                  </div>
                  @if (isInvalid('phoneNumber')) {
                    <p class="mt-1.5 text-xs text-rose-400">Déjanos un teléfono de contacto.</p>
                  }
                </div>
              </div>

              <div>
                <label for="username" class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Usuario para entrar
                </label>
                <div class="relative">
                  <span class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500">
                    <svg lucideAtSign class="w-4.5 h-4.5"></svg>
                  </span>
                  <input
                    id="username"
                    type="text"
                    formControlName="username"
                    autocomplete="username"
                    autocapitalize="none"
                    spellcheck="false"
                    placeholder="ana.perez"
                    [attr.aria-invalid]="isInvalid('username')"
                    class="w-full rounded-xl border bg-slate-900/60 py-3 pl-11 pr-4 text-sm text-white placeholder-slate-600 outline-none transition-all focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                    [class]="isInvalid('username') ? 'border-rose-500/60' : 'border-slate-800 hover:border-slate-700'"
                  />
                </div>
                @if (isInvalid('username')) {
                  <p class="mt-1.5 text-xs text-rose-400">
                    Usa al menos 4 caracteres, sin espacios (letras, números, punto, guion o guion bajo).
                  </p>
                }
              </div>

              <div>
                <label for="password" class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Contraseña
                </label>
                <div class="relative">
                  <span class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500">
                    <svg lucideLock class="w-4.5 h-4.5"></svg>
                  </span>
                  <input
                    id="password"
                    [type]="showPassword() ? 'text' : 'password'"
                    formControlName="password"
                    autocomplete="new-password"
                    placeholder="Mínimo 8 caracteres"
                    (input)="onPasswordInput($event)"
                    [attr.aria-invalid]="isInvalid('password')"
                    class="w-full rounded-xl border bg-slate-900/60 py-3 pl-11 pr-12 text-sm text-white placeholder-slate-600 outline-none transition-all focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                    [class]="isInvalid('password') ? 'border-rose-500/60' : 'border-slate-800 hover:border-slate-700'"
                  />
                  <button
                    type="button"
                    (click)="togglePassword()"
                    [attr.aria-label]="showPassword() ? 'Ocultar contraseña' : 'Mostrar contraseña'"
                    class="absolute inset-y-0 right-0 flex items-center px-3.5 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                  >
                    @if (showPassword()) {
                      <svg lucideEyeOff class="w-4.5 h-4.5"></svg>
                    } @else {
                      <svg lucideEye class="w-4.5 h-4.5"></svg>
                    }
                  </button>
                </div>

                <!-- Medidor de robustez -->
                @if (passwordValue().length > 0) {
                  <div class="mt-2.5">
                    <div class="flex gap-1.5" aria-hidden="true">
                      @for (level of [1, 2, 3, 4]; track level) {
                        <span
                          class="h-1 flex-1 rounded-full transition-colors duration-300"
                          [class]="passwordStrength() >= level ? strengthColor() : 'bg-slate-800'"
                        ></span>
                      }
                    </div>
                    <p class="mt-1.5 text-xs" [class]="strengthTextColor()" aria-live="polite">
                      Seguridad: {{ strengthLabel() }}
                    </p>
                  </div>
                }
                @if (isInvalid('password')) {
                  <p class="mt-1.5 text-xs text-rose-400">La contraseña debe tener al menos 8 caracteres.</p>
                }
              </div>

              <div>
                <label for="confirmPassword" class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Repite la contraseña
                </label>
                <div class="relative">
                  <span class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500">
                    <svg lucideLock class="w-4.5 h-4.5"></svg>
                  </span>
                  <input
                    id="confirmPassword"
                    [type]="showPassword() ? 'text' : 'password'"
                    formControlName="confirmPassword"
                    autocomplete="new-password"
                    placeholder="••••••••"
                    [attr.aria-invalid]="mismatch()"
                    class="w-full rounded-xl border bg-slate-900/60 py-3 pl-11 pr-12 text-sm text-white placeholder-slate-600 outline-none transition-all focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                    [class]="mismatch() ? 'border-rose-500/60' : 'border-slate-800 hover:border-slate-700'"
                  />
                  @if (!mismatch() && registerForm.get('confirmPassword')?.value) {
                    <span class="absolute inset-y-0 right-0 flex items-center px-3.5 text-emerald-400">
                      <svg lucideCheck class="w-4.5 h-4.5"></svg>
                    </span>
                  }
                </div>
                @if (mismatch()) {
                  <p class="mt-1.5 text-xs text-rose-400">Las contraseñas no coinciden.</p>
                }
              </div>

              <label class="flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  formControlName="terms"
                  class="mt-0.5 h-4 w-4 rounded border-slate-700 bg-slate-900 accent-indigo-500 cursor-pointer"
                />
                <span class="text-xs leading-relaxed text-slate-400">
                  Acepto los <a href="#" class="text-indigo-400 hover:text-indigo-300">términos del servicio</a> y el
                  tratamiento de los datos de mi restaurante según la
                  <a href="#" class="text-indigo-400 hover:text-indigo-300">política de privacidad</a>.
                </span>
              </label>
              @if (isInvalid('terms')) {
                <p class="-mt-2 text-xs text-rose-400">Debes aceptar los términos para continuar.</p>
              }

              <div class="flex gap-3 pt-1">
                <button
                  type="button"
                  (click)="previousStep()"
                  class="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-800 px-5 py-3.5 text-sm font-semibold text-slate-300 transition-all hover:bg-slate-800/60 cursor-pointer"
                >
                  <svg lucideArrowLeft class="w-4 h-4"></svg>
                  Atrás
                </button>
                <button
                  type="submit"
                  [disabled]="isLoading()"
                  class="group flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition-all hover:from-indigo-400 hover:to-violet-500 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
                >
                  @if (isLoading()) {
                    <svg lucideLoader2 class="h-5 w-5 animate-spin"></svg>
                    <span>Creando tu cuenta…</span>
                  } @else {
                    <span>Crear mi restaurante</span>
                    <svg lucideArrowRight class="w-4 h-4 transition-transform group-hover:translate-x-1"></svg>
                  }
                </button>
              </div>
            </div>
          }
        </form>

        <p class="mt-8 text-center text-sm text-slate-400">
          ¿Ya tienes cuenta?
          <a routerLink="/login" class="font-semibold text-indigo-400 hover:text-indigo-300 transition-colors">
            Inicia sesión
          </a>
        </p>
      </div>
    </app-auth-shell>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegisterComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly highlights = [
    'Configuración guiada: cuenta, WhatsApp, carta y QR',
    'Tú quedas como administrador con acceso total',
    'Sin comisión por pedido: lo que vendes es tuyo',
  ];

  /** Campos que se validan antes de dejar avanzar de paso. */
  private readonly stepFields: Record<number, readonly string[]> = {
    1: ['restaurantName', 'branchName'],
    2: ['name', 'phoneNumber', 'username', 'password', 'confirmPassword', 'terms'],
  };

  readonly registerForm: FormGroup = this.fb.nonNullable.group(
    {
      restaurantName: ['', [Validators.required]],
      branchName: ['', [Validators.required]],
      branchAddress: [''],
      whatsappNumber: [''],
      name: ['', [Validators.required]],
      phoneNumber: ['', [Validators.required]],
      username: ['', [Validators.required, Validators.minLength(4), Validators.pattern(/^[a-zA-Z0-9._-]+$/)]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]],
      terms: [false, [Validators.requiredTrue]],
    },
    { validators: passwordsMatch },
  );

  readonly step = signal(1);
  readonly isLoading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly showPassword = signal(false);

  /** Valor reactivo de la contraseña para alimentar el medidor. */
  readonly passwordValue = signal('');

  readonly passwordStrength = computed(() => {
    const value = this.passwordValue();
    if (!value) return 0;

    let score = 0;
    if (value.length >= 8) score++;
    if (value.length >= 12) score++;
    if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score++;
    if (/\d/.test(value) && /[^A-Za-z0-9]/.test(value)) score++;
    return Math.min(score, 4);
  });

  readonly strengthLabel = computed(
    () => ['muy débil', 'débil', 'aceptable', 'buena', 'excelente'][this.passwordStrength()],
  );

  readonly strengthColor = computed(
    () => ['bg-rose-500', 'bg-rose-500', 'bg-amber-500', 'bg-lime-500', 'bg-emerald-500'][this.passwordStrength()],
  );

  readonly strengthTextColor = computed(
    () =>
      ['text-rose-400', 'text-rose-400', 'text-amber-400', 'text-lime-400', 'text-emerald-400'][
        this.passwordStrength()
      ],
  );

  ngOnInit(): void {
    if (this.authService.isAuthenticated()) {
      this.router.navigate([this.authService.defaultRoute()]);
    }
  }

  /** Alimenta el medidor de robustez mientras se escribe. */
  onPasswordInput(event: Event): void {
    this.passwordValue.set((event.target as HTMLInputElement).value);
  }

  togglePassword(): void {
    this.showPassword.update((visible) => !visible);
  }

  isInvalid(controlName: string): boolean {
    const control = this.registerForm.get(controlName);
    return !!(control && control.invalid && (control.dirty || control.touched));
  }

  /** Las contraseñas difieren y el usuario ya escribió la confirmación. */
  mismatch(): boolean {
    const confirm = this.registerForm.get('confirmPassword');
    return !!(this.registerForm.hasError('passwordMismatch') && (confirm?.dirty || confirm?.touched));
  }

  nextStep(): void {
    if (!this.validateStep(1)) return;
    this.errorMessage.set(null);
    this.step.set(2);
  }

  previousStep(): void {
    this.errorMessage.set(null);
    this.step.set(1);
  }

  private validateStep(step: number): boolean {
    const controls = this.stepFields[step] ?? [];
    controls.forEach((name) => this.registerForm.get(name)?.markAsTouched());
    return controls.every((name) => this.registerForm.get(name)?.valid);
  }

  onSubmit(): void {
    if (!this.validateStep(2) || this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    // El backend no espera la confirmación ni la casilla de términos.
    const { confirmPassword, terms, ...payload } = this.registerForm.getRawValue();

    this.authService.register(payload).subscribe({
      next: () => {
        // Tras registrarse, lo siguiente es conectar el WhatsApp del negocio.
        this.router.navigate(['/settings/whatsapp']);
      },
      error: (err) => {
        this.isLoading.set(false);
        if (err.status === 409) {
          this.errorMessage.set('Ese nombre de usuario ya está en uso. Prueba con otro.');
        } else if (err.status === 400 && err.error?.message) {
          this.errorMessage.set(err.error.message);
        } else if (err.status === 0) {
          this.errorMessage.set('No se pudo conectar con el servidor. Verifica tu conexión e inténtalo de nuevo.');
        } else {
          this.errorMessage.set('Ocurrió un error inesperado al crear la cuenta. Inténtalo en unos segundos.');
        }
      },
    });
  }
}
