import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  LucideArrowRight,
  LucideCheck,
  LucideCircleCheck,
  LucideMessageCircle,
  LucideBookOpen,
  LucideBike,
  LucideShoppingBag,
  LucideMapPin,
  LucideStore,
} from '@lucide/angular';

type Vitrina = 'whatsapp' | 'menu' | 'domicilio';

interface ChatMessage {
  readonly mine: boolean;
  readonly text: string;
  readonly time: string;
}

/**
 * Inicio con vitrina: tres pestañas (WhatsApp, menú digital y domicilio)
 * que cambian el celular de la derecha. Rotan solas hasta que el visitante
 * elige una; con movimiento reducido no rotan ni se animan.
 */
@Component({
  selector: 'app-landing-hero',
  standalone: true,
  imports: [
    RouterLink, LucideArrowRight, LucideCheck, LucideCircleCheck, LucideMessageCircle,
    LucideBookOpen, LucideBike, LucideShoppingBag, LucideMapPin, LucideStore,
  ],
  template: `
    <section class="relative overflow-hidden pt-28 pb-16 sm:pt-32 lg:pt-36 lg:pb-24">
      <div class="mx-auto max-w-6xl px-5 sm:px-8">
        <div class="grid items-center gap-12 lg:grid-cols-[1fr_1fr] lg:gap-8">
          <!-- Mensaje -->
          <div class="animate-fade-up">
            <p class="inline-flex items-center gap-2 rounded-full bg-(--papel-2) px-3 py-1 text-xs font-semibold text-(--tinta-2) ring-1 ring-(--linea)">
              <span class="h-2 w-2 rounded-full bg-(--wa)"></span>
              Para fondas, taquerías, cocinas económicas y restaurantes
            </p>
            <h1 class="lp-display mt-6 text-[2.6rem] font-extrabold leading-[1.02] text-(--tinta) sm:text-6xl lg:text-[4.1rem] text-balance">
              {{ actual().prefijo }}<br />
              <span class="relative inline-block whitespace-nowrap transition-colors duration-300" [style.color]="actual().color">
                {{ actual().palabra }}
                <svg class="absolute -bottom-2 left-0 h-3 w-full" viewBox="0 0 200 12" preserveAspectRatio="none" aria-hidden="true">
                  <path d="M2 9 C 50 2, 150 2, 198 8" fill="none" stroke="var(--maiz)" stroke-width="5" stroke-linecap="round" />
                </svg>
              </span>
              <br />sin comisiones.
            </h1>
            <p class="mt-6 max-w-xl text-lg leading-relaxed text-(--tinta-2)">
              Tu asistente de WhatsApp, tu menú digital y tu propio reparto en un solo sistema.
              Todo llega a la cocina como comanda y tú ves cuánto te dejó cada venta.
            </p>

            <!-- Pestañas de la vitrina -->
            <div class="mt-8 grid grid-cols-3 gap-2 sm:max-w-lg" role="tablist" aria-label="Lo que incluye">
              @for (v of vitrinas; track v.id) {
                <button type="button" role="tab" [id]="'vit-' + v.id" [attr.aria-selected]="vitrina() === v.id"
                  [attr.aria-controls]="'vitrina-panel'" (click)="elegir(v.id)"
                  class="group relative flex flex-col items-start gap-2 overflow-hidden rounded-2xl p-3 text-left ring-1 transition-all duration-200 cursor-pointer sm:p-4"
                  [class]="vitrina() === v.id ? 'bg-[#fffdf8] ring-transparent shadow-[0_12px_30px_-12px_rgba(36,25,15,0.35)]' : 'bg-transparent ring-(--linea) hover:bg-[#fffdf8]/70'">
                  <span class="flex h-9 w-9 items-center justify-center rounded-xl text-white" [style.background]="v.color">
                    @switch (v.id) {
                      @case ('whatsapp') { <svg lucideMessageCircle class="h-5 w-5" aria-hidden="true"></svg> }
                      @case ('menu') { <svg lucideBookOpen class="h-5 w-5" aria-hidden="true"></svg> }
                      @case ('domicilio') { <svg lucideBike class="h-5 w-5" aria-hidden="true"></svg> }
                    }
                  </span>
                  <span class="text-sm font-bold leading-tight text-(--tinta)">{{ v.titulo }}</span>
                  <span class="hidden text-xs leading-snug text-(--tinta-2) sm:block">{{ v.detalle }}</span>
                  @if (vitrina() === v.id && rotando()) {
                    <span class="absolute inset-x-0 bottom-0 h-1 origin-left animate-[lp-barra_6s_linear_forwards]" [style.background]="v.color"></span>
                  }
                </button>
              }
            </div>

            <div class="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
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
            <ul class="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-(--tinta-2)">
              @for (item of assurances; track item) {
                <li class="flex items-center gap-1.5">
                  <svg lucideCircleCheck class="h-4 w-4 text-(--aguacate)"></svg>
                  {{ item }}
                </li>
              }
            </ul>
          </div>

          <!-- Vitrina -->
          <div id="vitrina-panel" role="tabpanel" [attr.aria-labelledby]="'vit-' + vitrina()"
            class="relative mx-auto flex w-full max-w-[460px] justify-center py-6 animate-fade-up delay-150" aria-live="off">
            <!-- Fondo de color que cambia con la pestaña -->
            <div class="absolute inset-x-4 top-10 bottom-0 rotate-[-4deg] rounded-[2.5rem] transition-colors duration-500" [style.background]="actual().color" aria-hidden="true"></div>
            <div class="absolute inset-x-4 top-10 bottom-0 rotate-[-4deg] rounded-[2.5rem] opacity-25 [background-image:radial-gradient(#fff_1.2px,transparent_1.2px)] [background-size:16px_16px]" aria-hidden="true"></div>

            <!-- Etiquetas flotantes -->
            @for (e of actual().etiquetas; track e; let i = $index) {
              <span class="absolute z-20 hidden rounded-full bg-[#fffdf8] px-3.5 py-2 text-xs font-bold text-(--tinta) shadow-[0_10px_25px_-10px_rgba(36,25,15,0.5)] sm:inline-flex items-center gap-1.5 animate-fade-up"
                [class]="i === 0 ? 'left-0 top-4 lg:-left-6' : i === 1 ? 'right-0 top-[63%] lg:-right-8' : 'left-0 bottom-2 lg:-left-4'">
                <span class="h-2 w-2 rounded-full" [style.background]="actual().color"></span>{{ e }}
              </span>
            }

            <!-- Celular -->
            <div class="relative z-10 w-[290px] rounded-[2.2rem] bg-(--tinta) p-2.5 shadow-[0_40px_70px_-25px_rgba(36,25,15,0.7)]" aria-hidden="true">
              <div class="relative h-[520px] overflow-hidden rounded-[1.75rem] bg-[#fffdf8]">
                @switch (vitrina()) {
                  @case ('whatsapp') {
                    <div class="flex h-full flex-col bg-[#efe6d6] animate-fade-in">
                      <div class="flex items-center gap-2.5 bg-(--wa) px-3.5 py-3 text-white">
                        <span class="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-xs font-bold">EF</span>
                        <div class="leading-tight">
                          <p class="text-[13px] font-semibold">Taquería El Farolito</p>
                          <p class="text-[11px] text-white/75">{{ escribiendo() ? 'escribiendo…' : 'en línea' }}</p>
                        </div>
                      </div>
                      <div class="flex-1 space-y-2 px-3 py-3.5">
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
                      @if (confirmado()) {
                        <div class="mx-3 mb-3 flex items-center gap-2 rounded-xl bg-(--tinta) px-3 py-2.5 text-[12px] text-(--papel) animate-fade-up">
                          <span class="h-2 w-2 rounded-full bg-(--maiz)"></span>
                          Comanda <b class="lp-mono">#1042</b> enviada a cocina
                        </div>
                      }
                    </div>
                  }
                  @case ('menu') {
                    <div class="flex h-full flex-col animate-fade-in">
                      <div class="bg-(--chile) px-4 pb-4 pt-5 text-white">
                        <p class="lp-display text-lg font-extrabold leading-tight">Taquería El Farolito</p>
                        <p class="mt-1 flex items-center gap-1.5 text-[11px] text-white/85">
                          <span class="h-1.5 w-1.5 rounded-full bg-[#7ee2a8]"></span> Abierto · Envío desde $25 · ~35 min
                        </p>
                      </div>
                      <div class="flex gap-1.5 overflow-hidden px-3 py-3 text-[11px] font-semibold">
                        @for (c of categorias; track c; let i = $index) {
                          <span class="shrink-0 rounded-full px-3 py-1.5" [class]="i === 0 ? 'bg-(--tinta) text-(--papel)' : 'bg-(--papel-2) text-(--tinta-2)'">{{ c }}</span>
                        }
                      </div>
                      <ul class="flex-1 space-y-2.5 px-3">
                        @for (p of platillos; track p.nombre) {
                          <li class="flex items-center gap-3 rounded-2xl bg-white p-2 ring-1 ring-(--linea)">
                            <span class="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-2xl" [style.background]="p.fondo">{{ p.foto }}</span>
                            <div class="min-w-0 flex-1">
                              <p class="truncate text-[13px] font-bold text-(--tinta)">{{ p.nombre }}</p>
                              <p class="truncate text-[11px] text-(--tinta-2)">{{ p.detalle }}</p>
                              <p class="lp-mono mt-0.5 text-[12px] font-semibold text-(--tinta)">{{ p.precio }}</p>
                            </div>
                            @if (p.agotado) {
                              <span class="rounded-full bg-(--papel-2) px-2 py-1 text-[10px] font-semibold text-(--tinta-2)">Se acabó</span>
                            } @else {
                              <span class="flex h-8 w-8 items-center justify-center rounded-full bg-(--chile) text-lg font-bold text-white">+</span>
                            }
                          </li>
                        }
                      </ul>
                      <div class="m-3 flex items-center justify-between rounded-2xl bg-(--tinta) px-4 py-3 text-(--papel)">
                        <span class="flex items-center gap-2 text-[13px] font-semibold"><svg lucideShoppingBag class="h-4 w-4"></svg> Ver carrito · 7</span>
                        <span class="lp-mono text-[13px] font-semibold">$203</span>
                      </div>
                    </div>
                  }
                  @case ('domicilio') {
                    <div class="flex h-full flex-col animate-fade-in">
                      <!-- Mapa ilustrado -->
                      <div class="relative h-[270px] bg-[#f1e7d4]">
                        <svg viewBox="0 0 270 270" class="absolute inset-0 h-full w-full" aria-hidden="true">
                          <g stroke="#fffdf8" stroke-width="14" fill="none" stroke-linecap="round">
                            <path d="M-10 60 H280" /><path d="M-10 170 H280" /><path d="M70 -10 V280" /><path d="M190 -10 V280" />
                          </g>
                          <g fill="#dfe9c9"><rect x="90" y="80" width="80" height="70" rx="10" /><rect x="0" y="190" width="55" height="80" rx="10" /></g>
                          <path id="ruta" d="M70 235 V170 H190 V60 H235" fill="none" stroke="var(--chile)" stroke-width="4" stroke-dasharray="2 9" stroke-linecap="round" />
                          <circle cx="70" cy="235" r="9" fill="var(--tinta)" />
                          <circle cx="235" cy="60" r="11" fill="var(--chile)" /><circle cx="235" cy="60" r="4" fill="#fff" />
                          <g>
                            <circle r="13" fill="var(--maiz)" stroke="#fff" stroke-width="3" />
                            <text text-anchor="middle" dy="4.5" font-size="12">🛵</text>
                            @if (conMovimiento) {
                              <animateMotion dur="7s" repeatCount="indefinite" rotate="0" path="M70 235 V170 H190 V60 H235" />
                            } @else {
                              <animateTransform attributeName="transform" type="translate" values="190 120" dur="1s" fill="freeze" />
                            }
                          </g>
                        </svg>
                        <span class="absolute left-3 bottom-3 inline-flex items-center gap-1 rounded-full bg-[#fffdf8] px-2.5 py-1 text-[10px] font-semibold text-(--tinta)"><svg lucideStore class="h-3 w-3"></svg> Sucursal</span>
                        <span class="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-[#fffdf8] px-2.5 py-1 text-[10px] font-semibold text-(--tinta)"><svg lucideMapPin class="h-3 w-3 text-(--chile)"></svg> Col. Roma</span>
                      </div>
                      <div class="flex-1 space-y-3 p-4">
                        <div class="flex items-center justify-between gap-2">
                          <div>
                            <p class="text-[11px] font-semibold uppercase tracking-wider text-(--tinta-2)">Pedido #1042</p>
                            <p class="lp-display whitespace-nowrap text-xl font-extrabold text-(--tinta)">Llega en 8 min</p>
                          </div>
                          <span class="shrink-0 whitespace-nowrap rounded-full bg-(--maiz)/30 px-2.5 py-1 text-[11px] font-bold text-(--tinta)">Juan · en camino</span>
                        </div>
                        <ol class="space-y-2 text-[12px]">
                          @for (paso of pasos; track paso.texto) {
                            <li class="flex items-center gap-2.5" [class]="paso.hecho ? 'text-(--tinta)' : 'text-(--tinta-2)/60'">
                              <span class="flex h-5 w-5 items-center justify-center rounded-full text-white" [style.background]="paso.hecho ? 'var(--aguacate)' : '#d9ccb5'">
                                <svg lucideCheck class="h-3 w-3"></svg>
                              </span>
                              {{ paso.texto }}
                            </li>
                          }
                        </ol>
                        <div class="lp-mono flex justify-between rounded-xl bg-(--papel-2) px-3 py-2 text-[11px] text-(--tinta-2)">
                          <span>Envío 2.4 km</span><span class="font-semibold text-(--tinta)">$25</span>
                        </div>
                      </div>
                    </div>
                  }
                }
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

  readonly assurances = ['Desde $29 USD al mes', '0% de comisión por pedido', '14 días gratis, sin tarjeta'];

  readonly vitrinas = [
    {
      id: 'whatsapp' as Vitrina,
      titulo: 'Asistente de WhatsApp',
      prefijo: 'Vende por',
      palabra: 'WhatsApp',
      detalle: 'Toma el pedido en tu número, a cualquier hora.',
      color: '#1f8f52',
      etiquetas: ['Responde a cualquier hora', 'Calcula total y cambio', 'Tu mismo número'],
    },
    {
      id: 'menu' as Vitrina,
      titulo: 'Menú digital',
      prefijo: 'Vende con',
      palabra: 'tu menú digital',
      detalle: 'Liga y QR con fotos, combos y extras.',
      color: '#c8381f',
      etiquetas: ['Fotos, combos y extras', 'Lo agotado no se pide', 'Liga y QR'],
    },
    {
      id: 'domicilio' as Vitrina,
      titulo: 'Domicilio propio',
      prefijo: 'Vende a',
      palabra: 'domicilio',
      detalle: 'Envío por km y tus repartidores.',
      color: '#d9940f',
      etiquetas: ['Envío por kilómetro', 'El cliente sigue su pedido', 'Corte del repartidor'],
    },
  ];

  readonly vitrina = signal<Vitrina>('whatsapp');
  readonly actual = computed(() => this.vitrinas.find((v) => v.id === this.vitrina())!);
  /** Rotan solas hasta que el visitante elige una pestaña. */
  readonly rotando = signal(true);

  readonly chat: readonly ChatMessage[] = [
    { mine: false, text: 'Buenas! me manda 4 de pastor con todo y una gringa', time: '20:14' },
    { mine: true, text: 'Con gusto. ¿Le agrego algo de tomar?', time: '20:14' },
    { mine: false, text: '2 aguas de jamaica. Pago con 300', time: '20:15' },
    { mine: true, text: 'Listo: <b>$228</b> con envío.<br>Le llevo cambio de <b>$72</b>.<br>Llega en ~35 min.', time: '20:16' },
  ];
  readonly visibles = signal(1);
  readonly escribiendo = signal(false);
  readonly confirmado = signal(false);

  readonly categorias = ['Tacos', 'Combos', 'Gringas', 'Bebidas'];
  readonly platillos = [
    { foto: '🌮', fondo: '#f6d9b8', nombre: 'Taco al pastor', detalle: 'Con piña, cebolla y cilantro', precio: '$22' },
    { foto: '🍱', fondo: '#f3c6bb', nombre: 'Combo Farolito', detalle: '5 tacos + agua de 500 ml', precio: '$129' },
    { foto: '🫓', fondo: '#efe0a8', nombre: 'Gringa de pastor', detalle: 'Tortilla de harina y queso', precio: '$65' },
    { foto: '🥤', fondo: '#d6e7d0', nombre: 'Agua de horchata', detalle: '500 ml', precio: '$25', agotado: true },
  ];

  readonly pasos = [
    { texto: 'Confirmado', hecho: true },
    { texto: 'En cocina', hecho: true },
    { texto: 'En camino con Juan', hecho: true },
    { texto: 'Entregado', hecho: false },
  ];

  readonly conMovimiento =
    typeof window !== 'undefined' && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  private timers: ReturnType<typeof setTimeout>[] = [];
  private rotacion: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    this.destroyRef.onDestroy(() => {
      this.timers.forEach(clearTimeout);
      if (this.rotacion) clearInterval(this.rotacion);
    });
    if (!this.conMovimiento) {
      this.visibles.set(this.chat.length);
      this.confirmado.set(true);
      this.rotando.set(false);
      return;
    }
    const fin = this.animarChat();
    // Cuando termina la conversación, la vitrina empieza a rotar.
    this.timers.push(setTimeout(() => {
      if (!this.rotando()) return;
      this.siguiente();
      this.rotacion = setInterval(() => this.siguiente(), 6000);
    }, fin + 1500));
  }

  elegir(id: Vitrina): void {
    this.rotando.set(false);
    if (this.rotacion) clearInterval(this.rotacion);
    this.vitrina.set(id);
  }

  private siguiente(): void {
    const i = this.vitrinas.findIndex((v) => v.id === this.vitrina());
    this.vitrina.set(this.vitrinas[(i + 1) % this.vitrinas.length].id);
  }

  /** Escribe la conversación una vez; regresa cuánto tarda en terminar (ms). */
  private animarChat(): number {
    let t = 600;
    for (let i = 1; i < this.chat.length; i++) {
      if (this.chat[i].mine) {
        this.timers.push(setTimeout(() => this.escribiendo.set(true), t));
        t += 900;
      }
      this.timers.push(setTimeout(() => {
        this.escribiendo.set(false);
        this.visibles.set(i + 1);
        if (i === this.chat.length - 1) this.confirmado.set(true);
      }, t));
      t += 1100;
    }
    return t;
  }
}
