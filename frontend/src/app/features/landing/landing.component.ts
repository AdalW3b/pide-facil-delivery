import { ChangeDetectionStrategy, Component } from '@angular/core';
import { LandingNavComponent } from './sections/landing-nav.component';
import { LandingHeroComponent } from './sections/hero.component';
import { LandingFeaturesComponent } from './sections/features.component';
import { LandingHowItWorksComponent } from './sections/how-it-works.component';
import { LandingModulesComponent } from './sections/modules.component';
import { LandingComparisonComponent } from './sections/comparison.component';
import { LandingPricingComponent } from './sections/pricing.component';
import { LandingFaqComponent } from './sections/faq.component';
import { LandingCtaComponent } from './sections/cta.component';
import { LandingFooterComponent } from './sections/footer.component';

/**
 * Página pública de aterrizaje de Pide Facil.
 * Compone las secciones en el orden del recorrido comercial:
 * promesa -> capacidades -> puesta en marcha -> producto -> contraste -> precio -> objeciones -> cierre.
 */
@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [
    LandingNavComponent,
    LandingHeroComponent,
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
    <div class="min-h-screen bg-slate-950 text-slate-200 antialiased overflow-x-hidden">
      <a
        href="#contenido"
        class="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[60] focus:rounded-lg focus:bg-indigo-600 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Saltar al contenido
      </a>

      <app-landing-nav />

      <main id="contenido">
        <app-landing-hero />
        <app-landing-features />
        <app-landing-how-it-works />
        <app-landing-modules />
        <app-landing-comparison />
        <app-landing-pricing />
        <app-landing-faq />
        <app-landing-cta />
      </main>

      <app-landing-footer />
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LandingComponent {}
