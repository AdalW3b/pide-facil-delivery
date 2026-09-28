import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideArrowRight, LucideCircleCheck } from '@lucide/angular';

@Component({
  selector: 'app-landing-cta',
  standalone: true,
  imports: [RouterLink, LucideArrowRight, LucideCircleCheck],
  template: `
    <section class="relative overflow-hidden bg-indigo-600">
      <div
        class="absolute inset-0 bg-grid opacity-25 [mask-image:radial-gradient(ellipse_70%_70%_at_50%_50%,#000,transparent)]"
        aria-hidden="true"
      ></div>

      <div class="relative mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-24">
        <div class="grid items-center gap-10 lg:grid-cols-12 lg:gap-10">
          <div class="lg:col-span-7">
            <h2 class="font-display text-[1.9rem] sm:text-4xl font-extrabold leading-[1.08] tracking-[-0.025em] text-white">
              Esta noche puedes estar recibiendo pedidos por WhatsApp
            </h2>
            <p class="mt-5 max-w-lg text-base leading-relaxed text-indigo-100">
              Crea tu cuenta, carga tu carta y deja que el sistema haga el resto. Sin instalaciones y sin comisión por
              venta.
            </p>
          </div>

          <div class="lg:col-span-5 lg:pl-6">
            <div class="flex flex-col gap-3 sm:flex-row lg:flex-col">
              <a
                routerLink="/register"
                class="group inline-flex items-center justify-center gap-2 rounded-lg bg-white px-7 py-3.5 font-semibold text-indigo-700 transition-colors hover:bg-indigo-50"
              >
                Crear mi restaurante
                <svg lucideArrowRight class="h-4 w-4 transition-transform group-hover:translate-x-1"></svg>
              </a>
              <a
                routerLink="/login"
                class="inline-flex items-center justify-center rounded-lg border border-white/35 px-7 py-3.5 font-semibold text-white transition-colors hover:bg-white/10"
              >
                Ya tengo cuenta
              </a>
            </div>

            <ul class="mt-7 flex flex-col gap-2.5 border-t border-white/20 pt-6 text-sm text-indigo-100">
              @for (item of assurances; track item) {
                <li class="inline-flex items-center gap-2.5">
                  <svg lucideCircleCheck class="h-4 w-4 shrink-0 text-emerald-300"></svg>
                  {{ item }}
                </li>
              }
            </ul>
          </div>
        </div>
      </div>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LandingCtaComponent {
  readonly assurances = ['14 días de prueba', 'Sin tarjeta', 'Cancelas cuando quieras'];
}
