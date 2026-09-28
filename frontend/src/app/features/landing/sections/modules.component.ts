import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { LucideLayoutDashboard, LucideChefHat, LucideBookOpen, LucideChartColumn, LucideCircleCheck } from '@lucide/angular';

type ModuleId = 'mesas' | 'cocina' | 'carta' | 'analitica';

interface ModuleTab {
  readonly id: ModuleId;
  readonly label: string;
  readonly title: string;
  readonly description: string;
  readonly bullets: readonly string[];
}

@Component({
  selector: 'app-landing-modules',
  standalone: true,
  imports: [LucideLayoutDashboard, LucideChefHat, LucideBookOpen, LucideChartColumn, LucideCircleCheck],
  template: `
    <section id="modulos" class="scroll-mt-24 border-t border-slate-800 py-24 sm:py-32">
      <div class="mx-auto max-w-6xl px-5 sm:px-8">
        <div class="grid gap-6 lg:grid-cols-12 lg:gap-10">
          <p class="text-[11px] font-semibold uppercase tracking-[0.2em] text-indigo-400 lg:col-span-3 lg:pt-2">
            El panel por dentro
          </p>
          <h2 class="font-display max-w-2xl text-[1.8rem] sm:text-4xl font-extrabold leading-[1.1] tracking-[-0.02em] text-white lg:col-span-9">
            Un módulo para cada momento del servicio
          </h2>
        </div>

        <!-- Selector de módulo: riel subrayado -->
        <div
          class="mt-12 -mx-5 overflow-x-auto border-b border-slate-800 px-5 sm:mx-0 sm:px-0"
          role="tablist"
          aria-label="Módulos de Pide Facil"
        >
          <div class="flex min-w-max gap-7">
            @for (tab of tabs; track tab.id) {
              <button
                type="button"
                role="tab"
                [id]="'tab-' + tab.id"
                [attr.aria-selected]="active() === tab.id"
                [attr.aria-controls]="'panel-' + tab.id"
                [tabindex]="active() === tab.id ? 0 : -1"
                (click)="select(tab.id)"
                (keydown)="onTabKeydown($event)"
                class="-mb-px inline-flex cursor-pointer items-center gap-2 border-b-2 pb-3.5 text-sm font-semibold transition-colors"
                [class]="
                  active() === tab.id
                    ? 'border-indigo-400 text-white'
                    : 'border-transparent text-slate-500 hover:text-slate-200'
                "
              >
                @switch (tab.id) {
                  @case ('mesas') {
                    <svg lucideLayoutDashboard class="w-4 h-4"></svg>
                  }
                  @case ('cocina') {
                    <svg lucideChefHat class="w-4 h-4"></svg>
                  }
                  @case ('carta') {
                    <svg lucideBookOpen class="w-4 h-4"></svg>
                  }
                  @default {
                    <svg lucideChartColumn class="w-4 h-4"></svg>
                  }
                }
                {{ tab.label }}
              </button>
            }
          </div>
        </div>

        <!-- Contenido del módulo -->
        @for (tab of tabs; track tab.id) {
          @if (active() === tab.id) {
            <div
              [id]="'panel-' + tab.id"
              role="tabpanel"
              [attr.aria-labelledby]="'tab-' + tab.id"
              class="animate-fade-in mt-12 grid items-start gap-10 lg:grid-cols-12 lg:gap-10"
            >
              <div class="lg:col-span-4">
                <h3 class="font-display text-2xl font-bold leading-snug text-white">{{ tab.title }}</h3>
                <p class="mt-4 text-[15px] leading-relaxed text-slate-400">{{ tab.description }}</p>
                <ul class="mt-7 divide-y divide-slate-800 border-y border-slate-800">
                  @for (bullet of tab.bullets; track bullet) {
                    <li class="flex items-start gap-3 py-3.5 text-[13.5px] leading-snug text-slate-300">
                      <svg lucideCircleCheck class="mt-0.5 h-4 w-4 shrink-0 text-emerald-500"></svg>
                      <span>{{ bullet }}</span>
                    </li>
                  }
                </ul>
              </div>

              <!-- Maqueta del módulo -->
              <div
                class="overflow-hidden rounded-lg bg-slate-900 ring-1 ring-slate-800 lg:col-span-8"
                aria-hidden="true"
              >
                <!-- Barra de ventana -->
                <div class="flex items-center gap-1.5 border-b border-slate-800 bg-slate-900/60 px-4 py-3">
                  <span class="h-2.5 w-2.5 rounded-full bg-slate-700"></span>
                  <span class="h-2.5 w-2.5 rounded-full bg-slate-700"></span>
                  <span class="h-2.5 w-2.5 rounded-full bg-slate-700"></span>
                  <span class="ml-3 text-[11px] tracking-tight text-slate-500">pidefacil.app/{{ tab.id }}</span>
                </div>

                <div class="bg-slate-950/40 p-4 sm:p-6">
                  @switch (tab.id) {
                    @case ('mesas') {
                      <div class="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                        @for (table of tables; track table.n) {
                          <div
                            class="rounded-md p-3.5 ring-1"
                            [class]="
                              table.state === 'ocupada'
                                ? 'bg-indigo-500/10 ring-indigo-500/30'
                                : table.state === 'cuenta'
                                  ? 'bg-amber-500/10 ring-amber-500/30'
                                  : 'bg-slate-900/60 ring-slate-800'
                            "
                          >
                            <p class="font-display text-sm font-bold text-white">Mesa {{ table.n }}</p>
                            <p
                              class="mt-1 text-[11px] font-semibold uppercase tracking-[0.1em]"
                              [class]="
                                table.state === 'ocupada'
                                  ? 'text-indigo-300'
                                  : table.state === 'cuenta'
                                    ? 'text-amber-300'
                                    : 'text-slate-500'
                              "
                            >
                              {{ table.state }}
                            </p>
                            <p class="mt-2 text-[12px] text-slate-400">{{ table.total }}</p>
                          </div>
                        }
                      </div>
                    }

                    @case ('cocina') {
                      <div class="grid gap-3 sm:grid-cols-3">
                        @for (ticket of tickets; track ticket.id) {
                          <div class="rounded-md bg-slate-900/60 p-3.5 ring-1 ring-slate-800">
                            <div class="flex items-center justify-between gap-2">
                              <span class="font-display text-sm font-bold text-white">{{ ticket.id }}</span>
                              <span
                                class="rounded px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide"
                                [class]="ticket.badgeClass"
                                >{{ ticket.minutes }}</span
                              >
                            </div>
                            <ul class="mt-3 space-y-1.5 text-[11.5px] text-slate-300">
                              @for (line of ticket.items; track line) {
                                <li class="truncate">{{ line }}</li>
                              }
                            </ul>
                            <div class="mt-3.5 h-1 overflow-hidden rounded-full bg-slate-800">
                              <div class="h-full rounded-full" [class]="ticket.barClass" [style.width.%]="ticket.progress"></div>
                            </div>
                          </div>
                        }
                      </div>
                    }

                    @case ('carta') {
                      <ul class="divide-y divide-slate-800 overflow-hidden rounded-md ring-1 ring-slate-800">
                        @for (dish of dishes; track dish.name) {
                          <li class="flex items-center gap-3.5 bg-slate-900/60 p-3.5">
                            <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-slate-800 text-base">{{ dish.emoji }}</span>
                            <div class="min-w-0 flex-1">
                              <p class="truncate text-[13.5px] font-semibold text-white">{{ dish.name }}</p>
                              <p class="text-[11px] text-slate-500">{{ dish.category }}</p>
                            </div>
                            <span class="text-[13.5px] font-bold tabular-nums text-white">{{ dish.price }}</span>
                            <span
                              class="rounded px-1.5 py-0.5 text-[11px] font-semibold"
                              [class]="dish.stock ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'"
                              >{{ dish.stock ? 'Disponible' : 'Sin stock' }}</span
                            >
                          </li>
                        }
                      </ul>
                    }

                    @default {
                      <div class="space-y-3">
                        <div class="grid grid-cols-3 divide-x divide-slate-800 overflow-hidden rounded-md bg-slate-900/60 ring-1 ring-slate-800">
                          @for (kpi of kpis; track kpi.label) {
                            <div class="p-3.5">
                              <p class="text-[11px] uppercase tracking-[0.1em] text-slate-500">{{ kpi.label }}</p>
                              <p class="font-display mt-1.5 text-lg font-extrabold tabular-nums text-white">{{ kpi.value }}</p>
                              <p class="text-[11px] font-semibold text-emerald-400">{{ kpi.delta }}</p>
                            </div>
                          }
                        </div>
                        <div class="rounded-md bg-slate-900/60 p-4 ring-1 ring-slate-800">
                          <p class="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">Ventas por hora</p>
                          <div class="mt-4 flex h-28 items-end gap-1.5">
                            @for (bar of chart; track $index) {
                              <span class="flex-1 rounded-t-sm bg-indigo-500/70" [style.height.%]="bar"></span>
                            }
                          </div>
                          <div class="mt-2.5 flex justify-between border-t border-slate-800 pt-2 text-[11px] tabular-nums text-slate-600">
                            <span>12h</span><span>16h</span><span>20h</span><span>00h</span>
                          </div>
                        </div>
                      </div>
                    }
                  }
                </div>
              </div>
            </div>
          }
        }
      </div>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LandingModulesComponent {
  readonly active = signal<ModuleId>('mesas');

  readonly tabs: readonly ModuleTab[] = [
    {
      id: 'mesas',
      label: 'Mesas',
      title: 'El salón completo en una pantalla',
      description:
        'Ve qué mesa está ocupada, cuánto lleva consumido y quién la atiende. Abre la comanda con un clic y cierra la cuenta con el método de pago que usó el cliente.',
      bullets: [
        'Estado de cada mesa en tiempo real vía WebSocket',
        'QR por mesa para que el cliente pida solo',
        'Cierre de cuenta con división por método de pago',
      ],
    },
    {
      id: 'cocina',
      label: 'Cocina',
      title: 'Comandas que nadie tiene que gritar',
      description:
        'La pantalla de cocina ordena los pedidos por antigüedad, avisa con sonido cuando entra uno nuevo y colorea los que llevan demasiado tiempo esperando.',
      bullets: [
        'Alerta sonora al recibir una comanda nueva',
        'Semáforo de tiempos para detectar demoras',
        'Marcar como listo notifica al salón al instante',
      ],
    },
    {
      id: 'carta',
      label: 'Carta',
      title: 'Una carta que se actualiza sola',
      description:
        'Categorías, platos, precios y recetas en un solo lugar. Si un ingrediente se agota, el plato se marca sin stock en la carta digital y en el bot de WhatsApp.',
      bullets: [
        'Recetas que descuentan ingredientes al vender',
        'Stock por sucursal, no por restaurante',
        'Cambios de precio reflejados al instante en el QR',
      ],
    },
    {
      id: 'analitica',
      label: 'Analítica',
      title: 'Decide con números, no con memoria',
      description:
        'Ventas por día, ticket promedio, horas pico y ranking de platos. Compara sucursales y descubre qué conviene promocionar esta semana.',
      bullets: [
        'Histórico de ventas exportable',
        'Comparativa entre sucursales',
        'Ranking de productos más y menos vendidos',
      ],
    },
  ];

  readonly tables = [
    { n: 1, state: 'ocupada', total: '$48,00' },
    { n: 2, state: 'libre', total: '—' },
    { n: 3, state: 'cuenta', total: '$92,50' },
    { n: 4, state: 'ocupada', total: '$21,00' },
    { n: 5, state: 'libre', total: '—' },
    { n: 6, state: 'ocupada', total: '$67,80' },
    { n: 7, state: 'cuenta', total: '$35,20' },
    { n: 8, state: 'libre', total: '—' },
  ];

  readonly tickets = [
    {
      id: '#1042',
      minutes: '2 min',
      items: ['2x Pizza Napolitana', '1x Ensalada Cesar'],
      progress: 25,
      badgeClass: 'bg-emerald-500/15 text-emerald-400',
      barClass: 'bg-emerald-500',
    },
    {
      id: '#1041',
      minutes: '11 min',
      items: ['1x Risotto', '2x Tiramisu', '1x Focaccia'],
      progress: 65,
      badgeClass: 'bg-amber-500/15 text-amber-400',
      barClass: 'bg-amber-500',
    },
    {
      id: '#1039',
      minutes: '19 min',
      items: ['3x Lasagna', '1x Sopa del dia'],
      progress: 92,
      badgeClass: 'bg-rose-500/15 text-rose-400',
      barClass: 'bg-rose-500',
    },
  ];

  readonly dishes = [
    { emoji: '🍕', name: 'Pizza Napolitana', category: 'Pizzas', price: '$12,50', stock: true },
    { emoji: '🥗', name: 'Ensalada Cesar', category: 'Entradas', price: '$7,50', stock: true },
    { emoji: '🍝', name: 'Lasagna de la casa', category: 'Pastas', price: '$14,00', stock: true },
    { emoji: '🍰', name: 'Tiramisu', category: 'Postres', price: '$6,00', stock: false },
  ];

  readonly kpis = [
    { label: 'Ventas hoy', value: '$4.860', delta: '+23%' },
    { label: 'Ticket prom.', value: '$28,4', delta: '+6%' },
    { label: 'Pedidos', value: '171', delta: '+18%' },
  ];

  readonly chart = [22, 34, 30, 48, 41, 62, 78, 95, 88, 70, 52, 30];

  select(id: ModuleId): void {
    this.active.set(id);
  }

  /** Navegación con flechas entre pestañas, como espera un lector de pantalla. */
  onTabKeydown(event: KeyboardEvent): void {
    const offset = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (offset === 0) return;

    event.preventDefault();
    const index = this.tabs.findIndex((tab) => tab.id === this.active());
    const next = this.tabs[(index + offset + this.tabs.length) % this.tabs.length];
    this.active.set(next.id);
    document.getElementById('tab-' + next.id)?.focus();
  }
}
