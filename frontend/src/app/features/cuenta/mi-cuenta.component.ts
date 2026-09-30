import { PesosPipe } from '../../shared/utils/pesos';
import {
  Component,
  ChangeDetectionStrategy,
  signal,
  computed,
  inject,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription, timer } from 'rxjs';
import { CuentaService, EntregaHistorial, PedidoHistorial } from './cuenta.service';
import {
  LucideUser,
  LucideBike,
  LucidePackage,
  LucideLogOut,
  LucideTriangleAlert,
  LucideMapPin,
  LucideArrowRight,
  LucideRefreshCw,
} from '@lucide/angular';

/** Estados en los que el pedido todavía se está moviendo. */
const EN_CURSO = ['NUEVO', 'CONFIRMADO', 'LISTO', 'EN_CAMINO'];

/**
 * Lo que la persona ve de sí misma: sus pedidos si es cliente, sus entregas si
 * es repartidor.
 *
 * Lo que está en curso va arriba y se actualiza solo. El repartidor puede
 * abrir desde aquí la entrega que lleva, sin depender del enlace que le llegó
 * por WhatsApp: su sesión es la otra puerta a la misma pantalla.
 */
@Component({
  // El telefono pausa los temporizadores de una pestaña en segundo plano: al
  // volver a ella se recarga, o veria el estado de hace minutos.
  host: { '(document:visibilitychange)': 'alVolverALaPestana()' },
  selector: 'app-mi-cuenta',
  standalone: true,
  imports: [PesosPipe, 
    RouterLink,
    LucideUser,
    LucideBike,
    LucidePackage,
    LucideLogOut,
    LucideTriangleAlert,
    LucideMapPin,
    LucideArrowRight,
    LucideRefreshCw,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-stone-50 text-stone-900 [color-scheme:light]">
      <header class="bg-white border-b border-stone-200 sticky top-0 z-10">
        <div class="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          @if (cuenta.esRepartidor()) {
            <svg lucideBike class="w-6 h-6 text-indigo-600 shrink-0"></svg>
          } @else {
            <svg lucideUser class="w-6 h-6 text-orange-600 shrink-0"></svg>
          }
          <div class="min-w-0">
            <h1 class="font-bold leading-tight truncate">{{ sesion()?.nombre }}</h1>
            <p class="text-xs text-stone-500 tabular-nums">{{ sesion()?.telefono }}</p>
          </div>

          <div class="ml-auto shrink-0 flex items-center gap-3">
            @if (vigilando()) {
              <span class="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                Al día
              </span>
            }
            <button
              (click)="recargar()"
              class="text-stone-400 hover:text-stone-900 cursor-pointer"
              aria-label="Actualizar"
              title="Actualizar"
            >
              <svg lucideRefreshCw class="w-4 h-4" [class.animate-spin]="refrescando()"></svg>
            </button>
            <button
              (click)="salir()"
              class="flex items-center gap-1.5 text-xs font-semibold text-stone-500 hover:text-stone-900 cursor-pointer"
            >
              <svg lucideLogOut class="w-4 h-4"></svg>
              Salir
            </button>
          </div>
        </div>
      </header>

      <div class="max-w-2xl mx-auto px-4 py-6 space-y-4">
        @if (cargando()) {
          <p class="text-center text-stone-500 text-sm py-16">Cargando tu historial...</p>
        } @else if (error()) {
          <div class="flex items-start gap-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl p-4 text-sm">
            <svg lucideTriangleAlert class="w-5 h-5 shrink-0 mt-0.5"></svg>
            <span>{{ error() }}</span>
          </div>
        } @else if (cuenta.esRepartidor()) {

          <!-- Lo que trae ahora: primero, porque es lo que tiene que hacer -->
          @if (entregasActivas().length > 0) {
            <section class="space-y-3">
              <h2 class="text-xs font-bold uppercase tracking-wider text-stone-500">
                Lo que llevas ahora
              </h2>
              @for (e of entregasActivas(); track e.orderId) {
                <a
                  [routerLink]="['/repartidor', e.token]"
                  class="block bg-white border-2 border-indigo-300 rounded-xl p-4 hover:border-indigo-500 transition-colors"
                >
                  <div class="flex items-start justify-between gap-3">
                    <div class="min-w-0">
                      <p class="font-bold tracking-wide">{{ e.token }}</p>
                      <p class="flex items-start gap-1.5 text-sm text-stone-600 mt-1">
                        <svg lucideMapPin class="w-4 h-4 shrink-0 mt-0.5 text-stone-400"></svg>
                        <span class="min-w-0">{{ e.direccion }}</span>
                      </p>
                      <p class="text-xs mt-2 font-bold uppercase tracking-wider" [class]="colorEstado(e.estado)">
                        {{ etiquetaEstado(e.estado) }}
                      </p>
                    </div>
                    <div class="text-right shrink-0">
                      <p class="text-xs text-stone-500">Cobrar</p>
                      <p class="font-bold tabular-nums">{{ e.cobrado | pesos }}</p>
                      <span class="inline-flex items-center gap-1 text-xs font-bold text-indigo-700 mt-2">
                        Abrir
                        <svg lucideArrowRight class="w-3.5 h-3.5"></svg>
                      </span>
                    </div>
                  </div>
                </a>
              }
            </section>
          }

          <!-- Resumen de lo ya cobrado -->
          <div class="grid grid-cols-3 gap-3 pt-2">
            <div class="bg-white border border-stone-200 rounded-xl p-3">
              <p class="text-[11px] uppercase tracking-wider text-stone-500 font-bold">Entregas</p>
              <p class="text-xl font-black mt-1 tabular-nums">{{ entregasCerradas() }}</p>
            </div>
            <div class="bg-white border border-stone-200 rounded-xl p-3">
              <p class="text-[11px] uppercase tracking-wider text-stone-500 font-bold">Kilómetros</p>
              <p class="text-xl font-black text-sky-700 mt-1 tabular-nums">{{ kmTotales().toFixed(1) }}</p>
            </div>
            <div class="bg-white border border-stone-200 rounded-xl p-3">
              <p class="text-[11px] uppercase tracking-wider text-stone-500 font-bold">Ganado</p>
              <p class="text-xl font-black text-emerald-700 mt-1 tabular-nums">{{ ganado() | pesos }}</p>
            </div>
          </div>

          @for (e of entregasCerradasLista(); track e.orderId) {
            <article class="bg-white border border-stone-200 rounded-xl p-4">
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <p class="font-bold tracking-wide">{{ e.token }}</p>
                  <p class="text-sm text-stone-600 mt-0.5">{{ e.direccion }}</p>
                  <p class="text-xs text-stone-400 mt-1">
                    {{ fecha(e.entregadoEn || e.asignadoEn) }}
                    @if (e.distanciaKm !== null) {
                      · <span class="tabular-nums">{{ e.distanciaKm }} km</span>
                    }
                  </p>
                </div>
                <div class="text-right shrink-0">
                  @if (e.tuPago !== null) {
                    <p class="font-bold text-emerald-700 tabular-nums">{{ e.tuPago | pesos }}</p>
                  }
                  <p class="text-[11px] uppercase tracking-wider font-bold mt-1" [class]="colorEstado(e.estado)">
                    {{ etiquetaEstado(e.estado) }}
                  </p>
                </div>
              </div>
            </article>
          } @empty {
            @if (entregasActivas().length === 0) {
              <div class="text-center py-20">
                <svg lucidePackage class="w-10 h-10 text-stone-300 mx-auto"></svg>
                <p class="text-stone-500 text-sm mt-3">Todavía no tienes entregas.</p>
              </div>
            }
          }

        } @else {

          <!-- Pedidos del cliente: primero el que está en camino -->
          @if (pedidosEnCurso().length > 0) {
            <section class="space-y-3">
              <h2 class="text-xs font-bold uppercase tracking-wider text-stone-500">En curso</h2>
              @for (p of pedidosEnCurso(); track p.orderId) {
                <article class="bg-white border-2 border-orange-300 rounded-xl p-4">
                  <div class="flex items-start justify-between gap-3">
                    <div class="min-w-0">
                      <p class="text-xs text-stone-400">{{ fecha(p.fecha) }}</p>
                      <p class="font-semibold mt-0.5">
                        {{ p.direccion || (p.mesa ? 'Mesa ' + p.mesa : 'En el restaurante') }}
                      </p>
                      <ul class="text-sm text-stone-600 mt-2 space-y-0.5">
                        @for (plato of p.platillos; track plato) {
                          <li>{{ plato }}</li>
                        }
                      </ul>
                    </div>
                    <div class="text-right shrink-0">
                      <p class="font-bold tabular-nums">{{ p.total | pesos }}</p>
                      <p class="text-[11px] uppercase tracking-wider font-bold mt-1" [class]="colorEstado(p.estadoEntrega || p.estado)">
                        {{ etiquetaEstado(p.estadoEntrega || p.estado) }}
                      </p>
                    </div>
                  </div>
                </article>
              }
            </section>
          }

          @for (p of pedidosPasados(); track p.orderId) {
            <article class="bg-white border border-stone-200 rounded-xl p-4">
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <p class="text-xs text-stone-400">{{ fecha(p.fecha) }}</p>
                  <p class="font-semibold mt-0.5">
                    {{ p.direccion || (p.mesa ? 'Mesa ' + p.mesa : 'En el restaurante') }}
                  </p>
                  <ul class="text-sm text-stone-600 mt-2 space-y-0.5">
                    @for (plato of p.platillos; track plato) {
                      <li>{{ plato }}</li>
                    }
                  </ul>
                </div>
                <div class="text-right shrink-0">
                  <p class="font-bold tabular-nums">{{ p.total | pesos }}</p>
                  @if (p.envio > 0) {
                    <p class="text-[11px] text-stone-400 tabular-nums">envío {{ p.envio | pesos }}</p>
                  }
                  <p class="text-[11px] uppercase tracking-wider font-bold mt-1" [class]="colorEstado(p.estadoEntrega || p.estado)">
                    {{ etiquetaEstado(p.estadoEntrega || p.estado) }}
                  </p>
                </div>
              </div>
            </article>
          } @empty {
            @if (pedidosEnCurso().length === 0) {
              <div class="text-center py-20">
                <svg lucidePackage class="w-10 h-10 text-stone-300 mx-auto"></svg>
                <p class="text-stone-500 text-sm mt-3 font-semibold">Todavía no tienes pedidos</p>
                @if (branchId()) {
                  <a [routerLink]="['/pedir', branchId()]" class="inline-block mt-4 text-sm text-orange-700 underline underline-offset-4">
                    Ver el menú
                  </a>
                }
              </div>
            }
          }
        }

        @if (branchId() && !cuenta.esRepartidor() && (pedidos().length > 0)) {
          <p class="text-center pt-4">
            <a [routerLink]="['/pedir', branchId()]" class="text-sm text-orange-700 underline underline-offset-4">
              Pedir otra vez
            </a>
          </p>
        }
      </div>
    </div>
  `,
})
export class MiCuentaComponent implements OnInit, OnDestroy {
  readonly cuenta = inject(CuentaService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly branchId = signal('');
  readonly pedidos = signal<PedidoHistorial[]>([]);
  readonly entregas = signal<EntregaHistorial[]>([]);
  readonly cargando = signal(true);
  readonly refrescando = signal(false);
  readonly error = signal<string | null>(null);

  readonly sesion = this.cuenta.sesion;

  /**
   * Se consulta cada tanto mientras haya algo moviéndose. Un pedido en curso
   * cambia de estado por decisiones del restaurante o del repartidor, y esta
   * pantalla no tiene forma de enterarse si no pregunta.
   */
  private espera: Subscription | null = null;
  private static readonly CADA_SEGUNDOS = 20;
  readonly vigilando = signal(false);

  readonly entregasActivas = computed(() =>
    this.entregas().filter((e) => EN_CURSO.includes(e.estado))
  );
  private readonly cerradas = computed(() => this.entregas().filter((e) => e.estado === 'ENTREGADO'));
  readonly entregasCerradasLista = computed(() =>
    this.entregas().filter((e) => !EN_CURSO.includes(e.estado))
  );
  readonly entregasCerradas = computed(() => this.cerradas().length);
  readonly kmTotales = computed(() => this.cerradas().reduce((s, e) => s + (e.distanciaKm ?? 0), 0));
  /** Su pago más las propinas: lo que de verdad se lleva. */
  readonly ganado = computed(() => this.cerradas().reduce((s, e) => s + (e.tuPago ?? 0) + (e.propina ?? 0), 0));

  readonly pedidosEnCurso = computed(() =>
    this.pedidos().filter((p) => p.estadoEntrega !== null && EN_CURSO.includes(p.estadoEntrega))
  );
  readonly pedidosPasados = computed(() =>
    this.pedidos().filter((p) => p.estadoEntrega === null || !EN_CURSO.includes(p.estadoEntrega))
  );

  ngOnInit(): void {
    this.branchId.set(this.route.snapshot.paramMap.get('branchId') ?? '');

    if (!this.cuenta.haIniciado()) {
      this.router.navigate(['/cuenta', this.branchId()]);
      return;
    }
    this.cargar();
  }

  ngOnDestroy(): void {
    this.dejarDeVigilar();
  }

  recargar(): void {
    this.cargar(true);
  }

  /**
   * @param enSilencio true en la consulta periódica: no muestra "Cargando" ni
   * borra lo que ya se ve si falla la señal.
   */
  alVolverALaPestana(): void {
    if (document.visibilityState === 'visible' && this.espera) this.cargar(true);
  }

  private cargar(enSilencio = false): void {
    if (enSilencio) {
      this.refrescando.set(true);
    } else {
      this.cargando.set(true);
    }

    // Las dos consultas se manejan por separado porque devuelven cosas
    // distintas; unirlas obligaba a castear y perdía el tipo.
    if (this.cuenta.esRepartidor()) {
      this.cuenta.misEntregas().subscribe({
        next: (datos) => {
          this.entregas.set(datos);
          this.alRecibir();
        },
        error: (err) => this.alFallar(err, enSilencio),
      });
    } else {
      this.cuenta.misPedidos().subscribe({
        next: (datos) => {
          this.pedidos.set(datos);
          this.alRecibir();
        },
        error: (err) => this.alFallar(err, enSilencio),
      });
    }
  }

  private alRecibir(): void {
    this.cargando.set(false);
    this.refrescando.set(false);
    this.ajustarVigilancia();
  }

  private alFallar(err: { status?: number; error?: { error?: string } }, enSilencio: boolean): void {
    this.refrescando.set(false);
    // La sesión venció o ya no es válida: se cierra y se vuelve a entrar, en
    // lugar de quedarse atorado en "Vuelve a entrar" con la sesión vieja.
    if (err.status === 401 || err.status === 403) {
      this.salir();
      return;
    }
    if (enSilencio) {
      return; // Un bache de señal no debe romper lo que ya se ve.
    }
    this.cargando.set(false);
    this.error.set(err.error?.error || 'No pudimos cargar tu historial. Vuelve a entrar.');
  }

  /** Solo se vigila mientras haya algo en curso: lo cerrado ya no cambia. */
  private ajustarVigilancia(): void {
    const hayMovimiento = this.cuenta.esRepartidor()
      ? this.entregasActivas().length > 0
      : this.pedidosEnCurso().length > 0;

    this.vigilando.set(hayMovimiento);

    if (hayMovimiento && !this.espera) {
      this.espera = timer(
        MiCuentaComponent.CADA_SEGUNDOS * 1000,
        MiCuentaComponent.CADA_SEGUNDOS * 1000
      ).subscribe(() => this.cargar(true));
    } else if (!hayMovimiento) {
      this.dejarDeVigilar();
    }
  }

  private dejarDeVigilar(): void {
    this.espera?.unsubscribe();
    this.espera = null;
    this.vigilando.set(false);
  }

  salir(): void {
    this.dejarDeVigilar();
    this.cuenta.cerrarSesion();
    this.router.navigate(['/cuenta', this.branchId()]);
  }

  fecha(iso: string | null): string {
    if (!iso) return '';
    return new Date(iso).toLocaleString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  etiquetaEstado(estado: string | null): string {
    switch (estado) {
      case 'NUEVO':
        return 'por confirmar';
      case 'CONFIRMADO':
        return 'en cocina';
      case 'LISTO':
        return 'listo para recoger';
      case 'EN_CAMINO':
        return 'en camino';
      case 'ENTREGADO':
        return 'entregado';
      case 'CANCELADO':
      case 'CANCELLED':
        return 'cancelado';
      case 'CLOSED':
        return 'cerrado';
      case 'OPEN':
        return 'abierto';
      default:
        return estado ?? '';
    }
  }

  colorEstado(estado: string | null): string {
    switch (estado) {
      case 'ENTREGADO':
      case 'CLOSED':
        return 'text-emerald-700';
      case 'CANCELADO':
      case 'CANCELLED':
        return 'text-rose-700';
      case 'EN_CAMINO':
        return 'text-sky-700';
      case 'LISTO':
        return 'text-indigo-700';
      default:
        return 'text-amber-700';
    }
  }
}
