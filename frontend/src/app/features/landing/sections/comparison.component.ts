import { ChangeDetectionStrategy, Component } from '@angular/core';
import { LucideX, LucideCheck, LucideMinus } from '@lucide/angular';

type Valor = 'si' | 'no' | 'parcial';

interface Fila {
  readonly tema: string;
  readonly apps: { valor: Valor; texto: string };
  readonly soloPedido: { valor: Valor; texto: string };
  readonly nosotros: { valor: Valor; texto: string };
}

/**
 * Comparación por categorías, sin nombrar marcas: apps de delivery,
 * herramientas que solo toman el pedido y Pide Facil.
 */
@Component({
  selector: 'app-landing-comparison',
  standalone: true,
  imports: [LucideX, LucideCheck, LucideMinus],
  template: `
    <section class="py-20 lg:py-28" aria-labelledby="comparar-titulo">
      <div class="mx-auto max-w-6xl px-5 sm:px-8">
        <div class="max-w-2xl">
          <p class="lp-mono text-xs uppercase tracking-[0.18em] text-(--chile)">Compara</p>
          <h2 id="comparar-titulo" class="lp-display mt-3 text-3xl font-extrabold leading-tight text-(--tinta) sm:text-4xl text-balance">
            Tomar el pedido es solo el principio
          </h2>
          <p class="mt-4 text-[15px] leading-relaxed text-(--tinta-2)">
            Muchas herramientas te ayudan a recibir pedidos por WhatsApp. Pide Facil sigue con lo que pasa después: cocina, reparto, inventario y utilidad.
          </p>
        </div>

        <div class="mt-10 overflow-x-auto rounded-2xl ring-1 ring-(--linea)">
          <table class="w-full min-w-[640px] border-collapse bg-[#fffdf8] text-left text-sm">
            <caption class="sr-only">Comparación entre apps de delivery, herramientas que solo toman el pedido y Pide Facil</caption>
            <thead>
              <tr class="text-xs uppercase tracking-wider">
                <th scope="col" class="w-[34%] px-5 py-4 font-semibold text-(--tinta-2)"></th>
                <th scope="col" class="px-5 py-4 font-semibold text-(--tinta-2)">Apps de delivery</th>
                <th scope="col" class="px-5 py-4 font-semibold text-(--tinta-2)">Solo toman el pedido</th>
                <th scope="col" class="bg-(--tinta) px-5 py-4 font-semibold text-(--maiz)">Pide Facil</th>
              </tr>
            </thead>
            <tbody>
              @for (f of filas; track f.tema) {
                <tr class="border-t border-(--linea)">
                  <th scope="row" class="px-5 py-4 font-semibold text-(--tinta)">{{ f.tema }}</th>
                  @for (c of [f.apps, f.soloPedido]; track $index) {
                    <td class="px-5 py-4 text-(--tinta-2)">
                      <span class="flex items-start gap-2">
                        @switch (c.valor) {
                          @case ('si') { <svg lucideCheck class="mt-0.5 h-4 w-4 shrink-0 text-(--aguacate)" aria-hidden="true"></svg> }
                          @case ('no') { <svg lucideX class="mt-0.5 h-4 w-4 shrink-0 text-(--chile)" aria-hidden="true"></svg> }
                          @case ('parcial') { <svg lucideMinus class="mt-0.5 h-4 w-4 shrink-0 text-[#b7791f]" aria-hidden="true"></svg> }
                        }
                        {{ c.texto }}
                      </span>
                    </td>
                  }
                  <td class="bg-(--tinta) px-5 py-4 font-medium text-(--papel)">
                    <span class="flex items-start gap-2">
                      <svg lucideCheck class="mt-0.5 h-4 w-4 shrink-0 text-(--maiz)" aria-hidden="true"></svg>
                      {{ f.nosotros.texto }}
                    </span>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <p class="mt-3 text-xs text-(--tinta-2)">Comparación general por tipo de herramienta; cada producto es distinto.</p>
      </div>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LandingComparisonComponent {
  readonly filas: readonly Fila[] = [
    {
      tema: 'Comisión por pedido',
      apps: { valor: 'no', texto: 'Suele ser de 25% a 35%' },
      soloPedido: { valor: 'si', texto: 'Cuota fija; algunas cobran por pedido extra' },
      nosotros: { valor: 'si', texto: '0%, sin límite de pedidos' },
    },
    {
      tema: 'El cliente es tuyo',
      apps: { valor: 'no', texto: 'La app se queda con el contacto' },
      soloPedido: { valor: 'si', texto: 'Sí' },
      nosotros: { valor: 'si', texto: 'Sí, con su historial y direcciones' },
    },
    {
      tema: 'Envío calculado por distancia',
      apps: { valor: 'parcial', texto: 'Lo pone la app' },
      soloPedido: { valor: 'parcial', texto: 'Depende de la herramienta' },
      nosotros: { valor: 'si', texto: 'Tus tarifas por km y tu zona' },
    },
    {
      tema: 'Tus repartidores y su corte',
      apps: { valor: 'no', texto: 'Repartidores de la app' },
      soloPedido: { valor: 'no', texto: 'Normalmente no' },
      nosotros: { valor: 'si', texto: 'Liga por repartidor y corte de efectivo' },
    },
    {
      tema: 'Pantalla de cocina y mesas',
      apps: { valor: 'no', texto: 'No' },
      soloPedido: { valor: 'parcial', texto: 'Algunas' },
      nosotros: { valor: 'si', texto: 'Comandas, mesas y meseros' },
    },
    {
      tema: 'Inventario con recetas',
      apps: { valor: 'no', texto: 'No' },
      soloPedido: { valor: 'no', texto: 'Normalmente no' },
      nosotros: { valor: 'si', texto: 'Descuenta al vender y avisa al mínimo' },
    },
    {
      tema: 'Utilidad por platillo',
      apps: { valor: 'no', texto: 'No' },
      soloPedido: { valor: 'no', texto: 'Normalmente no' },
      nosotros: { valor: 'si', texto: 'Costo, utilidad y margen' },
    },
  ];
}
