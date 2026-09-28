import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideCheck, LucideArrowRight, LucideSparkles } from '@lucide/angular';

interface Plan {
  readonly id: string;
  readonly name: string;
  readonly tagline: string;
  /** Precio mensual en la moneda del negocio. `null` = a convenir. */
  readonly monthly: number | null;
  readonly features: readonly string[];
  readonly highlighted: boolean;
  readonly cta: string;
}

@Component({
  selector: 'app-landing-pricing',
  standalone: true,
  imports: [RouterLink, LucideCheck, LucideArrowRight, LucideSparkles],
  template: `
    <section id="precios" class="scroll-mt-24 border-y border-slate-800 bg-slate-900/30 py-24 sm:py-32">
      <div class="mx-auto max-w-6xl px-5 sm:px-8">
        <div class="grid gap-8 lg:grid-cols-12 lg:gap-10">
          <div class="lg:col-span-5">
            <p class="text-[11px] font-semibold uppercase tracking-[0.2em] text-indigo-400">Precios</p>
            <h2 class="font-display mt-5 text-[1.8rem] sm:text-4xl font-extrabold leading-[1.1] tracking-[-0.02em] text-white">
              Una tarifa plana, sin comisión por pedido
            </h2>
            <p class="mt-5 text-base leading-relaxed text-slate-400">
              Pagas por sucursal. Todo lo que vendas es tuyo: Pide Facil no se lleva un porcentaje.
            </p>
          </div>

          <!-- Conmutador mensual / anual -->
          <div class="lg:col-span-7 lg:flex lg:items-end lg:justify-end">
            <div class="inline-flex items-stretch overflow-hidden rounded-lg border border-slate-700">
              <button
                type="button"
                (click)="annual.set(false)"
                class="cursor-pointer px-5 py-2.5 text-sm font-semibold transition-colors"
                [class]="!annual() ? 'bg-slate-100 text-slate-900' : 'text-slate-400 hover:text-white'"
                [attr.aria-pressed]="!annual()"
              >
                Mensual
              </button>
              <button
                type="button"
                (click)="annual.set(true)"
                class="inline-flex cursor-pointer items-center gap-2 border-l border-slate-700 px-5 py-2.5 text-sm font-semibold transition-colors"
                [class]="annual() ? 'bg-slate-100 text-slate-900' : 'text-slate-400 hover:text-white'"
                [attr.aria-pressed]="annual()"
              >
                Anual
                <span
                  class="rounded px-1.5 py-0.5 text-[11px] font-bold"
                  [class]="annual() ? 'bg-emerald-600/15 text-emerald-700' : 'bg-emerald-500/15 text-emerald-400'"
                  >-20%</span
                >
              </button>
            </div>
          </div>
        </div>

        <!-- Planes -->
        <div class="mt-14 grid gap-5 lg:grid-cols-3">
          @for (plan of plans; track plan.id) {
            <article
              class="relative flex flex-col rounded-lg p-7 sm:p-8"
              [class]="
                plan.highlighted
                  ? 'border-gradient bg-slate-900 ring-1 ring-indigo-500/40'
                  : 'bg-slate-950/40 ring-1 ring-slate-800'
              "
            >
              <div class="flex items-center justify-between gap-3">
                <h3 class="font-display text-lg font-bold text-white">{{ plan.name }}</h3>
                @if (plan.highlighted) {
                  <span
                    class="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-indigo-300"
                  >
                    <svg lucideSparkles class="h-3 w-3"></svg>
                    Más elegido
                  </span>
                }
              </div>
              <p class="mt-2 min-h-[2.75rem] text-sm leading-snug text-slate-400">{{ plan.tagline }}</p>

              <p class="mt-7 flex min-h-[3.5rem] items-baseline gap-2 border-t border-slate-800 pt-7">
                @if (plan.monthly === null) {
                  <span class="font-display text-3xl font-extrabold tracking-tight text-white">A medida</span>
                } @else {
                  <span class="font-display text-5xl font-extrabold tabular-nums tracking-[-0.04em] text-white">{{ price(plan) }}</span>
                  <span class="text-[13px] leading-snug text-slate-500">/ mes<br />por sucursal</span>
                }
              </p>
              @if (plan.monthly !== null && annual()) {
                <p class="mt-2 text-xs text-emerald-400">Facturado anualmente</p>
              }

              <ul class="mt-8 flex-1 space-y-3.5 border-t border-slate-800 pt-7">
                @for (feature of plan.features; track feature) {
                  <li class="flex items-start gap-3 text-[14px] leading-snug text-slate-300">
                    <svg lucideCheck class="mt-0.5 h-4 w-4 shrink-0 text-emerald-500"></svg>
                    <span>{{ feature }}</span>
                  </li>
                }
              </ul>

              <a
                routerLink="/register"
                class="group mt-8 flex w-full items-center justify-center gap-2 rounded-lg px-5 py-3.5 text-sm font-semibold transition-colors"
                [class]="
                  plan.highlighted
                    ? 'bg-indigo-500 text-white hover:bg-indigo-400'
                    : 'border border-slate-700 text-slate-200 hover:border-slate-500 hover:text-white'
                "
              >
                {{ plan.cta }}
                <svg lucideArrowRight class="h-4 w-4 transition-transform group-hover:translate-x-1"></svg>
              </a>
            </article>
          }
        </div>

        <p class="mt-10 max-w-2xl text-xs leading-relaxed text-slate-400">
          Los importes son de referencia y se ajustan a tu país y moneda. Sin permanencia: cancelas cuando quieras.
        </p>
      </div>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LandingPricingComponent {
  readonly annual = signal(false);

  readonly plans: readonly Plan[] = [
    {
      id: 'inicial',
      name: 'Inicial',
      tagline: 'Para el local que empieza a ordenarse.',
      monthly: 29,
      highlighted: false,
      cta: 'Empezar gratis',
      features: [
        '1 sucursal y hasta 5 usuarios',
        'Carta digital con QR por mesa',
        'Panel de mesas en tiempo real',
        'Pantalla de cocina',
        'Historial de ventas',
      ],
    },
    {
      id: 'pro',
      name: 'Pro',
      tagline: 'El paquete completo con bot de WhatsApp.',
      monthly: 59,
      highlighted: true,
      cta: 'Probar 14 días gratis',
      features: [
        'Todo lo del plan Inicial',
        'Bot de pedidos por WhatsApp',
        'Inventario con recetas e ingredientes',
        'Analítica avanzada y comparativas',
        'Roles y permisos personalizados',
        'Usuarios ilimitados',
      ],
    },
    {
      id: 'cadena',
      name: 'Cadena',
      tagline: 'Varias sedes bajo una misma administración.',
      monthly: null,
      highlighted: false,
      cta: 'Hablar con ventas',
      features: [
        'Todo lo del plan Pro',
        'Sucursales ilimitadas',
        'Reportes consolidados por marca',
        'Onboarding y migración asistidos',
        'Soporte prioritario',
      ],
    },
  ];

  /** Precio mostrado según el ciclo elegido (20% de descuento anual). */
  price(plan: Plan): string {
    if (plan.monthly === null) return '';
    const value = this.annual() ? Math.round(plan.monthly * 0.8) : plan.monthly;
    return '$' + value;
  }
}
