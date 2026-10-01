import { ChangeDetectionStrategy, Component } from '@angular/core';
import { LucideMessageCircle, LucideGlobe, LucidePhone, LucideQrCode, LucideArrowDown } from '@lucide/angular';

interface Canal {
  readonly icono: 'wa' | 'web' | 'tel' | 'mesa';
  readonly nombre: string;
  readonly detalle: string;
}

/** Todos los canales por donde entra un pedido terminan en la misma comanda. */
@Component({
  selector: 'app-landing-canales',
  standalone: true,
  imports: [LucideMessageCircle, LucideGlobe, LucidePhone, LucideQrCode, LucideArrowDown],
  template: `
    <section class="bg-(--tinta) text-(--papel)" aria-labelledby="canales-titulo">
      <div class="mx-auto max-w-6xl px-5 py-16 sm:px-8 lg:py-20">
        <div class="max-w-2xl">
          <p class="lp-mono text-xs uppercase tracking-[0.18em] text-(--maiz)">Por donde entre</p>
          <h2 id="canales-titulo" class="lp-display mt-3 text-3xl font-extrabold leading-tight sm:text-4xl text-balance">
            Cuatro puertas, una sola fila en la cocina
          </h2>
        </div>

        <ul class="mt-10 grid gap-px overflow-hidden rounded-2xl bg-white/10 sm:grid-cols-2 lg:grid-cols-4">
          @for (c of canales; track c.nombre) {
            <li class="bg-(--tinta) p-6">
              <span class="flex h-10 w-10 items-center justify-center rounded-full bg-(--papel)/10 text-(--maiz)">
                @switch (c.icono) {
                  @case ('wa') { <svg lucideMessageCircle class="h-5 w-5"></svg> }
                  @case ('web') { <svg lucideGlobe class="h-5 w-5"></svg> }
                  @case ('tel') { <svg lucidePhone class="h-5 w-5"></svg> }
                  @case ('mesa') { <svg lucideQrCode class="h-5 w-5"></svg> }
                }
              </span>
              <h3 class="mt-4 text-lg font-semibold">{{ c.nombre }}</h3>
              <p class="mt-1.5 text-sm leading-relaxed text-(--papel)/70">{{ c.detalle }}</p>
            </li>
          }
        </ul>

        <div class="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <svg lucideArrowDown class="h-5 w-5 text-(--maiz)" aria-hidden="true"></svg>
          <p class="text-center text-sm text-(--papel)/85">
            Todo llega a la <strong class="text-(--papel)">pantalla de cocina</strong> con sonido, en orden de llegada y sin volver a capturarlo.
          </p>
        </div>
      </div>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LandingCanalesComponent {
  readonly canales: readonly Canal[] = [
    { icono: 'wa', nombre: 'WhatsApp', detalle: 'Un asistente en tu número arma el pedido, calcula el envío y lo confirma con el cliente.' },
    { icono: 'web', nombre: 'Menú en línea', detalle: 'Tu liga con fotos, combos y extras. El cliente guarda sus direcciones y sigue su pedido.' },
    { icono: 'tel', nombre: 'Teléfono', detalle: 'Capturas el pedido en el panel con la misma carta, tarifa de envío y pedido mínimo.' },
    { icono: 'mesa', nombre: 'Mesa', detalle: 'El mesero toma la orden, o el cliente escanea el QR de su mesa y pide por WhatsApp.' },
  ];
}
