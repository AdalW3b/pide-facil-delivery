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
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CuentaService } from '../cuenta/cuenta.service';
import { Subscription, timer } from 'rxjs';
import { environment } from '../../../environments/environment';
import { DeliveryStatus } from './models/delivery.model';
import {
  LucideBike,
  LucideMapPin,
  LucidePhone,
  LucideNavigation,
  LucideClock,
  LucideBanknote,
  LucideCheckCircle,
  LucideTriangleAlert,
  LucideLock,
} from '@lucide/angular';

interface EntregaRepartidor {
  token: string;
  estado: DeliveryStatus;
  disponible: boolean;
  esMia: boolean;
  tomadaPor: string | null;
  listoParaRecoger: boolean;

  sucursal: string;
  direccionSucursal: string | null;

  clienteNombre: string | null;
  clienteTelefono: string | null;
  direccion: string | null;
  referencias: string | null;
  notas: string | null;
  latitud: number | null;
  longitud: number | null;
  distanciaKm: number | null;

  platillos: string[];
  /** Null si la entrega ya la tomó otro repartidor. */
  aCobrar: number | null;
  pagaCon: number | null;
  cambio: number | null;
  tuPago: number | null;
}

/** Dónde se recuerda al repartidor en su propio teléfono. */
const CLAVE_TELEFONO = 'pidefacil.repartidor.telefono';
const CLAVE_NOMBRE = 'pidefacil.repartidor.nombre';

/**
 * La pantalla del repartidor. Se abre desde el enlace que se publica en el
 * grupo de WhatsApp: no hay cuenta ni contraseña, el repartidor se identifica
 * con su número la primera vez y el teléfono lo recuerda desde entonces.
 */
@Component({
  // El telefono pausa los temporizadores de una pestaña en segundo plano: al
  // volver a ella se recarga, o veria el estado de hace minutos.
  host: { '(document:visibilitychange)': 'alVolverALaPestana()' },
  selector: 'app-driver-order',
  standalone: true,
  imports: [PesosPipe, 
    FormsModule,
    RouterLink,
    LucideBike,
    LucideMapPin,
    LucidePhone,
    LucideNavigation,
    LucideClock,
    LucideBanknote,
    LucideCheckCircle,
    LucideTriangleAlert,
    LucideLock,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-slate-950 text-slate-100">
      <header class="bg-slate-900 border-b border-slate-800 sticky top-0 z-10">
        <div class="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
          <svg lucideBike class="w-6 h-6 text-indigo-400 shrink-0"></svg>
          <div class="min-w-0">
            <h1 class="font-bold leading-tight">Entrega {{ entrega()?.token || '' }}</h1>
            @if (entrega(); as e) {
              <p class="text-xs text-slate-400 truncate">{{ e.sucursal }}</p>
            }
          </div>

          <!-- Si entró con su cuenta, que pueda volver a ella -->
          @if (tieneSesion()) {
            <a
              [routerLink]="['/mi-cuenta', sucursalDeLaSesion()]"
              class="ml-auto shrink-0 text-xs font-semibold text-indigo-400 hover:text-indigo-300 underline underline-offset-4"
            >
              Mis entregas
            </a>
          }
        </div>
      </header>

      <div class="max-w-lg mx-auto px-4 py-6 pb-32 space-y-5">
        @if (cargando()) {
          <p class="text-center text-slate-500 text-sm py-16">Cargando la entrega...</p>
        } @else if (error()) {
          <div class="flex items-start gap-3 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-xl p-4 text-sm">
            <svg lucideTriangleAlert class="w-5 h-5 shrink-0 mt-0.5"></svg>
            <span>{{ error() }}</span>
          </div>
        } @else if (entrega(); as e) {

          <!-- Entregada: se acabó el trabajo -->
          @if (e.estado === 'ENTREGADO') {
            <div class="text-center py-12">
              <svg lucideCheckCircle class="w-16 h-16 text-emerald-500 mx-auto"></svg>
              <h2 class="text-xl font-bold mt-4">Entrega cerrada</h2>
              <p class="text-slate-400 text-sm mt-2">Gracias. Ya quedó registrada a tu nombre.</p>
              @if (e.tuPago !== null) {
                <p class="mt-6 inline-block bg-slate-900 border border-slate-800 rounded-xl px-5 py-3">
                  <span class="block text-[11px] uppercase tracking-wider text-slate-500 font-bold">Se te paga</span>
                  <span class="text-2xl font-black text-emerald-400 tabular-nums">{{ e.tuPago | pesos }}</span>
                </p>
              }
            </div>
          } @else if (e.estado === 'CANCELADO') {
            <div class="text-center py-12">
              <svg lucideTriangleAlert class="w-12 h-12 text-slate-600 mx-auto"></svg>
              <h2 class="text-lg font-bold mt-4">Esta entrega fue cancelada</h2>
              <p class="text-slate-500 text-sm mt-2">El restaurante la dio de baja.</p>
            </div>
          } @else {

            <!-- Es suya pero la cocina no la suelta todavía -->
            @if (e.esMia && !e.listoParaRecoger && e.estado !== 'EN_CAMINO') {
              <div class="flex items-start gap-3 bg-amber-500/10 border border-amber-500/20 text-amber-300 rounded-xl p-4 text-sm">
                <svg lucideClock class="w-5 h-5 shrink-0 mt-0.5"></svg>
                <span>
                  Esta entrega es tuya. Te llega un WhatsApp en cuanto esté empacada, y esta
                  pantalla se actualiza sola: no hace falta que esperes en la puerta.
                </span>
              </div>
            }

            <!-- Ya la tomó alguien más -->
            @if (!e.disponible && !e.esMia) {
              <div class="flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-xl p-4 text-sm">
                <svg lucideLock class="w-5 h-5 shrink-0 text-slate-500"></svg>
                <span>Esta entrega ya la tomó <strong>{{ e.tomadaPor }}</strong>.</span>
              </div>
            }

            @if (e.disponible || e.esMia) {
            <!-- A dónde va -->
            <section class="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
              <div class="flex items-start gap-2">
                <svg lucideMapPin class="w-5 h-5 shrink-0 mt-0.5 text-indigo-400"></svg>
                <div class="min-w-0">
                  <p class="font-semibold">{{ e.direccion }}</p>
                  @if (e.referencias) {
                    <p class="text-sm text-slate-400 mt-0.5">{{ e.referencias }}</p>
                  }
                  @if (e.distanciaKm !== null) {
                    <p class="text-xs text-slate-400 mt-1 tabular-nums">{{ e.distanciaKm }} km desde el restaurante</p>
                  }
                </div>
              </div>

              @if (e.latitud !== null && e.longitud !== null) {
                <a
                  [href]="enlaceNavegar(e)"
                  target="_blank"
                  rel="noopener"
                  class="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl py-3 font-bold text-sm transition-colors"
                >
                  <svg lucideNavigation class="w-4 h-4"></svg>
                  Ir con el mapa
                </a>
              }

              @if (!e.esMia) {
                <p class="border-t border-slate-800 pt-3 text-xs text-slate-500">
                  Al tomarla verás el nombre y teléfono del cliente y el punto exacto en el mapa.
                </p>
              }
              @if (e.esMia) {
              <div class="border-t border-slate-800 pt-3 text-sm space-y-1">
                <p class="text-slate-300">{{ e.clienteNombre || 'Cliente' }}</p>
                @if (e.clienteTelefono) {
                  <a
                    [href]="'tel:' + e.clienteTelefono"
                    class="flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300 tabular-nums"
                  >
                    <svg lucidePhone class="w-3.5 h-3.5"></svg>
                    {{ e.clienteTelefono }}
                  </a>
                }
                @if (e.notas) {
                  <p class="text-amber-400/90 text-xs pt-1">Nota: {{ e.notas }}</p>
                }
              </div>
              }
            </section>

            <!-- Qué lleva -->
            <section class="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <h2 class="text-[11px] uppercase tracking-wider text-slate-500 font-bold mb-2">Lo que llevas</h2>
              <ul class="text-sm space-y-1">
                @for (p of e.platillos; track p) {
                  <li class="text-slate-300">{{ p }}</li>
                }
              </ul>
            </section>

            <!-- Dinero -->
            <section class="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2">
              <div class="flex items-center justify-between">
                <span class="text-sm text-slate-400">Cobrar al cliente</span>
                <span class="text-2xl font-black tabular-nums">{{ (e.aCobrar ?? 0) | pesos }}</span>
              </div>
              @if (e.cambio !== null) {
                <p class="flex items-center gap-2 text-sm text-emerald-400 font-semibold bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
                  <svg lucideBanknote class="w-4 h-4 shrink-0"></svg>
                  Paga con {{ e.pagaCon! | pesos }} — lleva {{ e.cambio | pesos }} de cambio
                </p>
              }
              @if (e.tuPago !== null) {
                <div class="flex items-center justify-between border-t border-slate-800 pt-2">
                  <span class="text-sm text-slate-400">Se te paga</span>
                  <span class="font-bold text-emerald-400 tabular-nums">{{ e.tuPago | pesos }}</span>
                </div>
              }
            </section>

            }

            <!-- Registro / acciones -->
            @if (e.disponible) {
              <section class="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
                <h2 class="text-sm font-bold">Tomar esta entrega</h2>
                <p class="text-xs text-slate-400">
                  Con tu WhatsApp queda a tu nombre. Solo te lo pedimos la primera vez.
                </p>

                <div>
                  <label for="dr-tel" class="block text-xs text-slate-400 mb-1.5">Tu WhatsApp</label>
                  <input id="dr-tel" type="tel" inputmode="tel" [ngModel]="telefono()" (ngModelChange)="telefono.set($event)"
                    placeholder="5215512345678"
                    class="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-4 text-sm text-white outline-none focus:border-indigo-500 tabular-nums" />
                </div>
                <div>
                  <label for="dr-nom" class="block text-xs text-slate-400 mb-1.5">Tu nombre</label>
                  <input id="dr-nom" type="text" [ngModel]="nombre()" (ngModelChange)="nombre.set($event)"
                    class="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-4 text-sm text-white outline-none focus:border-indigo-500" />
                </div>
              </section>
            }
          }
        }
      </div>

      <!-- Botón de acción, fijo abajo: se usa manejando -->
      @if (entrega(); as e) {
        @if (e.estado !== 'ENTREGADO' && e.estado !== 'CANCELADO') {
          <div
            class="fixed bottom-0 inset-x-0 bg-slate-900 border-t border-slate-800"
            style="padding-bottom: calc(0.75rem + env(safe-area-inset-bottom, 0px));"
          >
            <div class="max-w-lg mx-auto px-4 pt-3 space-y-2">
              @if (errorAccion()) {
                <p class="text-xs text-rose-400 text-center">{{ errorAccion() }}</p>
              }

              @if (e.disponible) {
                <button
                  (click)="tomar()"
                  [disabled]="!puedeTomar() || enviando()"
                  class="w-full bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl py-4 font-bold transition-colors cursor-pointer disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed"
                >
                  {{ enviando() ? 'Tomando...' : 'Tomar entrega' }}
                </button>
              } @else if (e.esMia) {
                @if (e.estado === 'EN_CAMINO') {
                  <button
                    (click)="entregar()"
                    [disabled]="enviando()"
                    class="w-full bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl py-4 font-bold transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-wait"
                  >
                    {{ enviando() ? 'Guardando...' : 'Ya entregué' }}
                  </button>
                } @else if (e.listoParaRecoger) {
                  <button
                    (click)="salir()"
                    [disabled]="enviando()"
                    class="w-full bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl py-4 font-bold transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-wait"
                  >
                    {{ enviando() ? 'Guardando...' : 'Lo recogí, voy en camino' }}
                  </button>
                } @else {
                  <!-- Es suya, pero la comida sigue en la cocina -->
                  <button
                    disabled
                    class="w-full bg-slate-800 text-slate-500 rounded-xl py-4 font-bold cursor-not-allowed"
                  >
                    Esperando a que lo empaquen
                  </button>
                  <button
                    (click)="recargar()"
                    class="w-full text-xs text-indigo-400 hover:text-indigo-300 py-1 cursor-pointer"
                  >
                    Actualizar
                  </button>
                }
                <!-- Ya no puede llevarla: solo antes de salir a la calle -->
                @if (e.estado !== 'EN_CAMINO') {
                  @if (confirmandoSoltar()) {
                    <div class="flex gap-2">
                      <button (click)="soltar()" [disabled]="enviando()"
                        class="flex-1 bg-rose-600 hover:bg-rose-500 text-white rounded-xl py-2.5 text-sm font-bold cursor-pointer disabled:opacity-60">
                        Sí, ya no puedo llevarla
                      </button>
                      <button (click)="confirmandoSoltar.set(false)"
                        class="px-4 rounded-xl text-sm text-slate-400 hover:text-white cursor-pointer">No</button>
                    </div>
                  } @else {
                    <button (click)="confirmandoSoltar.set(true)"
                      class="w-full text-xs text-slate-500 hover:text-rose-300 py-1 cursor-pointer">
                      Ya no puedo llevarla
                    </button>
                  }
                }
              }
            </div>
          </div>
        }
      }
    </div>
  `,
})
export class DriverOrderComponent implements OnInit, OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly cuenta = inject(CuentaService);

  readonly token = signal('');
  readonly entrega = signal<EntregaRepartidor | null>(null);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);
  readonly errorAccion = signal<string | null>(null);
  readonly enviando = signal(false);

  readonly telefono = signal('');
  readonly nombre = signal('');
  readonly confirmandoSoltar = signal(false);

  /**
   * Mientras el repartidor espera a que empaquen, la pantalla se consulta
   * sola. Es un telefono en la calle: se prefiere preguntar cada tanto antes
   * que sostener una conexion abierta que se cae al bloquear la pantalla.
   */
  private espera: Subscription | null = null;
  private static readonly CADA_SEGUNDOS = 20;

  /**
   * El repartidor abre esto desde su teléfono, casi nunca desde la máquina del
   * restaurante, así que el backend tiene que ser el público cuando la página
   * no se sirve en local.
   */
  private readonly api = (() => {
    const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
    const esLocal = host === 'localhost' || host === '127.0.0.1';
    return esLocal ? environment.apiUrl : environment.publicApiUrl;
  })();

  readonly tieneSesion = computed(() => this.cuenta.esRepartidor());
  readonly sucursalDeLaSesion = computed(() => this.cuenta.sesion()?.branchId ?? '');

  readonly puedeTomar = computed(
    () => this.telefono().replace(/\D/g, '').length >= 10 && this.nombre().trim().length > 1
  );

  ngOnInit(): void {
    const token = this.route.snapshot.paramMap.get('token') ?? '';
    this.token.set(token);
    if (!token) {
      this.cargando.set(false);
      this.error.set('El enlace no es válido.');
      return;
    }

    this.recordarRepartidor();
    this.cargar();
  }

  ngOnDestroy(): void {
    this.dejarDeEsperar();
  }

  /**
   * Arranca o detiene la consulta periodica segun haga falta: solo mientras la
   * entrega es suya y todavia no esta empacada.
   */
  private ajustarEspera(e: EntregaRepartidor): void {
    // Hasta que se cierra: en camino tambien, porque el restaurante puede
    // cancelar con el repartidor ya en la calle y tiene que enterarse.
    const esperando = e.esMia && e.estado !== 'ENTREGADO' && e.estado !== 'CANCELADO';

    if (esperando && !this.espera) {
      this.espera = timer(
        DriverOrderComponent.CADA_SEGUNDOS * 1000,
        DriverOrderComponent.CADA_SEGUNDOS * 1000
      ).subscribe(() => this.cargar(true));
    } else if (!esperando) {
      this.dejarDeEsperar();
    }
  }

  private dejarDeEsperar(): void {
    this.espera?.unsubscribe();
    this.espera = null;
  }

  /**
   * Averigua quién es. La sesión manda sobre lo que quedó guardado de la vez
   * pasada: es su identidad confirmada, no un recuerdo del navegador.
   */
  private recordarRepartidor(): void {
    const sesion = this.cuenta.sesion();
    if (sesion && sesion.tipo === 'REPARTIDOR') {
      this.telefono.set(sesion.telefono);
      this.nombre.set(sesion.nombre);
      return;
    }

    try {
      this.telefono.set(localStorage.getItem(CLAVE_TELEFONO) ?? '');
      this.nombre.set(localStorage.getItem(CLAVE_NOMBRE) ?? '');
    } catch {
      // Ventana privada o almacenamiento bloqueado: se le pide de nuevo.
    }
  }

  private guardarRepartidor(): void {
    try {
      localStorage.setItem(CLAVE_TELEFONO, this.telefono());
      localStorage.setItem(CLAVE_NOMBRE, this.nombre());
    } catch {
      // Que no se recuerde no impide entregar.
    }
  }

  enlaceNavegar(e: EntregaRepartidor): string {
    return `https://www.google.com/maps/dir/?api=1&destination=${e.latitud},${e.longitud}`;
  }

  tomar(): void {
    if (!this.puedeTomar() || this.enviando()) return;

    this.enviando.set(true);
    this.errorAccion.set(null);

    this.http
      .post<EntregaRepartidor>(`${this.api}/public/delivery/${this.token()}/tomar`, {
        phoneNumber: this.telefono().trim(),
        nombre: this.nombre().trim(),
      })
      .subscribe({
        next: (e) => {
          this.enviando.set(false);
          this.guardarRepartidor();
          this.entrega.set(e);
          this.ajustarEspera(e);
        },
        error: (err) => {
          this.enviando.set(false);
          this.errorAccion.set(err.error?.error || 'No se pudo tomar la entrega.');
          // Si alguien se adelantó, hay que ver el estado real.
          this.cargar();
        },
      });
  }

  /** Recogió el pedido: este es el único momento en que sale a la calle. */
  salir(): void {
    this.accion('en-camino');
  }

  entregar(): void {
    this.accion('entregado');
  }

  /** Ya no puede llevarla: vuelve a quedar disponible para otro repartidor. */
  soltar(): void {
    this.confirmandoSoltar.set(false);
    this.accion('soltar');
  }

  /** Las dos acciones del repartidor se mandan igual; solo cambia el paso. */
  private accion(paso: 'en-camino' | 'entregado' | 'soltar'): void {
    if (this.enviando()) return;

    this.enviando.set(true);
    this.errorAccion.set(null);

    this.http
      .post<EntregaRepartidor>(`${this.api}/public/delivery/${this.token()}/${paso}`, {
        phoneNumber: this.telefono().trim(),
      })
      .subscribe({
        next: (e) => {
          this.enviando.set(false);
          this.entrega.set(e);
          this.ajustarEspera(e);
        },
        error: (err) => {
          this.enviando.set(false);
          this.errorAccion.set(err.error?.error || 'No se pudo guardar el cambio.');
        },
      });
  }

  /** Vuelve a consultar, por si el restaurante ya empacó. */
  recargar(): void {
    this.cargar();
  }

  /**
   * @param enSilencio true en la consulta periodica: no muestra "Cargando" ni
   * borra la pantalla si falla la señal, para no parpadear cada 20 segundos.
   */
  alVolverALaPestana(): void {
    if (document.visibilityState === 'visible' && this.espera) this.cargar(true);
  }

  private cargar(enSilencio = false): void {
    if (!enSilencio) {
      this.cargando.set(true);
    }
    const tel = this.telefono().trim();
    const url = `${this.api}/public/delivery/${this.token()}` + (tel ? `?telefono=${encodeURIComponent(tel)}` : '');

    this.http.get<EntregaRepartidor>(url).subscribe({
      next: (e) => {
        const antes = this.entrega();
        this.entrega.set(e);
        this.cargando.set(false);

        // Justo cuando lo empacan, se le avisa en la pantalla ademas del
        // WhatsApp: puede tenerla abierta esperando.
        if (enSilencio && e.listoParaRecoger && !antes?.listoParaRecoger) {
          this.avisarEnPantalla();
        }
        this.ajustarEspera(e);
      },
      error: (err) => {
        if (enSilencio) {
          return; // Un bache de señal no debe romper lo que ya se ve.
        }
        this.cargando.set(false);
        this.error.set(err.error?.error || 'No encontramos esta entrega.');
      },
    });
  }

  /** Vibra y suena, porque el teléfono va en el bolsillo. */
  private avisarEnPantalla(): void {
    try {
      navigator.vibrate?.([200, 100, 200]);
    } catch {
      // No todos los navegadores vibran; el aviso visual ya cambió solo.
    }
  }
}
