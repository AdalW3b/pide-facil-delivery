import { ChangeDetectionStrategy, Component, HostListener, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideArrowRight } from '@lucide/angular';
import { LandingNavComponent } from './sections/landing-nav.component';
import { LandingHeroComponent } from './sections/hero.component';
import { LandingAhorroComponent } from './sections/ahorro.component';
import { LandingCanalesComponent } from './sections/canales.component';
import { LandingFeaturesComponent } from './sections/features.component';
import { LandingHowItWorksComponent } from './sections/how-it-works.component';
import { LandingModulesComponent } from './sections/modules.component';
import { LandingComparisonComponent } from './sections/comparison.component';
import { LandingPricingComponent } from './sections/pricing.component';
import { LandingFaqComponent } from './sections/faq.component';
import { LandingCtaComponent } from './sections/cta.component';
import { LandingFooterComponent } from './sections/footer.component';

/**
 * Página pública de aterrizaje de Pide Facil, armada como embudo:
 * promesa -> garantías -> problema (calculadora) -> solución (canales) ->
 * comparación -> funciones -> producto -> puesta en marcha -> precio ->
 * objeciones -> cierre.
 * Tema claro "fonda" (clase .lp en styles.css); el panel sigue oscuro.
 *
 * Prueba social: todavía no hay clientes ni testimonios publicables. Cuando
 * existan, van entre las garantías y la calculadora. No inventar.
 */
@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [
    RouterLink,
    LucideArrowRight,
    LandingNavComponent,
    LandingHeroComponent,
    LandingAhorroComponent,
    LandingCanalesComponent,
    LandingFeaturesComponent,
    LandingHowItWorksComponent,
    LandingModulesComponent,
    LandingComparisonComponent,
    LandingPricingComponent,
    LandingFaqComponent,
    LandingCtaComponent,
    LandingFooterComponent,
  ],
  template: `
    <div class="lp min-h-screen antialiased overflow-x-clip pb-20 lg:pb-0">
      <a
        href="#contenido"
        class="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[60] focus:rounded-lg focus:bg-[#c8381f] focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Saltar al contenido
      </a>

      <app-landing-nav />

      <main id="contenido">
        <app-landing-hero />

        <!-- Garantías: solo cosas que el sistema cumple -->
        <div class="border-y border-(--linea) bg-(--papel-2)">
          <ul class="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-10 gap-y-3 px-5 py-5 sm:px-8">
            @for (g of garantias; track g.fuerte) {
              <li class="text-sm text-(--tinta-2)"><strong class="lp-display text-base font-extrabold text-(--tinta)">{{ g.fuerte }}</strong> {{ g.resto }}</li>
            }
          </ul>
        </div>

        <app-landing-ahorro />
        <app-landing-canales />
        <app-landing-comparison />
        <app-landing-features />
        <app-landing-modules />
        <app-landing-how-it-works />
        <app-landing-pricing />
        <app-landing-faq />
        <app-landing-cta />
      </main>

      <app-landing-footer />

      <!-- CTA fija en celular: aparece al pasar el inicio -->
      <div class="fixed inset-x-0 bottom-0 z-40 border-t border-(--linea) bg-(--papel)/95 px-4 pt-3 backdrop-blur-md transition-transform duration-300 lg:hidden"
        style="padding-bottom: calc(0.75rem + env(safe-area-inset-bottom, 0px))"
        [class.translate-y-full]="!mostrarBarra()" [attr.aria-hidden]="!mostrarBarra()" [attr.inert]="mostrarBarra() ? null : ''">
        <a routerLink="/register"
          class="flex items-center justify-center gap-2 rounded-full bg-(--chile) px-6 py-3.5 text-base font-semibold text-white">
          Prueba 14 días gratis
          <svg lucideArrowRight class="h-4 w-4" aria-hidden="true"></svg>
        </a>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LandingComponent {
  readonly garantias = [
    { fuerte: '0%', resto: 'de comisión por pedido' },
    { fuerte: 'Sin límite', resto: 'de pedidos al mes' },
    { fuerte: '14 días', resto: 'gratis, sin tarjeta' },
    { fuerte: 'Hoy mismo', resto: 'lo configuras tú' },
    { fuerte: 'Sin plazo', resto: 'forzoso' },
  ];

  readonly mostrarBarra = signal(false);

  @HostListener('window:scroll')
  onScroll(): void {
    this.mostrarBarra.set(window.scrollY > 640);
  }
}
