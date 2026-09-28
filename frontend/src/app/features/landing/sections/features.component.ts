import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  LucideMessageCircle,
  LucideQrCode,
  LucideChefHat,
  LucideBoxes,
  LucideChartColumn,
  LucideShieldCheck,
  LucideCreditCard,
  LucideBuilding2,
} from '@lucide/angular';

interface Feature {
  readonly icon: string;
  readonly title: string;
  readonly description: string;
  readonly accent: string;
}

@Component({
  selector: 'app-landing-features',
  standalone: true,
  imports: [
    LucideMessageCircle,
    LucideQrCode,
    LucideChefHat,
    LucideBoxes,
    LucideChartColumn,
    LucideShieldCheck,
    LucideCreditCard,
    LucideBuilding2,
  ],
  template: `
    <section id="funciones" class="scroll-mt-24 py-24 sm:py-32">
      <div class="mx-auto max-w-6xl px-5 sm:px-8">
        <!-- Encabezado de sección -->
        <div class="grid gap-6 lg:grid-cols-12 lg:gap-10">
          <p class="text-[11px] font-semibold uppercase tracking-[0.2em] text-indigo-400 lg:col-span-3 lg:pt-2">
            Todo en uno
          </p>
          <div class="lg:col-span-9">
            <h2 class="font-display max-w-2xl text-[1.8rem] sm:text-4xl font-extrabold leading-[1.1] tracking-[-0.02em] text-white">
              Deja de saltar entre la libreta, el grupo de WhatsApp y la hoja de cálculo
            </h2>
            <p class="mt-5 max-w-xl text-base leading-relaxed text-slate-400">
              Cada módulo de Pide Facil habla con los demás: un pedido que entra por WhatsApp descuenta inventario,
              aparece en cocina y suma a tus reportes sin que nadie lo copie a mano.
            </p>
          </div>
        </div>

        <!-- Retícula de funciones: dos pilares y seis apoyos, sin cajas -->
        <div class="mt-16 grid gap-x-10 gap-y-11 sm:grid-cols-2 lg:grid-cols-6">
          @for (feature of features; track feature.title; let i = $index) {
            <article
              class="group border-t pt-7"
              [class]="i < 2 ? 'lg:col-span-3 border-slate-700' : 'lg:col-span-2 border-slate-800'"
            >
              <span
                class="inline-flex items-center justify-center rounded-md ring-1 transition-transform duration-300 group-hover:-translate-y-0.5"
                [class]="feature.accent + (i < 2 ? ' w-11 h-11' : ' w-9 h-9')"
              >
                @switch (feature.icon) {
                  @case ('whatsapp') {
                    <svg lucideMessageCircle class="w-5 h-5"></svg>
                  }
                  @case ('qr') {
                    <svg lucideQrCode class="w-5 h-5"></svg>
                  }
                  @case ('kitchen') {
                    <svg lucideChefHat class="w-4 h-4"></svg>
                  }
                  @case ('stock') {
                    <svg lucideBoxes class="w-4 h-4"></svg>
                  }
                  @case ('analytics') {
                    <svg lucideChartColumn class="w-4 h-4"></svg>
                  }
                  @case ('roles') {
                    <svg lucideShieldCheck class="w-4 h-4"></svg>
                  }
                  @case ('payments') {
                    <svg lucideCreditCard class="w-4 h-4"></svg>
                  }
                  @default {
                    <svg lucideBuilding2 class="w-4 h-4"></svg>
                  }
                }
              </span>

              <h3
                class="font-display font-bold text-white"
                [class]="i < 2 ? 'mt-5 text-xl leading-snug' : 'mt-4 text-[15px] leading-snug'"
              >
                {{ feature.title }}
              </h3>
              <p
                class="leading-relaxed text-slate-400"
                [class]="i < 2 ? 'mt-3 text-[15px] max-w-md' : 'mt-2 text-[13.5px]'"
              >
                {{ feature.description }}
              </p>
            </article>
          }
        </div>
      </div>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LandingFeaturesComponent {
  readonly features: readonly Feature[] = [
    {
      icon: 'whatsapp',
      title: 'Pedidos automáticos por WhatsApp',
      description:
        'Un asistente atiende a tus clientes en tu propio número: muestra la carta, arma el pedido, confirma el total y lo manda directo a cocina. Sin apps que instalar ni comisiones por pedido.',
      accent: 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20',
    },
    {
      icon: 'qr',
      title: 'Mesas con QR y carta digital',
      description:
        'Genera un QR por mesa desde el panel. El comensal escanea, ve la carta actualizada con fotos y precios, y pide sin esperar al mesero. Tú ves la mesa ocupada en tiempo real.',
      accent: 'bg-indigo-500/10 text-indigo-400 ring-indigo-500/20',
    },
    {
      icon: 'kitchen',
      title: 'Pantalla de cocina en vivo',
      description: 'Las comandas llegan ordenadas por antigüedad, con alerta sonora y cambio de estado en un toque.',
      accent: 'bg-amber-500/10 text-amber-400 ring-amber-500/20',
    },
    {
      icon: 'stock',
      title: 'Inventario con recetas',
      description: 'Cada plato descuenta sus ingredientes al venderse. Sabes qué falta antes de que se acabe.',
      accent: 'bg-sky-500/10 text-sky-400 ring-sky-500/20',
    },
    {
      icon: 'analytics',
      title: 'Analítica de ventas',
      description: 'Ticket promedio, horas pico y platos más rentables por sucursal, con historial completo.',
      accent: 'bg-violet-500/10 text-violet-400 ring-violet-500/20',
    },
    {
      icon: 'roles',
      title: 'Roles y permisos finos',
      description: 'Define qué ve y qué puede tocar cada empleado: mesero, cocina, caja o gerencia.',
      accent: 'bg-rose-500/10 text-rose-400 ring-rose-500/20',
    },
    {
      icon: 'payments',
      title: 'Métodos de pago a tu medida',
      description: 'Efectivo, transferencia o tarjeta: registra cómo cobró cada mesa y cuadra la caja al cierre.',
      accent: 'bg-teal-500/10 text-teal-400 ring-teal-500/20',
    },
    {
      icon: 'branches',
      title: 'Multi-sucursal desde el día uno',
      description: 'Una cuenta, varias sedes. Carta, stock y reportes independientes bajo un mismo administrador.',
      accent: 'bg-fuchsia-500/10 text-fuchsia-400 ring-fuchsia-500/20',
    },
  ];
}
