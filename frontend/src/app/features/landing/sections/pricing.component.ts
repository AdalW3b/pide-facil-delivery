import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideCheck, LucideArrowRight } from '@lucide/angular';

interface Plan {
  readonly id: string;
  readonly name: string;
  readonly tagline: string;
  /** Precio mensual por sucursal en USD; null = a medida. */
  readonly monthly: number | null;
  readonly highlighted: boolean;
  readonly cta: string;
  readonly features: readonly string[];
}

/**
 * Planes. Los límites deben coincidir con el enum Plan del backend:
 * Inicial 1 sucursal / 5 usuarios sin domicilio; Pro hasta 5 sucursales con
 * domicilio; Cadena sin límites.
 */
@Component({
  selector: 'app-landing-pricing',
  standalone: true,
  imports: [RouterLink, LucideCheck, LucideArrowRight],
  template: `
    <section id="precios" class="py-20 lg:py-28" aria-labelledby="precios-titulo">
      <div class="mx-auto max-w-6xl px-5 sm:px-8">
        <div class="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div class="max-w-2xl">
            <p class="lp-mono text-xs uppercase tracking-[0.18em] text-(--chile)">Precios</p>
            <h2 id="precios-titulo" class="lp-display mt-3 text-3xl font-extrabold leading-tight text-(--tinta) sm:text-4xl text-balance">
              Una cuota fija. Lo que vendes es tuyo.
            </h2>
            <p class="mt-4 text-[15px] leading-relaxed text-(--tinta-2)">
              Pagas por sucursal y no cobramos comisión por pedido, ni en WhatsApp ni en tu menú en línea.
            </p>
          </div>
          <div class="inline-flex self-start rounded-full bg-(--papel-2) p-1 ring-1 ring-(--linea)" role="group" aria-label="Forma de pago">
            <button type="button" (click)="annual.set(false)" [attr.aria-pressed]="!annual()"
              class="rounded-full px-4 py-1.5 text-sm font-semibold transition-colors cursor-pointer"
              [class]="!annual() ? 'bg-(--tinta) text-(--papel)' : 'text-(--tinta-2) hover:text-(--tinta)'">Mensual</button>
            <button type="button" (click)="annual.set(true)" [attr.aria-pressed]="annual()"
              class="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors cursor-pointer"
              [class]="annual() ? 'bg-(--tinta) text-(--papel)' : 'text-(--tinta-2) hover:text-(--tinta)'">
              Anual <span class="rounded-full bg-(--aguacate) px-1.5 py-0.5 text-[10px] font-bold text-white">-20%</span>
            </button>
          </div>
        </div>

        <div class="mt-12 grid gap-5 lg:grid-cols-3">
          @for (plan of plans; track plan.id) {
            <article class="relative flex flex-col rounded-2xl p-7"
              [class]="plan.highlighted ? 'bg-(--tinta) text-(--papel) shadow-[0_30px_60px_-30px_rgba(36,25,15,0.8)]' : 'bg-[#fffdf8] text-(--tinta) ring-1 ring-(--linea)'">
              @if (plan.highlighted) {
                <span class="absolute -top-3 left-7 rounded-full bg-(--maiz) px-3 py-1 text-[11px] font-bold text-(--tinta)">Con domicilio y WhatsApp</span>
              }
              <h3 class="lp-display text-2xl font-extrabold">{{ plan.name }}</h3>
              <p class="mt-1 text-sm" [class]="plan.highlighted ? 'text-(--papel)/70' : 'text-(--tinta-2)'">{{ plan.tagline }}</p>
              <p class="mt-6 flex items-end gap-2">
                @if (plan.monthly === null) {
                  <span class="lp-display text-4xl font-extrabold">A medida</span>
                } @else {
                  <span class="lp-display text-5xl font-extrabold tabular-nums">{{ price(plan) }}</span>
                  <span class="pb-1.5 text-xs leading-tight" [class]="plan.highlighted ? 'text-(--papel)/70' : 'text-(--tinta-2)'">USD al mes<br />por sucursal</span>
                }
              </p>
              <p class="mt-1 h-4 text-xs" [class]="plan.highlighted ? 'text-(--papel)/60' : 'text-(--tinta-2)'">
                @if (plan.monthly !== null && annual()) { Pago anual }
              </p>
              <ul class="mt-6 flex-1 space-y-3 text-[15px]">
                @for (f of plan.features; track f) {
                  <li class="flex gap-2.5">
                    <svg lucideCheck class="mt-0.5 h-4 w-4 shrink-0" [class]="plan.highlighted ? 'text-(--maiz)' : 'text-(--aguacate)'"></svg>
                    <span>{{ f }}</span>
                  </li>
                }
              </ul>
              <a routerLink="/register"
                class="mt-8 inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition-colors"
                [class]="plan.highlighted ? 'bg-(--chile) text-white hover:bg-(--chile-osc)' : 'border border-(--tinta)/25 hover:border-(--tinta)'">
                {{ plan.cta }}
                <svg lucideArrowRight class="h-4 w-4"></svg>
              </a>
            </article>
          }
        </div>
        <p class="mt-6 text-sm text-(--tinta-2)">Precios en dólares estadounidenses (USD). Sin plazo forzoso: cancelas cuando quieras. Los 14 días de prueba no piden tarjeta.</p>
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
      tagline: 'Para el local que atiende en sus mesas.',
      monthly: 29,
      highlighted: false,
      cta: 'Empezar gratis',
      features: [
        '1 sucursal y hasta 5 usuarios',
        'Mesas, meseros y pantalla de cocina',
        'Menú con combos y extras',
        'Inventario con recetas',
        'Reportes de ventas y utilidad',
      ],
    },
    {
      id: 'pro',
      name: 'Pro',
      tagline: 'Para vender también a domicilio.',
      monthly: 59,
      highlighted: true,
      cta: 'Probar 14 días gratis',
      features: [
        'Todo lo del plan Inicial',
        'Hasta 5 sucursales y usuarios ilimitados',
        'Pedidos ilimitados, 0% de comisión',
        'Pedidos por WhatsApp, menú en línea y teléfono',
        'Domicilio con envío por kilómetro y para llevar',
        'Repartidores con su liga y corte de efectivo',
      ],
    },
    {
      id: 'cadena',
      name: 'Cadena',
      tagline: 'Para marcas con muchas sucursales.',
      monthly: null,
      highlighted: false,
      cta: 'Hablar con ventas',
      features: [
        'Todo lo del plan Pro',
        'Sucursales ilimitadas',
        'Reportes de todas las sucursales juntas',
        'Te ayudamos a cargar tu menú y tu equipo',
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
