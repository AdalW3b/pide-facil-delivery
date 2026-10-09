import { PesosPipe, formatearPesos } from '../../shared/utils/pesos';
import {
  Component,
  ChangeDetectionStrategy,
  signal,
  computed,
  inject,
  effect,
  OnInit,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { TitleCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CuentaService, DireccionGuardada } from '../cuenta/cuenta.service';
import { usarMarcaDeSucursal } from '../../core/services/marca.service';
import { environment } from '../../../environments/environment';
import { EstadoPago, PagoEnLinea, PagoTarjetaComponent } from './pago-tarjeta.component';
import {
  LucideMapPin,
  LucideLocateFixed,
  LucidePlus,
  LucideMinus,
  LucideCheckCircle,
  LucideTriangleAlert,
  LucideBike,
  LucideX,
  LucideSearch,
  LucideClock,
} from '@lucide/angular';

interface OpcionAdicional {
  id: string;
  nombre: string;
  precio: number;
  /** false = agotado hoy: se muestra, pero no se puede elegir. */
  disponible: boolean;
}

interface GrupoAdicional {
  id: string;
  nombre: string;
  minimo: number;
  maximo: number;
  opciones: OpcionAdicional[];
}

interface MenuItem {
  id: string;
  nombre: string;
  precio: number;
  descripcion: string | null;
  grupos: GrupoAdicional[];
  /** Ruta de la foto cuadrada (lista) y de la grande (ficha). Null si no tiene. */
  miniatura?: string | null;
  foto?: string | null;
  /** Si es combo, lo que trae: ["4 × Taco al pastor", "2 × Refresco"]. */
  incluye?: string[];
  /** Se acabó por hoy: se ve, pero no se puede pedir. */
  agotado?: boolean;
}

interface MenuCategoria {
  categoryId: string;
  nombre: string;
  items: MenuItem[];
}

/**
 * Una línea del carrito. El mismo platillo con distintos adicionales son dos
 * líneas: "tacos con carne extra" y "tacos sin cebolla" se cocinan distinto.
 */
interface LineaCarrito {
  /** Platillo + adicionales + instrucciones: lo que hace iguales a dos líneas. */
  clave: string;
  item: MenuItem;
  cantidad: number;
  adicionales: string[];
  instrucciones: string;
}

/** Lo que se está armando en la ficha abierta. */
interface Ficha {
  item: MenuItem;
  elegidos: Set<string>;
  instrucciones: string;
  cantidad: number;
  /** Si se abrió desde "Editar", la clave de la línea que reemplaza. */
  editando: string | null;
}

interface Cotizacion {
  disponible: boolean;
  fueraDeCobertura: boolean;
  distanciaKm: number | null;
  costoEnvio: number | null;
  absorbeRestaurante: number | null;
  pagaCliente: number | null;
  pedidoMinimo: number | null;
  minutosEstimados: number | null;
  mensaje: string | null;
}

interface InfoSucursal {
  restaurante: string;
  sucursal: string;
  direccion: string | null;
  entregaActiva: boolean;
  minutosEstimados: number | null;
  envioDesde: number | null;
  kmIncluidos: number | null;
  pedidoMinimo: number | null;
  /** Ausente si responde un backend anterior a los pagos en línea. */
  formasPago?: { tarjeta: boolean; efectivo: boolean; enTienda: boolean };
}

type FormaPago = 'TARJETA' | 'EFECTIVO' | 'TIENDA';

/** "Jamaica" encuentra "jamaica" y "Café" encuentra "cafe". */
function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

interface PedidoCreado {
  orderId: string;
  tokenSeguimiento: string;
  subtotal: number;
  envioCobrado: number;
  total: number;
  minutosEstimados: number | null;
  cambioSugerido: number | null;
  /** Paso a recoger: el código es el turno y no hay envío. */
  paraRecoger?: boolean;
  /** Eligió tarjeta: falta pagarlo antes de que el restaurante lo vea. */
  pago?: PagoEnLinea | null;
  /** Ya pagado con tarjeta (Stripe lo confirmó). */
  pagadoCon?: { marca: string | null; ultimos4: string | null } | null;
}

/**
 * La página a la que entra el comensal por el enlace de la sucursal. No pide
 * cuenta: elige del menú, marca dónde vive y confirma.
 */
@Component({
  selector: 'app-public-order',
  standalone: true,
  imports: [PesosPipe, PagoTarjetaComponent, TitleCasePipe, 
    FormsModule,
    RouterLink,
    LucideMapPin,
    LucideLocateFixed,
    LucidePlus,
    LucideMinus,
    LucideCheckCircle,
    LucideTriangleAlert,
    LucideBike,
    LucideX,
    LucideSearch,
    LucideClock,
  ],
  host: { '(document:keydown.escape)': 'cerrarFicha()', '(window:scroll)': 'alDesplazar()', '(window:resize)': 'alDesplazar()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-stone-50 text-stone-900 [color-scheme:light]">
      <!-- Pago con tarjeta: el pedido ya existe, pero nadie lo ve hasta que se pague -->
      @if (cobro(); as c) {
        <app-pago-tarjeta [pago]="c.pago!" [api]="api" [soloEsperar]="soloEsperarPago()"
          (pagado)="alPagar(c, $event)" (cancelar)="volverDelPago()" />
      } @else if (pedidoCreado(); as p) {
        <div class="max-w-md mx-auto px-4 py-16 text-center">
          <svg lucideCheckCircle class="w-16 h-16 text-emerald-600 mx-auto"></svg>
          <h1 class="text-2xl font-bold mt-4">{{ p.pagadoCon ? '¡Pago recibido!' : '¡Pedido recibido!' }}</h1>
          <p class="text-stone-600 mt-2 text-sm">
            @if (p.paraRecoger) {
              Te avisamos por WhatsApp cuando esté listo. {{ p.pagadoCon ? 'Pasa a recogerlo: ya está pagado.' : 'Pasa a recogerlo y págalo en caja.' }}
            } @else {
              El restaurante lo va a confirmar en un momento y te avisamos por WhatsApp.
            }
          </p>

          <div class="mt-8 bg-white border border-stone-200 rounded-2xl p-6 text-left space-y-3">
            <div>
              <p class="text-[11px] uppercase tracking-wider text-stone-500 font-bold">{{ p.paraRecoger ? 'Tu turno' : 'Tu código' }}</p>
              <p class="text-3xl font-black tracking-widest tabular-nums">{{ p.tokenSeguimiento }}</p>
            </div>
            <div class="border-t border-stone-200 pt-3 text-sm space-y-1">
              <div class="flex justify-between"><span class="text-stone-600">Comida</span><span class="tabular-nums">{{ p.subtotal | pesos }}</span></div>
              @if (!p.paraRecoger) {
                <div class="flex justify-between"><span class="text-stone-600">Envío</span><span class="tabular-nums">{{ p.envioCobrado | pesos }}</span></div>
              }
              <div class="flex justify-between font-bold text-base pt-1"><span>Total</span><span class="tabular-nums">{{ p.total | pesos }}</span></div>
              @if (p.pagadoCon; as t) {
                <p class="text-emerald-700 text-xs pt-1 font-semibold">
                  Pagado con tarjeta{{ t.marca ? ' ' + (t.marca | titlecase) : '' }}{{ t.ultimos4 ? ' •••• ' + t.ultimos4 : '' }}. No pagas nada al recibir.
                </p>
              }
              @if (p.cambioSugerido !== null) {
                <p class="text-emerald-700 text-xs pt-1">El repartidor te lleva {{ p.cambioSugerido | pesos }} de cambio.</p>
              }
            </div>
            @if (p.minutosEstimados) {
              <p class="text-sm text-stone-600 border-t border-stone-200 pt-3">
                Tiempo estimado: <strong>{{ p.minutosEstimados }} minutos</strong>
              </p>
            }
          </div>

          <button
            (click)="empezarDeNuevo()"
            class="mt-6 text-sm text-stone-600 underline underline-offset-4 hover:text-stone-900 cursor-pointer"
          >
            Hacer otro pedido
          </button>
        </div>
      } @else {
        <!-- Encabezado: de quién es, cuánto tarda y cuánto cuesta el envío; debajo,
             el buscador y las categorías, siempre a la mano. -->
        <header id="encabezado-menu" class="bg-white border-b border-stone-200 sticky top-0 z-20">
          <div class="max-w-3xl mx-auto px-4 pt-3 pb-2">
            <div class="flex items-start gap-3">
              @if (marca.urlLogo(); as logo) {
                <img [src]="logo" alt="" class="w-11 h-11 rounded-xl object-contain shrink-0" />
              }
              <div class="min-w-0 flex-1">
                <h1 class="font-extrabold text-lg leading-tight truncate">{{ marca.marca()?.nombre ?? info()?.restaurante ?? 'Pide a domicilio' }}</h1>
                @if (info(); as i) {
                  <p class="text-xs text-stone-500 truncate">{{ i.sucursal }}</p>
                }
              </div>
              <div class="shrink-0 pt-0.5">
                @if (cuenta.haIniciado()) {
                  <a [routerLink]="['/mi-cuenta', branchId()]" class="text-xs font-semibold text-orange-700 underline underline-offset-4">
                    Mis pedidos
                  </a>
                } @else {
                  <a [routerLink]="['/cuenta', branchId()]" class="text-xs font-semibold text-stone-600 underline underline-offset-4">
                    Entrar
                  </a>
                }
              </div>
            </div>

            @if (info(); as i) {
              @if (i.entregaActiva) {
                <ul class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-600" aria-label="Datos de la entrega">
                  @if (i.minutosEstimados) {
                    <li class="flex items-center gap-1">
                      <svg lucideClock class="w-3.5 h-3.5 text-orange-600"></svg>
                      Llega en unos {{ i.minutosEstimados }} min
                    </li>
                  }
                  @if (i.envioDesde !== null) {
                    <li class="flex items-center gap-1">
                      <svg lucideBike class="w-3.5 h-3.5 text-orange-600"></svg>
                      @if (i.envioDesde === 0) {
                        <span class="font-semibold text-emerald-700">Envío gratis{{ i.kmIncluidos ? ' hasta ' + i.kmIncluidos + ' km' : '' }}</span>
                      } @else {
                        Envío desde {{ i.envioDesde | pesos }}
                      }
                    </li>
                  }
                  @if (i.pedidoMinimo) {
                    <li>Pedido mínimo {{ i.pedidoMinimo | pesos }}</li>
                  }
                </ul>
              } @else {
                <p class="mt-2 text-xs font-semibold text-rose-800 bg-rose-50 border border-rose-200 rounded-lg px-2.5 py-1.5">
                  Por ahora esta sucursal no está recibiendo pedidos a domicilio.
                </p>
              }
            }

            @if (!cargandoMenu() && !errorMenu() && menu().length > 0) {
              <div class="mt-2.5 relative">
                <svg lucideSearch class="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"></svg>
                <input
                  type="search"
                  [ngModel]="busqueda()"
                  (ngModelChange)="busqueda.set($event)"
                  placeholder="Buscar en el menú"
                  aria-label="Buscar en el menú"
                  enterkeyhint="search"
                  class="w-full rounded-xl bg-stone-100 border border-transparent pl-9 pr-3 py-2 text-sm outline-none focus:bg-white focus:border-orange-500"
                />
              </div>
              @if (!busqueda().trim()) {
                <nav id="chips-categorias" aria-label="Categorías del menú"
                  class="mt-2 -mx-4 px-4 flex gap-2 overflow-x-auto [scrollbar-width:none] pb-1">
                  @for (cat of menu(); track cat.categoryId) {
                    <button
                      type="button"
                      [id]="'chip-' + cat.categoryId"
                      (click)="irACategoria(cat.categoryId)"
                      [attr.aria-current]="categoriaActiva() === cat.categoryId ? 'true' : null"
                      class="shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border cursor-pointer transition-colors"
                      [class]="categoriaActiva() === cat.categoryId
                        ? 'bg-stone-900 text-white border-stone-900'
                        : 'bg-white text-stone-700 border-stone-300 hover:border-stone-400'"
                    >{{ cat.nombre }}</button>
                  }
                </nav>
              }
            }
          </div>
        </header>

        <div class="max-w-3xl mx-auto px-4 py-6 space-y-8 pb-32">
          @if (cargandoMenu()) {
            <p class="text-center text-stone-500 py-16 text-sm">Cargando el menú...</p>
          } @else if (errorMenu()) {
            <div class="flex items-start gap-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl p-4 text-sm">
              <svg lucideTriangleAlert class="w-5 h-5 shrink-0 mt-0.5"></svg>
              <span>{{ errorMenu() }}</span>
            </div>
          } @else {
            <!-- Lo más pedido: lo que otros ya eligieron convence más que una lista.
                 Con fotos se lucen en cuadros; sin fotos, tarjetas compactas. -->
            @if (!busqueda().trim() && destacados().length >= 3) {
              <section>
                <h2 class="text-xs font-bold uppercase tracking-wider text-stone-500 mb-3">Lo más pedido</h2>
                <ul class="flex gap-3 overflow-x-auto snap-x snap-mandatory scroll-px-4 -mx-4 px-4 pb-2 [scrollbar-width:none]">
                  @if (destacadosConFoto().length >= 3) {
                    @for (item of destacadosConFoto(); track item.id) {
                      <li class="snap-start shrink-0 w-36">
                        <button type="button" (click)="abrirFicha(item)" class="w-full text-left cursor-pointer group"
                          [attr.aria-label]="'Ver ' + item.nombre">
                          <div class="aspect-square rounded-xl overflow-hidden bg-stone-100">
                            <img [src]="urlFoto(item.miniatura!)" [alt]="item.nombre" loading="lazy"
                              class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                          </div>
                          <p class="text-xs font-semibold mt-1.5 line-clamp-2 leading-snug">{{ item.nombre }}</p>
                          <p class="text-xs font-bold text-orange-700 tabular-nums">{{ item.precio | pesos }}</p>
                        </button>
                      </li>
                    }
                  } @else {
                    @for (item of destacados(); track item.id) {
                      <li class="snap-start shrink-0 w-44 flex">
                        <button type="button" (click)="abrirFicha(item)"
                          class="w-full text-left bg-white border border-stone-200 hover:border-orange-300 rounded-xl p-3 flex flex-col gap-1 cursor-pointer"
                          [attr.aria-label]="'Ver ' + item.nombre">
                          <p class="text-sm font-semibold line-clamp-2 leading-snug">{{ item.nombre }}</p>
                          <p class="text-sm font-bold text-orange-700 tabular-nums mt-auto pt-1">{{ item.precio | pesos }}</p>
                        </button>
                      </li>
                    }
                  }
                </ul>
              </section>
            }

            <!-- Menú -->
            @if (busqueda().trim() && menuVisible().length === 0) {
              <p class="text-center text-sm text-stone-500 py-10">
                No encontramos «{{ busqueda().trim() }}» en el menú.
              </p>
            }
            @for (cat of menuVisible(); track cat.categoryId) {
              <section [attr.data-categoria]="cat.categoryId" [id]="'cat-' + cat.categoryId">
                <h2 class="text-xs font-bold uppercase tracking-wider text-stone-500 mb-3">{{ cat.nombre }}</h2>
                <ul class="space-y-2">
                  @for (item of cat.items; track item.id) {
                    <li class="bg-white border border-stone-200 rounded-xl p-3 flex items-start gap-3" [class.opacity-50]="item.agotado">
                      <!-- Tocar el platillo abre su ficha: ahí se eligen los
                           adicionales y se le escribe a la cocina. -->
                      <button
                        type="button"
                        (click)="abrirFicha(item)"
                        class="min-w-0 flex-1 text-left cursor-pointer"
                        [attr.aria-label]="'Ver ' + item.nombre"
                      >
                        <p class="font-semibold text-sm">
                          {{ item.nombre }}
                          @if (item.agotado) {
                            <span class="ml-1 align-middle text-[11px] font-bold uppercase tracking-wide text-stone-600 bg-stone-200 px-1.5 py-0.5 rounded">Agotado hoy</span>
                          }
                          @if (item.incluye?.length) {
                            <span class="ml-1 align-middle text-[11px] font-bold uppercase tracking-wide text-orange-800 bg-orange-100 px-1.5 py-0.5 rounded">Combo</span>
                          }
                        </p>
                        @if (item.incluye?.length) {
                          <p class="text-xs text-stone-600 mt-0.5">Incluye {{ item.incluye!.join(', ') }}</p>
                        }
                        @if (item.descripcion) {
                          <p class="text-xs text-stone-500 mt-0.5">{{ item.descripcion }}</p>
                        }
                        <p class="text-sm font-bold text-orange-700 mt-1 tabular-nums">
                          {{ item.precio | pesos }}
                          @if (item.grupos.length > 0) {
                            <span class="ml-1.5 text-[11px] font-semibold uppercase tracking-wide text-stone-500 bg-stone-100 px-1.5 py-0.5 rounded">
                              {{ tieneObligatorios(item) ? 'Elige opciones' : 'Con adicionales' }}
                            </span>
                          }
                        </p>
                      </button>

                      @if (item.miniatura) {
                        <div class="relative shrink-0 w-24 h-24">
                          <button type="button" (click)="abrirFicha(item)" class="w-full h-full rounded-xl overflow-hidden bg-stone-100 cursor-pointer"
                            [attr.aria-label]="'Ver foto de ' + item.nombre" tabindex="-1">
                            <img [src]="urlFoto(item.miniatura)" [alt]="item.nombre" loading="lazy" class="w-full h-full object-cover" />
                          </button>
                          @if (cantidadDe(item.id) > 0) {
                            <span class="absolute -top-1.5 -left-1.5 min-w-6 h-6 px-1.5 rounded-full bg-stone-900 text-white text-xs font-bold flex items-center justify-center tabular-nums">
                              {{ cantidadDe(item.id) }}
                            </span>
                          }
                          <button
                            (click)="alTocarMas(item)" [hidden]="item.agotado"
                            class="absolute -bottom-2 -right-2 w-9 h-9 rounded-full bg-orange-600 text-white flex items-center justify-center hover:bg-orange-700 shadow-md ring-2 ring-white cursor-pointer"
                            [attr.aria-label]="'Agregar un ' + item.nombre"
                          >
                            <svg lucidePlus class="w-4 h-4"></svg>
                          </button>
                        </div>
                      } @else {
                      <div class="flex items-center gap-2 shrink-0">
                        @if (item.grupos.length === 0 && cantidadDe(item.id) > 0) {
                          <button
                            (click)="quitar(item)"
                            class="w-8 h-8 rounded-full border border-stone-300 flex items-center justify-center hover:bg-stone-100 cursor-pointer"
                            [attr.aria-label]="'Quitar un ' + item.nombre"
                          >
                            <svg lucideMinus class="w-4 h-4"></svg>
                          </button>
                        }
                        @if (cantidadDe(item.id) > 0) {
                          <span class="min-w-5 text-center font-bold text-sm tabular-nums">{{ cantidadDe(item.id) }}</span>
                        }
                        <button
                          (click)="alTocarMas(item)" [hidden]="item.agotado"
                          class="w-8 h-8 rounded-full bg-orange-600 text-white flex items-center justify-center hover:bg-orange-700 cursor-pointer"
                          [attr.aria-label]="'Agregar un ' + item.nombre"
                        >
                          <svg lucidePlus class="w-4 h-4"></svg>
                        </button>
                      </div>
                      }
                    </li>
                  }
                </ul>
              </section>
            }

            <!-- Lo que lleva el pedido, línea por línea -->
            @if (totalArticulos() > 0) {
              <section id="tu-pedido" class="bg-white border border-stone-200 rounded-2xl p-4">
                <h2 class="font-bold text-sm mb-3">Tu pedido</h2>
                <ul class="divide-y divide-stone-100">
                  @for (linea of carrito(); track linea.clave) {
                    <li class="py-3 first:pt-0 last:pb-0 flex items-start gap-3">
                      <div class="min-w-0 flex-1">
                        <p class="text-sm font-semibold">{{ linea.item.nombre }}</p>
                        @for (texto of describirAdicionales(linea); track texto) {
                          <p class="text-xs text-stone-600">{{ texto }}</p>
                        }
                        @if (linea.instrucciones) {
                          <p class="text-xs text-stone-500 italic">"{{ linea.instrucciones }}"</p>
                        }
                        <div class="flex items-center gap-3 mt-1">
                          <span class="text-xs font-bold tabular-nums text-orange-700">
                            {{ (precioUnitario(linea) * linea.cantidad) | pesos }}
                          </span>
                          <button (click)="editarLinea(linea)" class="text-xs text-stone-600 underline underline-offset-2 cursor-pointer">
                            Editar
                          </button>
                        </div>
                      </div>
                      <div class="flex items-center gap-2 shrink-0">
                        <button
                          (click)="cambiarCantidad(linea, -1)"
                          class="w-7 h-7 rounded-full border border-stone-300 flex items-center justify-center hover:bg-stone-100 cursor-pointer"
                          [attr.aria-label]="'Quitar un ' + linea.item.nombre"
                        >
                          <svg lucideMinus class="w-3.5 h-3.5"></svg>
                        </button>
                        <span class="w-5 text-center font-bold text-sm tabular-nums">{{ linea.cantidad }}</span>
                        <button
                          (click)="cambiarCantidad(linea, 1)"
                          class="w-7 h-7 rounded-full border border-stone-300 flex items-center justify-center hover:bg-stone-100 cursor-pointer"
                          [attr.aria-label]="'Agregar otro ' + linea.item.nombre"
                        >
                          <svg lucidePlus class="w-3.5 h-3.5"></svg>
                        </button>
                      </div>
                    </li>
                  }
                </ul>
              </section>
            }

            <!-- Datos de entrega: solo cuando ya hay algo en el carrito -->
            @if (totalArticulos() > 0) {
              <section class="bg-white border border-stone-200 rounded-2xl p-4 space-y-4">
                <div class="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Cómo lo quieres">
                  <button type="button" role="radio" [attr.aria-checked]="modo() === 'DOMICILIO'" (click)="modo.set('DOMICILIO')"
                    class="rounded-xl border-2 px-3 py-2.5 text-sm font-bold cursor-pointer"
                    [class]="modo() === 'DOMICILIO' ? 'border-orange-600 bg-orange-50 text-orange-800' : 'border-stone-200 text-stone-600'">
                    🛵 A domicilio
                  </button>
                  <button type="button" role="radio" [attr.aria-checked]="modo() === 'RECOGER'" (click)="modo.set('RECOGER')"
                    class="rounded-xl border-2 px-3 py-2.5 text-sm font-bold cursor-pointer"
                    [class]="modo() === 'RECOGER' ? 'border-orange-600 bg-orange-50 text-orange-800' : 'border-stone-200 text-stone-600'">
                    🛍️ Paso a recoger
                  </button>
                </div>
                <h2 class="font-bold text-sm">{{ modo() === 'RECOGER' ? '¿A nombre de quién?' : '¿A dónde te lo llevamos?' }}</h2>
                @if (modo() === 'RECOGER' && info()?.direccion) {
                  <p class="text-xs text-stone-600">Lo recoges en <strong>{{ info()!.direccion }}</strong>{{ formaPago() === 'TARJETA' ? '.' : ' y lo pagas en caja.' }}</p>
                }

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label for="po-nombre" class="block text-xs font-semibold text-stone-600 mb-1">Tu nombre</label>
                    <input id="po-nombre" type="text" [ngModel]="nombre()" (ngModelChange)="nombre.set($event)" name="nombre" autocomplete="name"
                      class="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-500" />
                  </div>
                  <div>
                    <label for="po-tel" class="block text-xs font-semibold text-stone-600 mb-1">WhatsApp</label>
                    <input id="po-tel" type="tel" inputmode="tel" [ngModel]="telefono()" (ngModelChange)="telefono.set($event)" name="telefono" autocomplete="tel"
                      placeholder="5215512345678"
                      class="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-500" />
                    <p class="text-[11px] text-stone-500 mt-1">{{ modo() === 'RECOGER' ? 'Por aquí te avisamos cuando esté listo.' : 'Por aquí te avisamos cuando salga tu pedido.' }}</p>
                  </div>
                </div>

                @if (modo() === 'DOMICILIO') {

                @if (direccionesGuardadas().length > 0) {
                  <div>
                    <p class="text-xs font-semibold text-stone-600 mb-1.5">Tus direcciones</p>
                    <div class="flex flex-wrap gap-2" role="group" aria-label="Direcciones guardadas">
                      @for (d of direccionesGuardadas(); track d.id) {
                        <button type="button" (click)="elegirDireccion(d)" [attr.aria-pressed]="direccionElegida() === d.id"
                          class="max-w-full px-3 py-1.5 rounded-full border text-xs text-left cursor-pointer truncate"
                          [class]="direccionElegida() === d.id ? 'bg-orange-600 border-orange-600 text-white' : 'bg-white border-stone-300 text-stone-700 hover:border-orange-400'">
                          {{ d.alias || d.direccion }}
                        </button>
                      }
                    </div>
                  </div>
                }

                <div>
                  <label for="po-dir" class="block text-xs font-semibold text-stone-600 mb-1">Dirección</label>
                  <input id="po-dir" type="text" [ngModel]="direccion()" (ngModelChange)="direccion.set($event); direccionElegida.set(null)" name="direccion" autocomplete="street-address"
                    placeholder="Calle, número, colonia"
                    class="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-500" />
                  @if (cuenta.esCliente() && direccionElegida() === null) {
                    <label class="flex items-center gap-2 text-xs text-stone-600 mt-2 cursor-pointer">
                      <input type="checkbox" [ngModel]="guardarDireccion()" (ngModelChange)="guardarDireccion.set($event)" name="guardarDir" class="accent-orange-600" />
                      Guardar esta dirección para mis próximos pedidos
                    </label>
                  }
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label for="po-ref" class="block text-xs font-semibold text-stone-600 mb-1">Referencias</label>
                    <input id="po-ref" type="text" [ngModel]="referencias()" (ngModelChange)="referencias.set($event)" name="referencias"
                      placeholder="Portón azul, entre 2 farmacias"
                      class="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-500" />
                  </div>
                  <div>
                    <label for="po-notas" class="block text-xs font-semibold text-stone-600 mb-1">Notas para el repartidor</label>
                    <input id="po-notas" type="text" [ngModel]="notas()" (ngModelChange)="notas.set($event)" name="notas"
                      placeholder="Toca el timbre dos veces"
                      class="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-500" />
                  </div>
                </div>

                <!-- El pin: sin esto el repartidor no sabe a dónde ir -->
                <div class="border-t border-stone-200 pt-4">
                  <p class="text-xs font-semibold text-stone-600 mb-2">Ubicación exacta</p>

                  @if (tienePin()) {
                    <div class="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg px-3 py-2 text-xs">
                      <svg lucideMapPin class="w-4 h-4 shrink-0"></svg>
                      <span class="tabular-nums">Ubicación marcada ({{ latitud()!.toFixed(5) }}, {{ longitud()!.toFixed(5) }})</span>
                      <button (click)="borrarPin()" class="ml-auto underline underline-offset-2 cursor-pointer">Cambiar</button>
                    </div>
                  } @else {
                    <div class="space-y-2">
                      <button
                        (click)="usarMiUbicacion()"
                        [disabled]="buscandoUbicacion()"
                        class="w-full flex items-center justify-center gap-2 bg-stone-900 text-white rounded-lg px-4 py-2.5 text-sm font-semibold hover:bg-stone-800 cursor-pointer disabled:opacity-60 disabled:cursor-wait"
                      >
                        <svg lucideLocateFixed class="w-4 h-4"></svg>
                        {{ buscandoUbicacion() ? 'Buscando...' : 'Usar mi ubicación actual' }}
                      </button>

                      <p class="text-[11px] text-stone-500 text-center">o pega el enlace de tu ubicación de Google Maps</p>
                      <input aria-label="Enlace de Google Maps"
                        type="text"
                        [ngModel]="enlaceMaps()"
                        (ngModelChange)="alEscribirEnlace($event)"
                        name="enlaceMaps"
                        placeholder="https://maps.google.com/..."
                        class="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-500"
                      />
                    </div>
                  }

                  @if (errorUbicacion()) {
                    <p class="text-xs text-rose-700 mt-2">{{ errorUbicacion() }}</p>
                  }
                </div>

                <!-- Cotización -->
                @if (cotizando()) {
                  <p class="text-xs text-stone-500">Calculando el envío...</p>
                } @else if (cotizacion(); as c) {
                  @if (!c.disponible) {
                    <p class="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-3">{{ c.mensaje }}</p>
                  } @else if (c.fueraDeCobertura) {
                    <p class="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-3">{{ c.mensaje }}</p>
                  } @else if (c.pagaCliente === 0) {
                    <p class="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg p-3 font-semibold">
                      ¡Envío gratis a tu dirección! ({{ c.distanciaKm }} km)
                    </p>
                  }
                }

                }

                <!-- Cómo paga: solo si hay de dónde elegir -->
                @if (formasDisponibles().length > 1) {
                  <fieldset class="space-y-2">
                    <legend class="font-bold text-sm mb-2">¿Cómo vas a pagar?</legend>
                    <div class="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Forma de pago">
                      @for (f of formasDisponibles(); track f) {
                        <button type="button" role="radio" [attr.aria-checked]="formaPago() === f" (click)="formaElegida.set(f)"
                          class="rounded-xl border-2 px-3 py-2.5 text-sm font-bold cursor-pointer text-left"
                          [class]="formaPago() === f ? 'border-orange-600 bg-orange-50 text-orange-800' : 'border-stone-200 text-stone-600'">
                          {{ nombreForma(f) }}
                          <span class="block text-[11px] font-normal" [class]="formaPago() === f ? 'text-orange-700' : 'text-stone-500'">{{ detalleForma(f) }}</span>
                        </button>
                      }
                    </div>
                  </fieldset>
                } @else if (formaPago() === 'TARJETA') {
                  <p class="text-xs text-stone-600">Este restaurante recibe el pago con tarjeta al pedir.</p>
                }

                <!-- Propina: a domicilio siempre; para recoger solo con tarjeta (en caja se deja ahí) -->
                @if (modo() === 'DOMICILIO' || formaPago() === 'TARJETA') {
                  <fieldset>
                    <legend class="block text-xs font-semibold text-stone-600 mb-1">Propina (opcional)</legend>
                    <div class="flex flex-wrap gap-2" role="radiogroup" aria-label="Propina">
                      @for (pct of porcentajesPropina; track pct) {
                        <button type="button" role="radio" [attr.aria-checked]="propinaPct() === pct" (click)="elegirPropina(pct)"
                          class="rounded-lg border-2 px-3 py-1.5 text-sm font-semibold cursor-pointer"
                          [class]="propinaPct() === pct ? 'border-orange-600 bg-orange-50 text-orange-800' : 'border-stone-200 text-stone-600'">
                          {{ pct === 0 ? 'Sin propina' : pct + '%' }}
                        </button>
                      }
                    </div>
                    @if (propina() > 0) {
                      <p class="text-[11px] text-stone-500 mt-1">{{ propina() | pesos }} para el equipo. ¡Gracias!</p>
                    }
                  </fieldset>
                }

                @if (modo() === 'DOMICILIO' && formaPago() === 'EFECTIVO') {
                <div>
                  <label for="po-paga" class="block text-xs font-semibold text-stone-600 mb-1">¿Con cuánto vas a pagar? (opcional)</label>
                  <input id="po-paga" type="number" inputmode="decimal" min="0" [ngModel]="pagaCon()" (ngModelChange)="pagaCon.set($event)" name="pagaCon"
                    placeholder="Para llevarte cambio"
                    class="w-full sm:w-48 border border-stone-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-500" />
                </div>
                }
              </section>
            }
          }
        </div>

        <!-- Mientras se recorre el menú: un botón que lleva al pedido. Ya en el
             pedido: el total y el botón de confirmar. -->
        @if (totalArticulos() > 0 && !pedidoALaVista()) {
          <div
            class="fixed bottom-0 inset-x-0 z-20 pointer-events-none"
            style="padding-bottom: calc(0.75rem + env(safe-area-inset-bottom, 0px));"
          >
            <div class="max-w-3xl mx-auto px-4">
              <button
                (click)="irAlPedido()"
                class="pointer-events-auto w-full flex items-center justify-between gap-3 bg-orange-600 hover:bg-orange-700 text-white rounded-xl px-4 py-3.5 font-bold text-sm shadow-lg shadow-orange-900/20 cursor-pointer"
              >
                <span class="flex items-center gap-2">
                  <span class="min-w-6 h-6 px-1.5 rounded-full bg-white/20 flex items-center justify-center tabular-nums">{{ totalArticulos() }}</span>
                  Ver mi pedido
                </span>
                <span class="tabular-nums">{{ subtotal() | pesos }}</span>
              </button>
            </div>
          </div>
        }

        <!-- Barra de total, fija abajo -->
        @if (totalArticulos() > 0 && pedidoALaVista()) {
          <div
            class="fixed bottom-0 inset-x-0 bg-white border-t border-stone-200 z-20"
            style="padding-bottom: calc(0.75rem + env(safe-area-inset-bottom, 0px));"
          >
            <div class="max-w-3xl mx-auto px-4 pt-3 space-y-2">
              <div class="flex items-center justify-between text-sm">
                <span class="text-stone-600">Comida</span>
                <span class="font-semibold tabular-nums">{{ subtotal() | pesos }}</span>
              </div>
              @if (envio() !== null) {
                <div class="flex items-center justify-between text-sm">
                  <span class="text-stone-600">
                    Envío
                    @if (distanciaKm() !== null) {
                      <span class="text-stone-400">({{ distanciaKm() }} km)</span>
                    }
                  </span>
                  <!-- Un "$0.00" se lee como "no se calculó". Si el restaurante
                       lo absorbe, decirlo con todas sus letras. -->
                  @if (envio() === 0) {
                    <span class="font-semibold text-emerald-700">Gratis</span>
                  } @else {
                    <span class="font-semibold tabular-nums">{{ envio()! | pesos }}</span>
                  }
                </div>
              }
              @if (propina() > 0) {
                <div class="flex items-center justify-between text-sm">
                  <span class="text-stone-600">Propina</span>
                  <span class="font-semibold tabular-nums">{{ propina() | pesos }}</span>
                </div>
              }
              <div class="flex items-center justify-between font-bold">
                <span>Total</span>
                <span class="tabular-nums">{{ totalAPagar() | pesos }}</span>
              </div>

              @if (motivoBloqueo(); as motivo) {
                <p class="text-[11px] text-stone-500 text-center">{{ motivo }}</p>
              }

              <button
                (click)="confirmar()"
                [disabled]="motivoBloqueo() !== null || enviando()"
                class="w-full bg-orange-600 text-white rounded-xl py-3 font-bold text-sm hover:bg-orange-700 transition-colors cursor-pointer disabled:bg-stone-300 disabled:text-stone-500 disabled:cursor-not-allowed"
              >
                {{ enviando() ? 'Enviando...' : formaPago() === 'TARJETA' ? 'Continuar al pago' : 'Confirmar pedido' }}
              </button>

              @if (errorEnvio()) {
                <p class="text-xs text-rose-700 text-center pb-1">{{ errorEnvio() }}</p>
              }
            </div>
          </div>
        }

        <!-- Ficha del platillo: se abre desde abajo, como en las apps de
             comida, para que el pulgar alcance todo. -->
        @if (ficha(); as f) {
          <div class="fixed inset-0 z-40 bg-black/40" (click)="cerrarFicha()" aria-hidden="true"></div>
          <div
            role="dialog"
            aria-modal="true"
            [attr.aria-label]="f.item.nombre"
            class="fixed inset-x-0 bottom-0 z-50 max-h-[92vh] flex flex-col bg-white rounded-t-2xl shadow-2xl sm:max-w-lg sm:mx-auto overflow-hidden"
          >
            @if (f.item.foto) {
              <div class="relative shrink-0 bg-stone-100">
                <img [src]="urlFoto(f.item.foto)" [alt]="f.item.nombre" class="w-full aspect-[4/3] max-h-[38vh] object-cover" />
                <button (click)="cerrarFicha()" class="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/90 flex items-center justify-center shadow cursor-pointer" aria-label="Cerrar">
                  <svg lucideX class="w-5 h-5"></svg>
                </button>
              </div>
            }
            <div class="flex items-start gap-3 px-4 pt-4 pb-3 border-b border-stone-100">
              <div class="min-w-0 flex-1">
                <h2 class="font-bold text-lg leading-tight">{{ f.item.nombre }}</h2>
                @if (f.item.incluye?.length) {
                  <ul class="mt-1.5 text-sm text-stone-700 space-y-0.5" aria-label="El combo incluye">
                    @for (parte of f.item.incluye!; track parte) {
                      <li>{{ parte }}</li>
                    }
                  </ul>
                }
                @if (f.item.descripcion) {
                  <p class="text-sm text-stone-500 mt-1">{{ f.item.descripcion }}</p>
                }
                <p class="text-sm font-bold text-orange-700 mt-1 tabular-nums">{{ f.item.precio | pesos }}</p>
              </div>
              @if (!f.item.foto) {
                <button (click)="cerrarFicha()" class="p-1.5 -m-1.5 rounded-full hover:bg-stone-100 cursor-pointer" aria-label="Cerrar">
                  <svg lucideX class="w-5 h-5"></svg>
                </button>
              }
            </div>

            <div class="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-5">
              @for (grupo of f.item.grupos; track grupo.id) {
                <fieldset>
                  <legend class="w-full flex items-baseline justify-between gap-2 mb-2">
                    <span class="font-semibold text-sm">{{ grupo.nombre }}</span>
                    <span
                      class="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                      [class]="grupo.minimo > 0 && elegidosEn(f, grupo) < grupo.minimo
                        ? 'bg-orange-100 text-orange-800'
                        : 'bg-stone-100 text-stone-600'"
                    >
                      {{ reglaDe(grupo) }}
                    </span>
                  </legend>
                  <ul class="space-y-1.5">
                    @for (op of grupo.opciones; track op.id) {
                      <li>
                        <label
                          class="flex items-center gap-3 border rounded-lg px-3 py-2.5 text-sm"
                          [class]="!op.disponible
                            ? 'border-stone-200 text-stone-400 cursor-not-allowed'
                            : f.elegidos.has(op.id)
                              ? 'border-orange-500 bg-orange-50 cursor-pointer'
                              : 'border-stone-200 hover:border-stone-300 cursor-pointer'"
                        >
                          <input
                            [type]="grupo.maximo === 1 ? 'radio' : 'checkbox'"
                            [name]="'grupo-' + grupo.id"
                            [checked]="f.elegidos.has(op.id)"
                            [disabled]="!op.disponible || (!f.elegidos.has(op.id) && grupo.maximo > 1 && elegidosEn(f, grupo) >= grupo.maximo)"
                            (change)="alternarOpcion(grupo, op)"
                            class="accent-orange-600 w-4 h-4 shrink-0"
                          />
                          <span class="flex-1">{{ op.nombre }}</span>
                          @if (!op.disponible) {
                            <span class="text-[11px] font-semibold">Agotado</span>
                          } @else if (op.precio > 0) {
                            <span class="tabular-nums text-stone-600">+{{ op.precio | pesos }}</span>
                          }
                        </label>
                      </li>
                    }
                  </ul>
                </fieldset>
              }

              <div>
                <label for="po-instr" class="block font-semibold text-sm mb-1.5">Instrucciones para la cocina</label>
                <textarea
                  id="po-instr"
                  rows="2"
                  maxlength="200"
                  [ngModel]="f.instrucciones"
                  (ngModelChange)="actualizarFicha({ instrucciones: $event })"
                  placeholder="Ej. bien dorados, salsa aparte"
                  class="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-500 resize-none"
                ></textarea>
              </div>
            </div>

            <div class="border-t border-stone-200 px-4 pt-3 space-y-2" style="padding-bottom: calc(0.75rem + env(safe-area-inset-bottom, 0px));">
              @if (faltaEnFicha(); as falta) {
                <p class="text-[11px] text-stone-500 text-center">{{ falta }}</p>
              }
              <div class="flex items-center gap-3">
                <div class="flex items-center gap-2 shrink-0">
                  <button
                    (click)="cambiarCantidadFicha(-1)"
                    [disabled]="f.cantidad <= 1"
                    class="w-9 h-9 rounded-full border border-stone-300 flex items-center justify-center hover:bg-stone-100 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    aria-label="Uno menos"
                  >
                    <svg lucideMinus class="w-4 h-4"></svg>
                  </button>
                  <span class="w-6 text-center font-bold tabular-nums">{{ f.cantidad }}</span>
                  <button
                    (click)="cambiarCantidadFicha(1)"
                    class="w-9 h-9 rounded-full border border-stone-300 flex items-center justify-center hover:bg-stone-100 cursor-pointer"
                    aria-label="Uno más"
                  >
                    <svg lucidePlus class="w-4 h-4"></svg>
                  </button>
                </div>
                <button
                  (click)="guardarFicha()"
                  [disabled]="faltaEnFicha() !== null"
                  class="flex-1 bg-orange-600 text-white rounded-xl py-3 font-bold text-sm hover:bg-orange-700 cursor-pointer disabled:bg-stone-300 disabled:text-stone-500 disabled:cursor-not-allowed tabular-nums"
                >
                  {{ f.editando ? 'Guardar' : 'Agregar' }} · {{ totalFicha() | pesos }}
                </button>
              </div>
            </div>
          </div>
        }
      }
    </div>
  `,
})
export class PublicOrderComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  readonly cuenta = inject(CuentaService);

  readonly branchId = signal<string>('');
  /** Colores, nombre y logo del restaurante mientras el cliente está en el menú. */
  readonly marca = usarMarcaDeSucursal(() => this.branchId());

  readonly menu = signal<MenuCategoria[]>([]);
  readonly cargandoMenu = signal(true);
  readonly errorMenu = signal<string | null>(null);

  readonly carrito = signal<LineaCarrito[]>([]);
  /** Ids de lo más pedido en la sucursal, en orden. */
  readonly masPedidos = signal<string[]>([]);
  readonly destacados = computed(() => {
    const porId = new Map(this.menu().flatMap((c) => c.items).map((i) => [i.id, i]));
    return this.masPedidos().map((id) => porId.get(id)).filter((i): i is MenuItem => !!i && !i.agotado);
  });
  /** La ficha abierta, o null si no hay ninguna. */
  readonly ficha = signal<Ficha | null>(null);

  /** Encabezado del menú: restaurante, tiempo de entrega, costo de envío. */
  readonly info = signal<InfoSucursal | null>(null);
  readonly busqueda = signal('');
  /** La categoría que se está viendo: se marca en la barra de categorías. */
  readonly categoriaActiva = signal<string | null>(null);
  /** El resumen del pedido ya está en pantalla: abajo va el botón de confirmar. */
  readonly pedidoALaVista = signal(false);

  readonly destacadosConFoto = computed(() => this.destacados().filter((i) => !!i.miniatura));

  /** El menú con la búsqueda aplicada (sin acentos ni mayúsculas). */
  readonly menuVisible = computed(() => {
    const q = normalizar(this.busqueda().trim());
    if (!q) return this.menu();
    return this.menu()
      .map((c) => ({
        ...c,
        items: c.items.filter((i) => normalizar(i.nombre + ' ' + (i.descripcion ?? '')).includes(q)),
      }))
      .filter((c) => c.items.length > 0);
  });

  private revisionPendiente = false;
  /** Tras tocar una categoría, el desplazamiento suave no debe cambiarla. */
  private categoriaFijaHasta = 0;

  // Los campos del formulario son senales, no propiedades sueltas: el aviso
  // bajo el boton se calcula con computed(), y computed solo se entera de lo
  // que escribe el cliente si lo que lee son senales.
  readonly nombre = signal('');
  readonly telefono = signal('');
  readonly direccion = signal('');
  readonly referencias = signal('');
  readonly notas = signal('');
  readonly enlaceMaps = signal('');
  readonly pagaCon = signal<number | null>(null);
  /** Direcciones de su cuenta, si entró como cliente. */
  readonly direccionesGuardadas = signal<DireccionGuardada[]>([]);
  readonly direccionElegida = signal<string | null>(null);
  readonly guardarDireccion = signal(true);

  readonly latitud = signal<number | null>(null);
  readonly longitud = signal<number | null>(null);
  readonly buscandoUbicacion = signal(false);
  readonly errorUbicacion = signal<string | null>(null);

  readonly cotizacion = signal<Cotizacion | null>(null);
  readonly cotizando = signal(false);

  readonly enviando = signal(false);
  readonly errorEnvio = signal<string | null>(null);
  readonly pedidoCreado = signal<PedidoCreado | null>(null);
  /** Pedido creado con tarjeta que falta pagar. */
  readonly cobro = signal<PedidoCreado | null>(null);
  /** Volvió de la verificación del banco: el pago ya se mandó, solo falta la confirmación. */
  readonly soloEsperarPago = signal(false);

  /** Lo que eligió el cliente; si deja de estar disponible, se usa la primera que haya. */
  readonly formaElegida = signal<FormaPago | null>(null);
  readonly formasDisponibles = computed<FormaPago[]>(() => {
    const f = this.info()?.formasPago;
    const alRecibir: FormaPago = this.modo() === 'RECOGER' ? 'TIENDA' : 'EFECTIVO';
    if (!f) return [alRecibir];
    const lista: FormaPago[] = [];
    if (f.tarjeta) lista.push('TARJETA');
    if (this.modo() === 'RECOGER' ? f.enTienda : f.efectivo) lista.push(alRecibir);
    return lista.length ? lista : [alRecibir];
  });
  readonly formaPago = computed<FormaPago>(() => {
    const elegida = this.formaElegida();
    const disponibles = this.formasDisponibles();
    if (elegida === 'TARJETA' && disponibles.includes('TARJETA')) return 'TARJETA';
    if (elegida && elegida !== 'TARJETA') {
      // Efectivo y en tienda son la misma idea según el modo: pagar al recibir.
      const alRecibir = disponibles.find((f) => f !== 'TARJETA');
      if (alRecibir) return alRecibir;
    }
    return disponibles.find((f) => f !== 'TARJETA') ?? disponibles[0];
  });

  nombreForma(f: FormaPago): string {
    return f === 'TARJETA' ? '💳 Tarjeta' : f === 'TIENDA' ? '🏪 En caja' : '💵 Efectivo';
  }

  detalleForma(f: FormaPago): string {
    return f === 'TARJETA' ? 'Pagas ahora, en línea' : f === 'TIENDA' ? 'Al recogerlo' : 'Al recibirlo';
  }

  /**
   * La página la abre el comensal desde su teléfono, casi nunca desde esta
   * máquina. Si se está sirviendo por un dominio público, el backend también
   * tiene que serlo; en local se habla directo con localhost.
   */
  readonly api = (() => {
    const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
    const esLocal = host === 'localhost' || host === '127.0.0.1';
    return esLocal ? environment.apiUrl : environment.publicApiUrl;
  })();

  readonly totalArticulos = computed(() => this.carrito().reduce((s, l) => s + l.cantidad, 0));

  /** El carrito se guarda en el teléfono: recargar o volver más tarde no lo pierde. */
  private carritoRestaurado = false;
  private readonly guardarCarrito = effect(() => {
    const lineas = this.carrito();
    if (!this.carritoRestaurado || !this.branchId()) return;
    try {
      const clave = `pidefacil.carrito.${this.branchId()}`;
      if (lineas.length === 0) {
        localStorage.removeItem(clave);
      } else {
        localStorage.setItem(clave, JSON.stringify(lineas.map((l) => ({
          itemId: l.item.id, cantidad: l.cantidad, adicionales: l.adicionales, instrucciones: l.instrucciones,
        }))));
      }
    } catch {
      // Sin almacenamiento el carrito solo dura la visita.
    }
  });

  private readonly revisarAlCambiarCarrito = effect(() => {
    this.totalArticulos();
    this.menuVisible();
    setTimeout(() => this.alDesplazar());
  });

  /**
   * Solo sirve para que el cliente vea cuánto va: el precio que vale lo
   * calcula el servidor con sus propios precios.
   */
  readonly subtotal = computed(() =>
    this.carrito().reduce((s, l) => s + this.precioUnitario(l) * l.cantidad, 0)
  );

  readonly totalFicha = computed(() => {
    const f = this.ficha();
    if (!f) return 0;
    return (f.item.precio + this.sumaAdicionales(f.item, [...f.elegidos])) * f.cantidad;
  });

  /** Qué falta elegir en la ficha para poder agregarla. */
  readonly faltaEnFicha = computed<string | null>(() => {
    const f = this.ficha();
    if (!f) return null;
    for (const g of f.item.grupos) {
      if (this.elegidosEn(f, g) < g.minimo) {
        return g.minimo === 1 && g.maximo === 1
          ? `Elige ${g.nombre.toLowerCase()}`
          : `Elige al menos ${g.minimo} de ${g.nombre.toLowerCase()}`;
      }
    }
    return null;
  });

  /** A domicilio o paso a recoger. Recoger no lleva dirección, mapa ni envío. */
  readonly modo = signal<'DOMICILIO' | 'RECOGER'>('DOMICILIO');

  /** Si la sucursal no reparte, lo que queda es pasar a recoger. */
  private readonly sinReparto = effect(() => {
    const i = this.info();
    if (i && !i.entregaActiva) this.modo.set('RECOGER');
  });

  readonly envio = computed(() => {
    if (this.modo() === 'RECOGER') return null;
    const c = this.cotizacion();
    if (!c || !c.disponible || c.fueraDeCobertura) return null;
    return c.pagaCliente;
  });

  /** Propina en porcentaje de la comida; 0 = sin propina. */
  readonly porcentajesPropina = [0, 10, 15, 20];
  readonly propinaPct = signal(0);
  readonly propina = computed(() => {
    if (this.modo() === 'RECOGER' && this.formaPago() !== 'TARJETA') return 0;
    return Math.round(this.subtotal() * this.propinaPct()) / 100;
  });

  elegirPropina(pct: number): void {
    this.propinaPct.set(pct);
  }

  readonly totalAPagar = computed(() => this.subtotal() + (this.envio() ?? 0) + this.propina());

  readonly distanciaKm = computed(() => {
    const c = this.cotizacion();
    return c && c.disponible && !c.fueraDeCobertura ? c.distanciaKm : null;
  });

  /**
   * Por qué todavía no se puede confirmar. Devolver el motivo en vez de un
   * booleano deja decirle al cliente qué le falta, en lugar de un botón gris
   * sin explicación.
   */
  readonly motivoBloqueo = computed<string | null>(() => {
    if (this.totalArticulos() === 0) return 'Agrega algo al carrito';
    if (!this.telefono().trim()) return 'Falta tu WhatsApp';
    if (this.telefono().replace(/\D/g, '').length < 10) return 'Tu WhatsApp debe tener 10 dígitos';
    if (this.modo() === 'RECOGER') {
      return this.nombre().trim() ? null : 'Escribe tu nombre para llamarte';
    }
    if (!this.direccion().trim()) return 'Falta tu dirección';
    if (!this.tienePin()) return 'Marca tu ubicación en el mapa';

    const c = this.cotizacion();
    if (!c) return 'Calculando el envío...';
    if (!c.disponible || c.fueraDeCobertura) return c.mensaje;
    if (c.pedidoMinimo !== null && this.subtotal() < c.pedidoMinimo) {
      return `El pedido mínimo es de ${formatearPesos(c.pedidoMinimo)}`;
    }
    const pagaCon = this.formaPago() === 'EFECTIVO' ? Number(this.pagaCon()) || 0 : 0;
    if (pagaCon > 0 && pagaCon < this.totalAPagar()) {
      return `Con ${formatearPesos(pagaCon)} no alcanza: tu pedido suma ${formatearPesos(this.totalAPagar())}`;
    }
    return null;
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('branchId') ?? '';
    this.branchId.set(id);
    if (!id) {
      this.cargandoMenu.set(false);
      this.errorMenu.set('El enlace no es válido: le falta la sucursal.');
      return;
    }
    // Si ya tiene sesión, no volver a pedirle lo que el sistema ya sabe.
    const sesion = this.cuenta.sesion();
    if (sesion && sesion.tipo === 'CLIENTE') {
      this.telefono.set(sesion.telefono);
      this.nombre.set(sesion.nombre);
      this.cuenta.misDirecciones(id).subscribe({
        next: (lista) => this.direccionesGuardadas.set(lista),
        error: () => this.direccionesGuardadas.set([]),
      });
    }

    this.cargarMenu(id);
    this.retomarCobro();
  }

  /** Lleva a la categoría tocada, sin que el encabezado fijo la tape. */
  irACategoria(id: string): void {
    const seccion = document.getElementById('cat-' + id);
    if (!seccion) return;
    const alto = document.getElementById('encabezado-menu')?.offsetHeight ?? 0;
    const destino = seccion.getBoundingClientRect().top + window.scrollY - alto - 8;
    window.scrollTo({ top: destino, behavior: this.sinMovimiento() ? 'auto' : 'smooth' });
    this.categoriaActiva.set(id);
    this.centrarChip(id);
    // Fija hasta que termine el desplazamiento (o 2.5 s en navegadores sin "scrollend").
    this.categoriaFijaHasta = Date.now() + 2500;
    window.addEventListener('scrollend', () => {
      this.categoriaFijaHasta = 0;
      this.alDesplazar();
    }, { once: true });
  }

  irAlPedido(): void {
    const pedido = document.getElementById('tu-pedido');
    if (!pedido) return;
    const alto = document.getElementById('encabezado-menu')?.offsetHeight ?? 0;
    const destino = pedido.getBoundingClientRect().top + window.scrollY - alto - 8;
    window.scrollTo({ top: destino, behavior: this.sinMovimiento() ? 'auto' : 'smooth' });
  }

  /** Al desplazarse: qué categoría se está viendo y si ya se llegó al pedido. */
  alDesplazar(): void {
    if (this.revisionPendiente) return;
    this.revisionPendiente = true;
    requestAnimationFrame(() => {
      this.revisionPendiente = false;
      const alto = document.getElementById('encabezado-menu')?.offsetHeight ?? 0;

      // Al final de la página las últimas categorías no alcanzan a subir hasta
      // el encabezado: ahí se respeta la que se tocó.
      const alFinal = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      let activa: string | null = null;
      for (const el of Array.from(document.querySelectorAll<HTMLElement>('[data-categoria]'))) {
        if (el.getBoundingClientRect().top - alto <= 16) activa = el.dataset['categoria'] ?? null;
        else break;
      }
      activa ??= this.menu()[0]?.categoryId ?? null;
      const fija = Date.now() < this.categoriaFijaHasta || alFinal;
      if (!fija && activa !== this.categoriaActiva()) {
        this.categoriaActiva.set(activa);
        this.centrarChip(activa);
      }

      const pedido = document.getElementById('tu-pedido');
      this.pedidoALaVista.set(!!pedido && pedido.getBoundingClientRect().top < window.innerHeight - 140);
    });
  }

  /** La categoría activa queda visible en la barra, aunque haya muchas. */
  private centrarChip(id: string | null): void {
    if (!id) return;
    const barra = document.getElementById('chips-categorias');
    const chip = document.getElementById('chip-' + id);
    if (!barra || !chip) return;
    barra.scrollTo({ left: chip.offsetLeft - barra.clientWidth / 2 + chip.clientWidth / 2, behavior: 'auto' });
  }

  private sinMovimiento(): boolean {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  }

  tienePin(): boolean {
    return this.latitud() !== null && this.longitud() !== null;
  }

  /** Las rutas de foto vienen relativas a la API. */
  urlFoto(ruta: string): string {
    return `${this.api}${ruta}`;
  }

  // ------------------------------------------------------------------
  // Carrito
  // ------------------------------------------------------------------

  /** Cuántos de ese platillo hay en el carrito, sumando todas sus líneas. */
  cantidadDe(productId: string): number {
    return this.carrito()
      .filter((l) => l.item.id === productId)
      .reduce((s, l) => s + l.cantidad, 0);
  }

  tieneObligatorios(item: MenuItem): boolean {
    return item.grupos.some((g) => g.minimo > 0);
  }

  /**
   * El "+" de la lista. Un platillo sin adicionales entra directo, que es lo
   * rápido; uno con adicionales abre la ficha, porque hay algo que decidir.
   */
  alTocarMas(item: MenuItem): void {
    if (item.agotado) return;
    if (item.grupos.length === 0) {
      this.sumarLinea(item, [], '', 1);
    } else {
      this.abrirFicha(item);
    }
  }

  /** El "−" de la lista. Solo aparece en platillos sin adicionales. */
  quitar(item: MenuItem): void {
    const lineas = this.carrito().filter((l) => l.item.id === item.id);
    // Primero la línea sencilla; una con instrucciones se quita desde "Tu pedido".
    const linea = lineas.find((l) => !l.instrucciones) ?? lineas[lineas.length - 1];
    if (linea) this.cambiarCantidad(linea, -1);
  }

  cambiarCantidad(linea: LineaCarrito, delta: number): void {
    this.carrito.update((c) =>
      c
        .map((l) => (l.clave === linea.clave ? { ...l, cantidad: l.cantidad + delta } : l))
        .filter((l) => l.cantidad > 0)
    );
  }

  precioUnitario(linea: LineaCarrito): number {
    return linea.item.precio + this.sumaAdicionales(linea.item, linea.adicionales);
  }

  /** "Tortilla: Harina", "Extras: Carne extra, Queso", en el orden de la ficha. */
  describirAdicionales(linea: LineaCarrito): string[] {
    return linea.item.grupos
      .map((g) => {
        const nombres = g.opciones.filter((o) => linea.adicionales.includes(o.id)).map((o) => o.nombre);
        return nombres.length ? `${g.nombre}: ${nombres.join(', ')}` : '';
      })
      .filter((t) => t !== '');
  }

  private sumaAdicionales(item: MenuItem, ids: string[]): number {
    let suma = 0;
    for (const g of item.grupos) {
      for (const o of g.opciones) {
        if (ids.includes(o.id)) suma += o.precio;
      }
    }
    return suma;
  }

  private claveDe(itemId: string, adicionales: string[], instrucciones: string): string {
    return [itemId, [...adicionales].sort().join(','), instrucciones.trim().toLowerCase()].join('|');
  }

  /** Agrega la línea, o la suma a una idéntica si ya existe. */
  private sumarLinea(item: MenuItem, adicionales: string[], instrucciones: string, cantidad: number): void {
    const clave = this.claveDe(item.id, adicionales, instrucciones);
    this.carrito.update((c) => {
      if (c.some((l) => l.clave === clave)) {
        return c.map((l) => (l.clave === clave ? { ...l, cantidad: l.cantidad + cantidad } : l));
      }
      return [...c, { clave, item, cantidad, adicionales: [...adicionales], instrucciones: instrucciones.trim() }];
    });
  }

  // ------------------------------------------------------------------
  // Ficha del platillo
  // ------------------------------------------------------------------

  abrirFicha(item: MenuItem): void {
    if (item.agotado) return;
    this.ficha.set({ item, elegidos: new Set(), instrucciones: '', cantidad: 1, editando: null });
  }

  editarLinea(linea: LineaCarrito): void {
    this.ficha.set({
      item: linea.item,
      elegidos: new Set(linea.adicionales),
      instrucciones: linea.instrucciones,
      cantidad: linea.cantidad,
      editando: linea.clave,
    });
  }

  cerrarFicha(): void {
    this.ficha.set(null);
  }

  actualizarFicha(cambio: Partial<Ficha>): void {
    this.ficha.update((f) => (f ? { ...f, ...cambio } : f));
  }

  cambiarCantidadFicha(delta: number): void {
    this.ficha.update((f) => (f ? { ...f, cantidad: Math.max(1, f.cantidad + delta) } : f));
  }

  elegidosEn(f: Ficha, grupo: GrupoAdicional): number {
    return grupo.opciones.filter((o) => f.elegidos.has(o.id)).length;
  }

  reglaDe(grupo: GrupoAdicional): string {
    if (grupo.minimo === 1 && grupo.maximo === 1) return 'Obligatorio · elige 1';
    if (grupo.minimo > 0) return `Obligatorio · elige de ${grupo.minimo} a ${grupo.maximo}`;
    return grupo.maximo === 1 ? 'Opcional · hasta 1' : `Opcional · hasta ${grupo.maximo}`;
  }

  /**
   * En un grupo de una sola opción, elegir otra reemplaza la anterior, como
   * un radio. En uno de varias, se suma o se quita.
   */
  alternarOpcion(grupo: GrupoAdicional, opcion: OpcionAdicional): void {
    if (!opcion.disponible) return;
    this.ficha.update((f) => {
      if (!f) return f;
      const elegidos = new Set(f.elegidos);
      if (grupo.maximo === 1) {
        grupo.opciones.forEach((o) => elegidos.delete(o.id));
        elegidos.add(opcion.id);
      } else if (elegidos.has(opcion.id)) {
        elegidos.delete(opcion.id);
      } else if (this.elegidosEn(f, grupo) < grupo.maximo) {
        elegidos.add(opcion.id);
      }
      return { ...f, elegidos };
    });
  }

  guardarFicha(): void {
    const f = this.ficha();
    if (!f || this.faltaEnFicha() !== null) return;

    // Al editar se quita la línea vieja y se suma la nueva: si quedó igual a
    // otra que ya estaba, se juntan en vez de quedar dos líneas idénticas.
    if (f.editando) {
      this.carrito.update((c) => c.filter((l) => l.clave !== f.editando));
    }
    this.sumarLinea(f.item, [...f.elegidos], f.instrucciones, f.cantidad);
    this.ficha.set(null);
  }

  // ------------------------------------------------------------------
  // Ubicación
  // ------------------------------------------------------------------

  usarMiUbicacion(): void {
    this.errorUbicacion.set(null);

    if (!navigator.geolocation) {
      this.errorUbicacion.set('Tu navegador no puede compartir la ubicación. Pega el enlace de Google Maps.');
      return;
    }

    this.buscandoUbicacion.set(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.buscandoUbicacion.set(false);
        this.fijarPin(pos.coords.latitude, pos.coords.longitude);
      },
      () => {
        this.buscandoUbicacion.set(false);
        this.errorUbicacion.set(
          'No pudimos obtener tu ubicación. Da permiso al navegador o pega el enlace de Google Maps.'
        );
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  /**
   * Saca las coordenadas de un enlace de Google Maps. Es la vía más común en
   * la práctica: la gente comparte su ubicación por WhatsApp y pega ese enlace.
   */
  alEscribirEnlace(valor: string): void {
    this.enlaceMaps.set(valor);
    this.leerEnlaceMaps();
  }

  leerEnlaceMaps(): void {
    const texto = this.enlaceMaps().trim();
    if (!texto) return;

    // Formatos habituales: "@19.43,-99.13", "q=19.43,-99.13", "!3d19.43!4d-99.13"
    // o simplemente el par de números pegado a mano.
    const patrones = [
      /@(-?\d+\.\d+),\s*(-?\d+\.\d+)/,
      /[?&]q=(-?\d+\.\d+),\s*(-?\d+\.\d+)/,
      /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/,
      /^\s*(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)\s*$/,
    ];

    for (const patron of patrones) {
      const encontrado = texto.match(patron);
      if (encontrado) {
        this.errorUbicacion.set(null);
        this.fijarPin(parseFloat(encontrado[1]), parseFloat(encontrado[2]));
        return;
      }
    }

    // Un enlace acortado (maps.app.goo.gl) no trae las coordenadas dentro.
    if (/goo\.gl|maps\.app/.test(texto)) {
      this.errorUbicacion.set(
        'Ese enlace es corto y no trae las coordenadas. Ábrelo en el mapa y copia el enlace largo, o usa el botón de ubicación.'
      );
    }
  }

  /** Llena la dirección y el pin con una guardada: no hay que volver a marcarla. */
  elegirDireccion(d: DireccionGuardada): void {
    this.direccionElegida.set(d.id);
    this.direccion.set(d.direccion);
    this.referencias.set(d.referencias ?? '');
    this.enlaceMaps.set('');
    this.fijarPin(Number(d.latitud), Number(d.longitud));
  }

  /**
   * Vuelve a armar el carrito guardado con el menú de hoy: lo que ya no está o
   * cambió de adicionales se cae, y los precios son los actuales.
   */
  private restaurarCarrito(menu: MenuCategoria[]): void {
    this.carritoRestaurado = true;
    let guardado: { itemId: string; cantidad: number; adicionales: string[]; instrucciones: string }[] = [];
    try {
      guardado = JSON.parse(localStorage.getItem(`pidefacil.carrito.${this.branchId()}`) ?? '[]');
    } catch {
      return;
    }
    if (!Array.isArray(guardado) || guardado.length === 0 || this.carrito().length > 0) return;
    const items = new Map(menu.flatMap((c) => c.items).map((i) => [i.id, i]));
    for (const g of guardado) {
      const item = items.get(g.itemId);
      if (!item || item.agotado || !(g.cantidad > 0)) continue;
      const validos = new Set(item.grupos.flatMap((gr) => gr.opciones.map((o) => o.id)));
      const adicionales = (g.adicionales ?? []).filter((a) => validos.has(a));
      this.sumarLinea(item, adicionales, g.instrucciones ?? '', Math.min(99, g.cantidad));
    }
  }

  private fijarPin(lat: number, lon: number): void {
    this.latitud.set(lat);
    this.longitud.set(lon);
    this.cotizar();
  }

  borrarPin(): void {
    this.latitud.set(null);
    this.longitud.set(null);
    this.enlaceMaps.set('');
    this.cotizacion.set(null);
  }

  private cotizar(): void {
    if (!this.tienePin()) return;

    this.cotizando.set(true);
    this.http
      .post<Cotizacion>(`${this.api}/public/branches/${this.branchId()}/delivery/quote`, {
        latitud: this.latitud(),
        longitud: this.longitud(),
      })
      .subscribe({
        next: (c) => {
          this.cotizacion.set(c);
          this.cotizando.set(false);
        },
        error: (err) => {
          this.cotizando.set(false);
          console.error('Error al cotizar el envío', err);
          this.cotizacion.set({
            disponible: false,
            fueraDeCobertura: false,
            distanciaKm: null,
            costoEnvio: null,
            absorbeRestaurante: null,
            pagaCliente: null,
            pedidoMinimo: null,
            minutosEstimados: null,
            mensaje: 'No pudimos calcular el envío. Intenta de nuevo.',
          });
        },
      });
  }

  // ------------------------------------------------------------------
  // Envío del pedido
  // ------------------------------------------------------------------

  confirmar(): void {
    if (this.motivoBloqueo() !== null || this.enviando()) return;

    this.enviando.set(true);
    this.errorEnvio.set(null);

    // Solo ids: el precio de cada adicional lo pone el servidor.
    const items = this.carrito().map((l) => ({
      productId: l.item.id,
      quantity: l.cantidad,
      specialInstructions: l.instrucciones || null,
      adicionales: l.adicionales,
    }));

    if (this.modo() === 'RECOGER') {
      this.http
        .post<{ orderId: string; turno: string; total: number; pago: PagoEnLinea | null }>(
          `${this.api}/public/branches/${this.branchId()}/recoger/orders`, {
            nombre: this.nombre().trim(),
            telefono: this.telefono().trim(),
            consumo: 'LLEVAR',
            notas: this.notas().trim() || null,
            formaPago: this.formaPago(),
            propina: this.propina() > 0 ? this.propina() : null,
            items,
          })
        .subscribe({
          next: (r) => this.alCrear({
            orderId: r.orderId, tokenSeguimiento: r.turno, subtotal: r.total, envioCobrado: 0, total: r.total,
            minutosEstimados: this.info()?.minutosEstimados ?? null, cambioSugerido: null, paraRecoger: true,
            pago: r.pago,
          }),
          error: (err) => this.alFallar(err),
        });
      return;
    }

    this.http
      .post<PedidoCreado>(`${this.api}/public/branches/${this.branchId()}/delivery/orders`, {
        phoneNumber: this.telefono().trim(),
        nombre: this.nombre().trim() || null,
        direccion: this.direccion().trim(),
        referencias: this.referencias().trim() || null,
        latitud: this.latitud(),
        longitud: this.longitud(),
        notas: this.notas().trim() || null,
        pagaCon: this.formaPago() === 'EFECTIVO' ? this.pagaCon() : null,
        formaPago: this.formaPago(),
        propina: this.propina() > 0 ? this.propina() : null,
        guardarDireccion: this.cuenta.esCliente() && this.direccionElegida() === null && this.guardarDireccion(),
        items,
      })
      .subscribe({
        next: (p) => this.alCrear(p),
        error: (err) => this.alFallar(err),
      });
  }

  private alCrear(p: PedidoCreado): void {
    this.enviando.set(false);
    if (p.pago) {
      // Con tarjeta el carrito se queda hasta que se pague: si se arrepiente, no lo pierde.
      this.soloEsperarPago.set(false);
      this.cobro.set(p);
      this.recordarCobro(p);
      if (typeof window !== 'undefined') window.scrollTo({ top: 0 });
      return;
    }
    this.terminar(p);
  }

  alPagar(p: PedidoCreado, estado: EstadoPago): void {
    this.cobro.set(null);
    this.recordarCobro(null);
    this.terminar({ ...p, pago: null, pagadoCon: { marca: estado.marca, ultimos4: estado.ultimos4 } });
  }

  /** Regresa al pedido sin pagar. Ese pedido nunca llega al restaurante: se cancela solo a los 20 minutos. */
  volverDelPago(): void {
    this.cobro.set(null);
    this.recordarCobro(null);
  }

  /**
   * Algunos bancos sacan de la página para verificar y regresan con ?pago=.
   * Lo pendiente se guarda en el teléfono para retomarlo al volver.
   */
  private recordarCobro(p: PedidoCreado | null): void {
    try {
      const clave = `pidefacil.cobro.${this.branchId()}`;
      if (p) sessionStorage.setItem(clave, JSON.stringify(p));
      else sessionStorage.removeItem(clave);
    } catch {
      /* sin almacenamiento: no se puede retomar tras salir de la página */
    }
  }

  private retomarCobro(): void {
    const id = this.route.snapshot.queryParamMap.get('pago');
    if (!id) return;
    try {
      const guardado = sessionStorage.getItem(`pidefacil.cobro.${this.branchId()}`);
      const p = guardado ? (JSON.parse(guardado) as PedidoCreado) : null;
      if (p?.pago?.transaccionId === id) {
        this.soloEsperarPago.set(true);
        this.cobro.set(p);
      }
    } catch {
      /* sin almacenamiento no hay nada que retomar */
    }
  }

  private terminar(p: PedidoCreado): void {
    this.pedidoCreado.set(p);
    // Ya se pidio: si recarga, no debe volver a ver el mismo carrito.
    try {
      localStorage.removeItem(`pidefacil.carrito.${this.branchId()}`);
    } catch {
      /* sin almacenamiento no hay nada que borrar */
    }
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0 });
    }
  }

  private alFallar(err: { error?: { error?: string } }): void {
    this.enviando.set(false);
    console.error('Error al crear el pedido', err);
    this.errorEnvio.set(err.error?.error || 'No pudimos enviar tu pedido. Intenta de nuevo.');
  }

  empezarDeNuevo(): void {
    this.pedidoCreado.set(null);
    this.carrito.set([]);
    this.notas.set('');
    this.pagaCon.set(null);
    this.errorEnvio.set(null);
  }

  private cargarMenu(branchId: string): void {
    this.cargandoMenu.set(true);
    // El encabezado es un extra: si falla, se muestra el menú sin él.
    this.http.get<InfoSucursal>(`${this.api}/public/branches/${branchId}/info`).subscribe({
      next: (i) => this.info.set(i),
      error: () => this.info.set(null),
    });
    this.http.get<MenuCategoria[]>(`${this.api}/public/branches/${branchId}/menu`).subscribe({
      next: (data) => {
        // Por si responde un backend anterior a los adicionales, sin "grupos".
        this.menu.set(data.map((c) => ({ ...c, items: c.items.map((i) => ({ ...i, grupos: i.grupos ?? [] })) })));
        this.cargandoMenu.set(false);
        this.restaurarCarrito(this.menu());
        // Lo más pedido es un extra: si falla, el menú sigue igual.
        this.http.get<string[]>(`${this.api}/public/branches/${branchId}/menu/mas-pedidos`).subscribe({
          next: (ids) => this.masPedidos.set(ids),
          error: () => this.masPedidos.set([]),
        });
        if (data.length === 0) {
          this.errorMenu.set('Esta sucursal todavía no tiene platillos publicados.');
        }
      },
      error: (err) => {
        this.cargandoMenu.set(false);
        console.error('Error al cargar el menú público', err);
        this.errorMenu.set(
          err.status === 404
            ? 'No encontramos esta sucursal. Revisa el enlace.'
            : 'No pudimos cargar el menú. Intenta de nuevo en un momento.'
        );
      },
    });
  }
}
