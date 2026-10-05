import { TituloPaginaComponent } from '../../shared/components/titulo-pagina.component';
import { SucursalActivaService } from '../../core/services/sucursal-activa.service';
import { sucursalInicial } from '../../shared/utils/sucursal-inicial';
import { PesosPipe } from '../../shared/utils/pesos';
import { Component, ChangeDetectionStrategy, signal, computed, inject, OnInit, effect } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { environment } from '../../../environments/environment';
import { Restaurant } from '../admin-core/models/admin.model';
import {
  LucideBike,
  LucideLocateFixed,
  LucideMapPin,
  LucideSave,
  LucideCheckCircle,
  LucideTriangleAlert,
} from '@lucide/angular';

interface GrupoWhatsapp {
  id: string;
  subject: string;
  size: number;
}

interface BranchData {
  id: string;
  restaurantId: string;
  restaurantName: string;
  name: string;
  address: string | null;
  whatsappNumber: string | null;
  n8nWebhookUrl: string | null;
  active: boolean;
  createdAt: string;
}

interface DeliverySettings {
  activo: boolean | null;
  latitud: number | null;
  longitud: number | null;
  kmIncluidos: number | null;
  tarifaBase: number | null;
  pctBaseAbsorbe: number | null;
  precioKmExtra: number | null;
  pctExtraAbsorbe: number | null;
  redondeoKm: number | null;
  distanciaMaximaKm: number | null;
  factorCalles: number | null;
  pedidoMinimo: number | null;
  minutosEstimados: number | null;
  grupoRepartidores: string | null;
  pagoRepartidorFijo: number | null;
  pagoRepartidorKm: number | null;
}

/** Una fila de la vista previa: qué pasaría con un pedido a esa distancia. */
interface FilaPrevia {
  km: number;
  costo: number;
  absorbe: number;
  cliente: number;
  /** Lo que se le paga al repartidor a esa distancia. */
  repartidor: number;
  /** Lo que paga el cliente de envío menos el pago al repartidor. Negativo = lo pone el negocio. */
  balance: number;
  fuera: boolean;
}

@Component({
  selector: 'app-branch-settings',
  standalone: true,
  imports: [TituloPaginaComponent, PesosPipe, 
    FormsModule,
    LucideBike,
    LucideLocateFixed,
    LucideMapPin,
    LucideSave,
    LucideCheckCircle,
    LucideTriangleAlert,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6 min-h-screen bg-slate-950 text-slate-100 p-2 sm:p-4">
      <!-- Encabezado -->
      <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800/60 pb-5">
        <div class="flex items-center gap-3">
          <div>
            <app-titulo-pagina titulo="Sucursales" descripcion="Datos de contacto y reglas de entrega a domicilio." />
          </div>
        </div>

      </div>

      @if (aviso(); as a) {
        <div
          class="flex items-center gap-3 p-4 rounded-xl text-sm border"
          [class]="a.ok ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' : 'bg-rose-500/10 border-rose-500/20 text-rose-300'"
        >
          @if (a.ok) {
            <svg lucideCheckCircle class="w-5 h-5 shrink-0"></svg>
          } @else {
            <svg lucideTriangleAlert class="w-5 h-5 shrink-0"></svg>
          }
          <span>{{ a.texto }}</span>
        </div>
      }

      @if (!activeBranchId()) {
        <p class="text-center text-slate-500 text-sm py-16">Elige una sucursal para configurarla.</p>
      } @else if (cargando()) {
        <p class="text-center text-slate-500 text-sm py-16">Cargando...</p>
      } @else {
        <!-- Datos de la sucursal -->
        <section class="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5 space-y-4">
          <h2 class="text-sm font-bold text-white">Datos de la sucursal</h2>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label for="bs-nombre" class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Nombre</label>
              <input id="bs-nombre" type="text" [ngModel]="nombre()" (ngModelChange)="nombre.set($event)"
                class="w-full bg-slate-950/50 border border-slate-800 rounded-xl py-2.5 px-4 text-sm text-white outline-none focus:border-indigo-500" />
            </div>
            <div>
              <label for="bs-wa" class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">WhatsApp del negocio</label>
              <input id="bs-wa" type="tel" [ngModel]="whatsapp()" (ngModelChange)="whatsapp.set($event)"
                placeholder="5215512345678"
                class="w-full bg-slate-950/50 border border-slate-800 rounded-xl py-2.5 px-4 text-sm text-white outline-none focus:border-indigo-500" />
            </div>
          </div>

          <div>
            <label for="bs-dir" class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Dirección</label>
            <input id="bs-dir" type="text" [ngModel]="direccion()" (ngModelChange)="direccion.set($event)"
              class="w-full bg-slate-950/50 border border-slate-800 rounded-xl py-2.5 px-4 text-sm text-white outline-none focus:border-indigo-500" />
          </div>

          <button
            (click)="guardarSucursal()"
            [disabled]="guardandoSucursal()"
            class="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-wait"
          >
            <svg lucideSave class="w-4 h-4"></svg>
            {{ guardandoSucursal() ? 'Guardando...' : 'Guardar datos' }}
          </button>
        </section>

        <!-- Entrega a domicilio -->
        <section class="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5 space-y-5">
          <div class="flex items-start justify-between gap-4">
            <div>
              <h2 class="text-sm font-bold text-white flex items-center gap-2">
                <svg lucideBike class="w-4 h-4 text-indigo-400"></svg>
                Entrega a domicilio
              </h2>
              <p class="text-xs text-slate-400 mt-1">Desde dónde sale el repartidor, hasta dónde llega y qué se cobra</p>
            </div>
            <label class="flex items-center gap-2 cursor-pointer shrink-0">
              <input type="checkbox" [ngModel]="activo()" (ngModelChange)="activo.set($event)"
                class="w-4 h-4 accent-indigo-600 cursor-pointer" />
              <span class="text-xs font-bold" [class]="activo() ? 'text-emerald-400' : 'text-slate-500'">
                {{ activo() ? 'Recibiendo pedidos a domicilio' : 'Pedidos a domicilio apagados' }}
              </span>
            </label>
          </div>

          <!-- Ubicación de la sucursal -->
          <div class="border-t border-slate-800/80 pt-4">
            <p class="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Ubicación de la sucursal</p>
            <p class="text-xs text-slate-400 mb-3">
              Desde aquí se mide la distancia a cada cliente. Sin esto no se puede activar el servicio.
            </p>

            <div class="flex flex-col sm:flex-row gap-2">
              <button
                (click)="usarMiUbicacion()"
                [disabled]="buscandoUbicacion()"
                class="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-wait"
              >
                <svg lucideLocateFixed class="w-4 h-4"></svg>
                {{ buscandoUbicacion() ? 'Buscando...' : 'Usar mi ubicación actual' }}
              </button>
              <input
                type="text"
                [ngModel]="enlaceMaps()"
                (ngModelChange)="alEscribirEnlace($event)"
                placeholder="o pega el enlace de Google Maps"
                aria-label="Enlace de Google Maps de la sucursal"
                class="flex-1 min-w-0 bg-slate-950/50 border border-slate-800 rounded-xl py-2.5 px-4 text-sm text-white outline-none focus:border-indigo-500"
              />
            </div>

            <div class="grid grid-cols-2 gap-3 mt-3">
              <div>
                <label for="bs-lat" class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Latitud</label>
                <input id="bs-lat" type="number" step="0.0000001" [ngModel]="latitud()" (ngModelChange)="latitud.set($event)"
                  class="w-full bg-slate-950/50 border border-slate-800 rounded-xl py-2.5 px-4 text-sm text-white outline-none focus:border-indigo-500 tabular-nums" />
              </div>
              <div>
                <label for="bs-lon" class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Longitud</label>
                <input id="bs-lon" type="number" step="0.0000001" [ngModel]="longitud()" (ngModelChange)="longitud.set($event)"
                  class="w-full bg-slate-950/50 border border-slate-800 rounded-xl py-2.5 px-4 text-sm text-white outline-none focus:border-indigo-500 tabular-nums" />
              </div>
            </div>

            @if (tienePin()) {
              <a
                [href]="enlaceVerEnMapa()"
                target="_blank"
                rel="noopener"
                class="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 mt-2"
              >
                <svg lucideMapPin class="w-3.5 h-3.5"></svg>
                Verificar en el mapa
              </a>
            }
          </div>

          <!-- Tarifa -->
          <div class="border-t border-slate-800/80 pt-4">
            <p class="text-[11px] font-bold text-sky-300 uppercase tracking-wider">Lo que le cobras al cliente</p>
            <p class="text-xs text-slate-500 mt-0.5 mb-3">El envío que ve el cliente al pedir. Lo que absorbes es lo que regalas del envío.</p>

            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label for="bs-kmi" class="block text-xs text-slate-400 mb-1.5">Kilómetros incluidos</label>
                <input id="bs-kmi" type="number" step="0.5" min="0" [ngModel]="kmIncluidos()" (ngModelChange)="kmIncluidos.set($event)"
                  class="w-full bg-slate-950/50 border border-slate-800 rounded-xl py-2 px-3 text-sm text-white outline-none focus:border-indigo-500 tabular-nums" />
              </div>
              <div>
                <label for="bs-base" class="block text-xs text-slate-400 mb-1.5">Envío base ($)</label>
                <input id="bs-base" type="number" step="1" min="0" [ngModel]="tarifaBase()" (ngModelChange)="tarifaBase.set($event)"
                  class="w-full bg-slate-950/50 border border-slate-800 rounded-xl py-2 px-3 text-sm text-white outline-none focus:border-indigo-500 tabular-nums" />
                <p class="text-[11px] text-slate-500 mt-1">Cubre los kilómetros incluidos.</p>
              </div>
              <div>
                <label for="bs-pctbase" class="block text-xs text-slate-400 mb-1.5">Absorbes del tramo base (%)</label>
                <input id="bs-pctbase" type="number" step="5" min="0" max="100" [ngModel]="pctBase()" (ngModelChange)="pctBase.set($event)"
                  class="w-full bg-slate-950/50 border border-slate-800 rounded-xl py-2 px-3 text-sm text-white outline-none focus:border-indigo-500 tabular-nums" />
              </div>
              <div>
                <label for="bs-kmx" class="block text-xs text-slate-400 mb-1.5">Le cobras por km extra ($)</label>
                <input id="bs-kmx" type="number" step="1" min="0" [ngModel]="precioKmExtra()" (ngModelChange)="precioKmExtra.set($event)"
                  class="w-full bg-slate-950/50 border border-slate-800 rounded-xl py-2 px-3 text-sm text-white outline-none focus:border-indigo-500 tabular-nums" />
                <p class="text-[11px] text-slate-500 mt-1">Solo los km después de los incluidos.</p>
              </div>
              <div>
                <label for="bs-pctx" class="block text-xs text-slate-400 mb-1.5">Absorbes del extra (%)</label>
                <input id="bs-pctx" type="number" step="5" min="0" max="100" [ngModel]="pctExtra()" (ngModelChange)="pctExtra.set($event)"
                  class="w-full bg-slate-950/50 border border-slate-800 rounded-xl py-2 px-3 text-sm text-white outline-none focus:border-indigo-500 tabular-nums" />
              </div>
              <div>
                <label for="bs-red" class="block text-xs text-slate-400 mb-1.5">Se cobra cada (km)</label>
                <input id="bs-red" type="number" step="0.5" min="0.1" [ngModel]="redondeoKm()" (ngModelChange)="redondeoKm.set($event)"
                  class="w-full bg-slate-950/50 border border-slate-800 rounded-xl py-2 px-3 text-sm text-white outline-none focus:border-indigo-500 tabular-nums" />
              </div>
              <div>
                <label for="bs-max" class="block text-xs text-slate-400 mb-1.5">Hasta cuántos km repartes</label>
                <input id="bs-max" type="number" step="1" min="1" [ngModel]="distanciaMaxima()" (ngModelChange)="distanciaMaxima.set($event)"
                  class="w-full bg-slate-950/50 border border-slate-800 rounded-xl py-2 px-3 text-sm text-white outline-none focus:border-indigo-500 tabular-nums" />
              </div>
              <div>
                <label for="bs-min" class="block text-xs text-slate-400 mb-1.5">Pedido mínimo ($)</label>
                <input id="bs-min" type="number" step="10" min="0" [ngModel]="pedidoMinimo()" (ngModelChange)="pedidoMinimo.set($event)"
                  class="w-full bg-slate-950/50 border border-slate-800 rounded-xl py-2 px-3 text-sm text-white outline-none focus:border-indigo-500 tabular-nums" />
              </div>
              <div>
                <label for="bs-mins" class="block text-xs text-slate-400 mb-1.5">Tiempo estimado (min)</label>
                <input id="bs-mins" type="number" step="5" min="1" [ngModel]="minutosEstimados()" (ngModelChange)="minutosEstimados.set($event)"
                  class="w-full bg-slate-950/50 border border-slate-800 rounded-xl py-2 px-3 text-sm text-white outline-none focus:border-indigo-500 tabular-nums" />
              </div>
            </div>
          </div>

          <!-- Repartidores -->
          <div class="border-t border-slate-800/80 pt-4">
            <p class="text-[11px] font-bold text-emerald-300 uppercase tracking-wider">Lo que le pagas al repartidor</p>
            <p class="text-xs text-slate-500 mt-0.5 mb-3">No depende de lo que pague el cliente: es por todo el viaje.</p>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label for="bs-pfijo" class="block text-xs text-slate-400 mb-1.5">Le pagas por entrega ($)</label>
                <input id="bs-pfijo" type="number" step="1" min="0" [ngModel]="pagoFijo()" (ngModelChange)="pagoFijo.set($event)"
                  class="w-full bg-slate-950/50 border border-slate-800 rounded-xl py-2 px-3 text-sm text-white outline-none focus:border-indigo-500 tabular-nums" />
              </div>
              <div>
                <label for="bs-pkm" class="block text-xs text-slate-400 mb-1.5">Le pagas por km ($)</label>
                <input id="bs-pkm" type="number" step="1" min="0" [ngModel]="pagoKm()" (ngModelChange)="pagoKm.set($event)"
                  class="w-full bg-slate-950/50 border border-slate-800 rounded-xl py-2 px-3 text-sm text-white outline-none focus:border-indigo-500 tabular-nums" />
                <p class="text-[11px] text-slate-500 mt-1">Cada km del viaje, desde el primero.</p>
              </div>
              <div>
                <label for="bs-grupo" class="block text-xs text-slate-400 mb-1.5">Grupo de repartidores</label>
                @if (grupos().length > 0) {
                  <select id="bs-grupo" [ngModel]="grupoRepartidores()" (ngModelChange)="grupoRepartidores.set($event)"
                    class="w-full bg-slate-950/50 border border-slate-800 rounded-xl py-2 px-3 text-sm text-white outline-none focus:border-indigo-500 cursor-pointer">
                    <option value="">Sin grupo</option>
                    @for (g of grupos(); track g.id) {
                      <option [value]="g.id">{{ g.subject }} ({{ g.size }})</option>
                    }
                  </select>
                } @else {
                  <input id="bs-grupo" type="text" [ngModel]="grupoRepartidores()" (ngModelChange)="grupoRepartidores.set($event)"
                    placeholder="Opcional"
                    class="w-full bg-slate-950/50 border border-slate-800 rounded-xl py-2 px-3 text-sm text-white outline-none focus:border-indigo-500" />
                }

                @if (cargandoGrupos()) {
                  <p class="text-[11px] text-slate-500 mt-1.5">Buscando tus grupos...</p>
                } @else if (grupos().length === 0) {
                  <p class="text-[11px] text-amber-400/90 mt-1.5">
                    No pudimos leer tus grupos: el WhatsApp de esta sucursal no está conectado.
                    Conéctalo y recarga, o pega el identificador del grupo a mano.
                  </p>
                } @else {
                  <p class="text-[11px] text-slate-500 mt-1.5">
                    Ahí se publica cada entrega lista, con el enlace para tomarla.
                  </p>
                }
                <button
                  (click)="cargarGrupos()"
                  class="text-[11px] text-indigo-400 hover:text-indigo-300 mt-1 cursor-pointer"
                >
                  Volver a buscar grupos
                </button>
              </div>
            </div>

            <!-- Vista previa: las dos cuentas juntas, para ver cuánto pones tú en cada envío -->
            <div class="mt-5 bg-slate-950/50 border border-slate-800 rounded-xl p-4">
              <p class="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">Así queda cada envío</p>
              <div class="overflow-x-auto">
                <table class="w-full text-xs">
                  <thead>
                    <tr class="text-slate-500 text-left">
                      <th class="pb-2 pr-4 font-semibold">Distancia</th>
                      <th class="pb-2 pr-4 font-semibold text-right">Envío</th>
                      <th class="pb-2 pr-4 font-semibold text-right">Absorbes</th>
                      <th class="pb-2 pr-4 font-semibold text-right text-sky-300">Paga el cliente</th>
                      <th class="pb-2 pr-4 font-semibold text-right text-emerald-300">Le pagas al repartidor</th>
                      <th class="pb-2 font-semibold text-right">Resultado</th>
                    </tr>
                  </thead>
                  <tbody class="tabular-nums">
                    @for (fila of vistaPrevia(); track fila.km) {
                      <tr class="border-t border-slate-800/60">
                        <td class="py-1.5 pr-4 text-slate-300">{{ fila.km }} km</td>
                        @if (fila.fuera) {
                          <td colspan="5" class="py-1.5 text-right text-rose-400">Fuera de cobertura</td>
                        } @else {
                          <td class="py-1.5 pr-4 text-right text-slate-400">{{ fila.costo | pesos }}</td>
                          <td class="py-1.5 pr-4 text-right text-slate-400">{{ fila.absorbe | pesos }}</td>
                          <td class="py-1.5 pr-4 text-right font-bold" [class]="fila.cliente === 0 ? 'text-emerald-400' : 'text-white'">
                            {{ fila.cliente === 0 ? 'Gratis' : (fila.cliente | pesos) }}
                          </td>
                          <td class="py-1.5 pr-4 text-right text-white">{{ fila.repartidor | pesos }}</td>
                          <td class="py-1.5 text-right font-bold" [class]="fila.balance > 0 ? 'text-emerald-400' : fila.balance < 0 ? 'text-amber-400' : 'text-slate-400'">
                            {{ fila.balance > 0 ? 'Te quedan ' + (fila.balance | pesos) : fila.balance < 0 ? 'Pones ' + (-fila.balance | pesos) : 'Parejo' }}
                          </td>
                        }
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
              <p class="text-[11px] text-slate-500 mt-2">Resultado = lo que paga el cliente de envío menos lo que le pagas al repartidor.</p>
            </div>
          </div>

          @if (activo() && !tienePin()) {
            <p class="text-xs text-amber-400">
              Marca la ubicación de la sucursal antes de activar el servicio a domicilio.
            </p>
          }

          <button
            (click)="guardarDelivery()"
            [disabled]="guardandoDelivery()"
            class="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-wait"
          >
            <svg lucideSave class="w-4 h-4"></svg>
            {{ guardandoDelivery() ? 'Guardando...' : 'Guardar entrega a domicilio' }}
          </button>
        </section>
      }
    </div>
  `,
})
export class BranchSettingsComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);

  // Restaurante y sucursal: los mismos para todo el panel (se eligen en la barra superior).
  private readonly sucursalActiva = inject(SucursalActivaService);
  readonly restaurants = this.sucursalActiva.restaurantes;
  readonly selectedRestaurantId = this.sucursalActiva.restaurantId;
  readonly selectedBranchId = this.sucursalActiva.branchId;

  readonly cargando = signal(false);
  readonly guardandoSucursal = signal(false);
  readonly guardandoDelivery = signal(false);
  readonly aviso = signal<{ ok: boolean; texto: string } | null>(null);
  readonly buscandoUbicacion = signal(false);
  /** Grupos de WhatsApp de la sucursal, para elegir el de repartidores. */
  readonly grupos = signal<GrupoWhatsapp[]>([]);
  readonly cargandoGrupos = signal(false);

  // Datos de la sucursal
  readonly nombre = signal('');
  readonly direccion = signal('');
  readonly whatsapp = signal('');

  // Entrega a domicilio
  readonly activo = signal(false);
  readonly latitud = signal<number | null>(null);
  readonly longitud = signal<number | null>(null);
  readonly enlaceMaps = signal('');
  readonly kmIncluidos = signal<number>(3);
  readonly tarifaBase = signal<number>(40);
  /** En pantalla se manejan de 0 a 100; el backend los guarda de 0 a 1. */
  readonly pctBase = signal<number>(100);
  readonly precioKmExtra = signal<number>(10);
  readonly pctExtra = signal<number>(0);
  readonly redondeoKm = signal<number>(1);
  readonly distanciaMaxima = signal<number>(8);
  readonly factorCalles = signal<number>(1.3);
  readonly pedidoMinimo = signal<number>(0);
  readonly minutosEstimados = signal<number>(40);
  readonly grupoRepartidores = signal('');
  readonly pagoFijo = signal<number>(12);
  readonly pagoKm = signal<number>(6);

  // El operador de la plataforma también elige sucursal: entra en modo soporte.
  readonly isSuperAdmin = computed(() => this.authService.userRole() === 'SUPER_ADMIN' || this.authService.userRole() === 'SYSTEM_ADMIN');

  readonly activeBranchId = computed<string | null>(() => {
    if (this.isSuperAdmin()) {
      return this.selectedBranchId() || null;
    }
    const token = this.authService.decodedToken() as any;
    const tokenBranch = token?.branchId || token?.branch_id || null;
    return tokenBranch ? String(tokenBranch) : null;
  });

  readonly availableBranches = computed(() => {
    const rId = this.selectedRestaurantId();
    if (!rId) return [];
    return this.restaurants().find((r) => r.id === rId)?.branches ?? [];
  });

  /**
   * Repite la fórmula del backend para enseñar el resultado mientras se
   * escribe. Es una vista previa, no la fuente de verdad: al pedir, el envío
   * siempre lo calcula el servidor.
   */
  readonly vistaPrevia = computed<FilaPrevia[]>(() => {
    const incluidos = this.kmIncluidos() || 0;
    const base = this.tarifaBase() || 0;
    const porExtra = this.precioKmExtra() || 0;
    const escalon = this.redondeoKm() || 1;
    const maxima = this.distanciaMaxima() || 0;
    const absorbeBase = (this.pctBase() || 0) / 100;
    const absorbeExtra = (this.pctExtra() || 0) / 100;
    const pagoFijo = this.pagoFijo() || 0;
    const pagoKm = this.pagoKm() || 0;

    const distancias = [2, 4, 6, 8, 10];

    return distancias.map((km) => {
      if (km > maxima) {
        return { km, costo: 0, absorbe: 0, cliente: 0, repartidor: 0, balance: 0, fuera: true };
      }
      const sobrante = Math.max(0, km - incluidos);
      const kmExtra = sobrante > 0 ? Math.ceil(sobrante / escalon) * escalon : 0;
      const cargoExtra = kmExtra * porExtra;
      const costo = base + cargoExtra;
      const absorbe = Math.min(costo, base * absorbeBase + cargoExtra * absorbeExtra);
      const cliente = costo - absorbe;
      // Lo mismo que calcula el backend (CalculadoraEnvio.pagoRepartidor).
      const repartidor = Math.round((pagoFijo + pagoKm * km) * 100) / 100;
      return { km, costo, absorbe, cliente, repartidor, balance: Math.round((cliente - repartidor) * 100) / 100, fuera: false };
    });
  });

  constructor() {
    effect(() => {
      const branchId = this.activeBranchId();
      if (branchId) {
        this.cargarTodo(branchId);
      }
    });
  }

  ngOnInit(): void {
  }

  tienePin(): boolean {
    return this.latitud() !== null && this.longitud() !== null;
  }

  enlaceVerEnMapa(): string {
    return `https://www.google.com/maps/search/?api=1&query=${this.latitud()},${this.longitud()}`;
  }

  onRestaurantChange(valor: string): void {
    this.selectedRestaurantId.set(valor);
    this.selectedBranchId.set('');
  }

  usarMiUbicacion(): void {
    if (!navigator.geolocation) {
      this.mostrarAviso(false, 'Tu navegador no puede compartir la ubicación. Pega el enlace de Google Maps.');
      return;
    }
    this.buscandoUbicacion.set(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.buscandoUbicacion.set(false);
        this.latitud.set(Number(pos.coords.latitude.toFixed(7)));
        this.longitud.set(Number(pos.coords.longitude.toFixed(7)));
        this.mostrarAviso(true, 'Ubicación tomada. Revísala en el mapa y guarda.');
      },
      () => {
        this.buscandoUbicacion.set(false);
        this.mostrarAviso(false, 'No pudimos obtener tu ubicación. Da permiso al navegador o pega el enlace de Google Maps.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  alEscribirEnlace(valor: string): void {
    this.enlaceMaps.set(valor);
    const texto = valor.trim();
    if (!texto) return;

    const patrones = [
      /@(-?\d+\.\d+),\s*(-?\d+\.\d+)/,
      /[?&]q=(-?\d+\.\d+),\s*(-?\d+\.\d+)/,
      /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/,
      /^\s*(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)\s*$/,
    ];
    for (const patron of patrones) {
      const hallado = texto.match(patron);
      if (hallado) {
        this.latitud.set(parseFloat(hallado[1]));
        this.longitud.set(parseFloat(hallado[2]));
        return;
      }
    }
  }

  guardarSucursal(): void {
    const branchId = this.activeBranchId();
    if (!branchId) return;

    this.guardandoSucursal.set(true);
    this.http
      .put<BranchData>(`${environment.apiUrl}/branches/${branchId}`, {
        name: this.nombre().trim(),
        address: this.direccion().trim(),
        whatsappNumber: this.whatsapp().trim(),
      })
      .subscribe({
        next: () => {
          this.guardandoSucursal.set(false);
          this.mostrarAviso(true, 'Datos de la sucursal guardados.');
        },
        error: (err) => {
          this.guardandoSucursal.set(false);
          this.mostrarAviso(false, err.error?.error || err.error?.message || 'No se pudieron guardar los datos.');
        },
      });
  }

  guardarDelivery(): void {
    const branchId = this.activeBranchId();
    if (!branchId) return;

    this.guardandoDelivery.set(true);
    this.http
      .put<DeliverySettings>(`${environment.apiUrl}/branches/${branchId}/delivery-settings`, {
        activo: this.activo(),
        latitud: this.latitud(),
        longitud: this.longitud(),
        kmIncluidos: this.kmIncluidos(),
        tarifaBase: this.tarifaBase(),
        // La pantalla habla en porcentajes; el backend en fracciones.
        pctBaseAbsorbe: (this.pctBase() || 0) / 100,
        precioKmExtra: this.precioKmExtra(),
        pctExtraAbsorbe: (this.pctExtra() || 0) / 100,
        redondeoKm: this.redondeoKm(),
        distanciaMaximaKm: this.distanciaMaxima(),
        factorCalles: this.factorCalles(),
        pedidoMinimo: this.pedidoMinimo(),
        minutosEstimados: this.minutosEstimados(),
        grupoRepartidores: this.grupoRepartidores().trim() || null,
        pagoRepartidorFijo: this.pagoFijo(),
        pagoRepartidorKm: this.pagoKm(),
      })
      .subscribe({
        next: (c) => {
          this.guardandoDelivery.set(false);
          this.aplicarDelivery(c);
          this.mostrarAviso(true, 'Entrega a domicilio guardada.');
        },
        error: (err) => {
          this.guardandoDelivery.set(false);
          this.mostrarAviso(false, err.error?.error || err.error?.message || 'No se pudo guardar la configuración.');
        },
      });
  }

  private cargarTodo(branchId: string): void {
    this.cargando.set(true);

    this.http.get<BranchData[]>(`${environment.apiUrl}/branches`).subscribe({
      next: (lista) => {
        const b = lista.find((x) => x.id === branchId);
        if (b) {
          this.nombre.set(b.name ?? '');
          this.direccion.set(b.address ?? '');
          this.whatsapp.set(b.whatsappNumber ?? '');
        }
        this.cargando.set(false);
      },
      error: () => this.cargando.set(false),
    });

    this.http
      .get<DeliverySettings>(`${environment.apiUrl}/branches/${branchId}/delivery-settings`)
      .subscribe({
        next: (c) => this.aplicarDelivery(c),
        error: (err) => console.error('Error al cargar la configuración de entrega', err),
      });

    this.cargarGrupos();
  }

  /**
   * Lee los grupos de WhatsApp de la sucursal. Si el WhatsApp no está
   * conectado devuelve vacío, y la pantalla cae al campo de texto para poder
   * pegar el identificador a mano.
   */
  cargarGrupos(): void {
    const branchId = this.activeBranchId();
    if (!branchId) return;

    this.cargandoGrupos.set(true);
    this.http
      .get<GrupoWhatsapp[]>(`${environment.apiUrl}/branches/${branchId}/whatsapp/groups`)
      .subscribe({
        next: (lista) => {
          this.grupos.set(lista ?? []);
          this.cargandoGrupos.set(false);
        },
        error: () => {
          this.grupos.set([]);
          this.cargandoGrupos.set(false);
        },
      });
  }

  private aplicarDelivery(c: DeliverySettings): void {
    this.activo.set(c.activo ?? false);
    this.latitud.set(c.latitud);
    this.longitud.set(c.longitud);
    this.kmIncluidos.set(c.kmIncluidos ?? 3);
    this.tarifaBase.set(c.tarifaBase ?? 40);
    this.pctBase.set(Math.round((c.pctBaseAbsorbe ?? 1) * 100));
    this.precioKmExtra.set(c.precioKmExtra ?? 10);
    this.pctExtra.set(Math.round((c.pctExtraAbsorbe ?? 0) * 100));
    this.redondeoKm.set(c.redondeoKm ?? 1);
    this.distanciaMaxima.set(c.distanciaMaximaKm ?? 8);
    this.factorCalles.set(c.factorCalles ?? 1.3);
    this.pedidoMinimo.set(c.pedidoMinimo ?? 0);
    this.minutosEstimados.set(c.minutosEstimados ?? 40);
    this.grupoRepartidores.set(c.grupoRepartidores ?? '');
    this.pagoFijo.set(c.pagoRepartidorFijo ?? 12);
    this.pagoKm.set(c.pagoRepartidorKm ?? 6);
  }

  private cargarRestaurantes(): void {
    this.http.get<Restaurant[]>(`${environment.apiUrl}/admin/restaurants`).subscribe({
      next: (data) => {
        const ordenados = [...data].sort((a, b) => a.name.localeCompare(b.name));
        this.restaurants.set(ordenados);
        if (!this.selectedRestaurantId() && ordenados.length > 0) {
          const inicial = sucursalInicial(ordenados, this.authService.userBranchId());
          if (inicial) {
            this.selectedRestaurantId.set(inicial.restaurantId);
            this.selectedBranchId.set(inicial.branchId);
          }
        }
      },
      error: (err) => console.error('Error al cargar restaurantes', err),
    });
  }

  private mostrarAviso(ok: boolean, texto: string): void {
    this.aviso.set({ ok, texto });
    setTimeout(() => this.aviso.set(null), 4000);
  }
}
