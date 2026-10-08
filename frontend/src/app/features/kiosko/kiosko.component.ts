import { ChangeDetectionStrategy, Component, HostListener, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { NgTemplateOutlet } from '@angular/common';
import { Router } from '@angular/router';
import { LucideMinus, LucidePlus, LucideX } from '@lucide/angular';
import { environment } from '../../../environments/environment';
import { PesosPipe, formatearPesos } from '../../shared/utils/pesos';
import { usarMarcaDeSucursal } from '../../core/services/marca.service';

/** Lo que guarda la tablet al activarse como kiosko desde el panel. */
export interface KioskoGuardado {
  branchId: string;
  token: string;
  nombre: string;
}

export const CLAVE_KIOSKO = 'pidefacil.kiosko';

interface Opcion {
  id: string;
  nombre: string;
  precio: number;
  disponible: boolean;
}

interface Grupo {
  id: string;
  nombre: string;
  minimo: number;
  maximo: number;
  opciones: Opcion[];
}

interface Platillo {
  id: string;
  nombre: string;
  precio: number;
  descripcion: string | null;
  grupos: Grupo[];
  miniatura?: string | null;
  foto?: string | null;
  incluye?: string[];
  agotado?: boolean;
}

interface Categoria {
  categoryId: string;
  nombre: string;
  items: Platillo[];
}

interface Linea {
  clave: string;
  item: Platillo;
  cantidad: number;
  adicionales: string[];
}

interface Ficha {
  item: Platillo;
  elegidos: Set<string>;
  cantidad: number;
}

interface Creado {
  orderId: string;
  turno: string;
  consumo: 'AQUI' | 'LLEVAR';
  total: number;
}

type Pantalla = 'inicio' | 'menu' | 'datos' | 'listo' | 'sin-activar';
type Consumo = 'AQUI' | 'LLEVAR';

/** Sin tocar la pantalla este tiempo, se pregunta si sigue ahí. */
const INACTIVIDAD_MS = 90_000;
/** Y si no contesta en este tiempo, se vuelve al inicio. */
const CUENTA_REGRESIVA = 15;
/** La pantalla del turno se queda este tiempo antes de volver al inicio. */
const SEGUNDOS_TURNO = 20;

/**
 * El kiosko de la sucursal: una tablet donde el cliente pide solo. Elige si
 * come aquí o se lo lleva, arma su pedido, deja su nombre y recibe un turno
 * para pagar en caja. Lo que se pide aquí no se prepara hasta que se cobra.
 *
 * La tablet se activa desde el panel (Domicilio › Ligas), que le deja un token
 * en el navegador. Sin él, esta pantalla no acepta pedidos.
 */
@Component({
  selector: 'app-kiosko',
  standalone: true,
  imports: [FormsModule, NgTemplateOutlet, PesosPipe, LucidePlus, LucideMinus, LucideX],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div class="fixed inset-0 bg-stone-50 text-stone-900 select-none overflow-hidden flex flex-col">

      <!-- ============================== SIN ACTIVAR -->
      @if (pantalla() === 'sin-activar') {
        <div class="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
          <p class="text-2xl font-extrabold">Este dispositivo no es un kiosko</p>
          <p class="max-w-md text-stone-600">
            {{ errorActivacion() || 'Actívalo desde el panel: Domicilio › Ligas › "Activar este dispositivo como kiosko".' }}
          </p>
          <button type="button" (click)="router.navigateByUrl('/')" class="mt-2 px-6 py-3 rounded-2xl bg-stone-900 text-white font-bold cursor-pointer">Ir al inicio</button>
        </div>
      }

      <!-- ============================== BIENVENIDA -->
      @if (pantalla() === 'inicio') {
        <div class="flex-1 flex flex-col items-center justify-center gap-10 p-8 text-center">
          <div>
            @if (marca.urlLogo(); as logo) {
              <img [src]="logo" alt="" class="mx-auto mb-5 w-28 h-28 object-contain" />
            }
            <p class="text-sm font-bold uppercase tracking-[0.2em] text-orange-600" (pointerdown)="empezarSalida()" (pointerup)="cancelarSalida()" (pointerleave)="cancelarSalida()">
              {{ marca.marca()?.nombre || restaurante() || 'Bienvenido' }}
            </p>
            <h1 class="mt-3 text-5xl sm:text-6xl font-black tracking-tight">Ordena aquí</h1>
            <p class="mt-3 text-lg text-stone-600">Elige, paga en caja y te llamamos por tu turno.</p>
          </div>
          <div class="grid w-full max-w-2xl grid-cols-1 sm:grid-cols-2 gap-5">
            <button type="button" (click)="empezar('AQUI')"
              class="rounded-3xl bg-white border-2 border-stone-200 hover:border-orange-500 active:scale-[0.98] transition p-10 shadow-sm cursor-pointer">
              <span class="block text-6xl" aria-hidden="true">🍽️</span>
              <span class="mt-4 block text-2xl font-extrabold">Comer aquí</span>
            </button>
            <button type="button" (click)="empezar('LLEVAR')"
              class="rounded-3xl bg-white border-2 border-stone-200 hover:border-orange-500 active:scale-[0.98] transition p-10 shadow-sm cursor-pointer">
              <span class="block text-6xl" aria-hidden="true">🛍️</span>
              <span class="mt-4 block text-2xl font-extrabold">Para llevar</span>
            </button>
          </div>
        </div>
      }

      <!-- ============================== MENÚ -->
      @if (pantalla() === 'menu') {
        <header class="shrink-0 flex items-center justify-between gap-3 px-4 sm:px-6 py-3 bg-white border-b border-stone-200">
          <div class="flex items-center gap-2 min-w-0">
            @if (marca.urlLogo(); as logo) {
              <img [src]="logo" alt="" class="w-9 h-9 rounded-lg object-contain shrink-0" />
            }
            <p class="font-extrabold truncate">{{ marca.marca()?.nombre || restaurante() }}</p>
            <button type="button" (click)="alternarConsumo()"
              class="shrink-0 px-3 py-1.5 rounded-full text-sm font-bold bg-orange-100 text-orange-800 cursor-pointer">
              {{ consumo() === 'AQUI' ? '🍽️ Comer aquí' : '🛍️ Para llevar' }} · cambiar
            </button>
          </div>
          <button type="button" (click)="reiniciar()" class="shrink-0 px-3 py-2 rounded-xl text-sm font-bold text-stone-600 hover:bg-stone-100 cursor-pointer">Empezar de nuevo</button>
        </header>

        <div class="flex-1 min-h-0 flex">
          <!-- Categorías -->
          <nav class="hidden md:flex w-48 shrink-0 flex-col gap-1 overflow-y-auto border-r border-stone-200 bg-white p-3" aria-label="Categorías">
            @for (c of categorias(); track c.categoryId) {
              <button type="button" (click)="irACategoria(c.categoryId)"
                class="text-left px-3 py-3 rounded-xl text-base font-bold cursor-pointer"
                [class]="categoriaActiva() === c.categoryId ? 'bg-orange-500 text-white' : 'text-stone-700 hover:bg-stone-100'">
                {{ c.nombre }}
              </button>
            }
          </nav>

          <!-- Platillos -->
          <main id="kiosko-menu" class="flex-1 min-w-0 overflow-y-auto p-4 sm:p-6 space-y-8">
            @if (cargando()) {
              <p class="text-stone-500">Cargando el menú...</p>
            }
            @for (c of categorias(); track c.categoryId) {
              <section [id]="'cat-' + c.categoryId">
                <h2 class="text-xl font-black mb-3">{{ c.nombre }}</h2>
                <div class="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  @for (p of c.items; track p.id) {
                    <button type="button" (click)="abrirFicha(p)" [disabled]="p.agotado"
                      class="text-left rounded-2xl bg-white border border-stone-200 overflow-hidden shadow-sm active:scale-[0.98] transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
                      @if (p.miniatura) {
                        <img [src]="urlFoto(p.miniatura)" [alt]="p.nombre" loading="lazy" class="w-full aspect-[4/3] object-cover bg-stone-100" />
                      } @else {
                        <div class="w-full aspect-[4/3] bg-gradient-to-br from-orange-100 to-stone-100 flex items-center justify-center text-4xl" aria-hidden="true">🍴</div>
                      }
                      <div class="p-3">
                        <p class="font-bold leading-tight">{{ p.nombre }}</p>
                        <p class="mt-1 text-lg font-black text-orange-600 tabular-nums">{{ p.agotado ? 'Agotado' : (p.precio | pesos) }}</p>
                      </div>
                    </button>
                  }
                </div>
              </section>
            }
          </main>

          <!-- Carrito -->
          <aside class="hidden lg:flex w-80 shrink-0 flex-col border-l border-stone-200 bg-white">
            <ng-container *ngTemplateOutlet="carritoTpl" />
          </aside>
        </div>

        <!-- Barra inferior en pantallas angostas -->
        @if (articulos() > 0) {
          <div class="lg:hidden shrink-0 p-3 bg-white border-t border-stone-200">
            <button type="button" (click)="pantalla.set('datos')"
              class="w-full py-4 rounded-2xl bg-orange-500 text-white text-lg font-extrabold cursor-pointer">
              Continuar · {{ articulos() }} {{ articulos() === 1 ? 'platillo' : 'platillos' }} · {{ total() | pesos }}
            </button>
          </div>
        }
      }

      <!-- ============================== DATOS -->
      @if (pantalla() === 'datos') {
        <div class="flex-1 min-h-0 overflow-y-auto">
          <div class="max-w-xl mx-auto p-6 space-y-6">
            <button type="button" (click)="pantalla.set('menu')" class="text-sm font-bold text-stone-600 cursor-pointer">← Seguir pidiendo</button>
            <div class="rounded-3xl bg-white border border-stone-200 p-5">
              <ng-container *ngTemplateOutlet="carritoTpl" />
            </div>
            <div class="space-y-4">
              <label class="block">
                <span class="block text-lg font-extrabold">¿A nombre de quién?</span>
                <span class="block text-sm text-stone-500">Para llamarte cuando esté listo.</span>
                <input type="text" maxlength="60" [ngModel]="nombre()" (ngModelChange)="nombre.set($event)" autocomplete="off"
                  class="mt-2 w-full rounded-2xl border-2 border-stone-200 bg-white px-4 py-4 text-xl font-bold outline-none focus:border-orange-500" />
              </label>
              <label class="block">
                <span class="block text-lg font-extrabold">WhatsApp <span class="text-sm font-semibold text-stone-500">(opcional)</span></span>
                <span class="block text-sm text-stone-500">Te avisamos cuando esté listo.</span>
                <input type="tel" inputmode="tel" maxlength="20" [ngModel]="telefono()" (ngModelChange)="telefono.set($event)" autocomplete="off"
                  class="mt-2 w-full rounded-2xl border-2 border-stone-200 bg-white px-4 py-4 text-xl font-bold outline-none focus:border-orange-500 tabular-nums" />
              </label>
            </div>
            @if (error()) {
              <p class="rounded-2xl bg-rose-50 border border-rose-200 p-4 font-semibold text-rose-700" role="alert">{{ error() }}</p>
            }
            <button type="button" (click)="confirmar()" [disabled]="enviando() || !puedeConfirmar()"
              class="w-full py-5 rounded-2xl bg-orange-500 text-white text-xl font-black cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
              {{ enviando() ? 'Enviando...' : 'Confirmar pedido · ' + formatear(total()) }}
            </button>
            <p class="text-center text-sm text-stone-500">Pagas en caja. Lo empezamos a preparar en cuanto pagues.</p>
          </div>
        </div>
      }

      <!-- ============================== TURNO -->
      @if (pantalla() === 'listo' && creado(); as c) {
        <div class="flex-1 flex flex-col items-center justify-center gap-6 p-8 text-center bg-orange-500 text-white">
          <p class="text-xl font-bold opacity-90">{{ nombre() }}, tu turno es</p>
          <p class="text-[9rem] leading-none font-black tracking-tight tabular-nums">{{ c.turno }}</p>
          <p class="text-2xl font-extrabold">Pasa a caja a pagar {{ c.total | pesos }}</p>
          <p class="max-w-md text-lg opacity-90">
            {{ c.consumo === 'AQUI' ? 'Toma asiento: te llamamos por tu turno cuando esté listo.' : 'Te llamamos por tu turno para que pases a recogerlo.' }}
          </p>
          <button type="button" (click)="reiniciar()" class="mt-4 px-8 py-4 rounded-2xl bg-white text-orange-600 text-lg font-black cursor-pointer">
            Listo ({{ segundosTurno() }})
          </button>
        </div>
      }

      <!-- ============================== FICHA -->
      @if (ficha(); as f) {
        <div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 sm:p-6" role="dialog" aria-modal="true" [attr.aria-label]="f.item.nombre">
          <div class="w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto bg-white rounded-t-3xl sm:rounded-3xl">
            @if (f.item.foto) {
              <img [src]="urlFoto(f.item.foto)" [alt]="f.item.nombre" class="w-full aspect-[16/9] object-cover" />
            }
            <div class="p-6 space-y-5">
              <div class="flex items-start justify-between gap-3">
                <div>
                  <h2 class="text-2xl font-black">{{ f.item.nombre }}</h2>
                  @if (f.item.descripcion) { <p class="mt-1 text-stone-600">{{ f.item.descripcion }}</p> }
                  @if (f.item.incluye?.length) { <p class="mt-1 text-sm text-stone-500">Incluye: {{ f.item.incluye!.join(', ') }}</p> }
                </div>
                <button type="button" (click)="ficha.set(null)" aria-label="Cerrar" class="p-2 rounded-full hover:bg-stone-100 cursor-pointer">
                  <svg lucideX class="w-6 h-6"></svg>
                </button>
              </div>

              @for (g of f.item.grupos; track g.id) {
                <fieldset class="space-y-2">
                  <legend class="font-extrabold">{{ g.nombre }}
                    <span class="ml-1 text-sm font-semibold" [class]="g.minimo > 0 && elegidosEn(f, g) < g.minimo ? 'text-orange-600' : 'text-stone-500'">{{ regla(g) }}</span>
                  </legend>
                  <div class="grid grid-cols-2 gap-2">
                    @for (o of g.opciones; track o.id) {
                      <button type="button" (click)="alternar(g, o)" [disabled]="!o.disponible" [attr.aria-pressed]="f.elegidos.has(o.id)"
                        class="flex items-center justify-between gap-2 rounded-2xl border-2 px-4 py-3 text-left font-bold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        [class]="f.elegidos.has(o.id) ? 'border-orange-500 bg-orange-50' : 'border-stone-200'">
                        <span>{{ o.nombre }}{{ o.disponible ? '' : ' (agotado)' }}</span>
                        @if (o.precio > 0) { <span class="text-sm text-stone-600 tabular-nums">+{{ o.precio | pesos }}</span> }
                      </button>
                    }
                  </div>
                </fieldset>
              }

              <div class="flex items-center gap-3">
                <button type="button" (click)="cantidadFicha(-1)" aria-label="Uno menos" class="w-14 h-14 rounded-2xl border-2 border-stone-200 flex items-center justify-center cursor-pointer">
                  <svg lucideMinus class="w-6 h-6"></svg>
                </button>
                <span class="w-10 text-center text-2xl font-black tabular-nums">{{ f.cantidad }}</span>
                <button type="button" (click)="cantidadFicha(1)" aria-label="Uno más" class="w-14 h-14 rounded-2xl border-2 border-stone-200 flex items-center justify-center cursor-pointer">
                  <svg lucidePlus class="w-6 h-6"></svg>
                </button>
                <button type="button" (click)="agregar()" [disabled]="faltaEnFicha() !== null"
                  class="flex-1 py-4 rounded-2xl bg-orange-500 text-white text-lg font-black cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
                  {{ faltaEnFicha() ?? 'Agregar · ' + formatear(precioFicha()) }}
                </button>
              </div>
            </div>
          </div>
        </div>
      }

      <!-- ============================== ¿SIGUES AHÍ? -->
      @if (preguntando()) {
        <div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-6" role="alertdialog" aria-modal="true" aria-labelledby="sigues">
          <div class="w-full max-w-md rounded-3xl bg-white p-8 text-center space-y-5">
            <p id="sigues" class="text-2xl font-black">¿Sigues ahí?</p>
            <p class="text-stone-600">Volvemos al inicio en {{ segundosRestantes() }} segundos.</p>
            <button type="button" (click)="sigo()" class="w-full py-4 rounded-2xl bg-orange-500 text-white text-lg font-black cursor-pointer">Sí, sigo aquí</button>
          </div>
        </div>
      }

      <ng-template #carritoTpl>
        <div class="flex flex-col h-full min-h-0">
          <p class="px-4 pt-4 text-lg font-black">Tu pedido</p>
          @if (carrito().length === 0) {
            <p class="flex-1 px-4 py-6 text-stone-500">Toca un platillo para agregarlo.</p>
          } @else {
            <ul class="flex-1 min-h-0 overflow-y-auto px-4 py-2 divide-y divide-stone-100">
              @for (l of carrito(); track l.clave) {
                <li class="py-3 flex items-start gap-3">
                  <div class="min-w-0 flex-1">
                    <p class="font-bold leading-tight">{{ l.item.nombre }}</p>
                    @if (l.adicionales.length) {
                      <p class="text-sm text-stone-500">{{ nombresAdicionales(l) }}</p>
                    }
                    <p class="text-sm font-bold text-orange-600 tabular-nums">{{ precioLinea(l) * l.cantidad | pesos }}</p>
                  </div>
                  <div class="flex items-center gap-1 shrink-0">
                    <button type="button" (click)="cambiarCantidad(l, -1)" [attr.aria-label]="'Quitar uno de ' + l.item.nombre" class="w-9 h-9 rounded-xl border border-stone-200 flex items-center justify-center cursor-pointer"><svg lucideMinus class="w-4 h-4"></svg></button>
                    <span class="w-6 text-center font-black tabular-nums">{{ l.cantidad }}</span>
                    <button type="button" (click)="cambiarCantidad(l, 1)" [attr.aria-label]="'Agregar uno de ' + l.item.nombre" class="w-9 h-9 rounded-xl border border-stone-200 flex items-center justify-center cursor-pointer"><svg lucidePlus class="w-4 h-4"></svg></button>
                  </div>
                </li>
              }
            </ul>
          }
          @if (pantalla() === 'menu') {
            <div class="p-4 border-t border-stone-200">
              <p class="flex justify-between text-lg font-black tabular-nums mb-3"><span>Total</span><span>{{ total() | pesos }}</span></p>
              <button type="button" (click)="pantalla.set('datos')" [disabled]="articulos() === 0"
                class="w-full py-4 rounded-2xl bg-orange-500 text-white text-lg font-extrabold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
                Continuar
              </button>
            </div>
          } @else {
            <p class="px-4 pb-4 flex justify-between text-lg font-black tabular-nums"><span>Total</span><span>{{ total() | pesos }}</span></p>
          }
        </div>
      </ng-template>
    </div>
  `,
})
export class KioskoComponent implements OnInit, OnDestroy {
  private readonly http = inject(HttpClient);
  readonly router = inject(Router);

  private kiosko: KioskoGuardado | null = null;
  /** La sucursal del kiosko, para mostrar la marca del restaurante. */
  private readonly sucursal = signal<string | null>(null);
  readonly marca = usarMarcaDeSucursal(() => this.sucursal());

  readonly pantalla = signal<Pantalla>('inicio');
  readonly restaurante = signal('');
  readonly errorActivacion = signal<string | null>(null);
  readonly categorias = signal<Categoria[]>([]);
  readonly cargando = signal(true);
  readonly categoriaActiva = signal<string | null>(null);

  readonly consumo = signal<Consumo>('AQUI');
  readonly carrito = signal<Linea[]>([]);
  readonly ficha = signal<Ficha | null>(null);
  readonly nombre = signal('');
  readonly telefono = signal('');
  readonly enviando = signal(false);
  readonly error = signal<string | null>(null);
  readonly creado = signal<Creado | null>(null);

  readonly preguntando = signal(false);
  readonly segundosRestantes = signal(CUENTA_REGRESIVA);
  readonly segundosTurno = signal(SEGUNDOS_TURNO);

  readonly formatear = formatearPesos;

  private temporizadorInactividad: ReturnType<typeof setTimeout> | null = null;
  private reloj: ReturnType<typeof setInterval> | null = null;
  private temporizadorSalida: ReturnType<typeof setTimeout> | null = null;

  /** En una tablet en la sucursal se habla directo con el backend del entorno. */
  private readonly api = (() => {
    const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
    return host === 'localhost' || host === '127.0.0.1' ? environment.apiUrl : environment.publicApiUrl;
  })();

  readonly articulos = computed(() => this.carrito().reduce((s, l) => s + l.cantidad, 0));
  readonly total = computed(() => this.carrito().reduce((s, l) => s + this.precioLinea(l) * l.cantidad, 0));
  readonly puedeConfirmar = computed(() => this.articulos() > 0 && this.nombre().trim().length > 0);

  readonly precioFicha = computed(() => {
    const f = this.ficha();
    if (!f) return 0;
    return (f.item.precio + this.extras(f.item, [...f.elegidos])) * f.cantidad;
  });

  /** Lo que falta elegir en la ficha, o null si ya se puede agregar. */
  readonly faltaEnFicha = computed(() => {
    const f = this.ficha();
    if (!f) return null;
    const grupo = f.item.grupos.find((g) => this.elegidosEn(f, g) < g.minimo);
    return grupo ? `Elige ${grupo.nombre.toLowerCase()}` : null;
  });

  ngOnInit(): void {
    try {
      const guardado = localStorage.getItem(CLAVE_KIOSKO);
      this.kiosko = guardado ? (JSON.parse(guardado) as KioskoGuardado) : null;
    } catch {
      this.kiosko = null;
    }
    if (!this.kiosko?.branchId || !this.kiosko?.token) {
      this.pantalla.set('sin-activar');
      return;
    }
    this.sucursal.set(this.kiosko.branchId);
    this.http.get<{ nombre: string; restaurante: string }>(
      `${this.api}/public/branches/${this.kiosko.branchId}/kiosko`, { headers: this.encabezados() },
    ).subscribe({
      next: (r) => this.restaurante.set(r.restaurante),
      error: (e: HttpErrorResponse) => this.desactivado(e),
    });
    this.cargarMenu();
  }

  ngOnDestroy(): void {
    this.pararInactividad();
    this.pararReloj();
    if (this.temporizadorSalida) clearTimeout(this.temporizadorSalida);
  }

  // ------------------------------------------------------------------
  // Flujo
  // ------------------------------------------------------------------

  empezar(consumo: Consumo): void {
    this.consumo.set(consumo);
    this.pantalla.set('menu');
    this.vigilar();
  }

  alternarConsumo(): void {
    this.consumo.update((c) => (c === 'AQUI' ? 'LLEVAR' : 'AQUI'));
  }

  /** Borra todo y vuelve a la bienvenida, para el siguiente cliente. */
  reiniciar(): void {
    this.pararInactividad();
    this.pararReloj();
    this.preguntando.set(false);
    this.carrito.set([]);
    this.ficha.set(null);
    this.nombre.set('');
    this.telefono.set('');
    this.error.set(null);
    this.creado.set(null);
    this.pantalla.set('inicio');
    // De paso, el menú se refresca: lo agotado entre clientes ya no aparece.
    this.cargarMenu();
  }

  confirmar(): void {
    if (!this.kiosko || !this.puedeConfirmar() || this.enviando()) return;
    this.enviando.set(true);
    this.error.set(null);
    const cuerpo = {
      nombre: this.nombre().trim(),
      telefono: this.telefono().trim() || null,
      consumo: this.consumo(),
      items: this.carrito().map((l) => ({
        productId: l.item.id,
        quantity: l.cantidad,
        specialInstructions: null,
        adicionales: l.adicionales,
      })),
    };
    this.http.post<Creado>(`${this.api}/public/branches/${this.kiosko.branchId}/kiosko/orders`, cuerpo,
      { headers: this.encabezados() }).subscribe({
      next: (c) => {
        this.enviando.set(false);
        this.creado.set(c);
        this.pantalla.set('listo');
        this.pararInactividad();
        this.cuentaRegresivaTurno();
      },
      error: (e: HttpErrorResponse) => {
        this.enviando.set(false);
        if (e.status === 401) {
          this.desactivado(e);
          return;
        }
        this.error.set(e.error?.error || e.error?.message || 'No se pudo enviar tu pedido. Intenta de nuevo.');
        // Si algo se agotó mientras pedía, el menú nuevo ya lo marca.
        this.cargarMenu();
      },
    });
  }

  // ------------------------------------------------------------------
  // Menú y ficha
  // ------------------------------------------------------------------

  irACategoria(id: string): void {
    this.categoriaActiva.set(id);
    document.getElementById('cat-' + id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  abrirFicha(p: Platillo): void {
    if (p.agotado) return;
    // Sin opciones que elegir, se agrega directo: un toque menos.
    if (p.grupos.length === 0) {
      this.sumar(p, [], 1);
      return;
    }
    this.ficha.set({ item: p, elegidos: new Set(), cantidad: 1 });
  }

  elegidosEn(f: Ficha, g: Grupo): number {
    return g.opciones.filter((o) => f.elegidos.has(o.id)).length;
  }

  regla(g: Grupo): string {
    if (g.minimo === 1 && g.maximo === 1) return 'elige 1';
    if (g.minimo > 0) return `elige de ${g.minimo} a ${g.maximo}`;
    return g.maximo === 1 ? 'opcional' : `opcional, hasta ${g.maximo}`;
  }

  alternar(g: Grupo, o: Opcion): void {
    if (!o.disponible) return;
    this.ficha.update((f) => {
      if (!f) return f;
      const elegidos = new Set(f.elegidos);
      if (g.maximo === 1) {
        g.opciones.forEach((x) => elegidos.delete(x.id));
        elegidos.add(o.id);
      } else if (elegidos.has(o.id)) {
        elegidos.delete(o.id);
      } else if (this.elegidosEn(f, g) < g.maximo) {
        elegidos.add(o.id);
      }
      return { ...f, elegidos };
    });
  }

  cantidadFicha(delta: number): void {
    this.ficha.update((f) => (f ? { ...f, cantidad: Math.min(99, Math.max(1, f.cantidad + delta)) } : f));
  }

  agregar(): void {
    const f = this.ficha();
    if (!f || this.faltaEnFicha() !== null) return;
    this.sumar(f.item, [...f.elegidos], f.cantidad);
    this.ficha.set(null);
  }

  private sumar(item: Platillo, adicionales: string[], cantidad: number): void {
    const clave = item.id + '|' + [...adicionales].sort().join(',');
    this.carrito.update((c) => {
      const existe = c.find((l) => l.clave === clave);
      return existe
        ? c.map((l) => (l.clave === clave ? { ...l, cantidad: Math.min(99, l.cantidad + cantidad) } : l))
        : [...c, { clave, item, cantidad, adicionales }];
    });
  }

  cambiarCantidad(l: Linea, delta: number): void {
    this.carrito.update((c) => c
      .map((x) => (x.clave === l.clave ? { ...x, cantidad: Math.min(99, x.cantidad + delta) } : x))
      .filter((x) => x.cantidad > 0));
  }

  precioLinea(l: Linea): number {
    return l.item.precio + this.extras(l.item, l.adicionales);
  }

  nombresAdicionales(l: Linea): string {
    const opciones = l.item.grupos.flatMap((g) => g.opciones);
    return l.adicionales.map((id) => opciones.find((o) => o.id === id)?.nombre).filter(Boolean).join(', ');
  }

  private extras(item: Platillo, ids: string[]): number {
    const opciones = item.grupos.flatMap((g) => g.opciones);
    return ids.reduce((s, id) => s + (opciones.find((o) => o.id === id)?.precio ?? 0), 0);
  }

  urlFoto(ruta: string): string {
    return `${this.api}${ruta}`;
  }

  // ------------------------------------------------------------------
  // Inactividad: el kiosko no se queda con el pedido a medias de otro
  // ------------------------------------------------------------------

  @HostListener('document:pointerdown')
  @HostListener('document:keydown')
  alTocar(): void {
    if (this.pantalla() === 'menu' || this.pantalla() === 'datos') {
      if (!this.preguntando()) this.vigilar();
    }
  }

  sigo(): void {
    this.preguntando.set(false);
    this.pararReloj();
    this.vigilar();
  }

  private vigilar(): void {
    this.pararInactividad();
    this.temporizadorInactividad = setTimeout(() => this.preguntar(), INACTIVIDAD_MS);
  }

  private preguntar(): void {
    this.preguntando.set(true);
    this.segundosRestantes.set(CUENTA_REGRESIVA);
    this.pararReloj();
    this.reloj = setInterval(() => {
      const quedan = this.segundosRestantes() - 1;
      this.segundosRestantes.set(quedan);
      if (quedan <= 0) this.reiniciar();
    }, 1000);
  }

  private cuentaRegresivaTurno(): void {
    this.segundosTurno.set(SEGUNDOS_TURNO);
    this.pararReloj();
    this.reloj = setInterval(() => {
      const quedan = this.segundosTurno() - 1;
      this.segundosTurno.set(quedan);
      if (quedan <= 0) this.reiniciar();
    }, 1000);
  }

  private pararInactividad(): void {
    if (this.temporizadorInactividad) clearTimeout(this.temporizadorInactividad);
    this.temporizadorInactividad = null;
  }

  private pararReloj(): void {
    if (this.reloj) clearInterval(this.reloj);
    this.reloj = null;
  }

  // ------------------------------------------------------------------
  // Salida del modo kiosko: mantener presionado el nombre 3 segundos
  // ------------------------------------------------------------------

  empezarSalida(): void {
    this.cancelarSalida();
    this.temporizadorSalida = setTimeout(() => {
      if (confirm('¿Salir del modo kiosko en este dispositivo?')) {
        try {
          localStorage.removeItem(CLAVE_KIOSKO);
        } catch {
          /* sin almacenamiento no hay nada que borrar */
        }
        this.router.navigateByUrl('/delivery');
      }
    }, 3000);
  }

  cancelarSalida(): void {
    if (this.temporizadorSalida) clearTimeout(this.temporizadorSalida);
    this.temporizadorSalida = null;
  }

  // ------------------------------------------------------------------
  // Apoyos
  // ------------------------------------------------------------------

  private cargarMenu(): void {
    if (!this.kiosko) return;
    this.http.get<Categoria[]>(`${this.api}/public/branches/${this.kiosko.branchId}/menu`).subscribe({
      next: (cs) => {
        this.categorias.set(cs.filter((c) => c.items.length > 0));
        if (!this.categoriaActiva() && cs.length) this.categoriaActiva.set(cs[0].categoryId);
        this.cargando.set(false);
      },
      error: () => this.cargando.set(false),
    });
  }

  private encabezados(): Record<string, string> {
    return { 'X-Kiosko-Token': this.kiosko?.token ?? '' };
  }

  private desactivado(e: HttpErrorResponse): void {
    if (e.status !== 401) return;
    try {
      localStorage.removeItem(CLAVE_KIOSKO);
    } catch {
      /* nada que borrar */
    }
    this.errorActivacion.set(e.error?.error || 'Este kiosko fue desactivado desde el panel.');
    this.pantalla.set('sin-activar');
  }
}
