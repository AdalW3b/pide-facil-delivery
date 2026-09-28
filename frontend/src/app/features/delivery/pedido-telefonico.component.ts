import { PesosPipe } from '../../shared/utils/pesos';
import { Component, ChangeDetectionStrategy, computed, inject, input, output, signal, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../environments/environment';
import { leerUbicacion } from '../../shared/utils/ubicacion';
import { LucideX, LucidePlus, LucideMinus, LucideSearch, LucideMapPin, LucideLoader2 } from '@lucide/angular';

interface Opcion { id: string; nombre: string; precio: number; disponible: boolean }
interface Grupo { id: string; nombre: string; minimo: number; maximo: number; opciones: Opcion[] }
interface Platillo { id: string; nombre: string; precio: number; descripcion: string | null; grupos: Grupo[]; categoria: string }

interface Linea {
  clave: string;
  platillo: Platillo;
  cantidad: number;
  adicionales: string[];
  nota: string;
}

interface Cliente {
  encontrado: boolean;
  nombre: string | null;
  visitas: number | null;
  direcciones: { id: string; alias: string | null; direccion: string; referencias: string | null; latitud: number; longitud: number }[];
}

interface Cotizacion {
  disponible: boolean;
  fueraDeCobertura: boolean;
  distanciaKm: number | null;
  pagaCliente: number | null;
  pedidoMinimo: number | null;
  mensaje: string | null;
}

/**
 * Captura de un pedido por teléfono. Sigue el orden de la llamada: quién
 * habla, a dónde va (o si pasa por él), qué pide y con cuánto paga. Nace
 * confirmado y entra directo a cocina.
 */
@Component({
  selector: 'app-pedido-telefonico',
  standalone: true,
  imports: [PesosPipe, FormsModule, LucideX, LucidePlus, LucideMinus, LucideSearch, LucideMapPin, LucideLoader2],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'cerrar.emit()' },
  template: `
    <div class="fixed inset-0 z-40 bg-black/60" (click)="cerrar.emit()" aria-hidden="true"></div>
    <aside role="dialog" aria-modal="true" aria-label="Pedido por teléfono"
      class="fixed inset-y-0 right-0 z-50 w-full max-w-2xl bg-slate-950 border-l border-slate-800 flex flex-col text-slate-200">
      <header class="flex items-center justify-between px-5 py-4 border-b border-slate-800">
        <div>
          <h2 class="text-lg font-bold text-white">Pedido por teléfono</h2>
          <p class="text-xs text-slate-400">Entra confirmado y va directo a cocina.</p>
        </div>
        <button (click)="cerrar.emit()" class="p-2 rounded-lg hover:bg-slate-800 cursor-pointer" aria-label="Cerrar">
          <svg lucideX class="w-5 h-5"></svg>
        </button>
      </header>

      <div class="flex-1 min-h-0 overflow-y-auto px-5 py-5 space-y-6">
        <!-- 1. Quién llama -->
        <section class="space-y-3">
          <h3 class="text-[11px] font-bold uppercase tracking-wider text-slate-500">1 · Cliente</h3>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label for="pt-tel" class="block text-xs text-slate-400 mb-1">Teléfono</label>
              <input id="pt-tel" type="tel" inputmode="tel" autocomplete="off" [ngModel]="telefono()" (ngModelChange)="alEscribirTelefono($event)"
                placeholder="951 123 4567"
                class="w-full bg-slate-900 border border-slate-800 rounded-lg py-2 px-3 text-sm text-white outline-none focus:border-indigo-500 tabular-nums" />
              @if (buscandoCliente()) {
                <p class="text-[11px] text-slate-500 mt-1">Buscando...</p>
              } @else if (cliente(); as c) {
                <p class="text-[11px] mt-1" [class]="c.encontrado ? 'text-emerald-400' : 'text-slate-500'">
                  {{ c.encontrado ? 'Cliente frecuente · ' + (c.visitas ?? 0) + ' visitas' : 'Cliente nuevo' }}
                </p>
              }
            </div>
            <div>
              <label for="pt-nombre" class="block text-xs text-slate-400 mb-1">Nombre</label>
              <input id="pt-nombre" type="text" [ngModel]="nombre()" (ngModelChange)="nombre.set($event)"
                class="w-full bg-slate-900 border border-slate-800 rounded-lg py-2 px-3 text-sm text-white outline-none focus:border-indigo-500" />
            </div>
          </div>
        </section>

        <!-- 2. A dónde va -->
        <section class="space-y-3">
          <h3 class="text-[11px] font-bold uppercase tracking-wider text-slate-500">2 · Entrega</h3>
          <div class="inline-flex p-1 rounded-xl bg-slate-900 border border-slate-800" role="radiogroup" aria-label="Tipo de pedido">
            @for (t of tipos; track t.valor) {
              <button type="button" role="radio" [attr.aria-checked]="tipo() === t.valor" (click)="tipo.set(t.valor)"
                class="px-4 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors"
                [class]="tipo() === t.valor ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'">
                {{ t.texto }}
              </button>
            }
          </div>

          @if (tipo() === 'DOMICILIO') {
            @if (cliente()?.direcciones?.length) {
              <div class="flex flex-wrap gap-2">
                @for (d of cliente()!.direcciones; track d.id) {
                  <button type="button" (click)="usarDireccion(d)"
                    class="px-3 py-1.5 rounded-lg border text-xs text-left cursor-pointer max-w-full"
                    [class]="direccionElegida() === d.id ? 'border-indigo-500 bg-indigo-500/10 text-white' : 'border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-600'">
                    <span class="font-semibold">{{ d.alias || 'Dirección guardada' }}</span>
                    <span class="block text-slate-500 truncate">{{ d.direccion }}</span>
                  </button>
                }
              </div>
            }
            <div>
              <label for="pt-dir" class="block text-xs text-slate-400 mb-1">Dirección</label>
              <input id="pt-dir" type="text" [ngModel]="direccion()" (ngModelChange)="direccion.set($event); direccionElegida.set(null)"
                placeholder="Calle, número, colonia"
                class="w-full bg-slate-900 border border-slate-800 rounded-lg py-2 px-3 text-sm text-white outline-none focus:border-indigo-500" />
            </div>
            <div>
              <label for="pt-ref" class="block text-xs text-slate-400 mb-1">Referencias</label>
              <input id="pt-ref" type="text" [ngModel]="referencias()" (ngModelChange)="referencias.set($event)"
                placeholder="Portón azul, frente a la tienda"
                class="w-full bg-slate-900 border border-slate-800 rounded-lg py-2 px-3 text-sm text-white outline-none focus:border-indigo-500" />
            </div>
            <div>
              <label for="pt-ubi" class="block text-xs text-slate-400 mb-1">Ubicación</label>
              @if (latitud() !== null) {
                <div class="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs">
                  <svg lucideMapPin class="w-4 h-4 shrink-0"></svg>
                  <span class="tabular-nums">{{ latitud()!.toFixed(5) }}, {{ longitud()!.toFixed(5) }}</span>
                  @if (cotizacion(); as c) {
                    @if (c.disponible && !c.fueraDeCobertura) {
                      <span class="text-emerald-400/80">· {{ c.distanciaKm }} km · envío {{ c.pagaCliente === 0 ? 'gratis' : '$' + c.pagaCliente }}</span>
                    }
                  }
                  <button (click)="borrarUbicacion()" class="ml-auto underline underline-offset-2 cursor-pointer">Cambiar</button>
                </div>
                @if (cotizacion(); as c) {
                  @if (!c.disponible || c.fueraDeCobertura) {
                    <p class="text-xs text-rose-400 mt-1">{{ c.mensaje }}</p>
                  }
                }
              } @else {
                <input id="pt-ubi" type="text" [ngModel]="enlace()" (ngModelChange)="alPegarUbicacion($event)"
                  placeholder="Pega el enlace de ubicación que te mandó por WhatsApp"
                  class="w-full bg-slate-900 border border-slate-800 rounded-lg py-2 px-3 text-sm text-white outline-none focus:border-indigo-500" />
                <p class="text-[11px] mt-1" [class]="errorUbicacion() ? 'text-rose-400' : 'text-slate-500'">
                  {{ errorUbicacion() || 'Pídele que comparta su ubicación por WhatsApp: es lo que abre el repartidor.' }}
                </p>
              }
            </div>
            @if (!direccionElegida() && latitud() !== null) {
              <label class="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input type="checkbox" [ngModel]="guardarDireccion()" (ngModelChange)="guardarDireccion.set($event)" class="accent-indigo-500" />
                Guardar esta dirección para su próximo pedido
              </label>
            }
          } @else {
            <p class="text-xs text-slate-400">Pasa a recogerlo al mostrador. Le avisamos por WhatsApp cuando esté listo.</p>
          }
        </section>

        <!-- 3. Qué pide -->
        <section class="space-y-3">
          <h3 class="text-[11px] font-bold uppercase tracking-wider text-slate-500">3 · Platillos</h3>
          <div class="relative">
            <svg lucideSearch class="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2"></svg>
            <input type="search" [ngModel]="busqueda()" (ngModelChange)="busqueda.set($event)" placeholder="Busca un platillo..."
              aria-label="Buscar platillo"
              class="w-full bg-slate-900 border border-slate-800 rounded-lg py-2 pl-9 pr-3 text-sm text-white outline-none focus:border-indigo-500" />
          </div>

          @if (busqueda().trim()) {
            <ul class="border border-slate-800 rounded-xl divide-y divide-slate-800 overflow-hidden">
              @for (p of resultados(); track p.id) {
                <li>
                  <button type="button" (click)="elegir(p)"
                    class="w-full flex items-center justify-between gap-3 px-3 py-2 text-left hover:bg-slate-900 cursor-pointer">
                    <span class="min-w-0">
                      <span class="block text-sm text-white truncate">{{ p.nombre }}</span>
                      <span class="block text-[11px] text-slate-500">{{ p.categoria }}{{ p.grupos.length ? ' · con opciones' : '' }}</span>
                    </span>
                    <span class="text-sm font-bold text-indigo-300 tabular-nums shrink-0">{{ p.precio | pesos }}</span>
                  </button>
                </li>
              } @empty {
                <li class="px-3 py-3 text-xs text-slate-400">Sin coincidencias.</li>
              }
            </ul>
          }

          <!-- Opciones del platillo elegido -->
          @if (enEdicion(); as e) {
            <div class="p-4 rounded-xl border border-indigo-500/40 bg-indigo-500/5 space-y-3">
              <div class="flex items-center justify-between">
                <p class="font-semibold text-white text-sm">{{ e.platillo.nombre }}</p>
                <button (click)="enEdicion.set(null)" class="text-xs text-slate-400 hover:text-white cursor-pointer">Cancelar</button>
              </div>
              @for (g of e.platillo.grupos; track g.id) {
                <div>
                  <p class="text-[11px] mb-1.5" [class]="g.minimo > 0 && elegidosEn(g) < g.minimo ? 'text-amber-400' : 'text-slate-400'">
                    {{ g.nombre }} · {{ g.minimo > 0 ? 'obligatorio' : 'opcional' }}, {{ g.maximo === 1 ? 'elige 1' : 'hasta ' + g.maximo }}
                  </p>
                  <div class="flex flex-wrap gap-1.5">
                    @for (o of g.opciones; track o.id) {
                      <button type="button" (click)="alternar(g, o)" [disabled]="!o.disponible" [attr.aria-pressed]="e.adicionales.includes(o.id)"
                        class="px-2.5 py-1.5 rounded-lg text-xs border cursor-pointer disabled:opacity-40 disabled:line-through disabled:cursor-not-allowed"
                        [class]="e.adicionales.includes(o.id) ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-600'">
                        {{ o.nombre }}@if (o.precio > 0) { <span class="opacity-70">+\${{ o.precio }}</span> }
                      </button>
                    }
                  </div>
                </div>
              }
              <div class="flex flex-wrap items-center gap-3">
                <div class="flex items-center gap-2">
                  <button (click)="cambiarEnEdicion(-1)" [disabled]="e.cantidad <= 1" class="w-8 h-8 rounded-full border border-slate-700 flex items-center justify-center disabled:opacity-40 cursor-pointer" aria-label="Uno menos">
                    <svg lucideMinus class="w-3.5 h-3.5"></svg>
                  </button>
                  <span class="w-6 text-center font-bold tabular-nums">{{ e.cantidad }}</span>
                  <button (click)="cambiarEnEdicion(1)" class="w-8 h-8 rounded-full border border-slate-700 flex items-center justify-center cursor-pointer" aria-label="Uno más">
                    <svg lucidePlus class="w-3.5 h-3.5"></svg>
                  </button>
                </div>
                <input type="text" [ngModel]="e.nota" (ngModelChange)="actualizarEdicion({ nota: $event })" placeholder="Nota para cocina"
                  aria-label="Nota para cocina"
                  class="flex-1 min-w-40 bg-slate-900 border border-slate-800 rounded-lg py-1.5 px-2.5 text-xs text-white outline-none focus:border-indigo-500" />
                <button (click)="confirmarEdicion()" [disabled]="faltaEnEdicion() !== null"
                  class="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
                  Agregar
                </button>
              </div>
              @if (faltaEnEdicion(); as falta) {
                <p class="text-[11px] text-amber-400">{{ falta }}</p>
              }
            </div>
          }

          @if (lineas().length) {
            <ul class="border border-slate-800 rounded-xl divide-y divide-slate-800">
              @for (l of lineas(); track l.clave) {
                <li class="flex items-start gap-3 px-3 py-2.5">
                  <div class="min-w-0 flex-1">
                    <p class="text-sm text-white">{{ l.platillo.nombre }}</p>
                    @for (t of describir(l); track t) { <p class="text-[11px] text-sky-300">+ {{ t }}</p> }
                    @if (l.nota) { <p class="text-[11px] text-amber-300/80 italic">{{ l.nota }}</p> }
                  </div>
                  <div class="flex items-center gap-1.5 shrink-0">
                    <button (click)="cambiarCantidad(l, -1)" class="w-7 h-7 rounded-full border border-slate-700 flex items-center justify-center cursor-pointer" [attr.aria-label]="'Quitar un ' + l.platillo.nombre">
                      <svg lucideMinus class="w-3 h-3"></svg>
                    </button>
                    <span class="w-5 text-center text-sm font-bold tabular-nums">{{ l.cantidad }}</span>
                    <button (click)="cambiarCantidad(l, 1)" class="w-7 h-7 rounded-full border border-slate-700 flex items-center justify-center cursor-pointer" [attr.aria-label]="'Agregar otro ' + l.platillo.nombre">
                      <svg lucidePlus class="w-3 h-3"></svg>
                    </button>
                  </div>
                  <span class="w-20 text-right text-sm font-bold text-white tabular-nums shrink-0">{{ (precioDe(l) * l.cantidad) | pesos }}</span>
                </li>
              }
            </ul>
          }
        </section>

        <!-- 4. Pago -->
        <section class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label for="pt-notas" class="block text-xs text-slate-400 mb-1">Notas del pedido</label>
            <input id="pt-notas" type="text" [ngModel]="notas()" (ngModelChange)="notas.set($event)"
              [placeholder]="tipo() === 'DOMICILIO' ? 'Toca el timbre dos veces' : 'Pasa a las 3:30'"
              class="w-full bg-slate-900 border border-slate-800 rounded-lg py-2 px-3 text-sm text-white outline-none focus:border-indigo-500" />
          </div>
          <div>
            <label for="pt-paga" class="block text-xs text-slate-400 mb-1">¿Con cuánto paga?</label>
            <input id="pt-paga" type="number" min="0" inputmode="decimal" [ngModel]="pagaCon()" (ngModelChange)="pagaCon.set($event)"
              placeholder="Para llevarle cambio"
              class="w-full bg-slate-900 border border-slate-800 rounded-lg py-2 px-3 text-sm text-white outline-none focus:border-indigo-500 tabular-nums" />
          </div>
        </section>
      </div>

      <footer class="border-t border-slate-800 px-5 py-4 space-y-2 bg-slate-950">
        <div class="flex justify-between text-sm"><span class="text-slate-400">Comida</span><span class="tabular-nums">{{ subtotal() | pesos }}</span></div>
        @if (tipo() === 'DOMICILIO' && envio() !== null) {
          <div class="flex justify-between text-sm"><span class="text-slate-400">Envío</span><span class="tabular-nums">{{ envio() === 0 ? 'Gratis' : (envio()! | pesos) }}</span></div>
        }
        <div class="flex justify-between text-base font-bold text-white"><span>Total</span><span class="tabular-nums">{{ total() | pesos }}</span></div>
        @if (cambio() !== null) {
          <p class="text-xs text-emerald-400">Cambio: {{ cambio()! | pesos }}</p>
        }
        @if (error()) {
          <p class="text-xs text-rose-400" role="alert">{{ error() }}</p>
        } @else if (motivoBloqueo(); as m) {
          <p class="text-[11px] text-slate-500">{{ m }}</p>
        }
        <button (click)="crear()" [disabled]="motivoBloqueo() !== null || enviando()"
          class="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
          @if (enviando()) { <svg lucideLoader2 class="w-4 h-4 animate-spin"></svg> }
          Crear pedido
        </button>
      </footer>
    </aside>
  `,
})
export class PedidoTelefonicoComponent implements OnInit {
  private readonly http = inject(HttpClient);

  readonly branchId = input.required<string>();
  readonly cerrar = output<void>();
  /** Token de seguimiento del pedido creado. */
  readonly creado = output<string>();

  readonly tipos = [
    { valor: 'DOMICILIO' as const, texto: 'A domicilio' },
    { valor: 'PARA_LLEVAR' as const, texto: 'Para llevar' },
  ];

  readonly menu = signal<Platillo[]>([]);
  readonly telefono = signal('');
  readonly nombre = signal('');
  readonly cliente = signal<Cliente | null>(null);
  readonly buscandoCliente = signal(false);
  readonly tipo = signal<'DOMICILIO' | 'PARA_LLEVAR'>('DOMICILIO');
  readonly direccion = signal('');
  readonly referencias = signal('');
  readonly direccionElegida = signal<string | null>(null);
  readonly guardarDireccion = signal(true);
  readonly enlace = signal('');
  readonly latitud = signal<number | null>(null);
  readonly longitud = signal<number | null>(null);
  readonly errorUbicacion = signal<string | null>(null);
  readonly cotizacion = signal<Cotizacion | null>(null);
  readonly busqueda = signal('');
  readonly lineas = signal<Linea[]>([]);
  readonly enEdicion = signal<Linea | null>(null);
  readonly notas = signal('');
  readonly pagaCon = signal<number | null>(null);
  readonly enviando = signal(false);
  readonly error = signal<string | null>(null);

  private temporizadorBusqueda: ReturnType<typeof setTimeout> | null = null;

  readonly resultados = computed(() => {
    const q = this.normalizar(this.busqueda());
    if (!q) return [];
    return this.menu().filter((p) => this.normalizar(p.nombre).includes(q)).slice(0, 8);
  });

  readonly subtotal = computed(() => this.lineas().reduce((s, l) => s + this.precioDe(l) * l.cantidad, 0));
  readonly envio = computed(() => {
    const c = this.cotizacion();
    return this.tipo() === 'DOMICILIO' && c && c.disponible && !c.fueraDeCobertura ? c.pagaCliente : null;
  });
  readonly total = computed(() => this.subtotal() + (this.envio() ?? 0));
  readonly cambio = computed(() => {
    const paga = this.pagaCon();
    return paga && paga >= this.total() && this.total() > 0 ? paga - this.total() : null;
  });

  readonly faltaEnEdicion = computed(() => {
    const e = this.enEdicion();
    if (!e) return null;
    const falta = e.platillo.grupos.find((g) => this.elegidosEn(g) < g.minimo);
    return falta ? `Falta elegir ${falta.nombre.toLowerCase()}` : null;
  });

  /** Qué falta para poder crear el pedido, dicho en palabras. */
  readonly motivoBloqueo = computed<string | null>(() => {
    if (this.telefono().replace(/\D/g, '').length < 10) return 'Falta el teléfono (10 dígitos).';
    if (this.tipo() === 'DOMICILIO') {
      if (!this.direccion().trim()) return 'Falta la dirección.';
      if (this.latitud() === null) return 'Falta la ubicación: pega el enlace que te mandó.';
      const c = this.cotizacion();
      if (!c) return 'Calculando el envío...';
      if (!c.disponible || c.fueraDeCobertura) return c.mensaje;
      if (c.pedidoMinimo && this.subtotal() < c.pedidoMinimo) return `El pedido mínimo a domicilio es de $${c.pedidoMinimo}.`;
    }
    if (this.lineas().length === 0) return 'Agrega al menos un platillo.';
    if (this.pagaCon() && this.pagaCon()! < this.total()) return 'Paga con menos que el total.';
    return null;
  });

  ngOnInit(): void {
    this.http.get<{ nombre: string; items: Omit<Platillo, 'categoria'>[] }[]>(
      `${environment.apiUrl}/public/branches/${this.branchId()}/menu`
    ).subscribe({
      next: (cats) =>
        this.menu.set(cats.flatMap((c) => c.items.map((i) => ({ ...i, grupos: i.grupos ?? [], categoria: c.nombre })))),
      error: () => this.error.set('No se pudo cargar el menú.'),
    });
  }

  // ---------------- Cliente ----------------

  alEscribirTelefono(valor: string): void {
    this.telefono.set(valor);
    if (this.temporizadorBusqueda) clearTimeout(this.temporizadorBusqueda);
    const digitos = valor.replace(/\D/g, '');
    if (digitos.length < 10) {
      this.cliente.set(null);
      return;
    }
    this.temporizadorBusqueda = setTimeout(() => this.buscarCliente(digitos), 400);
  }

  private buscarCliente(digitos: string): void {
    this.buscandoCliente.set(true);
    this.http.get<Cliente>(`${environment.apiUrl}/branches/${this.branchId()}/delivery/clientes`, { params: { telefono: digitos } })
      .subscribe({
        next: (c) => {
          this.buscandoCliente.set(false);
          this.cliente.set(c);
          if (c.encontrado && c.nombre && c.nombre !== 'Cliente' && !this.nombre()) this.nombre.set(c.nombre);
          // Si tiene una sola dirección, lo más probable es que sea esa.
          if (c.direcciones.length === 1 && !this.direccion()) this.usarDireccion(c.direcciones[0]);
        },
        error: () => {
          this.buscandoCliente.set(false);
          this.cliente.set(null);
        },
      });
  }

  usarDireccion(d: Cliente['direcciones'][number]): void {
    this.direccionElegida.set(d.id);
    this.direccion.set(d.direccion);
    this.referencias.set(d.referencias ?? '');
    this.fijarUbicacion(d.latitud, d.longitud);
  }

  // ---------------- Ubicación ----------------

  alPegarUbicacion(texto: string): void {
    this.enlace.set(texto);
    const lectura = leerUbicacion(texto);
    if (lectura.ok) {
      this.errorUbicacion.set(null);
      this.fijarUbicacion(lectura.latitud, lectura.longitud);
    } else {
      this.errorUbicacion.set(lectura.motivo);
    }
  }

  borrarUbicacion(): void {
    this.latitud.set(null);
    this.longitud.set(null);
    this.enlace.set('');
    this.cotizacion.set(null);
    this.direccionElegida.set(null);
  }

  private fijarUbicacion(lat: number, lon: number): void {
    this.latitud.set(lat);
    this.longitud.set(lon);
    this.cotizacion.set(null);
    this.http.post<Cotizacion>(`${environment.apiUrl}/public/branches/${this.branchId()}/delivery/quote`, { latitud: lat, longitud: lon })
      .subscribe({
        next: (c) => this.cotizacion.set(c),
        error: () => this.cotizacion.set({ disponible: false, fueraDeCobertura: false, distanciaKm: null, pagaCliente: null, pedidoMinimo: null, mensaje: 'No se pudo calcular el envío.' }),
      });
  }

  // ---------------- Platillos ----------------

  elegir(p: Platillo): void {
    this.busqueda.set('');
    const linea: Linea = { clave: '', platillo: p, cantidad: 1, adicionales: [], nota: '' };
    if (p.grupos.length === 0) {
      this.sumar(linea);
    } else {
      this.enEdicion.set(linea);
    }
  }

  elegidosEn(g: Grupo): number {
    const e = this.enEdicion();
    return e ? g.opciones.filter((o) => e.adicionales.includes(o.id)).length : 0;
  }

  alternar(g: Grupo, o: Opcion): void {
    const e = this.enEdicion();
    if (!e || !o.disponible) return;
    let lista = [...e.adicionales];
    if (lista.includes(o.id)) {
      lista = lista.filter((x) => x !== o.id);
    } else if (g.maximo === 1) {
      lista = lista.filter((x) => !g.opciones.some((op) => op.id === x));
      lista.push(o.id);
    } else if (this.elegidosEn(g) < g.maximo) {
      lista.push(o.id);
    }
    this.enEdicion.set({ ...e, adicionales: lista });
  }

  actualizarEdicion(cambio: Partial<Linea>): void {
    this.enEdicion.update((e) => (e ? { ...e, ...cambio } : e));
  }

  cambiarEnEdicion(delta: number): void {
    this.enEdicion.update((e) => (e ? { ...e, cantidad: Math.max(1, e.cantidad + delta) } : e));
  }

  confirmarEdicion(): void {
    const e = this.enEdicion();
    if (!e || this.faltaEnEdicion()) return;
    this.sumar(e);
    this.enEdicion.set(null);
  }

  /** La misma combinación se suma a su línea en vez de repetirse. */
  private sumar(l: Linea): void {
    const clave = [l.platillo.id, [...l.adicionales].sort().join(','), l.nota.trim().toLowerCase()].join('|');
    this.lineas.update((ls) =>
      ls.some((x) => x.clave === clave)
        ? ls.map((x) => (x.clave === clave ? { ...x, cantidad: x.cantidad + l.cantidad } : x))
        : [...ls, { ...l, clave, nota: l.nota.trim() }]
    );
  }

  cambiarCantidad(l: Linea, delta: number): void {
    this.lineas.update((ls) =>
      ls.map((x) => (x.clave === l.clave ? { ...x, cantidad: x.cantidad + delta } : x)).filter((x) => x.cantidad > 0)
    );
  }

  precioDe(l: Linea): number {
    return l.platillo.precio + l.platillo.grupos.flatMap((g) => g.opciones)
      .filter((o) => l.adicionales.includes(o.id)).reduce((s, o) => s + o.precio, 0);
  }

  describir(l: Linea): string[] {
    return l.platillo.grupos
      .map((g) => {
        const n = g.opciones.filter((o) => l.adicionales.includes(o.id)).map((o) => o.nombre);
        return n.length ? `${g.nombre}: ${n.join(', ')}` : '';
      })
      .filter((t) => t);
  }

  // ---------------- Envío ----------------

  crear(): void {
    if (this.motivoBloqueo() !== null || this.enviando()) return;
    this.enviando.set(true);
    this.error.set(null);

    const domicilio = this.tipo() === 'DOMICILIO';
    this.http.post<{ tokenSeguimiento: string }>(`${environment.apiUrl}/branches/${this.branchId()}/delivery/orders/telefono`, {
      phoneNumber: this.telefono().replace(/\D/g, ''),
      nombre: this.nombre().trim() || null,
      tipo: this.tipo(),
      direccion: domicilio ? this.direccion().trim() : null,
      referencias: domicilio ? this.referencias().trim() || null : null,
      latitud: domicilio ? this.latitud() : null,
      longitud: domicilio ? this.longitud() : null,
      notas: this.notas().trim() || null,
      guardarDireccion: domicilio && !this.direccionElegida() && this.guardarDireccion(),
      items: this.lineas().map((l) => ({
        productId: l.platillo.id,
        quantity: l.cantidad,
        specialInstructions: l.nota || null,
        adicionales: l.adicionales,
      })),
      pagaCon: this.pagaCon() || null,
    }).subscribe({
      next: (r) => {
        this.enviando.set(false);
        this.creado.emit(r.tokenSeguimiento);
      },
      error: (err) => {
        this.enviando.set(false);
        this.error.set(err.error?.error || err.error?.message || 'No se pudo crear el pedido.');
      },
    });
  }

  private normalizar(t: string): string {
    return t.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
  }
}
