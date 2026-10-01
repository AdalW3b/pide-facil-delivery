import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideArrowRight } from '@lucide/angular';

/** Cuota del plan Pro en USD; debe coincidir con la tabla de precios. */
const PRO_USD = 59;
/** Precio de referencia del taco para traducir el ahorro a algo tangible. */
const PRECIO_TACO = 22;

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

        <div class="mt-10 grid overflow-hidden rounded-3xl shadow-[0_30px_60px_-35px_rgba(36,25,15,0.55)] ring-1 ring-(--linea) lg:grid-cols-[1.15fr_0.85fr]">
          <!-- Supuestos + comparación -->
          <div class="space-y-8 bg-[#fffdf8] p-6 sm:p-9">
            <!-- Ventas -->
            <div>
              <div class="flex flex-wrap items-center justify-between gap-3">
                <label for="ventas" class="text-sm font-semibold text-(--tinta)">¿Cuánto vendes al mes en apps?</label>
                <div class="flex items-center rounded-xl border border-(--linea) bg-white focus-within:border-(--chile)">
                  <span class="lp-mono pl-3 text-sm text-(--tinta-2)">$</span>
                  <input id="ventas-num" type="text" inputmode="numeric" [value]="miles(ventas())"
                    (change)="fijarVentas($any($event.target).value); $any($event.target).value = miles(ventas())"
                    (keydown.enter)="$any($event.target).blur()" aria-label="Ventas al mes en pesos"
                    class="lp-mono w-28 bg-transparent px-2 py-2 text-right text-base font-semibold text-(--tinta) focus:outline-none" />
                  <span class="pr-3 text-xs text-(--tinta-2)">MXN</span>
                </div>
              </div>
              <input id="ventas" type="range" min="5000" max="300000" step="5000" [value]="ventas()"
                (input)="ventas.set(+$any($event.target).value)"
                class="mt-4 h-2 w-full cursor-pointer appearance-none rounded-full accent-(--chile)"
                [style.background]="'linear-gradient(to right, var(--chile) ' + avanceVentas() + '%, var(--papel-2) ' + avanceVentas() + '%)'" />
              <div class="mt-3 flex flex-wrap gap-2" role="group" aria-label="Montos rápidos">
                @for (m of montos; track m) {
                  <button type="button" (click)="ventas.set(m)" [attr.aria-pressed]="ventas() === m"
                    class="lp-mono rounded-full px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer"
                    [class]="ventas() === m ? 'bg-(--tinta) text-(--papel)' : 'bg-(--papel-2) text-(--tinta-2) hover:text-(--tinta)'">
                    {{ corto(m) }}
                  </button>
                }
              </div>
            </div>

            <!-- Comisión -->
            <div>
              <div class="flex items-center justify-between gap-3">
                <label for="comision" class="text-sm font-semibold text-(--tinta)">Comisión que te cobran</label>
                <output for="comision" class="lp-display text-2xl font-extrabold text-(--chile)">{{ comision() }}%</output>
              </div>
              <input id="comision" type="range" min="10" max="40" step="1" [value]="comision()"
                (input)="comision.set(+$any($event.target).value)"
                class="mt-4 h-2 w-full cursor-pointer appearance-none rounded-full accent-(--chile)"
                [style.background]="'linear-gradient(to right, var(--chile) ' + avanceComision() + '%, var(--papel-2) ' + avanceComision() + '%)'" />
              <div class="lp-mono mt-1.5 flex justify-between text-[11px] text-(--tinta-2)"><span>10%</span><span>40%</span></div>
            </div>

            <!-- De cada $100 -->
            <div class="rounded-2xl bg-(--papel) p-5 ring-1 ring-(--linea)">
              <p class="text-sm font-semibold text-(--tinta)">De cada $100 que vendes, te quedan…</p>
              <div class="mt-4 space-y-4">
                <div>
                  <div class="mb-1.5 flex items-baseline justify-between text-xs">
                    <span class="font-semibold text-(--tinta-2)">Con apps de delivery</span>
                    <span class="lp-mono font-semibold text-(--tinta)">{{ pesosExactos(100 - comision()) }}</span>
                  </div>
                  <div class="flex h-7 overflow-hidden rounded-lg text-[10px] font-bold">
                    <div class="flex items-center bg-(--aguacate) pl-2 text-white transition-[width] duration-300" [style.width.%]="100 - comision()">Tú</div>
                    <div class="flex items-center justify-center bg-(--chile) text-white transition-[width] duration-300 [background-image:repeating-linear-gradient(135deg,transparent_0_6px,rgba(255,255,255,.18)_6px_12px)]" [style.width.%]="comision()">App</div>
                  </div>
                </div>
                <div>
                  <div class="mb-1.5 flex items-baseline justify-between text-xs">
                    <span class="font-semibold text-(--tinta-2)">Con Pide Facil</span>
                    <span class="lp-mono font-semibold text-(--tinta)">{{ pesosExactos(100 - cuotaPorCien()) }}</span>
                  </div>
                  <div class="flex h-7 overflow-hidden rounded-lg text-[10px] font-bold">
                    <div class="flex items-center bg-(--aguacate) pl-2 text-white transition-[width] duration-300" [style.width.%]="100 - cuotaPorCien()">Tú</div>
                    <div class="bg-(--maiz) transition-[width] duration-300" [style.width.%]="cuotaPorCien()" title="Cuota fija repartida entre tus ventas"></div>
                  </div>
                </div>
              </div>
              <p class="mt-3 text-[11px] text-(--tinta-2)">La cuota fija repartida entre lo que vendes ({{ cuotaPorCien().toFixed(1) }}%). Entre más vendes, menos pesa.</p>
            </div>
          </div>

          <!-- Resultado -->
          <div class="relative flex flex-col justify-between gap-8 overflow-hidden bg-(--tinta) p-6 text-(--papel) sm:p-9" aria-live="polite">
            <div class="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-(--chile)/25 blur-3xl" aria-hidden="true"></div>
            <dl class="relative space-y-4">
              <div class="flex items-baseline justify-between gap-4">
                <dt class="text-sm text-(--papel)/70">Las apps se llevan al mes</dt>
                <dd class="lp-mono text-lg text-[#ff9b85] line-through decoration-2">{{ pesos(comisionMes()) }}</dd>
              </div>
              <div class="flex items-baseline justify-between gap-4">
                <dt class="text-sm text-(--papel)/70">Pide Facil Pro</dt>
                <dd class="lp-mono text-lg">{{ pesos(cuotaMes()) }}</dd>
              </div>
              <div class="border-t border-white/15 pt-6">
                @if (ahorroMes() > 0) {
                  <dt class="text-sm font-semibold uppercase tracking-wider text-(--maiz)">Te quedas al mes</dt>
                  <dd class="lp-display mt-1 text-5xl font-extrabold tabular-nums sm:text-6xl">{{ pesos(mostrado()) }}</dd>
                  <dd class="mt-4 flex flex-wrap gap-2">
                    <span class="rounded-full bg-white/10 px-3 py-1.5 text-xs">
                      Al año: <strong class="lp-mono text-(--papel)">{{ pesos(ahorroMes() * 12) }}</strong>
                    </span>
                    <span class="rounded-full bg-(--maiz) px-3 py-1.5 text-xs font-semibold text-(--tinta)">
                      = {{ tacos() }} tacos al pastor al mes
                    </span>
                  </dd>
                } @else {
                  <dt class="text-sm font-semibold uppercase tracking-wider text-(--maiz)">Con estas ventas</dt>
                  <dd class="mt-2 text-lg leading-snug">La comisión todavía es menor que la cuota. Si atiendes sobre todo en mesas, empieza con el plan Inicial ($29 USD).</dd>
                }
              </div>
            </dl>

            <div class="relative">
              <a routerLink="/register"
                class="group inline-flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-full bg-(--chile) px-6 py-4 text-base font-semibold text-white shadow-[0_12px_30px_-12px_rgba(200,56,31,0.9)] transition-colors hover:bg-(--chile-osc)">
                Quedarme con mis ventas
                <svg lucideArrowRight class="h-4 w-4 transition-transform group-hover:translate-x-0.5"></svg>
              </a>
              <p class="mt-4 text-[11px] leading-relaxed text-(--papel)/60">
                Cálculo de referencia: compara comisión contra cuota. Si repartes tú, cuenta también lo que le pagas al repartidor.
              </p>
              <details class="mt-2 text-[11px] text-(--papel)/60">
                <summary class="cursor-pointer select-none hover:text-(--papel)">Tipo de cambio: {{ tipoCambio() }} pesos por dólar</summary>
                <label class="mt-2 flex items-center gap-2">
                  Ajustar
                  <input type="number" min="10" max="40" step="0.1" [value]="tipoCambio()" (input)="fijarTipoCambio($any($event.target).value)"
                    class="lp-mono w-20 rounded-md border border-white/20 bg-transparent px-2 py-1 text-right text-(--papel) focus:border-(--maiz) focus:outline-none" />
                </label>
              </details>
            </div>
          </div>
        </div>
      </div>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LandingAhorroComponent {
  private readonly destroyRef = inject(DestroyRef);

  readonly montos = [20000, 60000, 120000, 250000];
  readonly ventas = signal(60000);
  readonly comision = signal(30);
  /** Editable: el tipo de cambio se mueve y no lo adivinamos. */
  readonly tipoCambio = signal(18.5);

  readonly comisionMes = computed(() => (this.ventas() * this.comision()) / 100);
  readonly cuotaMes = computed(() => PRO_USD * this.tipoCambio());
  readonly ahorroMes = computed(() => this.comisionMes() - this.cuotaMes());
  /** Cuánto pesa la cuota fija por cada $100 vendidos (tope 100). */
  readonly cuotaPorCien = computed(() => (this.ventas() > 0 ? Math.min(100, (this.cuotaMes() / this.ventas()) * 100) : 100));
  readonly tacos = computed(() => Math.floor(Math.max(0, this.ahorroMes()) / PRECIO_TACO).toLocaleString('es-MX'));
  readonly avanceVentas = computed(() => ((Math.min(this.ventas(), 300000) - 5000) / 295000) * 100);
  readonly avanceComision = computed(() => ((this.comision() - 10) / 30) * 100);

  /** El número grande sube o baja hasta el valor nuevo en vez de brincar. */
  readonly mostrado = signal(0);
  private cuadro = 0;
  private readonly sinMovimiento =
    typeof window === 'undefined' || !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  private readonly animar = effect(() => {
    const destino = Math.max(0, this.ahorroMes());
    untracked(() => {
      cancelAnimationFrame(this.cuadro);
      const inicio = this.mostrado();
      if (this.sinMovimiento || Math.abs(destino - inicio) < 1) {
        this.mostrado.set(destino);
        return;
      }
      const t0 = performance.now();
      const paso = (t: number) => {
        const k = Math.min(1, (t - t0) / 450);
        const suave = 1 - Math.pow(1 - k, 3);
        this.mostrado.set(inicio + (destino - inicio) * suave);
        if (k < 1) this.cuadro = requestAnimationFrame(paso);
      };
      this.cuadro = requestAnimationFrame(paso);
    });
  });

  constructor() {
    this.destroyRef.onDestroy(() => cancelAnimationFrame(this.cuadro));
  }

  /** Acepta "60,000", "$60 000" o "60000". */
  fijarVentas(valor: string): void {
    const n = Math.round(Number(String(valor).replace(/[^0-9.]/g, '')));
    if (Number.isFinite(n) && n >= 0 && n <= 10_000_000) this.ventas.set(n);
  }

  fijarTipoCambio(valor: string): void {
    const n = Number(valor);
    if (Number.isFinite(n) && n >= 10 && n <= 40) this.tipoCambio.set(n);
  }

  pesos(n: number): string {
    return n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
  }

  miles(n: number): string {
    return n.toLocaleString('es-MX', { maximumFractionDigits: 0 });
  }

  pesosExactos(n: number): string {
    return n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 2, minimumFractionDigits: 2 });
  }

  corto(n: number): string {
    return `$${(n / 1000).toLocaleString('es-MX')} mil`;
  }
}
