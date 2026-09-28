import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  LucideArrowRight,
  LucidePlay,
  LucideSparkles,
  LucideCircleCheck,
  LucideCheck,
  LucideQrCode,
  LucideChefHat,
} from '@lucide/angular';

interface ChatMessage {
  readonly mine: boolean;
  readonly text: string;
  readonly time: string;
}

@Component({
  selector: 'app-landing-hero',
  standalone: true,
  imports: [
    RouterLink,
    LucideArrowRight,
    LucidePlay,
    LucideSparkles,
    LucideCircleCheck,
    LucideCheck,
    LucideQrCode,
    LucideChefHat,
  ],
  template: `
    <section class="relative overflow-hidden pt-28 sm:pt-32">
      <!-- Retícula de fondo, sin destellos -->
      <div
        class="absolute inset-0 bg-grid [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_30%,transparent_100%)]"
        aria-hidden="true"
      ></div>

      <div class="relative mx-auto max-w-6xl px-5 sm:px-8">
        <div class="grid items-start gap-14 pb-20 lg:grid-cols-12 lg:gap-10 lg:pb-28">
          <!-- Mensaje principal -->
          <div class="lg:col-span-7 lg:pt-6">
            <span
              class="animate-fade-up inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400"
            >
              <svg lucideSparkles class="w-3.5 h-3.5 text-emerald-400"></svg>
              Bot de pedidos por WhatsApp incluido
            </span>

            <h1
              class="animate-fade-up delay-75 font-display mt-7 text-[2.7rem] sm:text-6xl lg:text-[4.1rem] font-extrabold leading-[0.98] tracking-[-0.035em] text-white"
            >
              Tu restaurante atiende, cobra y se organiza
              <span class="text-gradient">desde WhatsApp</span>
            </h1>

            <p
              class="animate-fade-up delay-150 mt-7 max-w-xl text-base sm:text-lg leading-relaxed text-slate-400"
            >
              Pide Facil une tu carta digital, las mesas con QR, la pantalla de cocina, el inventario y las ventas en un
              solo panel. Los pedidos entran solos por WhatsApp: tu equipo solo cocina y sirve.
            </p>

            <div class="animate-fade-up delay-225 mt-10 flex flex-col sm:flex-row gap-3">
              <a
                routerLink="/register"
                class="group inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-500 px-6 py-3.5 font-semibold text-white transition-colors hover:bg-indigo-400"
              >
                Crear cuenta gratis
                <svg lucideArrowRight class="w-4 h-4 transition-transform group-hover:translate-x-1"></svg>
              </a>
              <a
                href="#como-funciona"
                class="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-700 px-6 py-3.5 font-semibold text-slate-200 transition-colors hover:border-slate-500 hover:text-white"
              >
                <svg lucidePlay class="w-4 h-4"></svg>
                Ver cómo funciona
              </a>
            </div>

            <ul
              class="animate-fade-up delay-300 mt-10 flex flex-col gap-3 text-sm text-slate-500 sm:flex-row sm:items-center sm:gap-0 sm:divide-x sm:divide-slate-800"
            >
              @for (item of assurances; track item) {
                <li class="inline-flex items-center gap-2 sm:px-4 sm:first:pl-0">
                  <svg lucideCircleCheck class="w-4 h-4 shrink-0 text-emerald-500"></svg>
                  {{ item }}
                </li>
              }
            </ul>
          </div>

          <!-- Maqueta del producto -->
          <div class="animate-fade-up delay-300 lg:col-span-5" aria-hidden="true">
            <div class="relative mx-auto w-full max-w-[310px] lg:ml-auto lg:mr-0">
            <!-- Teléfono con la conversación -->
            <div class="relative rounded-[2.25rem] bg-slate-900 p-2.5 ring-1 ring-slate-800">
              <div class="overflow-hidden rounded-[1.85rem] bg-slate-950">
                <div class="flex items-center gap-3 bg-emerald-600 px-4 py-3">
                  <span class="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-sm font-bold text-white">
                    LT
                  </span>
                  <div class="min-w-0">
                    <p class="truncate text-sm font-semibold text-white">La Trattoria</p>
                    <p class="text-[11px] text-emerald-100">en linea</p>
                  </div>
                </div>

                <div class="min-h-[340px] space-y-2.5 bg-[#0b141a] px-3 py-4">
                  @for (msg of chat; track $index) {
                    <div class="flex" [class.justify-end]="msg.mine">
                      <div
                        class="max-w-[80%] rounded-lg px-3 py-2 text-[12.5px] leading-snug"
                        [class]="msg.mine ? 'bg-emerald-800 text-white' : 'bg-slate-800 text-slate-100'"
                      >
                        <span [innerHTML]="msg.text"></span>
                        <span class="mt-1 flex items-center justify-end gap-1 text-[11px] opacity-60">
                          {{ msg.time }}
                          @if (msg.mine) {
                            <svg lucideCheck class="w-3 h-3"></svg>
                          }
                        </span>
                      </div>
                    </div>
                  }
                </div>
              </div>
            </div>

            <!-- Comanda en cocina -->
            <div
              class="animate-float absolute -left-8 bottom-14 hidden w-52 rounded-lg bg-slate-900/95 p-3.5 ring-1 ring-slate-800 backdrop-blur sm:block"
            >
              <div class="flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-amber-400">
                <svg lucideChefHat class="w-4 h-4"></svg>
                Cocina · Mesa 7
              </div>
              <div class="mt-3 space-y-1.5 text-[12px] text-slate-300">
                <p class="flex justify-between gap-3">
                  <span>2x Pizza Napolitana</span><span class="text-slate-500">08:12</span>
                </p>
                <p class="flex justify-between gap-3">
                  <span>1x Ensalada Cesar</span><span class="text-slate-500">08:12</span>
                </p>
              </div>
              <div class="mt-3.5 h-1 overflow-hidden rounded-full bg-slate-800">
                <div class="h-full w-2/3 rounded-full bg-amber-400"></div>
              </div>
            </div>

            <!-- Ventas del día -->
            <div
              class="absolute -right-8 top-10 hidden w-44 rounded-lg bg-slate-900/95 p-3.5 ring-1 ring-slate-800 backdrop-blur sm:block"
            >
              <div class="flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-indigo-300">
                <svg lucideQrCode class="w-4 h-4"></svg>
                Ventas de hoy
              </div>
              <p class="font-display mt-2.5 text-2xl font-extrabold text-white">$4.860</p>
              <p class="text-[11px] font-medium text-emerald-400">+23% vs. ayer</p>
              <div class="mt-3 flex h-9 items-end gap-1">
                @for (bar of sparkline; track $index) {
                  <span class="flex-1 rounded-sm bg-indigo-500/70" [style.height.%]="bar"></span>
                }
              </div>
            </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Métricas: banda a sangre, sin caja -->
      <div class="animate-fade-up delay-450 border-y border-slate-800">
        <dl
          class="mx-auto grid max-w-6xl grid-cols-2 divide-slate-800 px-5 sm:px-8 lg:grid-cols-4 lg:divide-x"
        >
          @for (stat of stats; track stat.label) {
            <div class="border-b border-slate-800 py-7 lg:border-b-0 lg:px-7 lg:first:pl-0 lg:last:pr-0">
              <dt class="sr-only">{{ stat.label }}</dt>
              <dd>
                <span class="font-display block text-3xl font-extrabold tracking-tight text-white">{{ stat.value }}</span>
                <span class="mt-1.5 block max-w-[15ch] text-[13px] leading-snug text-slate-500">{{ stat.label }}</span>
              </dd>
            </div>
          }
        </dl>
      </div>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LandingHeroComponent {
  readonly assurances = ['Sin tarjeta de credito', 'Listo en 10 minutos', 'Tu numero de WhatsApp de siempre'];

  readonly chat: readonly ChatMessage[] = [
    { mine: false, text: 'Hola! Quiero pedir para llevar', time: '20:14' },
    { mine: true, text: 'Hola! Soy el asistente de <b>La Trattoria</b>. Te comparto la carta.', time: '20:14' },
    { mine: false, text: '2 pizzas napolitanas y una cesar', time: '20:15' },
    { mine: true, text: 'Anotado.<br>Total: <b>$32,50</b><br>Confirmo el pedido?', time: '20:15' },
    { mine: false, text: 'Si, confirmo', time: '20:16' },
    { mine: true, text: 'Pedido <b>#1042</b> enviado a cocina.<br>Listo en ~25 min.', time: '20:16' },
  ];

  readonly sparkline = [35, 52, 44, 68, 58, 80, 72, 100];

  readonly stats = [
    { value: '24/7', label: 'Toma pedidos sin descanso' },
    { value: '-40%', label: 'Errores al anotar comandas' },
    { value: '3 min', label: 'De la mesa al QR con la carta' },
    { value: '1 panel', label: 'Todas tus sucursales' },
  ];
}
