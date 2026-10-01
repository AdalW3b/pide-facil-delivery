import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideArrowRight, LucideCircleCheck } from '@lucide/angular';

/** Cierre: la misma promesa del inicio y el botón de prueba. */
@Component({
  selector: 'app-landing-cta',
  standalone: true,
  imports: [RouterLink, LucideArrowRight, LucideCircleCheck],
  template: `
    <section class="py-20 lg:py-24" aria-labelledby="cta-titulo">
      <div class="mx-auto max-w-6xl px-5 sm:px-8">
        <div class="relative overflow-hidden rounded-3xl bg-(--chile) px-6 py-14 text-center text-white sm:px-12 lg:py-16">
          <h2 id="cta-titulo" class="lp-display mx-auto max-w-2xl text-3xl font-extrabold leading-tight sm:text-5xl text-balance">
            Este fin de semana, que los pedidos lleguen solos.
          </h2>
          <p class="mx-auto mt-5 max-w-xl text-base text-white/85 sm:text-lg">
            Crea tu cuenta, sube tu menú y comparte tu liga hoy mismo.
          </p>
          <a routerLink="/register"
            class="group mt-9 inline-flex items-center justify-center gap-2 rounded-full bg-(--papel) px-8 py-3.5 text-base font-semibold text-(--tinta) transition-colors hover:bg-white">
            Prueba 14 días gratis
            <svg lucideArrowRight class="h-4 w-4 transition-transform group-hover:translate-x-0.5"></svg>
          </a>
          <ul class="mt-7 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-white/85">
            @for (a of assurances; track a) {
              <li class="flex items-center gap-1.5"><svg lucideCircleCheck class="h-4 w-4"></svg>{{ a }}</li>
            }
          </ul>
        </div>
      </div>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LandingCtaComponent {
  readonly assurances = ['Sin tarjeta', 'Sin comisión por pedido', 'Cancelas cuando quieras'];
}
