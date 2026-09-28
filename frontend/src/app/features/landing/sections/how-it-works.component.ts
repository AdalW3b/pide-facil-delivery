import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideArrowRight } from '@lucide/angular';

interface Step {
  readonly number: string;
  readonly title: string;
  readonly description: string;
  readonly duration: string;
}

@Component({
  selector: 'app-landing-how-it-works',
  standalone: true,
  imports: [RouterLink, LucideArrowRight],
  template: `
    <section id="como-funciona" class="scroll-mt-24 border-t border-slate-800 py-24 sm:py-32">
      <div class="mx-auto max-w-6xl px-5 sm:px-8">
        <div class="grid gap-12 lg:grid-cols-12 lg:gap-10">
          <!-- Encabezado y cierre, fijos a la izquierda -->
          <div class="lg:col-span-4 lg:sticky lg:top-28 lg:self-start">
            <p class="text-[11px] font-semibold uppercase tracking-[0.2em] text-indigo-400">Puesta en marcha</p>
            <h2 class="font-display mt-5 text-[1.8rem] sm:text-4xl font-extrabold leading-[1.1] tracking-[-0.02em] text-white">
              De cero a recibiendo pedidos, en una tarde
            </h2>
            <p class="mt-5 text-base leading-relaxed text-slate-400">
              No necesitas técnico ni cambiar de número. Cuatro pasos y tu restaurante ya está operando.
            </p>

            <a
              routerLink="/register"
              class="group mt-8 inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-6 py-3.5 font-semibold text-white transition-colors hover:bg-indigo-400"
            >
              Empezar ahora
              <svg lucideArrowRight class="w-4 h-4 transition-transform group-hover:translate-x-1"></svg>
            </a>
            <p class="mt-4 text-sm text-slate-500">Te acompañamos en la configuración inicial sin costo.</p>
          </div>

          <!-- Secuencia vertical con espina -->
          <ol class="lg:col-span-7 lg:col-start-6">
            @for (step of steps; track step.number; let last = $last) {
              <li class="relative grid grid-cols-[2.75rem_minmax(0,1fr)] gap-x-5" [class]="last ? 'pb-0' : 'pb-10'">
                <!-- Espina que une los pasos -->
                @if (!last) {
                  <span
                    class="absolute left-[1.375rem] top-12 bottom-0 w-px -translate-x-1/2 bg-slate-800"
                    aria-hidden="true"
                  ></span>
                }

                <span
                  class="font-display relative z-10 flex h-11 w-11 items-center justify-center rounded-full bg-slate-900 text-[15px] font-extrabold text-indigo-300 ring-1 ring-slate-800"
                >
                  {{ step.number }}
                </span>

                <div class="pt-2">
                  <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <h3 class="font-display text-lg font-bold text-white">{{ step.title }}</h3>
                    <span class="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                      {{ step.duration }}
                    </span>
                  </div>
                  <p class="mt-2.5 max-w-lg text-[15px] leading-relaxed text-slate-400">{{ step.description }}</p>
                </div>
              </li>
            }
          </ol>
        </div>
      </div>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LandingHowItWorksComponent {
  readonly steps: readonly Step[] = [
    {
      number: '01',
      title: 'Crea tu cuenta',
      description: 'Registra tu restaurante y tu primera sucursal. Quedas como administrador con acceso total.',
      duration: '1 minuto',
    },
    {
      number: '02',
      title: 'Conecta tu WhatsApp',
      description: 'Vincula el número del negocio desde Ajustes. El asistente empieza a responder de inmediato.',
      duration: '5 minutos',
    },
    {
      number: '03',
      title: 'Carga tu carta y tus mesas',
      description: 'Categorías, platos, precios e ingredientes. Imprime los QR que se generan por mesa.',
      duration: '30 minutos',
    },
    {
      number: '04',
      title: 'Abre y vende',
      description: 'Cocina ve las comandas, caja cobra y tú miras las ventas en vivo desde el panel.',
      duration: 'Hoy mismo',
    },
  ];
}
