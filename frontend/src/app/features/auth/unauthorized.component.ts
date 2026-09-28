import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { LucideShieldAlert, LucideLogOut, LucideArrowLeft } from '@lucide/angular';
import { BrandLogoComponent } from '../../shared/components/brand-logo.component';

@Component({
  selector: 'app-unauthorized',
  standalone: true,
  imports: [RouterLink, BrandLogoComponent, LucideShieldAlert, LucideLogOut, LucideArrowLeft],
  template: `
    <div class="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-slate-950 p-4">
      <div class="absolute inset-0 bg-grid opacity-50 [mask-image:radial-gradient(ellipse_60%_50%_at_50%_40%,#000,transparent)]"></div>
      <div class="absolute -top-24 left-1/2 -translate-x-1/2 w-[520px] h-[420px] rounded-full bg-rose-600/10 blur-[120px] pointer-events-none"></div>

      <a routerLink="/" class="relative mb-10" aria-label="Pide Facil · Inicio">
        <app-brand-logo />
      </a>

      <div
        class="animate-fade-up relative w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/70 p-8 text-center shadow-2xl shadow-slate-950/60 backdrop-blur-xl"
      >
        <div
          class="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-2xl border border-rose-500/20 bg-rose-500/10 text-rose-400 shadow-lg shadow-rose-500/10"
        >
          <svg lucideShieldAlert class="h-8 w-8"></svg>
        </div>

        <h1 class="font-display text-2xl font-extrabold tracking-tight text-white">Aquí no puedes entrar</h1>
        <p class="mt-3 text-sm leading-relaxed text-slate-400">
          Tu usuario no tiene permisos para este módulo. Si crees que es un error, pídele a quien administra la
          sucursal que revise tu rol.
        </p>

        @if (userRole()) {
          <div
            class="mt-5 inline-flex items-center gap-2 rounded-full border border-slate-700/60 bg-slate-800/80 px-3 py-1.5 text-xs font-medium text-slate-300"
          >
            <span>Tu rol actual:</span>
            <span class="font-bold uppercase tracking-wider text-indigo-400">{{ userRole() }}</span>
          </div>
        }

        <div class="mt-8 flex flex-col gap-3">
          <a
            [routerLink]="homeRoute()"
            class="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition-all hover:from-indigo-400 hover:to-violet-500"
          >
            <svg lucideArrowLeft class="h-4 w-4"></svg>
            <span>Volver a mi inicio</span>
          </a>
          <button
            (click)="logout()"
            class="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-700/50 bg-slate-800/60 px-4 py-3 text-sm font-semibold text-slate-200 transition-all hover:bg-slate-700/60"
          >
            <svg lucideLogOut class="h-4 w-4 text-slate-400"></svg>
            <span>Cerrar sesión</span>
          </button>
        </div>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UnauthorizedComponent {
  private readonly authService = inject(AuthService);

  readonly userRole = this.authService.userRole;
  /** Ruta de aterrizaje que corresponde al rol de quien mira la página. */
  readonly homeRoute = this.authService.defaultRoute;

  logout(): void {
    this.authService.logout();
  }
}
