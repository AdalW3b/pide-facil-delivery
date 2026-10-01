import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideArrowRight } from '@lucide/angular';

/** Cuota del plan Pro en USD; debe coincidir con la tabla de precios. */
const PRO_USD = 59;

/**
 * Problema y calculadora: cuánto se llevan las apps de delivery contra una
 * cuota fija. Los supuestos están a la vista y se pueden mover; no promete
 * ventas, solo compara comisión contra cuota.
 */
@Component({
  selector: 'app-landing-ahorro',
  standalone: true,
  imports: [RouterLink, LucideArrowRight],
  template: `
    <section id="ahorro" class="scroll-mt-20 py-20 lg:py-28" aria-labelledby="ahorro-titulo">
      <div class="mx-auto max-w-6xl px-5 sm:px-8">
        <div class="max-w-2xl">
          <p class="lp-mono text-xs uppercase tracking-[0.18em] text-(--chile)">Haz la cuenta</p>
          <h2 id="ahorro-titulo" class="lp-display mt-3 text-3xl font-extrabold leading-tight text-(--tinta) sm:text-4xl text-balance">
            ¿Cuánto se quedan las apps de cada venta tuya?
          </h2>
          <p class="mt-4 text-[15px] leading-relaxed text-(--tinta-2)">
            Las apps de delivery suelen cobrar entre 25% y 35% por pedido. Con tu propio canal pagas una cuota fija y el cliente sigue siendo tuyo.
          </p>
        </div>

        <div class="mt-10 grid overflow-hidden rounded-3xl ring-1 ring-(--linea) lg:grid-cols-[1.1fr_0.9fr]">
          <!-- Supuestos -->
          <div class="space-y-8 bg-[#fffdf8] p-6 sm:p-9">
            <div>
              <div class="flex items-baseline justify-between gap-4">
                <label for="ventas" class="text-sm font-semibold text-(--tinta)">Lo que vendes al mes en apps</label>
                <output for="ventas" class="lp-mono text-lg font-semibold text-(--tinta)">{{ pesos(ventas()) }}</output>
              </div>
              <input id="ventas" type="range" min="5000" max="300000" step="5000" [value]="ventas()"
                (input)="ventas.set(+$any($event.target).value)" class="mt-3 w-full accent-(--chile) cursor-pointer" />
              <div class="lp-mono mt-1 flex justify-between text-[11px] text-(--tinta-2)"><span>$5,000</span><span>$300,000</span></div>
            </div>

            <div>
              <div class="flex items-baseline justify-between gap-4">
                <label for="comision" class="text-sm font-semibold text-(--tinta)">Comisión que te cobran</label>
                <output for="comision" class="lp-mono text-lg font-semibold text-(--tinta)">{{ comision() }}%</output>
              </div>
              <input id="comision" type="range" min="10" max="40" step="1" [value]="comision()"
                (input)="comision.set(+$any($event.target).value)" class="mt-3 w-full accent-(--chile) cursor-pointer" />
              <div class="lp-mono mt-1 flex justify-between text-[11px] text-(--tinta-2)"><span>10%</span><span>40%</span></div>
            </div>

            <div class="flex flex-wrap items-center justify-between gap-3 border-t border-(--linea) pt-6">
              <label for="tc" class="text-sm text-(--tinta-2)">Tipo de cambio (pesos por dólar)</label>
              <input id="tc" type="number" min="10" max="40" step="0.1" [value]="tipoCambio()"
                (input)="fijarTipoCambio($any($event.target).value)"
                class="lp-mono w-24 rounded-lg border border-(--linea) bg-white px-3 py-2 text-right text-sm text-(--tinta) focus:border-(--chile) focus:outline-none" />
            </div>
          </div>

          <!-- Resultado -->
          <div class="flex flex-col justify-between gap-8 bg-(--tinta) p-6 text-(--papel) sm:p-9" aria-live="polite">
            <dl class="space-y-4">
              <div class="flex items-baseline justify-between gap-4">
                <dt class="text-sm text-(--papel)/70">Comisión de las apps al mes</dt>
                <dd class="lp-mono text-lg text-(--papel)">{{ pesos(comisionMes()) }}</dd>
              </div>
              <div class="flex items-baseline justify-between gap-4">
                <dt class="text-sm text-(--papel)/70">Pide Facil Pro ($59 USD)</dt>
                <dd class="lp-mono text-lg text-(--papel)">− {{ pesos(cuotaMes()) }}</dd>
              </div>
              <div class="border-t border-white/15 pt-5">
                @if (ahorroMes() > 0) {
                  <dt class="text-sm font-semibold text-(--maiz)">Te quedas al mes</dt>
                  <dd class="lp-display mt-1 text-5xl font-extrabold tabular-nums sm:text-6xl">{{ pesos(ahorroMes()) }}</dd>
                  <dd class="mt-2 text-sm text-(--papel)/80">Al año son <strong class="text-(--papel)">{{ pesos(ahorroMes() * 12) }}</strong>.</dd>
                } @else {
                  <dt class="text-sm font-semibold text-(--maiz)">Con estas ventas</dt>
                  <dd class="mt-1 text-lg">La comisión todavía es menor que la cuota. El plan Inicial ($29 USD) es para atender en tus mesas.</dd>
                }
              </div>
            </dl>
            <div>
              <a routerLink="/register"
                class="group inline-flex w-full items-center justify-center gap-2 rounded-full bg-(--chile) px-6 py-3.5 text-base font-semibold text-white transition-colors hover:bg-(--chile-osc)">
                Empezar a ahorrar
                <svg lucideArrowRight class="h-4 w-4 transition-transform group-hover:translate-x-0.5"></svg>
              </a>
              <p class="mt-3 text-[11px] leading-relaxed text-(--papel)/60">
                Cálculo de referencia: compara comisión contra cuota. Si repartes tú, cuenta también lo que le pagas al repartidor.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LandingAhorroComponent {
  readonly ventas = signal(60000);
  readonly comision = signal(30);
  /** Editable: el tipo de cambio se mueve y no lo adivinamos. */
  readonly tipoCambio = signal(18.5);

  readonly comisionMes = computed(() => (this.ventas() * this.comision()) / 100);
  readonly cuotaMes = computed(() => PRO_USD * this.tipoCambio());
  readonly ahorroMes = computed(() => this.comisionMes() - this.cuotaMes());

  fijarTipoCambio(valor: string): void {
    const n = Number(valor);
    if (Number.isFinite(n) && n >= 10 && n <= 40) this.tipoCambio.set(n);
  }

  pesos(n: number): string {
    return n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
  }
}
