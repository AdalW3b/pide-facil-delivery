import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { LucideCircleCheck } from '@lucide/angular';

type ModuleId = 'cocina' | 'domicilio' | 'inventario' | 'reportes';

interface ModuleTab {
  readonly id: ModuleId;
  readonly label: string;
  readonly title: string;
  readonly description: string;
  readonly bullets: readonly string[];
}

/** Recorrido por las pantallas del sistema, con maquetas hechas en HTML (sin capturas). */
@Component({
  selector: 'app-landing-modules',
  standalone: true,
  imports: [LucideCircleCheck],
  template: `
    <section id="modulos" class="py-20 lg:py-28" aria-labelledby="modulos-titulo">
      <div class="mx-auto max-w-6xl px-5 sm:px-8">
        <div class="max-w-2xl">
          <p class="lp-mono text-xs uppercase tracking-[0.18em] text-(--chile)">El sistema</p>
          <h2 id="modulos-titulo" class="lp-display mt-3 text-3xl font-extrabold leading-tight text-(--tinta) sm:text-4xl text-balance">
            Así se ve un servicio de viernes en la noche
          </h2>
        </div>

        <div class="mt-10 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Pantallas del sistema" (keydown)="onTabKeydown($event)">
          @for (tab of tabs; track tab.id) {
            <button type="button" role="tab" [id]="'tab-' + tab.id" [attr.aria-selected]="active() === tab.id"
              [attr.aria-controls]="'panel-' + tab.id" [attr.tabindex]="active() === tab.id ? 0 : -1" (click)="select(tab.id)"
              class="shrink-0 rounded-full px-5 py-2 text-sm font-semibold transition-colors cursor-pointer"
              [class]="active() === tab.id ? 'bg-(--tinta) text-(--papel)' : 'bg-(--papel-2) text-(--tinta-2) hover:text-(--tinta)'">
              {{ tab.label }}
            </button>
          }
        </div>

        @for (tab of tabs; track tab.id) {
          @if (active() === tab.id) {
            <div [id]="'panel-' + tab.id" role="tabpanel" [attr.aria-labelledby]="'tab-' + tab.id"
              class="mt-8 grid items-start gap-10 lg:grid-cols-[0.85fr_1.15fr] animate-fade-in">
              <div>
                <h3 class="lp-display text-2xl font-extrabold text-(--tinta) sm:text-3xl text-balance">{{ tab.title }}</h3>
                <p class="mt-4 text-[15px] leading-relaxed text-(--tinta-2)">{{ tab.description }}</p>
                <ul class="mt-6 space-y-3">
                  @for (b of tab.bullets; track b) {
                    <li class="flex gap-2.5 text-[15px] text-(--tinta)">
                      <svg lucideCircleCheck class="mt-0.5 h-4.5 w-4.5 shrink-0 text-(--aguacate)"></svg>
                      {{ b }}
                    </li>
                  }
                </ul>
              </div>

              <div class="rounded-2xl bg-(--tinta) p-4 sm:p-6 shadow-[0_30px_60px_-30px_rgba(36,25,15,0.7)]" aria-hidden="true">
                @switch (tab.id) {
                  @case ('cocina') {
                    <div class="grid gap-3 sm:grid-cols-3">
                      @for (t of tickets; track t.id) {
                        <div class="rounded-lg bg-[#fffdf8] p-3">
                          <div class="flex items-center justify-between">
                            <span class="lp-display text-lg font-extrabold text-(--tinta)">{{ t.id }}</span>
                            <span class="lp-mono rounded-full px-2 py-0.5 text-[11px] font-semibold" [style.background]="t.fondo" [style.color]="t.color">{{ t.minutos }}</span>
                          </div>
                          <p class="lp-mono mt-0.5 text-[10px] uppercase tracking-wider text-(--tinta-2)">{{ t.origen }}</p>
                          <div class="lp-corte my-2"></div>
                          <ul class="lp-mono space-y-1 text-[12px] text-(--tinta)">
                            @for (i of t.items; track i) { <li>{{ i }}</li> }
                          </ul>
                          <div class="mt-3 rounded-md py-1.5 text-center text-[11px] font-semibold" [style.background]="t.color" style="color:#fff">Listo</div>
                        </div>
                      }
                    </div>
                  }
                  @case ('domicilio') {
                    <ul class="space-y-2.5">
                      @for (p of entregas; track p.id) {
                        <li class="flex items-center justify-between gap-3 rounded-lg bg-[#fffdf8] px-4 py-3">
                          <div class="min-w-0">
                            <p class="text-sm font-semibold text-(--tinta)"><span class="lp-mono">{{ p.id }}</span> · {{ p.cliente }}</p>
                            <p class="lp-mono text-[11px] text-(--tinta-2)">{{ p.detalle }}</p>
                          </div>
                          <span class="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold" [style.background]="p.fondo" [style.color]="p.color">{{ p.estado }}</span>
                        </li>
                      }
                    </ul>
                    <div class="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/15 px-4 py-3 text-(--papel)">
                      <span class="text-sm">Corte de <b>Juan</b> · 9 entregas</span>
                      <span class="lp-mono text-sm">Entrega <b class="text-(--maiz)">$1,840</b> · se queda $186</span>
                    </div>
                  }
                  @case ('inventario') {
                    <div class="overflow-hidden rounded-lg bg-[#fffdf8]">
                      <div class="grid grid-cols-[1.4fr_1fr_1fr] gap-2 border-b border-(--linea) px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-(--tinta-2)">
                        <span>Artículo</span><span>Hay</span><span>Zona</span>
                      </div>
                      @for (a of articulos; track a.nombre) {
                        <div class="grid grid-cols-[1.4fr_1fr_1fr] items-center gap-2 border-b border-(--linea)/70 px-4 py-2.5 text-sm last:border-0">
                          <span class="font-medium text-(--tinta)">{{ a.nombre }}</span>
                          <span>
                            <span class="lp-mono" [style.color]="a.bajo ? 'var(--chile)' : 'var(--tinta)'">{{ a.hay }}</span>
                            @if (a.bajo) { <span class="ml-1 rounded bg-(--chile)/10 px-1.5 py-0.5 text-[10px] font-semibold text-(--chile)">mínimo</span> }
                          </span>
                          <span class="text-(--tinta-2)">{{ a.zona }}</span>
                        </div>
                      }
                    </div>
                    <p class="mt-3 text-xs text-(--papel)/75">Taco al pastor: costo <span class="lp-mono text-(--maiz)">$7.40</span> · precio $22 · margen 66%</p>
                  }
                  @case ('reportes') {
                    <div class="grid gap-3 sm:grid-cols-3">
                      @for (k of kpis; track k.label) {
                        <div class="rounded-lg bg-[#fffdf8] p-3">
                          <p class="text-[11px] font-semibold uppercase tracking-wider text-(--tinta-2)">{{ k.label }}</p>
                          <p class="lp-display mt-1 text-xl font-extrabold text-(--tinta)">{{ k.value }}</p>
                          <p class="lp-mono text-[11px] text-(--aguacate)">{{ k.nota }}</p>
                        </div>
                      }
                    </div>
                    <div class="mt-3 rounded-lg bg-[#fffdf8] p-4">
                      <p class="text-[11px] font-semibold uppercase tracking-wider text-(--tinta-2)">Por canal</p>
                      <ul class="mt-3 space-y-2.5">
                        @for (c of canales; track c.nombre) {
                          <li>
                            <div class="flex justify-between text-[13px] text-(--tinta)"><span>{{ c.nombre }}</span><span class="lp-mono">{{ c.pct }}%</span></div>
                            <div class="mt-1 h-2 rounded-full bg-(--papel-2)"><div class="h-2 rounded-full" [style.width.%]="c.pct" [style.background]="c.color"></div></div>
                          </li>
                        }
                      </ul>
                    </div>
                  }
                }
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
  readonly active = signal<ModuleId>('cocina');

  readonly tabs: readonly ModuleTab[] = [
    {
      id: 'cocina',
      label: 'Cocina',
      title: 'Comandas que nadie tiene que gritar',
      description:
        'Los pedidos de todos los canales aparecen en orden de llegada, suenan al entrar y cambian de color cuando ya llevan rato esperando.',
      bullets: [
        'Sonido al entrar cada comanda',
        'Semáforo de tiempo por pedido',
        '"Se acabó" con un toque: deja de ofrecerse ese día',
      ],
    },
    {
      id: 'domicilio',
      label: 'Domicilio',
      title: 'Del "¿ya viene?" al pedido rastreado',
      description:
        'Confirmas, mandas a cocina y asignas repartidor desde un tablero. El cliente sigue su pedido y el repartidor ve la dirección y el mapa en su celular.',
      bullets: [
        'Envío calculado por distancia con tus tarifas',
        'Liga para cada repartidor, sin app que instalar',
        'Corte de efectivo, pago por entrega y propinas',
      ],
    },
    {
      id: 'inventario',
      label: 'Inventario',
      title: 'Sabes qué hay antes de que se acabe',
      description:
        'Cada platillo descuenta su receta al venderse. Registras compras con su costo, haces conteos por zona y ves la merma.',
      bullets: [
        'Aviso cuando un ingrediente llega al mínimo',
        'Costo promedio con cada compra',
        'Preparaciones (salsas, marinados) y traspasos entre sucursales',
      ],
    },
    {
      id: 'reportes',
      label: 'Reportes',
      title: 'No solo cuánto vendiste: cuánto te dejó',
      description:
        'Ventas, utilidad y margen del periodo, por canal, por platillo y por mesero. Las horas pico por día de la semana te ayudan a armar turnos.',
      bullets: [
        'Utilidad y margen por platillo',
        'Comparación contra el periodo anterior',
        'Exporta a Excel ventas, platillos y meseros',
      ],
    },
  ];

  readonly tickets = [
    { id: '#1042', origen: 'WhatsApp', minutos: '3 min', items: ['4 Pastor con todo', '1 Gringa', '2 Jamaica'], color: '#2f6e45', fondo: '#2f6e4520' },
    { id: '#1041', origen: 'Mesa 4', minutos: '12 min', items: ['2 Suadero', '1 Quesadilla', '1 Horchata'], color: '#b7791f', fondo: '#f0b42933' },
    { id: '#1039', origen: 'Teléfono', minutos: '21 min', items: ['Orden de costilla', '3 Campechanos'], color: '#c8381f', fondo: '#c8381f1f' },
  ];

  readonly entregas = [
    { id: '#1042', cliente: 'Mariana R.', detalle: 'Col. Roma · 2.4 km · paga con $300', estado: 'En cocina', color: '#8a5a00', fondo: '#f0b42933' },
    { id: '#1040', cliente: 'Luis G.', detalle: 'Narvarte · 3.1 km · paga con $500', estado: 'En camino · Juan', color: '#1f5f8f', fondo: '#1f5f8f1f' },
    { id: '#1037', cliente: 'Andrea P.', detalle: 'Del Valle · 1.2 km · pago exacto', estado: 'Entregado', color: '#2f6e45', fondo: '#2f6e4520' },
  ];

  readonly articulos = [
    { nombre: 'Carne de pastor', hay: '3.2 kg', zona: 'Refri', bajo: true },
    { nombre: 'Tortilla de maíz', hay: '420 pz', zona: 'Almacén', bajo: false },
    { nombre: 'Piña', hay: '2 pz', zona: 'Verduras', bajo: true },
    { nombre: 'Queso Oaxaca', hay: '4.5 kg', zona: 'Refri', bajo: false },
  ];

  readonly kpis = [
    { label: 'Ventas', value: '$18,420', nota: '↑ 12% vs. semana pasada' },
    { label: 'Utilidad', value: '$11,260', nota: 'margen 61%' },
    { label: 'Ticket', value: '$186', nota: '99 órdenes' },
  ];

  readonly canales = [
    { nombre: 'Salón', pct: 46, color: 'var(--aguacate)' },
    { nombre: 'Domicilio', pct: 38, color: 'var(--chile)' },
    { nombre: 'Para llevar · teléfono', pct: 16, color: 'var(--maiz)' },
  ];

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
