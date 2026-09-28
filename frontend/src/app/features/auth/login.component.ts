import { Component, ChangeDetectionStrategy, signal, inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService, LoginResponse } from '../../core/services/auth.service';
import {
  LucideTriangleAlert,
  LucideUser,
  LucideLock,
  LucideLoader2,
  LucideEye,
  LucideEyeOff,
  LucideArrowRight,
} from '@lucide/angular';
import { AuthShellComponent } from './auth-shell.component';

const REMEMBERED_USER_KEY = 'pidefacil.rememberedUser';

@Component({
  selector: 'app-login',
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
  ],
  template: `
    <app-auth-shell
      headline="Tu servicio de hoy empieza aquí"
      subhead="Entra al panel para ver tus mesas, la cocina y las ventas de la jornada en tiempo real."
      [points]="highlights"
    >
      <div class="animate-fade-up">
        <!-- Encabezado -->
        <header>
          <h1 class="font-display text-3xl font-extrabold tracking-tight text-white">Bienvenido de vuelta</h1>
          <p class="mt-2 text-sm text-slate-400">Ingresa con las credenciales de tu cuenta Pide Facil.</p>
        </header>

        <!-- Error de autenticación -->
        @if (errorMessage()) {
          <div
            role="alert"
            class="animate-fade-in mt-6 flex items-start gap-3 rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-300"
          >
            <svg lucideTriangleAlert class="w-5 h-5 shrink-0 mt-0.5"></svg>
            <span>{{ errorMessage() }}</span>
          </div>
        }

        <form [formGroup]="loginForm" (ngSubmit)="onSubmit()" novalidate class="mt-8 space-y-5">
          <!-- Usuario -->
          <div>
            <label for="username" class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Usuario
            </label>
            <div class="relative">
              <span class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500">
                <svg lucideUser class="w-4.5 h-4.5"></svg>
              </span>
              <input
                id="username"
                type="text"
                formControlName="username"
                autocomplete="username"
                autocapitalize="none"
                spellcheck="false"
                placeholder="tu.usuario"
                [attr.aria-invalid]="isInvalid('username')"
                [attr.aria-describedby]="isInvalid('username') ? 'username-error' : null"
                class="w-full rounded-xl border bg-slate-900/60 py-3 pl-11 pr-4 text-sm text-white placeholder-slate-600 outline-none transition-all duration-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                [class]="isInvalid('username') ? 'border-rose-500/60' : 'border-slate-800 hover:border-slate-700'"
              />
            </div>
            @if (isInvalid('username')) {
              <p id="username-error" class="mt-1.5 text-xs text-rose-400">Escribe tu nombre de usuario.</p>
            }
          </div>

          <!-- Contraseña -->
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
                autocomplete="current-password"
                placeholder="••••••••"
                [attr.aria-invalid]="isInvalid('password')"
                [attr.aria-describedby]="isInvalid('password') ? 'password-error' : null"
                class="w-full rounded-xl border bg-slate-900/60 py-3 pl-11 pr-12 text-sm text-white placeholder-slate-600 outline-none transition-all duration-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
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
            @if (isInvalid('password')) {
              <p id="password-error" class="mt-1.5 text-xs text-rose-400">Escribe tu contraseña.</p>
            }
          </div>

          <!-- Recordar usuario -->
          <div class="flex items-center justify-between gap-4">
            <label class="inline-flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                formControlName="remember"
                class="h-4 w-4 rounded border-slate-700 bg-slate-900 text-indigo-500 accent-indigo-500 cursor-pointer"
              />
              <span class="text-sm text-slate-400">Recordar mi usuario</span>
            </label>
            <span class="text-xs text-slate-600">¿Olvidaste tu clave? Pídesela a tu administrador.</span>
          </div>

          <!-- Enviar -->
          <button
            type="submit"
            [disabled]="isLoading()"
            class="group flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition-all hover:from-indigo-400 hover:to-violet-500 hover:shadow-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
          >
            @if (isLoading()) {
              <svg lucideLoader2 class="h-5 w-5 animate-spin"></svg>
              <span>Verificando…</span>
            } @else {
              <span>Entrar al panel</span>
              <svg lucideArrowRight class="w-4 h-4 transition-transform group-hover:translate-x-1"></svg>
            }
          </button>
        </form>

        <p class="mt-8 text-center text-sm text-slate-400">
          ¿Aún no tienes cuenta?
          <a routerLink="/register" class="font-semibold text-indigo-400 hover:text-indigo-300 transition-colors">
            Registra tu restaurante
          </a>
        </p>
      </div>
    </app-auth-shell>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly highlights = [
    'Mesas, cocina y caja sincronizadas al segundo',
    'Los pedidos de WhatsApp entran solos al sistema',
    'Cada rol ve exactamente lo que le toca',
  ];

  readonly loginForm: FormGroup = this.fb.nonNullable.group({
    username: ['', [Validators.required]],
    password: ['', [Validators.required]],
    remember: [false],
  });

  readonly isLoading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly showPassword = signal(false);

  ngOnInit(): void {
    if (this.authService.isAuthenticated()) {
      this.router.navigate([this.authService.defaultRoute()]);
      return;
    }

    // Recupera el último usuario si lo pidió explícitamente
    const remembered = localStorage.getItem(REMEMBERED_USER_KEY);
    if (remembered) {
      this.loginForm.patchValue({ username: remembered, remember: true });
    }
  }

  togglePassword(): void {
    this.showPassword.update((visible) => !visible);
  }

  /** Muestra el error solo cuando el usuario ya interactuó con el campo. */
  isInvalid(controlName: string): boolean {
    const control = this.loginForm.get(controlName);
    return !!(control && control.invalid && (control.dirty || control.touched));
  }

  onSubmit(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    const { username, password, remember } = this.loginForm.getRawValue();

    if (remember) {
      localStorage.setItem(REMEMBERED_USER_KEY, username);
    } else {
      localStorage.removeItem(REMEMBERED_USER_KEY);
    }

    this.authService.login({ username, password }).subscribe({
      next: (response: LoginResponse) => {
        const targetRoute =
          response.user?.role?.defaultRoute ??
          response.user?.role?.default_route ??
          (response.user?.['defaultRoute'] as string | undefined) ??
          this.authService.defaultRoute();
        this.router.navigate([targetRoute]);
      },
      error: (err) => {
        this.isLoading.set(false);
        if (err.status === 401 || err.status === 403) {
          this.errorMessage.set('Usuario o contraseña incorrectos. Revisa y vuelve a intentar.');
        } else if (err.status === 429) {
          // Bloqueo por intentos fallidos: el servidor dice cuánto esperar.
          this.errorMessage.set(err.error?.message || 'Demasiados intentos fallidos. Espera unos minutos.');
        } else if (err.status === 0) {
          this.errorMessage.set('No se pudo conectar con el servidor. Verifica tu conexión e inténtalo de nuevo.');
        } else {
          this.errorMessage.set('Ocurrió un error inesperado al iniciar sesión. Inténtalo en unos segundos.');
        }
      },
    });
  }
}
