import { SonidosService } from '../../core/services/sonidos.service';
import { TituloPaginaComponent } from '../../shared/components/titulo-pagina.component';
import { AvisosService } from '../../core/services/avisos.service';
import { SucursalActivaService } from '../../core/services/sucursal-activa.service';
import { PesosPipe } from '../../shared/utils/pesos';
import { Component, ChangeDetectionStrategy, signal, computed, inject, OnInit, OnDestroy, effect, untracked } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { timer, Subscription } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { WebSocketService } from '../../core/services/websocket.service';
import { PedidoTelefonicoComponent } from './pedido-telefonico.component';
import { CuadreCajaComponent } from './cuadre-caja.component';
import { EstadoEnVivoComponent } from '../../shared/components/estado-en-vivo.component';
import { environment } from '../../../environments/environment';
import { Restaurant } from '../admin-core/models/admin.model';
import { QRCodeComponent } from 'angularx-qrcode';
import { DeliveryOrder, DeliveryStatus, ReporteRepartidor } from './models/delivery.model';
import {
  LucideBike,
  LucideMapPin,
  LucidePhone,
  LucideClock,
  LucideBanknote,
  LucideCheck,
  LucideX,
  LucidePackage,
  LucideTriangleAlert,
  LucideLink,
  LucideCopy,
  LucideQrCode,
  LucideUsers,
  LucideLayoutGrid,
  LucideSend,
} from '@lucide/angular';

/** Una columna del tablero: el estado que agrupa y cómo se llama en pantalla. */
interface Columna {
  estado: DeliveryStatus;
  titulo: string;
  ayuda: string;
}

@Component({
  selector: 'app-delivery-board',
  standalone: true,
  imports: [TituloPaginaComponent, PesosPipe, EstadoEnVivoComponent, PedidoTelefonicoComponent, CuadreCajaComponent, 
    LucideBike,
    LucideMapPin,
    LucidePhone,
    LucideClock,
    LucideBanknote,
    LucideCheck,
    LucideX,
    LucidePackage,
    LucideTriangleAlert,
    LucideLink,
    LucideCopy,
    LucideQrCode,
    LucideUsers,
    LucideLayoutGrid,
    LucideSend,
    FormsModule,
    QRCodeComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6 select-none min-h-screen bg-slate-950 text-slate-100 p-2 sm:p-4">
      <app-estado-en-vivo [branchId]="activeBranchId()" />
      @if (sonidos.bloqueado()) {
        <button
          (click)="sonidos.desbloquear(); sonidos.tocar('domicilio')"
          class="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-bold cursor-pointer"
        >
          El navegador bloqueó el sonido. Toca aquí para oír los pedidos nuevos.
        </button>
      }
      @if (telefonoAbierto() && activeBranchId()) {
        <app-pedido-telefonico [branchId]="activeBranchId()!" (cerrar)="telefonoAbierto.set(false)" (creado)="alCrearPorTelefono($event)" />
      }
      @if (avisoCreado(); as aviso) {
        <div role="status" class="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 px-4 py-3 rounded-xl bg-emerald-600 text-white text-sm font-semibold shadow-lg">
          {{ aviso }}
        </div>
      }
      <!-- Encabezado -->
      <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800/60 pb-5">
        <div>
          <app-titulo-pagina titulo="Domicilio" descripcion="Acepta los pedidos del enlace y sigue cada entrega hasta la puerta del cliente." />
        </div>

        <div class="flex flex-wrap items-center gap-3">
          @if (activeBranchId()) {
            <button (click)="telefonoAbierto.set(true)"
              class="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold cursor-pointer">
              <svg lucidePhone class="w-4 h-4"></svg>
              Pedido por teléfono
            </button>
          }
          @if (isWsConnected()) {
            <div class="flex items-center gap-1.5 px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-[11px] font-bold uppercase tracking-wider">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              En vivo
            </div>
          } @else {
            <div class="flex items-center gap-1.5 px-3 py-2 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-[11px] font-bold uppercase tracking-wider">
              <span class="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
              Reconectando
            </div>
          }
        </div>
      </div>


      <!-- Enlace para compartir con los clientes -->
      @if (activeBranchId()) {
        <section class="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5">
          <div class="flex flex-col lg:flex-row lg:items-center gap-5">
            <div class="min-w-0 flex-1 space-y-2">
              <h2 class="text-sm font-bold text-white flex items-center gap-2">
                <svg lucideLink class="w-4 h-4 text-indigo-400"></svg>
                Enlace para tus clientes
              </h2>
              <p class="text-xs text-slate-400">
                Compártelo por WhatsApp, redes o pégalo en tu perfil. Quien lo abra ve tu menú y pide a domicilio.
              </p>

              <div class="flex flex-col sm:flex-row gap-2 pt-1">
                <input
                  type="text"
                  readonly
                  [value]="enlacePublico()"
                  (focus)="seleccionarTodo($event)"
                  aria-label="Enlace público para pedir a domicilio"
                  class="flex-1 min-w-0 bg-slate-950/60 border border-slate-800 rounded-lg px-3 py-2 text-xs text-indigo-300 outline-none focus:border-indigo-500 select-all"
                />
                <div class="flex gap-2 shrink-0">
                  <button
                    (click)="copiarEnlace(enlacePublico(), 'menu')"
                    [disabled]="esEnlaceLocal()"
                    class="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-indigo-600"
                  >
                    <svg lucideCopy class="w-3.5 h-3.5"></svg>
                    {{ copiado() === 'menu' ? 'Copiado' : 'Copiar' }}
                  </button>
                  <a
                    [href]="enlacePublico()"
                    target="_blank"
                    rel="noopener"
                    class="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
                  >
                    Abrir
                  </a>
                  <button
                    (click)="mostrarQr.set(!mostrarQr())"
                    [disabled]="esEnlaceLocal()"
                    class="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    [attr.aria-expanded]="mostrarQr()"
                  >
                    <svg lucideQrCode class="w-3.5 h-3.5"></svg>
                    QR
                  </button>
                </div>
              </div>

              <!-- Ligas de cuenta: clientes que quieren registrarse y repartidores nuevos -->
              <div class="grid gap-2 pt-2 sm:grid-cols-2">
                @for (l of ligasDeCuenta(); track l.clave) {
                  <div class="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
                    <p class="text-xs font-bold text-slate-200">{{ l.titulo }}</p>
                    <p class="mt-0.5 text-[11px] text-slate-400">{{ l.ayuda }}</p>
                    <div class="mt-2 flex gap-2">
                      <input type="text" readonly [value]="l.url" (focus)="seleccionarTodo($event)" [attr.aria-label]="l.titulo"
                        class="flex-1 min-w-0 bg-slate-950/60 border border-slate-800 rounded-lg px-2.5 py-1.5 text-[11px] text-indigo-300 outline-none focus:border-indigo-500" />
                      <button (click)="copiarEnlace(l.url, l.clave)" [disabled]="esEnlaceLocal()"
                        class="flex shrink-0 items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
                        <svg lucideCopy class="w-3.5 h-3.5"></svg>
                        {{ copiado() === l.clave ? 'Copiado' : 'Copiar' }}
                      </button>
                    </div>
                  </div>
                }
              </div>

              @if (esEnlaceLocal()) {
                <p class="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200" role="note">
                  <svg lucideTriangleAlert class="w-4 h-4 shrink-0 mt-px text-amber-400"></svg>
                  <span>
                    Este enlace solo abre en esta computadora, por eso Copiar y QR están desactivados.
                    Para compartirlo con tus clientes, entra al panel desde tu dominio público.
                  </span>
                </p>
              }
            </div>

            @if (mostrarQr() && !esEnlaceLocal()) {
              <div class="shrink-0 mx-auto lg:mx-0 p-3 bg-white rounded-xl">
                <qrcode
                  [qrdata]="enlacePublico()"
                  [width]="150"
                  [errorCorrectionLevel]="'M'"
                  [elementType]="'canvas'"
                  [margin]="0"
                ></qrcode>
              </div>
            }
          </div>
        </section>
      }

      <!-- Resumen -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div class="p-4 bg-slate-900/30 border border-slate-800/80 rounded-xl">
          <p class="text-[11px] text-slate-400 uppercase tracking-wider font-bold">Por aceptar</p>
          <p class="text-2xl font-black mt-1" [class]="porAceptar().length > 0 ? 'text-amber-400' : 'text-white'">
            {{ porAceptar().length }}
          </p>
        </div>
        <div class="p-4 bg-slate-900/30 border border-slate-800/80 rounded-xl">
          <p class="text-[11px] text-slate-400 uppercase tracking-wider font-bold">En cocina</p>
          <p class="text-2xl font-black text-indigo-400 mt-1">{{ enCocina().length }}</p>
        </div>
        <div class="p-4 bg-slate-900/30 border border-slate-800/80 rounded-xl">
          <p class="text-[11px] text-slate-400 uppercase tracking-wider font-bold">En camino</p>
          <p class="text-2xl font-black text-sky-400 mt-1">{{ enCamino().length }}</p>
        </div>
        <div class="p-4 bg-slate-900/30 border border-slate-800/80 rounded-xl">
          <p class="text-[11px] text-slate-400 uppercase tracking-wider font-bold">Por cobrar</p>
          <p class="text-2xl font-black text-emerald-400 mt-1 tabular-nums">{{ totalPorCobrar() | pesos }}</p>
        </div>
      </div>

      @if (aviso(); as a) {
        <div
          class="flex items-center gap-3 p-4 rounded-xl text-sm border"
          [class]="a.ok ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' : 'bg-rose-500/10 border-rose-500/20 text-rose-300'"
        >
          <span>{{ a.texto }}</span>
        </div>
      }

      @if (errorMessage()) {
        <div class="flex items-center gap-3 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 text-sm">
          <svg lucideTriangleAlert class="w-5 h-5 shrink-0"></svg>
          <span>{{ errorMessage() }}</span>
          <button (click)="recargar()" class="ml-auto px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 rounded-lg text-xs font-bold cursor-pointer">
            Reintentar
          </button>
        </div>
      }

      <!-- Pestanas -->
      <nav class="flex items-center gap-2" aria-label="Vistas de reparto">
        <button
          (click)="vista.set('tablero')"
          class="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          [class]="vista() === 'tablero' ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white'"
        >
          <svg lucideLayoutGrid class="w-4 h-4"></svg>
          Tablero
        </button>
        <button
          (click)="verRepartidores()"
          class="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          [class]="vista() === 'repartidores' ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white'"
        >
          <svg lucideUsers class="w-4 h-4"></svg>
          Repartidores
        </button>
        <button
          (click)="vista.set('cuadre')"
          class="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          [class]="vista() === 'cuadre' ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white'"
        >
          Cuadre de caja
        </button>
      </nav>

      @if (vista() === 'cuadre' && activeBranchId()) {
        <app-cuadre-caja [branchId]="activeBranchId()!" />
      }

      @if (vista() === 'repartidores') {
        <section class="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5 space-y-4">
          <div class="flex flex-col sm:flex-row sm:items-end gap-3">
            <div>
              <label for="rep-desde" class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Desde</label>
              <input id="rep-desde" type="date" [ngModel]="desde()" (ngModelChange)="desde.set($event)"
                class="bg-slate-950/50 border border-slate-800 rounded-xl py-2 px-3 text-sm text-white outline-none focus:border-indigo-500" />
            </div>
            <div>
              <label for="rep-hasta" class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Hasta</label>
              <input id="rep-hasta" type="date" [ngModel]="hasta()" (ngModelChange)="hasta.set($event)"
                class="bg-slate-950/50 border border-slate-800 rounded-xl py-2 px-3 text-sm text-white outline-none focus:border-indigo-500" />
            </div>
            <button
              (click)="cargarReporte()"
              class="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors cursor-pointer"
            >
              Ver periodo
            </button>
            <p class="text-[11px] text-slate-500 sm:ml-auto">Solo cuenta entregas ya cerradas.</p>
          </div>

          @if (cargandoReporte()) {
            <p class="text-center text-slate-500 text-sm py-12">Calculando...</p>
          } @else if (reporte().length === 0) {
            <p class="text-center text-slate-500 text-sm py-12">Nadie cerró entregas en ese periodo.</p>
          } @else {
            <!-- Totales del periodo: lo primero que se busca al pagar -->
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div class="p-3 bg-slate-950/50 border border-slate-800 rounded-xl">
                <p class="text-[11px] text-slate-400 uppercase tracking-wider font-bold">Entregas</p>
                <p class="text-xl font-black text-white mt-1 tabular-nums">{{ totalEntregas() }}</p>
              </div>
              <div class="p-3 bg-slate-950/50 border border-slate-800 rounded-xl">
                <p class="text-[11px] text-slate-400 uppercase tracking-wider font-bold">Kilómetros</p>
                <p class="text-xl font-black text-sky-400 mt-1 tabular-nums">{{ totalKm().toFixed(1) }}</p>
              </div>
              <div class="p-3 bg-slate-950/50 border border-slate-800 rounded-xl">
                <p class="text-[11px] text-slate-400 uppercase tracking-wider font-bold">A pagar</p>
                <p class="text-xl font-black text-amber-400 mt-1 tabular-nums">{{ totalAPagar() | pesos }}</p>
              </div>
              <div class="p-3 bg-slate-950/50 border border-slate-800 rounded-xl">
                <p class="text-[11px] text-slate-400 uppercase tracking-wider font-bold">Cobrado</p>
                <p class="text-xl font-black text-emerald-400 mt-1 tabular-nums">{{ totalCobrado() | pesos }}</p>
              </div>
            </div>

            <div class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead>
                  <tr class="text-slate-500 text-left text-xs">
                    <th class="pb-2 pr-4 font-semibold">Repartidor</th>
                    <th class="pb-2 pr-4 font-semibold text-right">Entregas</th>
                    <th class="pb-2 pr-4 font-semibold text-right">Km</th>
                    <th class="pb-2 pr-4 font-semibold text-right">A pagar</th>
                    <th class="pb-2 pr-4 font-semibold text-right">Cobró (para caja)</th>
                    <th class="pb-2 pr-4 font-semibold text-right">Propinas (suyas)</th>
                    <th class="pb-2 font-semibold text-right">Última</th>
                  </tr>
                </thead>
                <tbody class="tabular-nums">
                  @for (r of reporte(); track r.driverId) {
                    <tr class="border-t border-slate-800/60">
                      <td class="py-2 pr-4">
                        <span class="text-white font-semibold">{{ r.nombre }}</span>
                        <span class="block text-[11px] text-slate-500">
                          {{ r.telefono }}@if (r.vehiculo) { · {{ r.vehiculo }} }
                        </span>
                      </td>
                      <td class="py-2 pr-4 text-right text-slate-300">{{ r.entregas }}</td>
                      <td class="py-2 pr-4 text-right text-slate-400">{{ r.kmTotales.toFixed(1) }}</td>
                      <td class="py-2 pr-4 text-right font-bold text-amber-400">{{ r.aPagar | pesos }}</td>
                      <td class="py-2 pr-4 text-right text-emerald-400">{{ r.cobrado | pesos }}</td>
                      <td class="py-2 pr-4 text-right text-slate-300">{{ r.propinas | pesos }}</td>
                      <td class="py-2 text-right text-slate-400 text-xs">{{ soloHora(r.ultimaEntrega) }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </section>
      } @else if (vista() === 'cuadre') {
        <!-- El cuadre se pinta arriba; el tablero no va debajo. -->
      } @else if (isLoading()) {
        <p class="text-center text-slate-500 text-sm py-16">Cargando pedidos...</p>
      } @else if (!activeBranchId()) {
        <p class="text-center text-slate-500 text-sm py-16">Elige una sucursal para ver sus pedidos.</p>
      } @else if (pedidos().length === 0) {
        <div class="text-center py-20 border border-dashed border-slate-800 rounded-2xl">
          <svg lucidePackage class="w-10 h-10 text-slate-700 mx-auto"></svg>
          <p class="text-slate-400 text-sm mt-3 font-semibold">No hay pedidos a domicilio activos</p>
          <p class="text-slate-600 text-xs mt-1">Los pedidos aparecerán aquí en cuanto alguien use el enlace del menú.</p>
        </div>
      } @else {
        <!-- Tablero -->
        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
          @for (col of columnas; track col.estado) {
            <section class="bg-slate-900/30 border border-slate-800/80 rounded-2xl p-3 space-y-3">
              <header class="px-1">
                <h2 class="text-sm font-bold text-white flex items-center justify-between">
                  <span>{{ col.titulo }}</span>
                  <span class="text-[11px] font-black px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 tabular-nums">
                    {{ pedidosDe(col.estado).length }}
                  </span>
                </h2>
                <p class="text-[11px] text-slate-500 mt-0.5">{{ col.ayuda }}</p>
              </header>

              @for (p of pedidosDe(col.estado); track p.orderId) {
                <article
                  class="rounded-xl border p-3 space-y-3 transition-colors"
                  [class]="claseTarjeta(p)"
                >
                  <!-- Identidad y tiempo -->
                  <div class="flex items-start justify-between gap-2">
                    <div class="min-w-0">
                      <p class="font-black text-white tracking-wide flex items-center gap-1.5 flex-wrap">
                        {{ p.tokenSeguimiento }}
                        @if (p.orderType === 'PARA_LLEVAR') {
                          <span class="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 text-[11px] font-bold uppercase tracking-wider">Para llevar</span>
                        }
                        @if (p.origen === 'TELEFONO') {
                          <span class="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[11px] font-bold uppercase tracking-wider">Teléfono</span>
                        }
                      </p>
                      <p class="text-xs text-slate-300 truncate">{{ p.clienteNombre || 'Cliente' }}</p>
                    </div>
                    <span class="flex items-center gap-1 text-[11px] font-bold shrink-0" [class]="claseReloj(p)">
                      <svg lucideClock class="w-3 h-3"></svg>
                      {{ tiempoTranscurrido(p.creadoEn) }}
                    </span>
                  </div>

                  <!-- Entrega -->
                  <div class="text-xs space-y-1">
                    @if (p.orderType === 'PARA_LLEVAR') {
                      <p class="text-slate-400">Pasa a recogerlo al mostrador.</p>
                    } @else {
                    <p class="flex items-start gap-1.5 text-slate-300">
                      <svg lucideMapPin class="w-3.5 h-3.5 shrink-0 mt-0.5 text-slate-500"></svg>
                      <span class="min-w-0">{{ p.direccion }}</span>
                    </p>
                    }
                    @if (p.referencias) {
                      <p class="text-slate-500 pl-5">{{ p.referencias }}</p>
                    }
                    @if (p.notas) {
                      <p class="text-amber-400/90 pl-5">Nota: {{ p.notas }}</p>
                    }
                    <div class="flex items-center gap-3 pl-5 text-slate-500">
                      @if (p.distanciaKm !== null) {
                        <span class="tabular-nums">{{ p.distanciaKm }} km</span>
                      }
                      @if (p.latitud !== null && p.longitud !== null) {
                        <a
                          [href]="enlaceMapa(p)"
                          target="_blank"
                          rel="noopener"
                          class="text-indigo-400 hover:text-indigo-300 underline underline-offset-2"
                        >Ver en el mapa</a>
                      }
                    </div>
                    @if (p.clienteTelefono) {
                      <p class="flex items-center gap-1.5 text-slate-400">
                        <svg lucidePhone class="w-3.5 h-3.5 shrink-0 text-slate-500"></svg>
                        <span class="tabular-nums">{{ p.clienteTelefono }}</span>
                      </p>
                    }
                  </div>

                  <!-- Platillos -->
                  <ul class="text-xs space-y-1 border-t border-slate-800/80 pt-2">
                    @for (i of p.items; track i.itemId) {
                      <li class="flex gap-2">
                        <span class="font-bold text-slate-300 tabular-nums shrink-0">{{ i.quantity }}×</span>
                        <span class="min-w-0 text-slate-400">
                          {{ i.productName }}
                          @for (a of i.adicionales ?? []; track a) {
                            <span class="block text-[11px] text-sky-300/90">+ {{ a }}</span>
                          }
                          @if (i.specialInstructions) {
                            <span class="block text-[11px] text-amber-400/80">{{ i.specialInstructions }}</span>
                          }
                        </span>
                      </li>
                    }
                  </ul>

                  <!-- Dinero -->
                  <div class="text-xs border-t border-slate-800/80 pt-2 space-y-0.5">
                    <div class="flex justify-between text-slate-400">
                      <span>Comida</span><span class="tabular-nums">{{ p.subtotal | pesos }}</span>
                    </div>
                    <div class="flex justify-between text-slate-400">
                      <span>Envío</span><span class="tabular-nums">{{ p.envioCobrado | pesos }}</span>
                    </div>
                    @if (p.propina > 0) {
                      <div class="flex justify-between text-slate-400">
                        <span>Propina (del repartidor)</span><span class="tabular-nums">{{ p.propina | pesos }}</span>
                      </div>
                    }
                    <div class="flex justify-between font-bold text-white">
                      <span>Total</span><span class="tabular-nums">{{ p.total | pesos }}</span>
                    </div>
                    @if (p.cambio !== null) {
                      <p class="flex items-center gap-1.5 text-emerald-400 font-semibold pt-1">
                        <svg lucideBanknote class="w-3.5 h-3.5 shrink-0"></svg>
                        <span>Paga con {{ p.pagaCon! | pesos }} — llevar {{ p.cambio! | pesos }} de cambio</span>
                      </p>
                    }
                  </div>

                  <!-- Quién la lleva -->
                  @if (p.repartidorNombre) {
                    <p class="text-xs text-sky-400 flex items-center gap-1.5">
                      <svg lucideBike class="w-3.5 h-3.5 shrink-0"></svg>
                      <span class="min-w-0">
                        La lleva <strong>{{ p.repartidorNombre }}</strong>
                        @if (p.pagoRepartidor !== null) {
                          <span class="text-slate-500">· se le pagan {{ p.pagoRepartidor | pesos }}</span>
                        }
                        @if (p.deliveryStatus !== 'ENTREGADO' && p.deliveryStatus !== 'CANCELADO') {
                          <button (click)="liberar(p)" [disabled]="enviando().has(p.orderId)"
                            class="ml-1 text-[11px] text-slate-500 hover:text-rose-300 underline underline-offset-2 cursor-pointer disabled:opacity-50">
                            Quitárselo
                          </button>
                        }
                      </span>
                    </p>
                  }

                  <!-- Estado de cocina, solo cuando ya está aceptado -->
                  @if (p.deliveryStatus !== 'NUEVO' && p.kitchenStatus) {
                    <p class="text-[11px] font-bold uppercase tracking-wider" [class]="claseCocina(p)">
                      Cocina: {{ etiquetaCocina(p) }}
                    </p>
                  }

                  <!-- Acciones -->
                  <div class="flex gap-2 pt-1">
                    @if (siguientePaso(p); as paso) {
                      <button
                        (click)="avanzar(p, paso.estado)"
                        [disabled]="enviando().has(p.orderId)"
                        class="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-wait"
                      >
                        <svg lucideCheck class="w-3.5 h-3.5"></svg>
                        {{ paso.texto }}
                      </button>
                    }
                    <!-- Mandar al grupo: solo si nadie la ha tomado todavía -->
                    @if (sePuedePublicar(p)) {
                      <button
                        (click)="publicar(p)"
                        [disabled]="enviando().has(p.orderId)"
                        class="px-3 py-2 rounded-lg text-xs font-bold bg-slate-800 hover:bg-sky-600 text-slate-300 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
                        [attr.title]="'Mandar ' + p.tokenSeguimiento + ' al grupo de repartidores'"
                        [attr.aria-label]="'Mandar ' + p.tokenSeguimiento + ' al grupo de repartidores'"
                      >
                        <svg lucideSend class="w-3.5 h-3.5"></svg>
                      </button>
                    }
                    <button
                      (click)="cancelar(p)"
                      [disabled]="enviando().has(p.orderId)"
                      class="px-3 py-2 rounded-lg text-xs font-bold bg-slate-800 hover:bg-rose-600/80 text-slate-300 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
                      [attr.aria-label]="'Cancelar pedido ' + p.tokenSeguimiento"
                    >
                      <svg lucideX class="w-3.5 h-3.5"></svg>
                    </button>
                  </div>
                </article>
              } @empty {
                <p class="text-[11px] text-slate-600 text-center py-6">Sin pedidos aquí</p>
              }
            </section>
          }
        </div>
      }
    </div>
  `,
})
export class DeliveryBoardComponent implements OnInit, OnDestroy {
  private readonly avisos = inject(AvisosService);
  readonly sonidos = inject(SonidosService);
  /** Pedidos que ya se vieron en esta sucursal: los que no estén aquí son nuevos y suenan. */
  private conocidos: Set<string> | null = null;
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly webSocketService = inject(WebSocketService);

  private wsSubscription: Subscription | null = null;
  private timerSubscription: Subscription | null = null;

  readonly pedidos = signal<DeliveryOrder[]>([]);
  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  /** El estado real de la conexión lo lleva el servicio, no esta pantalla. */
  readonly isWsConnected = this.webSocketService.connected;
  readonly telefonoAbierto = signal(false);
  readonly avisoCreado = signal<string | null>(null);

  /** El pedido aparece solo en el tablero por el canal en vivo; aquí solo se confirma. */
  alCrearPorTelefono(token: string): void {
    this.telefonoAbierto.set(false);
    this.avisoCreado.set(`Pedido ${token} creado y enviado a cocina`);
    setTimeout(() => this.avisoCreado.set(null), 4000);
  }
  /** Pedidos con una petición en curso, para no dejar apretar dos veces. */
  readonly enviando = signal<Set<string>>(new Set());
  readonly ahora = signal<number>(Date.now());

  // Restaurante y sucursal: los mismos para todo el panel (se eligen en la barra superior).
  private readonly sucursalActiva = inject(SucursalActivaService);
  readonly restaurants = this.sucursalActiva.restaurantes;
  readonly selectedRestaurantId = this.sucursalActiva.restaurantId;
  readonly selectedBranchId = this.sucursalActiva.branchId;

  /** Las cuatro etapas vivas. Entregado y cancelado salen del tablero. */
  readonly columnas: Columna[] = [
    { estado: 'NUEVO', titulo: 'Por aceptar', ayuda: 'Llegaron por el enlace y esperan tu visto bueno' },
    { estado: 'CONFIRMADO', titulo: 'En cocina', ayuda: 'Aceptados: cocina ya los tiene' },
    { estado: 'LISTO', titulo: 'Empacados', ayuda: 'Listos, esperando repartidor' },
    { estado: 'EN_CAMINO', titulo: 'En camino', ayuda: 'El repartidor va en ruta' },
  ];

  /** Qué se está viendo: el tablero de pedidos o el corte por repartidor. */
  readonly vista = signal<'tablero' | 'repartidores' | 'cuadre'>('tablero');
  readonly reporte = signal<ReporteRepartidor[]>([]);
  readonly cargandoReporte = signal(false);
  readonly desde = signal(this.hoy());
  readonly hasta = signal(this.hoy());

  readonly totalEntregas = computed(() => this.reporte().reduce((s, r) => s + r.entregas, 0));
  readonly totalKm = computed(() => this.reporte().reduce((s, r) => s + (r.kmTotales ?? 0), 0));
  readonly totalAPagar = computed(() => this.reporte().reduce((s, r) => s + (r.aPagar ?? 0), 0));
  readonly totalCobrado = computed(() => this.reporte().reduce((s, r) => s + (r.cobrado ?? 0), 0));

  readonly aviso = signal<{ ok: boolean; texto: string } | null>(null);
  readonly mostrarQr = signal(false);
  /** Cuál liga se acaba de copiar: 'menu', 'clientes' o 'repartidores'. */
  readonly copiado = signal<string | null>(null);

  readonly isSuperAdmin = computed(() => this.authService.userRole() === 'SUPER_ADMIN');

  /**
   * El enlace que el restaurante comparte. Se arma con el origen desde el que
   * se abrió el panel: si entraron por el dominio público, el enlace ya sirve
   * para cualquiera; si entraron por localhost, solo sirve aquí.
   */
  private readonly origenPublico = computed(() =>
    (environment.publicAppUrl || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/$/, ''),
  );

  readonly enlacePublico = computed(() => {
    const branchId = this.activeBranchId();
    return branchId ? `${this.origenPublico()}/pedir/${branchId}` : '';
  });

  /**
   * Ligas para entrar a una cuenta de esta sucursal. Los repartidores reciben
   * cada entrega por WhatsApp, pero un repartidor nuevo necesita esta liga
   * para crear su cuenta y ver sus entregas y su corte.
   */
  readonly ligasDeCuenta = computed(() => {
    const branchId = this.activeBranchId();
    if (!branchId) return [];
    const base = `${this.origenPublico()}/cuenta/${branchId}`;
    return [
      { clave: 'clientes', titulo: 'Cuenta de clientes', ayuda: 'Para que guarden sus direcciones y vean sus pedidos.', url: base },
      { clave: 'repartidores', titulo: 'Liga para repartidores', ayuda: 'Mándala a tu grupo: entran con su teléfono y un código.', url: `${base}?tipo=REPARTIDOR` },
    ];
  });

  readonly esEnlaceLocal = computed(() => /localhost|127\.0\.0\.1/.test(this.enlacePublico()));

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
   * Los pedidos ya repartidos por columna. Se agrupa una sola vez y la
   * plantilla solo lee del mapa, en vez de recorrer la lista por cada columna
   * en cada ciclo de deteccion de cambios.
   */
  private readonly porEstado = computed(() => {
    const mapa = new Map<DeliveryStatus, DeliveryOrder[]>();
    for (const p of this.pedidos()) {
      const grupo = mapa.get(p.deliveryStatus);
      if (grupo) {
        grupo.push(p);
      } else {
        mapa.set(p.deliveryStatus, [p]);
      }
    }
    return mapa;
  });

  readonly porAceptar = computed(() => this.pedidosDe('NUEVO'));
  readonly enCocina = computed(() => this.pedidosDe('CONFIRMADO'));
  readonly enCamino = computed(() => this.pedidosDe('EN_CAMINO'));

  /** Lo que falta cobrar: todo lo que sigue vivo en el tablero. */
  readonly totalPorCobrar = computed(() =>
    this.pedidos().reduce((suma, p) => suma + (p.total ?? 0), 0)
  );

  constructor() {
    effect(() => {
      const branchId = this.activeBranchId();
      if (branchId) {
        this.cargarPedidos(branchId);
        this.conectarWebSocket(branchId);
      } else {
        this.desconectarWebSocket();
        this.pedidos.set([]);
        this.conocidos = null;
        this.isLoading.set(false);
      }
    });

    // Tras una reconexión, o cada 20 s mientras no hay conexión en vivo, se
    // vuelve a pedir todo: lo que pasó durante la caída no llegó por el canal.
    effect(() => {
      if (this.webSocketService.sincronizar() === 0) return;
      const branchId = untracked(this.activeBranchId);
      if (branchId) untracked(() => this.cargarPedidos(branchId, true));
    });
  }

  ngOnInit(): void {
    // El reloj de cada tarjeta avanza solo, sin volver a pedir datos.
    this.timerSubscription = timer(0, 30000).subscribe(() => this.ahora.set(Date.now()));
  }

  ngOnDestroy(): void {
    this.desconectarWebSocket();
    this.timerSubscription?.unsubscribe();
  }

  pedidosDe(estado: DeliveryStatus): DeliveryOrder[] {
    return this.porEstado().get(estado) ?? [];
  }

  /**
   * El botón principal de cada tarjeta. Es un solo paso a la vez: el tablero
   * empuja el pedido hacia adelante, nunca hacia atrás.
   */
  siguientePaso(p: DeliveryOrder): { estado: DeliveryStatus; texto: string } | null {
    switch (p.deliveryStatus) {
      case 'NUEVO':
        return { estado: 'CONFIRMADO', texto: 'Aceptar' };
      case 'CONFIRMADO':
        return { estado: 'LISTO', texto: p.orderType === 'PARA_LLEVAR' ? 'Marcar listo' : 'Marcar empacado' };
      case 'LISTO':
        // Para llevar no tiene repartidor: se entrega en el mostrador.
        return p.orderType === 'PARA_LLEVAR'
          ? { estado: 'ENTREGADO', texto: 'Entregado en mostrador' }
          : { estado: 'EN_CAMINO', texto: 'Enviar' };
      case 'EN_CAMINO':
        return { estado: 'ENTREGADO', texto: 'Entregado' };
      default:
        return null;
    }
  }

  /**
   * Se puede ofrecer en el grupo mientras el restaurante ya lo aceptó y nadie
   * lo ha tomado. Antes de aceptarlo no hay nada que repartir.
   */
  sePuedePublicar(p: DeliveryOrder): boolean {
    return p.orderType !== 'PARA_LLEVAR' && !p.repartidorNombre && p.deliveryStatus !== 'NUEVO';
  }

  /** Le quita la entrega al repartidor para que la lleve otro. */
  async liberar(p: DeliveryOrder): Promise<void> {
    const branchId = this.activeBranchId();
    if (!branchId) return;
    const ok = await this.avisos.confirmar({
      titulo: `¿Quitarle la entrega a ${p.repartidorNombre}?`,
      mensaje: 'Le avisamos por WhatsApp y la entrega vuelve a quedar disponible. Si ya está empacada, se ofrece de nuevo en el grupo.',
      confirmar: 'Quitársela',
      peligro: true,
    });
    if (!ok) return;

    this.marcarEnviando(p.orderId, true);
    this.http
      .post<DeliveryOrder>(`${environment.apiUrl}/branches/${branchId}/delivery/orders/${p.orderId}/liberar`, {})
      .subscribe({
        next: (actualizado) => {
          this.marcarEnviando(p.orderId, false);
          this.pedidos.update((lista) => lista.map((x) => (x.orderId === actualizado.orderId ? actualizado : x)));
          this.avisar(true, `La entrega ${p.tokenSeguimiento} quedó sin repartidor.`);
        },
        error: (err) => {
          this.marcarEnviando(p.orderId, false);
          this.avisar(false, err.error?.error || 'No se pudo quitar el repartidor.');
        },
      });
  }

  /** Manda la entrega al grupo de repartidores, o la vuelve a ofrecer. */
  publicar(p: DeliveryOrder): void {
    const branchId = this.activeBranchId();
    if (!branchId) return;

    this.marcarEnviando(p.orderId, true);
    this.http
      .post<{ message: string }>(
        `${environment.apiUrl}/branches/${branchId}/delivery/orders/${p.orderId}/publicar`,
        {}
      )
      .subscribe({
        next: (r) => {
          this.marcarEnviando(p.orderId, false);
          this.avisar(true, r.message);
        },
        error: (err) => {
          this.marcarEnviando(p.orderId, false);
          this.avisar(false, err.error?.error || 'No se pudo publicar en el grupo.');
        },
      });
  }

  private avisar(ok: boolean, texto: string): void {
    this.aviso.set({ ok, texto });
    setTimeout(() => this.aviso.set(null), 4000);
  }

  avanzar(p: DeliveryOrder, estado: DeliveryStatus): void {
    this.cambiarEstado(p, estado);
  }

  cancelar(p: DeliveryOrder): void {
    const motivo = prompt(
      `¿Cancelar el pedido ${p.tokenSeguimiento} de ${p.clienteNombre || 'el cliente'}?\n` +
        'Se le avisará por WhatsApp y el inventario regresará.\n\n' +
        'Motivo (opcional):'
    );
    // prompt devuelve null solo si cerró el diálogo: ahí no se cancela nada.
    if (motivo === null) return;
    this.cambiarEstado(p, 'CANCELADO', motivo.trim() || undefined);
  }

  private cambiarEstado(p: DeliveryOrder, estado: DeliveryStatus, motivo?: string): void {
    const branchId = this.activeBranchId();
    if (!branchId) return;

    this.marcarEnviando(p.orderId, true);

    this.http
      .patch<DeliveryOrder>(
        `${environment.apiUrl}/branches/${branchId}/delivery/orders/${p.orderId}/status`,
        { estado, motivo }
      )
      .subscribe({
        next: (actualizado) => {
          this.marcarEnviando(p.orderId, false);
          // El WebSocket ya trae el tablero completo, pero se aplica el cambio
          // de una vez para que el botón responda sin esperar al servidor.
          this.aplicarCambio(actualizado);
        },
        error: (err) => {
          this.marcarEnviando(p.orderId, false);
          console.error('Error al cambiar el estado del pedido', err);
          this.avisos.error(err.error?.error || 'No se pudo cambiar el estado del pedido.');
        },
      });
  }

  private aplicarCambio(actualizado: DeliveryOrder): void {
    const vivo = actualizado.deliveryStatus !== 'ENTREGADO' && actualizado.deliveryStatus !== 'CANCELADO';
    this.pedidos.update((lista) =>
      vivo
        ? lista.map((p) => (p.orderId === actualizado.orderId ? actualizado : p))
        : lista.filter((p) => p.orderId !== actualizado.orderId)
    );
  }

  private marcarEnviando(orderId: string, activo: boolean): void {
    this.enviando.update((actual) => {
      const copia = new Set(actual);
      if (activo) {
        copia.add(orderId);
      } else {
        copia.delete(orderId);
      }
      return copia;
    });
  }

  recargar(): void {
    const branchId = this.activeBranchId();
    if (branchId) {
      this.cargarPedidos(branchId);
      this.conectarWebSocket(branchId);
    }
  }

  private cargarPedidos(branchId: string, silencioso = false): void {
    if (!silencioso) {
      this.isLoading.set(true);
      this.errorMessage.set(null);
    }

    this.http
      .get<DeliveryOrder[]>(`${environment.apiUrl}/branches/${branchId}/delivery/orders`)
      .subscribe({
        next: (data) => {
          this.recibirPedidos(data, silencioso);
          this.isLoading.set(false);
        },
        error: (err) => {
          this.isLoading.set(false);
          if (silencioso) return; // Se queda con lo que ya mostraba.
          console.error('Error al cargar los pedidos a domicilio', err);
          this.errorMessage.set(
            err.status === 0
              ? 'No se pudo conectar con el servidor.'
              : err.error?.error || 'No se pudieron cargar los pedidos a domicilio.'
          );
        },
      });
  }

  private conectarWebSocket(branchId: string): void {
    this.desconectarWebSocket();

    this.wsSubscription = this.webSocketService
      .subscribe<DeliveryOrder[]>(`/topic/branches/${branchId}/delivery`)
      .subscribe({
        next: (lista) => this.recibirPedidos(lista, true),
        error: (err) => console.error('Error en la suscripción de reparto', err),
      });
  }

  /**
   * Pone la lista y suena si llegó un pedido que no se había visto. La primera
   * carga de una sucursal no suena: son los pedidos que ya estaban.
   */
  private recibirPedidos(lista: DeliveryOrder[], avisar: boolean): void {
    const nuevos = this.conocidos ? lista.filter((p) => !this.conocidos!.has(p.orderId)) : [];
    if (avisar && nuevos.length > 0) this.sonidos.tocar('domicilio');
    this.conocidos = new Set([...(this.conocidos ?? []), ...lista.map((p) => p.orderId)]);
    this.pedidos.set(lista);
  }

  private desconectarWebSocket(): void {
    this.wsSubscription?.unsubscribe();
    this.wsSubscription = null;
  }

  private cargarRestaurantes(): void {
    this.http.get<Restaurant[]>(`${environment.apiUrl}/admin/restaurants`).subscribe({
      next: (data) => {
        const ordenados = [...data].sort((a, b) => a.name.localeCompare(b.name));
        this.restaurants.set(ordenados);
        this.preseleccionarPrimeraSucursal(ordenados);
      },
      error: (err) => console.error('Error al cargar restaurantes', err),
    });
  }

  /** Deja elegida la primera sucursal, para no abrir el módulo en blanco. */
  private preseleccionarPrimeraSucursal(lista: Restaurant[]): void {
    if (this.selectedRestaurantId() || lista.length === 0) return;

    // La sucursal del propio usuario primero: antes se abría la primera de la
    // lista, y quien trabajaba en otra veía una sucursal ajena y no le llegaban
    // sus pedidos ni sus avisos.
    const propia = this.authService.userBranchId();
    const conPropia = propia ? lista.find((r) => r.branches?.some((b) => b.id === propia)) : undefined;
    const restaurante = conPropia ?? lista[0];
    const sucursal = conPropia ? restaurante.branches!.find((b) => b.id === propia)! : restaurante.branches?.[0];
    if (!sucursal) return;
    this.selectedRestaurantId.set(restaurante.id);
    this.selectedBranchId.set(sucursal.id);
  }

  onRestaurantChange(event: Event): void {
    this.selectedRestaurantId.set((event.target as HTMLSelectElement).value);
    this.selectedBranchId.set('');
    this.pedidos.set([]);
    this.conocidos = null;
  }

  onBranchChange(event: Event): void {
    this.selectedBranchId.set((event.target as HTMLSelectElement).value);
  }

  // ----------------------------------------------------------------
  // Presentación
  // ----------------------------------------------------------------

  verRepartidores(): void {
    this.vista.set('repartidores');
    if (this.reporte().length === 0) {
      this.cargarReporte();
    }
  }

  cargarReporte(): void {
    const branchId = this.activeBranchId();
    if (!branchId) return;

    this.cargandoReporte.set(true);
    this.http
      .get<ReporteRepartidor[]>(`${environment.apiUrl}/branches/${branchId}/delivery/reports/drivers`, {
        params: { desde: this.desde(), hasta: this.hasta() },
      })
      .subscribe({
        next: (data) => {
          this.reporte.set(data);
          this.cargandoReporte.set(false);
        },
        error: (err) => {
          this.cargandoReporte.set(false);
          console.error('Error al cargar el reporte de repartidores', err);
          this.reporte.set([]);
        },
      });
  }

  private hoy(): string {
    // En formato YYYY-MM-DD y en hora local: con toISOString un pedido de la
    // noche se contaria en el dia siguiente.
    const d = new Date();
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mes}-${dia}`;
  }

  soloHora(fecha: string | null): string {
    if (!fecha) return '—';
    const d = new Date(fecha);
    return d.toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  seleccionarTodo(event: Event): void {
    (event.target as HTMLInputElement).select();
  }

  copiarEnlace(enlace: string, clave: string): void {
    if (!enlace) return;

    navigator.clipboard.writeText(enlace).then(
      () => {
        this.copiado.set(clave);
        setTimeout(() => this.copiado.set(null), 2000);
      },
      () => this.avisos.error('No se pudo copiar. Selecciona el enlace y cópialo a mano.')
    );
  }

  enlaceMapa(p: DeliveryOrder): string {
    return `https://www.google.com/maps/search/?api=1&query=${p.latitud},${p.longitud}`;
  }

  minutosDesde(fecha: string): number {
    if (!fecha) return 0;
    return Math.max(0, Math.floor((this.ahora() - new Date(fecha).getTime()) / 60000));
  }

  tiempoTranscurrido(fecha: string): string {
    const min = this.minutosDesde(fecha);
    if (min < 1) return 'ahora';
    if (min < 60) return `${min} min`;
    return `${Math.floor(min / 60)}h ${min % 60}m`;
  }

  /**
   * Un pedido sin aceptar se resalta, y se pone rojo si lleva demasiado
   * esperando: mientras nadie lo acepte, el cliente está esperando en blanco.
   */
  claseTarjeta(p: DeliveryOrder): string {
    if (p.deliveryStatus !== 'NUEVO') {
      return 'bg-slate-950/60 border-slate-800';
    }
    return this.minutosDesde(p.creadoEn) >= 5
      ? 'bg-rose-500/10 border-rose-500/40'
      : 'bg-amber-500/10 border-amber-500/40';
  }

  claseReloj(p: DeliveryOrder): string {
    const min = this.minutosDesde(p.creadoEn);
    const limite = p.minutosEstimados ?? 40;
    if (p.deliveryStatus === 'NUEVO') {
      return min >= 5 ? 'text-rose-400' : 'text-amber-400';
    }
    return min > limite ? 'text-rose-400' : 'text-slate-400';
  }

  etiquetaCocina(p: DeliveryOrder): string {
    switch (p.kitchenStatus) {
      case 'PENDING':
        return 'sin empezar';
      case 'PREPARING':
        return 'preparando';
      case 'READY':
        return 'lista';
      case 'DELIVERED':
        return 'entregada';
      default:
        return '—';
    }
  }

  claseCocina(p: DeliveryOrder): string {
    switch (p.kitchenStatus) {
      case 'PENDING':
        return 'text-slate-500';
      case 'PREPARING':
        return 'text-amber-400';
      default:
        return 'text-emerald-400';
    }
  }
}
