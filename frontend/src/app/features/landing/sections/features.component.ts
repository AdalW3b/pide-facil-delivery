import { ChangeDetectionStrategy, Component } from '@angular/core';

interface Grupo {
  readonly numero: string;
  readonly titulo: string;
  readonly resumen: string;
  readonly color: string;
  readonly funciones: readonly { readonly nombre: string; readonly detalle: string }[];
}

/** Lo que hace el sistema, agrupado como lo vive un restaurante: vender, operar y controlar. */
@Component({
  selector: 'app-landing-features',
  standalone: true,
  template: `
    <section id="funciones" class="bg-(--papel-2) py-20 lg:py-28" aria-labelledby="funciones-titulo">
      <div class="mx-auto max-w-6xl px-5 sm:px-8">
        <div class="max-w-2xl">
          <p class="lp-mono text-xs uppercase tracking-[0.18em] text-(--chile)">Funciones</p>
          <h2 id="funciones-titulo" class="lp-display mt-3 text-3xl font-extrabold leading-tight text-(--tinta) sm:text-4xl text-balance">
            Todo lo que pasa entre el pedido y el corte de caja
          </h2>
        </div>

        <div class="mt-14 space-y-14">
          @for (g of grupos; track g.titulo) {
            <div class="grid gap-8 lg:grid-cols-[0.8fr_2fr] lg:gap-12">
              <div>
                <p class="lp-mono text-sm font-semibold" [style.color]="g.color">{{ g.numero }}</p>
                <h3 class="lp-display mt-1 text-2xl font-extrabold text-(--tinta)">{{ g.titulo }}</h3>
                <p class="mt-2 text-[15px] leading-relaxed text-(--tinta-2)">{{ g.resumen }}</p>
              </div>
              <ul class="grid gap-x-8 gap-y-6 sm:grid-cols-2">
                @for (f of g.funciones; track f.nombre) {
                  <li class="border-t-2 pt-4" [style.border-color]="g.color">
                    <h4 class="font-semibold text-(--tinta)">{{ f.nombre }}</h4>
                    <p class="mt-1 text-sm leading-relaxed text-(--tinta-2)">{{ f.detalle }}</p>
                  </li>
                }
              </ul>
            </div>
          }
        </div>
      </div>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LandingFeaturesComponent {
  readonly grupos: readonly Grupo[] = [
    {
      numero: '01',
      titulo: 'Vender',
      resumen: 'Recibe pedidos por donde tus clientes ya te buscan, sin pagar comisión por cada uno.',
      color: 'var(--chile)',
      funciones: [
        { nombre: 'Asistente de WhatsApp', detalle: 'Responde en tu número, enseña el menú, arma el carrito y confirma total y cambio.' },
        { nombre: 'Menú en línea', detalle: 'Liga y QR con fotos. El cliente guarda sus direcciones y ve el estado de su pedido.' },
        { nombre: 'Combos y extras', detalle: 'Paquetes con precio especial y extras como "con todo" o "queso extra", con su costo.' },
        { nombre: 'Envío por kilómetro', detalle: 'Tarifa con km incluidos, costo por km extra, distancia máxima, pedido mínimo y cuánto del envío absorbes tú.' },
      ],
    },
    {
      numero: '02',
      titulo: 'Operar',
      resumen: 'Que cocina, salón y reparto trabajen con la misma información, al mismo tiempo.',
      color: 'var(--aguacate)',
      funciones: [
        { nombre: 'Pantalla de cocina', detalle: 'Comandas en orden de llegada, con sonido. Marca "se acabó" y nadie lo puede pedir en el menú ni en WhatsApp.' },
        { nombre: 'Mesas y meseros', detalle: 'Estado de cada mesa en vivo, cuenta abierta y cierre con el método de pago.' },
        { nombre: 'Repartidores', detalle: 'Cada uno recibe sus entregas en una liga, sin instalar nada. Corte de efectivo y propinas al final.' },
        { nombre: 'Inventario con recetas', detalle: 'Cada venta descuenta ingredientes. Compras, conteos, mermas, zonas y traspasos entre sucursales.' },
      ],
    },
    {
      numero: '03',
      titulo: 'Controlar',
      resumen: 'Decide con números del día, no con lo que te acuerdas al cerrar.',
      color: '#b7791f',
      funciones: [
        { nombre: 'Utilidad y margen', detalle: 'Costo de cada platillo con tus compras reales y cuánto te dejó el día.' },
        { nombre: 'Reportes', detalle: 'Ventas por canal, horas pico por día, meseros, mesas y tiempos de cocina. Exporta a Excel.' },
        { nombre: 'Roles y permisos', detalle: 'El mesero ve el salón, cocina sus comandas y el encargado su sucursal.' },
        { nombre: 'Varias sucursales', detalle: 'Cada una con su menú, existencias y equipo; tú las ves juntas o por separado.' },
      ],
    },
  ];
}
