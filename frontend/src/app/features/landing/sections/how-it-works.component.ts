import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideArrowRight } from '@lucide/angular';

interface Step {
  readonly number: string;
  readonly title: string;
  readonly description: string;
}

/** Puesta en marcha en cuatro pasos, como una lista de pendientes. */
@Component({
  selector: 'app-landing-how-it-works',
  standalone: true,
  imports: [RouterLink, LucideArrowRight],
  template: `
    <section id="como-funciona" class="bg-(--papel-2) py-20 lg:py-28" aria-labelledby="pasos-titulo">
      <div class="mx-auto max-w-6xl px-5 sm:px-8">
        <div class="grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p class="lp-mono text-xs uppercase tracking-[0.18em] text-(--chile)">Cómo empiezo</p>
            <h2 id="pasos-titulo" class="lp-display mt-3 text-3xl font-extrabold leading-tight text-(--tinta) sm:text-4xl text-balance">
              Abres hoy con lo que ya tienes
            </h2>
            <p class="mt-4 text-[15px] leading-relaxed text-(--tinta-2)">
              Solo necesitas internet y un celular, tablet o computadora. No hay que instalar nada en el local.
            </p>
            <a routerLink="/register"
              class="group mt-8 inline-flex items-center gap-2 rounded-full bg-(--chile) px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-(--chile-osc)">
              Crear mi cuenta
              <svg lucideArrowRight class="h-4 w-4 transition-transform group-hover:translate-x-0.5"></svg>
            </a>
          </div>

          <ol class="space-y-4">
            @for (s of steps; track s.number) {
              <li class="flex gap-5 rounded-2xl bg-[#fffdf8] p-5 ring-1 ring-(--linea)">
                <span class="lp-display flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-(--tinta) text-base font-extrabold text-(--papel)">{{ s.number }}</span>
                <div>
                  <h3 class="text-lg font-semibold text-(--tinta)">{{ s.title }}</h3>
                  <p class="mt-1 text-[15px] leading-relaxed text-(--tinta-2)">{{ s.description }}</p>
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
    { number: '1', title: 'Crea tu cuenta', description: 'Registra tu negocio y tu primera sucursal. Quedas como administrador.' },
    { number: '2', title: 'Sube tu menú', description: 'Categorías, platillos, precios, fotos, combos y extras. Si quieres, agrega recetas e ingredientes para el inventario.' },
    { number: '3', title: 'Conecta WhatsApp y el reparto', description: 'Vinculas tu número escaneando un QR, marcas tu ubicación y pones tus tarifas de envío.' },
    { number: '4', title: 'Comparte tu liga y abre', description: 'Manda la liga de tu menú a tus clientes, da de alta a tu equipo y empieza a recibir pedidos.' },
  ];
}
