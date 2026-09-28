import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideArrowLeft, LucideCircleCheck } from '@lucide/angular';
import { BrandLogoComponent } from '../../shared/components/brand-logo.component';

/**
 * Marco visual compartido por login y registro.
 *
 * Columna izquierda: refuerzo de marca y motivos para continuar (oculta en móvil,
 * donde el formulario debe ocupar toda la pantalla).
 * Columna derecha: el formulario, proyectado por el componente que la usa.
 */
@Component({
  selector: 'app-auth-shell',
  standalone: true,
  imports: [RouterLink, BrandLogoComponent, LucideArrowLeft, LucideCircleCheck],
  template: `
    <div class="min-h-screen bg-slate-950 lg:grid lg:grid-cols-2">
      <!-- Panel de marca -->
      <aside class="relative hidden lg:flex flex-col justify-between overflow-hidden p-12 xl:p-16">
        <div class="absolute inset-0 bg-gradient-to-br from-indigo-950 via-slate-950 to-slate-950"></div>
        <div class="absolute inset-0 bg-grid opacity-60 [mask-image:radial-gradient(ellipse_70%_60%_at_30%_30%,#000,transparent)]"></div>
        <div class="absolute -top-32 -left-24 w-[520px] h-[520px] rounded-full bg-indigo-600/15 blur-[120px]"></div>
        <div class="absolute bottom-0 right-0 w-[420px] h-[420px] rounded-full bg-violet-600/12 blur-[120px]"></div>

        <a routerLink="/" class="relative z-10 w-fit" aria-label="Pide Facil · Inicio">
          <app-brand-logo size="md" />
        </a>

        <div class="relative z-10 max-w-md">
          <h2 class="font-display text-3xl xl:text-4xl font-extrabold leading-tight text-white">
            {{ headline() }}
          </h2>
          <p class="mt-4 text-base leading-relaxed text-slate-400">{{ subhead() }}</p>

          <ul class="mt-9 space-y-4">
            @for (point of points(); track point) {
              <li class="flex items-start gap-3 text-sm text-slate-300">
                <svg lucideCircleCheck class="w-5 h-5 mt-px shrink-0 text-emerald-400"></svg>
                <span>{{ point }}</span>
              </li>
            }
          </ul>
        </div>

        <p class="relative z-10 text-xs text-slate-600">
          © {{ year }} Pide Facil · Gestión para restaurantes
        </p>
      </aside>

      <!-- Panel del formulario -->
      <main class="relative overflow-x-clip flex flex-col min-h-screen lg:min-h-0 px-4 py-8 sm:px-8 lg:px-12 xl:px-20">
        <!-- Blobs suaves solo en móvil, donde no hay panel de marca -->
        <div class="lg:hidden absolute -top-24 left-1/2 -translate-x-1/2 w-[420px] h-[420px] rounded-full bg-indigo-600/12 blur-[110px] pointer-events-none"></div>

        <div class="relative flex items-center justify-between gap-4">
          <a routerLink="/" class="lg:hidden" aria-label="Pide Facil · Inicio">
            <app-brand-logo size="sm" />
          </a>
          <a
            routerLink="/"
            class="ml-auto inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <svg lucideArrowLeft class="w-3.5 h-3.5"></svg>
            Volver al inicio
          </a>
        </div>

        <div class="relative flex flex-1 items-center justify-center py-8">
          <div class="w-full" [class]="contentWidth()">
            <ng-content />
          </div>
        </div>
      </main>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthShellComponent {
  readonly headline = input.required<string>();
  readonly subhead = input.required<string>();
  readonly points = input<readonly string[]>([]);
  /** Ancho máximo del formulario proyectado. */
  readonly contentWidth = input('max-w-md');

  readonly year = new Date().getFullYear();
}
