import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideArrowRight, LucideCheck, LucideCircleCheck } from '@lucide/angular';

interface ChatMessage {
  readonly mine: boolean;
  readonly text: string;
  readonly time: string;
}

/**
 * Promesa principal. La maqueta cuenta la historia completa de un pedido:
 * el cliente escribe por WhatsApp y sale una comanda para cocina.
 */
@Component({
  selector: 'app-landing-hero',
  standalone: true,
  imports: [RouterLink, LucideArrowRight, LucideCheck, LucideCircleCheck],
  template: `
    <section class="relative pt-28 pb-16 sm:pt-32 lg:pt-36 lg:pb-24">
      <div class="mx-auto max-w-6xl px-5 sm:px-8">
        <div class="grid items-center gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10">
          <!-- Mensaje principal -->
          <div class="animate-fade-up">
            <p class="inline-flex items-center gap-2 rounded-full bg-(--papel-2) px-3 py-1 text-xs font-semibold text-(--tinta-2) ring-1 ring-(--linea)">
              <span class="h-2 w-2 rounded-full bg-(--wa)"></span>
              Para fondas, taquerías, cocinas económicas y restaurantes
            </p>
            <h1 class="lp-display mt-6 text-[2.6rem] font-extrabold leading-[1.02] text-(--tinta) sm:text-6xl lg:text-[4.1rem] text-balance">
              Que el pedido llegue <span class="text-(--chile)">solo</span> a la cocina.
            </h1>
            <p class="mt-6 max-w-xl text-lg leading-relaxed text-(--tinta-2)">
              WhatsApp, menú en línea, teléfono o mesa: todo entra como una comanda. Cocina la ve al instante,
              el repartidor recibe su ruta y tú sabes cuánto vendiste y cuánto te dejó.
            </p>
            <div class="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
              <a routerLink="/register"
                class="group inline-flex items-center justify-center gap-2 rounded-full bg-(--chile) px-7 py-3.5 text-base font-semibold text-white shadow-[0_10px_30px_-10px_rgba(200,56,31,0.7)] transition-colors hover:bg-(--chile-osc)">
                Prueba 14 días gratis
                <svg lucideArrowRight class="h-4 w-4 transition-transform group-hover:translate-x-0.5"></svg>
              </a>
              <a href="#ahorro"
                class="inline-flex items-center justify-center gap-2 rounded-full border border-(--tinta)/20 px-7 py-3.5 text-base font-semibold text-(--tinta) transition-colors hover:border-(--tinta)/60">
                Calcula cuánto ahorras
              </a>
            </div>
            <ul class="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-(--tinta-2)">
              @for (item of assurances; track item) {
                <li class="flex items-center gap-1.5">
                  <svg lucideCircleCheck class="h-4 w-4 text-(--aguacate)"></svg>
                  {{ item }}
                </li>
              }
            </ul>
          </div>

          <!-- Maqueta: conversación -> comanda -->
          <div class="relative mx-auto w-full max-w-md lg:max-w-none animate-fade-up delay-150" aria-hidden="true">
            <div class="relative grid grid-cols-1 sm:grid-cols-[1.1fr_0.9fr] items-start gap-4">
              <!-- Teléfono -->
              <div class="rounded-[1.75rem] bg-(--tinta) p-2 shadow-[0_30px_60px_-25px_rgba(36,25,15,0.6)]">
                <div class="overflow-hidden rounded-[1.35rem] bg-[#efe6d6]">
                  <div class="flex items-center gap-2.5 bg-(--wa) px-3.5 py-3 text-white">
                    <span class="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-xs font-bold">EF</span>
                    <div class="leading-tight">
                      <p class="text-[13px] font-semibold">Taquería El Farolito</p>
                      <p class="text-[11px] text-white/75">en línea</p>
                    </div>
                  </div>
                  <div class="space-y-2 px-3 py-3.5 min-h-[272px]">
                    @for (msg of chat.slice(0, visibles()); track $index) {
                      <div class="flex animate-fade-up" [class.justify-end]="msg.mine">
                        <div class="max-w-[85%] rounded-xl px-2.5 py-1.5 text-[12px] leading-snug text-(--tinta) shadow-sm"
                          [class]="msg.mine ? 'bg-[#d9f7c5] rounded-tr-sm' : 'bg-white rounded-tl-sm'">
                          <span [innerHTML]="msg.text"></span>
                          <span class="ml-1.5 inline-flex items-center gap-0.5 align-bottom text-[9px] text-(--tinta-2)/70">
                            {{ msg.time }}
                            @if (msg.mine) { <svg lucideCheck class="h-2.5 w-2.5 text-sky-600"></svg> }
                          </span>
                        </div>
                      </div>
                    }
                    @if (escribiendo()) {
                      <div class="flex justify-end">
                        <div class="flex gap-1 rounded-xl rounded-tr-sm bg-[#d9f7c5] px-3 py-2.5">
                          <span class="h-1.5 w-1.5 animate-bounce rounded-full bg-(--tinta-2)/60"></span>
                          <span class="h-1.5 w-1.5 animate-bounce rounded-full bg-(--tinta-2)/60 [animation-delay:120ms]"></span>
                          <span class="h-1.5 w-1.5 animate-bounce rounded-full bg-(--tinta-2)/60 [animation-delay:240ms]"></span>
                        </div>
                      </div>
                    }
                  </div>
                </div>
              </div>

              <!-- Comanda: se "imprime" cuando el asistente confirma -->
              <div class="lp-ticket rotate-[2deg] rounded-t-md px-4 pt-4 sm:mt-14 transition-[opacity,transform] duration-500"
                [class.opacity-40]="!confirmado()" [class.translate-y-2]="!confirmado()">
                <div class="lp-mono text-[11px] uppercase tracking-wider text-(--tinta-2)">Comanda · domicilio</div>
                <div class="mt-1 flex items-baseline justify-between">
                  <span class="lp-display text-2xl font-extrabold text-(--tinta)">#1042</span>
                  <span class="lp-mono text-[11px] text-(--tinta-2)">20:16</span>
                </div>
                <div class="lp-corte my-3"></div>
                <ul class="lp-mono space-y-1.5 text-[12.5px] text-(--tinta)">
                  <li class="flex justify-between gap-2"><span>4 × Taco al pastor</span><span>$88</span></li>
                  <li class="pl-4 text-[11px] text-(--tinta-2)">+ con todo, piña extra</li>
                  <li class="flex justify-between gap-2"><span>1 × Gringa</span><span>$65</span></li>
                  <li class="flex justify-between gap-2"><span>2 × Agua de jamaica</span><span>$50</span></li>
                </ul>
                <div class="lp-corte my-3"></div>
                <dl class="lp-mono space-y-1 text-[12px] text-(--tinta-2)">
                  <div class="flex justify-between"><dt>Envío · 2.4 km</dt><dd>$25</dd></div>
                  <div class="flex justify-between text-[14px] font-semibold text-(--tinta)"><dt>Total</dt><dd>$228</dd></div>
                  <div class="flex justify-between"><dt>Paga con</dt><dd>$300</dd></div>
                </dl>
                <p class="mt-3 mb-1 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold text-(--tinta)"
                  [class]="confirmado() ? 'bg-(--maiz)/25' : 'bg-(--papel-2)'">
                  <span class="h-1.5 w-1.5 rounded-full" [class]="confirmado() ? 'bg-(--chile)' : 'bg-(--tinta-2)/40'"></span>
                  {{ confirmado() ? 'En cocina' : 'Armando pedido…' }}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LandingHeroComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  /** Cuántos mensajes del chat se ven; la conversación se escribe sola una vez. */
  readonly visibles = signal(1);
  readonly escribiendo = signal(false);
  readonly confirmado = signal(false);
  readonly assurances = ['Desde $29 USD al mes', '0% de comisión por pedido', '14 días gratis, sin tarjeta'];

  readonly chat: readonly ChatMessage[] = [
    { mine: false, text: 'Buenas! me manda 4 de pastor con todo y una gringa', time: '20:14' },
    { mine: true, text: 'Con gusto 🌮 ¿Le agrego algo de tomar?', time: '20:14' },
    { mine: false, text: '2 aguas de jamaica. Pago con 300', time: '20:15' },
    { mine: true, text: 'Listo: <b>$228</b> con envío.<br>Le llevo cambio de <b>$72</b>.<br>Pedido <b>#1042</b> en cocina, llega en ~35 min.', time: '20:16' },
  ];

  ngOnInit(): void {
    const sinMovimiento =
      typeof window === 'undefined' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (sinMovimiento) {
      this.visibles.set(this.chat.length);
      this.confirmado.set(true);
      return;
    }
    const timers: ReturnType<typeof setTimeout>[] = [];
    let t = 600;
    for (let i = 1; i < this.chat.length; i++) {
      const delNegocio = this.chat[i].mine;
      if (delNegocio) {
        timers.push(setTimeout(() => this.escribiendo.set(true), t));
        t += 900;
      }
      timers.push(setTimeout(() => {
        this.escribiendo.set(false);
        this.visibles.set(i + 1);
        if (i === this.chat.length - 1) this.confirmado.set(true);
      }, t));
      t += 1100;
    }
    this.destroyRef.onDestroy(() => timers.forEach(clearTimeout));
  }
}
