import { ChangeDetectionStrategy, Component } from '@angular/core';
import { LucideX, LucideCheck } from '@lucide/angular';

@Component({
  selector: 'app-landing-comparison',
  standalone: true,
  imports: [LucideX, LucideCheck],
  template: `
    <section class="border-t border-slate-800 py-24 sm:py-32">
      <div class="mx-auto max-w-6xl px-5 sm:px-8">
        <div class="grid gap-6 lg:grid-cols-12 lg:gap-10">
          <p class="text-[11px] font-semibold uppercase tracking-[0.2em] text-indigo-400 lg:col-span-3 lg:pt-2">
            El cambio
          </p>
          <h2 class="font-display max-w-2xl text-[1.8rem] sm:text-4xl font-extrabold leading-[1.1] tracking-[-0.02em] text-white lg:col-span-9">
            Lo mismo que ya haces, sin la parte que te desgasta
          </h2>
        </div>

        <!-- Libro mayor: cada problema frente a su solución, en la misma fila -->
        <div class="mt-16">
          <div class="hidden gap-10 border-b border-slate-700 pb-3 md:grid md:grid-cols-2">
            <h3 class="font-display text-[13px] font-bold uppercase tracking-[0.16em] text-slate-500">Sin Pide Facil</h3>
            <h3 class="font-display text-[13px] font-bold uppercase tracking-[0.16em] text-indigo-300">Con Pide Facil</h3>
          </div>

          <dl class="divide-y divide-slate-800">
            @for (item of before; track item; let i = $index) {
              <div class="grid gap-x-10 gap-y-4 py-6 md:grid-cols-2">
                <dt class="flex items-start gap-3">
                  <span class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-500/10">
                    <svg lucideX class="h-3 w-3 text-rose-400"></svg>
                  </span>
                  <span class="text-[15px] leading-snug text-slate-500">
                    <span class="mb-1 block text-[11px] font-bold uppercase tracking-[0.16em] text-slate-600 md:hidden">
                      Sin Pide Facil
                    </span>
                    {{ item }}
                  </span>
                </dt>
                <dd class="flex items-start gap-3">
                  <span class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15">
                    <svg lucideCheck class="h-3 w-3 text-emerald-400"></svg>
                  </span>
                  <span class="text-[15px] leading-snug text-slate-100">
                    <span class="mb-1 block text-[11px] font-bold uppercase tracking-[0.16em] text-indigo-300 md:hidden">
                      Con Pide Facil
                    </span>
                    {{ after[i] }}
                  </span>
                </dd>
              </div>
            }
          </dl>
        </div>
      </div>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LandingComparisonComponent {
  readonly before = [
    'Los pedidos llegan por mensajes sueltos y alguien los copia a mano.',
    'La cocina se entera por gritos o por un papel que se pierde.',
    'Nadie sabe cuánto se vendió hasta cerrar la caja de noche.',
    'El inventario se revisa a ojo y siempre falta algo el fin de semana.',
    'Cambiar un precio implica reimprimir la carta.',
    'Cada empleado ve todo el sistema, o no ve nada.',
  ];

  readonly after = [
    'El bot toma el pedido, lo cotiza y lo registra sin intervención.',
    'La comanda aparece en la pantalla de cocina con alerta sonora.',
    'Las ventas se actualizan en vivo mientras el servicio ocurre.',
    'Cada plato vendido descuenta sus ingredientes automáticamente.',
    'Editas el precio una vez y cambia en el QR y en WhatsApp.',
    'Cada rol ve exactamente los módulos que le corresponden.',
  ];
}
