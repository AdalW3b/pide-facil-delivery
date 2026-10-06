import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { LucideLoader2 } from '@lucide/angular';
import { environment } from '../../../environments/environment';
import { AvisosService } from '../../core/services/avisos.service';
import { SoporteService } from '../../core/services/soporte.service';
import { SucursalActivaService } from '../../core/services/sucursal-activa.service';
import { TituloPaginaComponent } from '../../shared/components/titulo-pagina.component';
import { PesosPipe } from '../../shared/utils/pesos';

/** Un dueño de restaurante, como lo ve el operador. */
interface Dueno {
  userId: string;
  name: string | null;
  username: string;
  phoneNumber: string | null;
  active: boolean;
  restaurantId: string | null;
  restaurantName: string | null;
  isDemo: boolean;
  createdAt: string | null;
  subscriptionPlan: string | null;
  subscriptionStatus: string | null;
  trialEndsAt: string | null;
}

/** Cómo va un restaurante con su renta. */
interface EstadoRenta {
  restaurantId: string;
  restaurante: string | null;
  plan: string | null;
  estadoSuscripcion: string | null;
  demo: boolean;
  activo: boolean;
  pruebaHasta: string | null;
  pagadoHasta: string | null;
  ultimoPago: string | null;
  ultimoMonto: number | null;
  vencido: boolean;
  ultimoFallido: boolean;
}

interface ResumenRenta {
  cobradoEsteMes: number;
  cobrosEsteMes: number;
  vencidos: number;
  fallidos: number;
  pruebasPorVencer: number;
  restaurantes: EstadoRenta[];
}

interface Cobro {
  id: string;
  metodo: 'STRIPE' | 'EFECTIVO';
  estado: 'PAGADO' | 'FALLIDO' | 'ANULADO';
  monto: number;
  moneda: string;
  plan: string | null;
  periodoDesde: string | null;
  periodoHasta: string | null;
  referencia: string | null;
  notas: string | null;
  registradoPor: string | null;
  pagadoEn: string | null;
  creadoEn: string;
  anuladoMotivo: string | null;
}

interface Bitacora {
  sesion: { id: string; restaurante: string; operador: string | null; motivo: string; inicio: string; fin: string | null; abierta: boolean };
  acciones: { metodo: string; ruta: string; estadoHttp: number | null; en: string }[];
}

type Pestana = 'restaurantes' | 'renta' | 'bitacora';

/**
 * La pantalla del operador de la plataforma: los restaurantes y sus dueños,
 * la renta del sistema (Stripe y efectivo) y la bitácora del modo soporte.
 * Desde aquí se entra a ver un restaurante en modo soporte.
 */
@Component({
  selector: 'app-plataforma',
  standalone: true,
  imports: [DatePipe, FormsModule, RouterLink, LucideLoader2, TituloPaginaComponent, PesosPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6 min-h-screen bg-slate-950 text-slate-100 p-2 sm:p-4">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <app-titulo-pagina titulo="Plataforma" descripcion="Los restaurantes, su renta y el soporte que se les da." />
        <a routerLink="/admin" class="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold">Crear restaurante o sucursal</a>
      </div>

      @if (soporte.sesion(); as s) {
        <p class="rounded-xl border border-indigo-500/40 bg-indigo-500/10 px-4 py-2 text-xs text-indigo-100">
          Tienes una sesión de soporte abierta en <strong>{{ s.restaurante }}</strong>.
          <button type="button" (click)="irAlRestaurante(s.restaurantId)" class="ml-2 font-bold underline underline-offset-2 cursor-pointer">Ir</button>
        </p>
      }

      <nav class="flex gap-1 overflow-x-auto pb-1" aria-label="Secciones de la plataforma">
        @for (p of pestanas; track p.id) {
          <button type="button" (click)="cambiarPestana(p.id)" [attr.aria-current]="pestana() === p.id ? 'page' : null"
            class="px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer"
            [class]="pestana() === p.id ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'">
            {{ p.nombre }}
          </button>
        }
      </nav>

      <!-- ============================== RESTAURANTES -->
      @if (pestana() === 'restaurantes') {
        <dl class="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div class="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
            <dt class="text-[11px] text-slate-500 uppercase tracking-wider">Restaurantes</dt>
            <dd class="text-2xl font-black text-white tabular-nums">{{ duenos().length }}</dd>
          </div>
          <div class="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
            <dt class="text-[11px] text-slate-500 uppercase tracking-wider">Activos</dt>
            <dd class="text-2xl font-black text-emerald-400 tabular-nums">{{ activos() }}</dd>
          </div>
          <div class="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
            <dt class="text-[11px] text-slate-500 uppercase tracking-wider">Desactivados</dt>
            <dd class="text-2xl font-black text-rose-400 tabular-nums">{{ duenos().length - activos() }}</dd>
          </div>
          <div class="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
            <dt class="text-[11px] text-slate-500 uppercase tracking-wider">Demo</dt>
            <dd class="text-2xl font-black text-amber-300 tabular-nums">{{ demos() }}</dd>
          </div>
        </dl>

        <section class="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 space-y-4">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <h2 class="text-sm font-bold text-white">Dueños y restaurantes</h2>
            <input type="search" [ngModel]="buscar()" (ngModelChange)="buscar.set($event)" placeholder="Buscar restaurante, dueño o usuario"
              aria-label="Buscar restaurante"
              class="w-full sm:w-72 bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-sm text-white outline-none focus:border-indigo-500" />
          </div>

          @if (cargando()) {
            <p class="flex items-center gap-2 text-sm text-slate-400"><svg lucideLoader2 class="w-4 h-4 animate-spin"></svg> Cargando...</p>
          } @else if (error()) {
            <p class="text-sm text-rose-400" role="alert">{{ error() }}</p>
          } @else if (filtrados().length === 0) {
            <p class="text-sm text-slate-500 py-6 text-center">No hay restaurantes que coincidan.</p>
          } @else {
            <div class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead>
                  <tr class="text-[11px] text-slate-500 uppercase tracking-wider text-left">
                    <th class="py-2 pr-3 font-semibold">Restaurante</th>
                    <th class="py-2 pr-3 font-semibold">Dueño</th>
                    <th class="py-2 pr-3 font-semibold">Plan</th>
                    <th class="py-2 pr-3 font-semibold">Estado</th>
                    <th class="py-2 pr-3 font-semibold">Asistente IA</th>
                    <th class="py-2 font-semibold text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-800">
                  @for (d of filtrados(); track d.userId) {
                    <tr [class.opacity-60]="!d.active">
                      <td class="py-3 pr-3">
                        <p class="font-bold text-white">{{ d.restaurantName || 'Sin restaurante' }}</p>
                        @if (d.isDemo) {
                          <span class="inline-block mt-0.5 px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 text-[11px] font-bold uppercase tracking-wider">Demo</span>
                        }
                      </td>
                      <td class="py-3 pr-3">
                        <p class="text-slate-200">{{ d.name || d.username }}</p>
                        <p class="text-[11px] text-slate-500">{{ d.username }}{{ d.phoneNumber ? ' · ' + d.phoneNumber : '' }}</p>
                      </td>
                      <td class="py-3 pr-3 text-slate-300">{{ d.subscriptionPlan || '—' }}</td>
                      <td class="py-3 pr-3">
                        <span class="px-2 py-0.5 rounded-full text-[11px] font-bold"
                          [class]="d.active ? 'bg-emerald-500/15 text-emerald-300' : 'bg-rose-500/15 text-rose-300'">
                          {{ d.active ? 'Activo' : 'Desactivado' }}
                        </span>
                      </td>
                      <td class="py-3 pr-3">
                        @if (d.restaurantId; as rid) {
                          <!-- Complemento: el restaurante pone su propia llave del proveedor de IA -->
                          <button type="button" role="switch" [attr.aria-checked]="conAsistente().has(rid)"
                            [attr.aria-label]="'Asistente IA de ' + (d.restaurantName || d.username)"
                            (click)="alternarAsistente(d)" [disabled]="ocupado() === d.userId"
                            class="relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer disabled:opacity-40"
                            [class]="conAsistente().has(rid) ? 'bg-indigo-600' : 'bg-slate-700'">
                            <span class="inline-block h-4 w-4 rounded-full bg-white transition-transform"
                              [class]="conAsistente().has(rid) ? 'translate-x-4.5' : 'translate-x-0.5'"></span>
                          </button>
                        }
                      </td>
                      <td class="py-3 text-right whitespace-nowrap space-x-3">
                        @if (d.restaurantId) {
                          <button type="button" (click)="entrandoA.set(d)" class="text-xs font-bold text-indigo-400 hover:text-indigo-300 cursor-pointer">Entrar en soporte</button>
                          <button type="button" (click)="alternarDemo(d)" [disabled]="ocupado() === d.userId"
                            class="text-xs font-bold text-amber-300 hover:text-amber-200 cursor-pointer disabled:opacity-40">
                            {{ d.isDemo ? 'Quitar demo' : 'Marcar demo' }}
                          </button>
                        }
                        <button type="button" (click)="alternarActivo(d)" [disabled]="ocupado() === d.userId"
                          class="text-xs font-bold cursor-pointer disabled:opacity-40"
                          [class]="d.active ? 'text-rose-400 hover:text-rose-300' : 'text-emerald-400 hover:text-emerald-300'">
                          {{ d.active ? 'Desactivar' : 'Activar' }}
                        </button>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </section>

        <section class="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-5 space-y-3 max-w-2xl">
          <h2 class="text-sm font-bold text-rose-200">Reiniciar la cuenta demo</h2>
          <p class="text-xs text-slate-300">
            Borra lo que se hizo en la demo (pedidos, cambios al menú, empleados) y la deja como recién creada.
            Úsalo entre presentaciones. No toca los restaurantes reales.
          </p>
          <button type="button" (click)="reiniciarDemo()" [disabled]="reiniciando()"
            class="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer disabled:opacity-50">
            {{ reiniciando() ? 'Reiniciando...' : 'Reiniciar demo' }}
          </button>
        </section>
      }

      <!-- ============================== RENTA -->
      @if (pestana() === 'renta') {
        @if (renta(); as r) {
          <dl class="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <div class="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
              <dt class="text-[11px] text-slate-500 uppercase tracking-wider">Cobrado este mes</dt>
              <dd class="text-xl font-black text-emerald-400 tabular-nums">{{ r.cobradoEsteMes | pesos }}</dd>
              <dd class="text-[11px] text-slate-500">{{ r.cobrosEsteMes }} cobros</dd>
            </div>
            <div class="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
              <dt class="text-[11px] text-slate-500 uppercase tracking-wider">Vencidos</dt>
              <dd class="text-xl font-black tabular-nums" [class]="r.vencidos ? 'text-rose-400' : 'text-white'">{{ r.vencidos }}</dd>
            </div>
            <div class="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
              <dt class="text-[11px] text-slate-500 uppercase tracking-wider">Cobro fallido</dt>
              <dd class="text-xl font-black tabular-nums" [class]="r.fallidos ? 'text-amber-300' : 'text-white'">{{ r.fallidos }}</dd>
            </div>
            <div class="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
              <dt class="text-[11px] text-slate-500 uppercase tracking-wider">Pruebas por vencer</dt>
              <dd class="text-xl font-black text-white tabular-nums">{{ r.pruebasPorVencer }}</dd>
              <dd class="text-[11px] text-slate-500">próximos 7 días</dd>
            </div>
            <div class="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 col-span-2 lg:col-span-1 flex items-center">
              <button type="button" (click)="nuevoEfectivo(null)"
                class="w-full px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer">
                Registrar pago en efectivo
              </button>
            </div>
          </dl>

          <section class="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 space-y-3">
            <h2 class="text-sm font-bold text-white">Renta por restaurante</h2>
            <div class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead>
                  <tr class="text-[11px] text-slate-500 uppercase tracking-wider text-left">
                    <th class="py-2 pr-3 font-semibold">Restaurante</th>
                    <th class="py-2 pr-3 font-semibold">Plan</th>
                    <th class="py-2 pr-3 font-semibold">Pagado hasta</th>
                    <th class="py-2 pr-3 font-semibold">Último pago</th>
                    <th class="py-2 pr-3 font-semibold">Estado</th>
                    <th class="py-2 font-semibold text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-800">
                  @for (e of r.restaurantes; track e.restaurantId) {
                    <tr [class.opacity-60]="!e.activo">
                      <td class="py-3 pr-3 font-bold text-white">{{ e.restaurante || '—' }}</td>
                      <td class="py-3 pr-3 text-slate-300">{{ e.plan || '—' }}</td>
                      <td class="py-3 pr-3 tabular-nums" [class]="e.vencido ? 'text-rose-300 font-bold' : 'text-slate-300'">
                        {{ e.pagadoHasta ? (e.pagadoHasta | date: 'dd/MM/yy') : (e.pruebaHasta ? 'Prueba al ' + (e.pruebaHasta | date: 'dd/MM/yy') : '—') }}
                      </td>
                      <td class="py-3 pr-3 text-slate-400 tabular-nums">
                        {{ e.ultimoPago ? (e.ultimoPago | date: 'dd/MM/yy') + ' · ' + (e.ultimoMonto | pesos) : 'Sin pagos' }}
                      </td>
                      <td class="py-3 pr-3 space-x-1">
                        @if (e.demo) { <span class="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 text-[11px] font-bold">Demo</span> }
                        @else if (e.vencido) { <span class="px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-300 text-[11px] font-bold">Vencido</span> }
                        @else { <span class="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 text-[11px] font-bold">Al corriente</span> }
                        @if (e.ultimoFallido) { <span class="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 text-[11px] font-bold">Cobro fallido</span> }
                        @if (!e.activo) { <span class="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[11px] font-bold">Desactivado</span> }
                      </td>
                      <td class="py-3 text-right whitespace-nowrap space-x-3">
                        <button type="button" (click)="verHistorial(e)" class="text-xs font-bold text-indigo-400 hover:text-indigo-300 cursor-pointer">Historial</button>
                        <button type="button" (click)="nuevoEfectivo(e)" class="text-xs font-bold text-emerald-400 hover:text-emerald-300 cursor-pointer">Efectivo</button>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </section>
        } @else {
          <p class="flex items-center gap-2 text-sm text-slate-400"><svg lucideLoader2 class="w-4 h-4 animate-spin"></svg> Cargando la renta...</p>
        }
      }

      <!-- ============================== BITÁCORA DE SOPORTE -->
      @if (pestana() === 'bitacora') {
        <section class="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 space-y-3">
          <h2 class="text-sm font-bold text-white">Sesiones de soporte</h2>
          @if (bitacora().length === 0) {
            <p class="text-sm text-slate-500">Todavía no hay sesiones.</p>
          } @else {
            <ul class="divide-y divide-slate-800">
              @for (b of bitacora(); track b.sesion.id) {
                <li class="py-3 space-y-1">
                  <p class="text-sm text-white">
                    <span class="tabular-nums text-slate-400">{{ b.sesion.inicio | date: 'dd/MM/yy HH:mm' }}</span>
                    · <strong>{{ b.sesion.restaurante }}</strong> · {{ b.sesion.operador }}
                    @if (b.sesion.abierta) { <span class="ml-1 px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 text-[11px] font-bold">Abierta</span> }
                  </p>
                  <p class="text-xs text-slate-400">Motivo: {{ b.sesion.motivo }}</p>
                  @if (b.acciones.length) {
                    <details class="text-xs text-slate-400">
                      <summary class="cursor-pointer text-amber-300 font-semibold">{{ b.acciones.length }} cambios</summary>
                      <ul class="mt-1 space-y-0.5 font-mono text-[11px]">
                        @for (a of b.acciones; track $index) {
                          <li>{{ a.en | date: 'HH:mm' }} · {{ a.metodo }} {{ a.ruta }} · {{ a.estadoHttp }}</li>
                        }
                      </ul>
                    </details>
                  }
                </li>
              }
            </ul>
          }
        </section>
      }

      <!-- ============================== MODAL: ENTRAR EN SOPORTE -->
      @if (entrandoA(); as d) {
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-labelledby="titulo-soporte">
          <div class="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-5 space-y-4">
            <h2 id="titulo-soporte" class="text-lg font-bold text-white">Entrar en soporte a {{ d.restaurantName }}</h2>
            <p class="text-xs text-slate-400">Vas a ver su cuenta en solo lectura. El dueño recibe un aviso con el motivo. Para hacer cambios necesitarás un código que te dé el dueño.</p>
            <input type="text" maxlength="300" [ngModel]="motivo()" (ngModelChange)="motivo.set($event)"
              placeholder="Motivo (ej. no le llegan pedidos de WhatsApp)" aria-label="Motivo de la revisión"
              class="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-sm text-white outline-none focus:border-indigo-500" />
            <div class="flex justify-end gap-2">
              <button type="button" (click)="entrandoA.set(null)" class="px-4 py-2 rounded-lg border border-slate-700 text-sm text-slate-300 cursor-pointer">Cancelar</button>
              <button type="button" (click)="entrarEnSoporte(d)" [disabled]="motivo().trim().length < 5 || ocupado() === d.userId"
                class="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold cursor-pointer disabled:opacity-40">
                Entrar
              </button>
            </div>
          </div>
        </div>
      }

      <!-- ============================== MODAL: HISTORIAL DE RENTA -->
      @if (historialDe(); as e) {
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-labelledby="titulo-historial">
          <div class="w-full max-w-3xl max-h-[85vh] overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900 p-5 space-y-4">
            <div class="flex items-center justify-between gap-3">
              <h2 id="titulo-historial" class="text-lg font-bold text-white">Renta de {{ e.restaurante }}</h2>
              <button type="button" (click)="historialDe.set(null)" class="px-3 py-1.5 rounded-lg bg-slate-800 text-xs font-bold text-white cursor-pointer">Cerrar</button>
            </div>
            @if (cobros().length === 0) {
              <p class="text-sm text-slate-500">Sin cobros registrados.</p>
            } @else {
              <table class="w-full text-sm">
                <thead>
                  <tr class="text-[11px] text-slate-500 uppercase tracking-wider text-left">
                    <th class="py-2 pr-3 font-semibold">Fecha</th>
                    <th class="py-2 pr-3 font-semibold">Método</th>
                    <th class="py-2 pr-3 font-semibold">Periodo</th>
                    <th class="py-2 pr-3 font-semibold text-right">Monto</th>
                    <th class="py-2 pr-3 font-semibold">Estado</th>
                    <th class="py-2"><span class="sr-only">Acciones</span></th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-800">
                  @for (c of cobros(); track c.id) {
                    <tr [class.opacity-50]="c.estado === 'ANULADO'">
                      <td class="py-2 pr-3 text-slate-400 tabular-nums whitespace-nowrap">{{ (c.pagadoEn || c.creadoEn) | date: 'dd/MM/yy' }}</td>
                      <td class="py-2 pr-3 text-slate-300">
                        {{ c.metodo === 'STRIPE' ? 'Tarjeta (Stripe)' : 'Efectivo' }}
                        @if (c.referencia) { <span class="block text-[11px] text-slate-500">{{ c.referencia }}</span> }
                      </td>
                      <td class="py-2 pr-3 text-slate-400 tabular-nums whitespace-nowrap">
                        {{ c.periodoDesde ? (c.periodoDesde | date: 'dd/MM') + ' – ' + (c.periodoHasta | date: 'dd/MM/yy') : '—' }}
                      </td>
                      <td class="py-2 pr-3 text-right tabular-nums text-white">{{ c.monto | pesos }}</td>
                      <td class="py-2 pr-3">
                        <span class="text-[11px] font-bold" [class]="c.estado === 'PAGADO' ? 'text-emerald-300' : c.estado === 'FALLIDO' ? 'text-amber-300' : 'text-slate-400'">{{ c.estado }}</span>
                        @if (c.anuladoMotivo) { <span class="block text-[11px] text-slate-500">{{ c.anuladoMotivo }}</span> }
                      </td>
                      <td class="py-2 text-right">
                        @if (c.metodo === 'EFECTIVO' && c.estado === 'PAGADO') {
                          <button type="button" (click)="anular(c)" class="text-xs font-bold text-rose-400 hover:text-rose-300 cursor-pointer">Anular</button>
                        }
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            }
          </div>
        </div>
      }

      <!-- ============================== MODAL: PAGO EN EFECTIVO -->
      @if (efectivoAbierto()) {
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-labelledby="titulo-efectivo">
          <div class="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-5 space-y-3">
            <h2 id="titulo-efectivo" class="text-lg font-bold text-white">Registrar pago en efectivo</h2>
            <label class="block">
              <span class="block text-[11px] text-slate-400 uppercase tracking-wider mb-1">Restaurante</span>
              <select [(ngModel)]="efectivo.restaurantId" class="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-sm text-white outline-none focus:border-indigo-500">
                <option value="" disabled>Elige un restaurante</option>
                @for (e of renta()?.restaurantes ?? []; track e.restaurantId) {
                  <option [value]="e.restaurantId" class="bg-slate-950">{{ e.restaurante }}</option>
                }
              </select>
            </label>
            <label class="block">
              <span class="block text-[11px] text-slate-400 uppercase tracking-wider mb-1">Monto</span>
              <input type="number" min="0" step="0.5" inputmode="decimal" [(ngModel)]="efectivo.monto"
                class="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-sm text-white outline-none focus:border-indigo-500 tabular-nums" />
            </label>
            <div class="grid grid-cols-2 gap-2">
              <label class="block">
                <span class="block text-[11px] text-slate-400 uppercase tracking-wider mb-1">Cubre desde</span>
                <input type="date" [(ngModel)]="efectivo.periodoDesde"
                  class="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-sm text-white outline-none focus:border-indigo-500 [color-scheme:dark]" />
              </label>
              <label class="block">
                <span class="block text-[11px] text-slate-400 uppercase tracking-wider mb-1">Hasta</span>
                <input type="date" [(ngModel)]="efectivo.periodoHasta"
                  class="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-sm text-white outline-none focus:border-indigo-500 [color-scheme:dark]" />
              </label>
            </div>
            <input type="text" maxlength="120" [(ngModel)]="efectivo.referencia" placeholder="Folio del recibo (opcional)" aria-label="Folio del recibo"
              class="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-sm text-white outline-none focus:border-indigo-500" />
            <input type="text" maxlength="300" [(ngModel)]="efectivo.notas" placeholder="Notas (opcional)" aria-label="Notas"
              class="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-sm text-white outline-none focus:border-indigo-500" />
            <div class="flex justify-end gap-2 pt-1">
              <button type="button" (click)="efectivoAbierto.set(false)" class="px-4 py-2 rounded-lg border border-slate-700 text-sm text-slate-300 cursor-pointer">Cancelar</button>
              <button type="button" (click)="guardarEfectivo()" [disabled]="guardando() || !efectivo.restaurantId || !(efectivo.monto > 0) || !efectivo.periodoDesde || !efectivo.periodoHasta"
                class="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold cursor-pointer disabled:opacity-40">
                {{ guardando() ? 'Guardando...' : 'Registrar pago' }}
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class PlataformaComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly avisos = inject(AvisosService);
  private readonly router = inject(Router);
  private readonly sucursal = inject(SucursalActivaService);
  readonly soporte = inject(SoporteService);
  private readonly api = `${environment.apiUrl}/system`;

  readonly pestanas: { id: Pestana; nombre: string }[] = [
    { id: 'restaurantes', nombre: 'Restaurantes' },
    { id: 'renta', nombre: 'Renta' },
    { id: 'bitacora', nombre: 'Bitácora de soporte' },
  ];
  readonly pestana = signal<Pestana>('restaurantes');

  readonly duenos = signal<Dueno[]>([]);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);
  readonly ocupado = signal<string | null>(null);
  readonly reiniciando = signal(false);
  readonly buscar = signal('');

  readonly entrandoA = signal<Dueno | null>(null);
  readonly motivo = signal('');

  readonly renta = signal<ResumenRenta | null>(null);
  readonly historialDe = signal<EstadoRenta | null>(null);
  readonly cobros = signal<Cobro[]>([]);
  readonly efectivoAbierto = signal(false);
  readonly guardando = signal(false);
  efectivo = { restaurantId: '', monto: 0, periodoDesde: '', periodoHasta: '', referencia: '', notas: '' };

  readonly bitacora = signal<Bitacora[]>([]);
  /** Restaurantes con el complemento del asistente contratado. */
  readonly conAsistente = signal<Set<string>>(new Set());

  readonly activos = computed(() => this.duenos().filter((d) => d.active).length);
  readonly demos = computed(() => this.duenos().filter((d) => d.isDemo).length);
  readonly filtrados = computed(() => {
    const q = this.buscar().trim().toLowerCase();
    if (!q) return this.duenos();
    return this.duenos().filter((d) =>
      [d.restaurantName, d.name, d.username, d.phoneNumber].some((v) => v?.toLowerCase().includes(q)));
  });

  ngOnInit(): void {
    this.cargarDuenos();
    this.http.get<string[]>(`${this.api}/asistente`).subscribe({ next: (ids) => this.conAsistente.set(new Set(ids)) });
  }

  cambiarPestana(p: Pestana): void {
    this.pestana.set(p);
    if (p === 'renta') this.cargarRenta();
    if (p === 'bitacora') {
      this.http.get<Bitacora[]>(`${this.api}/soporte/bitacora`).subscribe({ next: (b) => this.bitacora.set(b) });
    }
  }

  // ------------------------------------------------------------------ restaurantes

  cargarDuenos(): void {
    this.cargando.set(true);
    this.http.get<Dueno[]>(`${this.api}/creators`).subscribe({
      next: (d) => {
        this.duenos.set(d);
        this.cargando.set(false);
      },
      error: (err) => {
        this.cargando.set(false);
        this.error.set(this.mensaje(err, 'No se pudieron cargar los restaurantes.'));
      },
    });
  }

  /** Abre la sesión, elige ese restaurante en la barra y lleva a sus mesas. */
  entrarEnSoporte(d: Dueno): void {
    if (!d.restaurantId) return;
    this.ocupado.set(d.userId);
    this.soporte.abrir(d.restaurantId, this.motivo().trim()).subscribe({
      next: () => {
        this.ocupado.set(null);
        this.entrandoA.set(null);
        this.motivo.set('');
        this.irAlRestaurante(d.restaurantId!);
      },
      error: (err) => {
        this.ocupado.set(null);
        this.avisos.error(this.mensaje(err, 'No se pudo abrir la sesión de soporte.'));
      },
    });
  }

  irAlRestaurante(restaurantId: string): void {
    this.sucursal.elegirRestaurante(restaurantId);
    this.router.navigateByUrl('/dashboard');
  }

  async alternarActivo(d: Dueno): Promise<void> {
    const desactivar = d.active;
    const ok = await this.avisos.confirmar({
      titulo: `¿${desactivar ? 'Desactivar' : 'Activar'} ${d.restaurantName || d.username}?`,
      mensaje: desactivar
        ? 'El dueño, sus empleados y sus sucursales dejan de poder entrar y recibir pedidos hasta que lo actives de nuevo.'
        : 'El dueño y sus sucursales vuelven a poder entrar y recibir pedidos.',
      confirmar: desactivar ? 'Desactivar' : 'Activar',
      peligro: desactivar,
    });
    if (!ok) return;
    this.reemplazar(d, this.http.patch<Dueno>(`${this.api}/creators/${d.userId}/toggle`, {}));
  }

  async alternarDemo(d: Dueno): Promise<void> {
    if (!d.restaurantId) return;
    const ok = await this.avisos.confirmar({
      titulo: d.isDemo ? `¿Quitar ${d.restaurantName} de la demo?` : `¿Usar ${d.restaurantName} como demo?`,
      mensaje: d.isDemo
        ? 'Vuelve a comportarse como un restaurante normal.'
        : 'En una cuenta demo no se pueden agregar empleados ni cambiar roles, y se puede reiniciar desde aquí.',
      confirmar: d.isDemo ? 'Quitar demo' : 'Marcar demo',
    });
    if (!ok) return;
    this.reemplazar(d, this.http.patch<Dueno>(`${this.api}/creators/restaurants/${d.restaurantId}/demo/toggle`, {}));
  }

  async reiniciarDemo(): Promise<void> {
    const ok = await this.avisos.confirmar({
      titulo: '¿Reiniciar la cuenta demo?',
      mensaje: 'Se borra todo lo que se hizo en la demo y queda como recién creada. No se puede deshacer.',
      confirmar: 'Reiniciar demo',
      peligro: true,
    });
    if (!ok) return;
    this.reiniciando.set(true);
    this.http.post<{ message: string }>(`${this.api}/creators/demo/reset`, {}).subscribe({
      next: (r) => {
        this.reiniciando.set(false);
        this.avisos.exito(r.message || 'Demo reiniciada.');
        this.cargarDuenos();
      },
      error: (err) => {
        this.reiniciando.set(false);
        this.avisos.error(this.mensaje(err, 'No se pudo reiniciar la demo.'));
      },
    });
  }

  async alternarAsistente(d: Dueno): Promise<void> {
    const rid = d.restaurantId;
    if (!rid) return;
    const activar = !this.conAsistente().has(rid);
    const ok = await this.avisos.confirmar({
      titulo: `¿${activar ? 'Activar' : 'Quitar'} el asistente IA a ${d.restaurantName}?`,
      mensaje: activar
        ? 'El dueño podrá elegir su proveedor de IA, poner su llave y habilitarlo a su personal. Le llega un aviso.'
        : 'Dejan de poder usar el asistente y de recibir el resumen diario. Su configuración se conserva.',
      confirmar: activar ? 'Activar' : 'Quitar',
      peligro: !activar,
    });
    if (!ok) return;
    this.ocupado.set(d.userId);
    this.http.put<{ activo: boolean }>(`${this.api}/asistente/${rid}`, { activo: activar }).subscribe({
      next: (r) => {
        this.ocupado.set(null);
        this.conAsistente.update((s) => {
          const n = new Set(s);
          if (r.activo) n.add(rid);
          else n.delete(rid);
          return n;
        });
      },
      error: (err) => {
        this.ocupado.set(null);
        this.avisos.error(this.mensaje(err, 'No se pudo cambiar el asistente.'));
      },
    });
  }

  private reemplazar(d: Dueno, peticion: Observable<Dueno>): void {
    this.ocupado.set(d.userId);
    peticion.subscribe({
      next: (nuevo) => {
        this.ocupado.set(null);
        this.duenos.update((ds) => ds.map((x) => (x.userId === d.userId ? nuevo : x)));
      },
      error: (err) => {
        this.ocupado.set(null);
        this.avisos.error(this.mensaje(err, 'No se pudo cambiar.'));
      },
    });
  }

  // ------------------------------------------------------------------ renta

  cargarRenta(): void {
    this.http.get<ResumenRenta>(`${this.api}/renta/resumen`).subscribe({
      next: (r) => this.renta.set(r),
      error: (err) => this.avisos.error(this.mensaje(err, 'No se pudo cargar la renta.')),
    });
  }

  verHistorial(e: EstadoRenta): void {
    this.historialDe.set(e);
    this.cobros.set([]);
    this.http.get<Cobro[]>(`${this.api}/renta/cobros`, { params: { restaurante: e.restaurantId } }).subscribe({
      next: (c) => this.cobros.set(c),
      error: (err) => this.avisos.error(this.mensaje(err, 'No se pudo cargar el historial.')),
    });
  }

  /** El formulario de efectivo, con el mes de hoy como periodo propuesto. */
  nuevoEfectivo(e: EstadoRenta | null): void {
    const hoy = new Date();
    const desde = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const hasta = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
    this.efectivo = {
      restaurantId: e?.restaurantId ?? '',
      monto: e?.ultimoMonto ?? 0,
      periodoDesde: fecha(desde),
      periodoHasta: fecha(hasta),
      referencia: '',
      notas: '',
    };
    this.efectivoAbierto.set(true);
  }

  guardarEfectivo(): void {
    this.guardando.set(true);
    this.http.post<Cobro>(`${this.api}/renta/cobros/efectivo`, {
      ...this.efectivo,
      monto: Number(this.efectivo.monto),
      referencia: this.efectivo.referencia.trim() || null,
      notas: this.efectivo.notas.trim() || null,
    }).subscribe({
      next: () => {
        this.guardando.set(false);
        this.efectivoAbierto.set(false);
        this.avisos.exito('Pago registrado. Le avisamos al dueño.');
        this.cargarRenta();
      },
      error: (err) => {
        this.guardando.set(false);
        this.avisos.error(this.mensaje(err, 'No se pudo registrar el pago.'));
      },
    });
  }

  async anular(c: Cobro): Promise<void> {
    const motivo = prompt('¿Por qué se anula este pago? (queda en el historial)');
    if (!motivo || !motivo.trim()) return;
    this.http.patch<Cobro>(`${this.api}/renta/cobros/${c.id}/anular`, { motivo: motivo.trim() }).subscribe({
      next: (anulado) => {
        this.cobros.update((cs) => cs.map((x) => (x.id === c.id ? anulado : x)));
        this.cargarRenta();
      },
      error: (err) => this.avisos.error(this.mensaje(err, 'No se pudo anular.')),
    });
  }

  private mensaje(err: any, otro: string): string {
    return err?.error?.error || err?.error?.message || otro;
  }
}

/** yyyy-MM-dd en la hora local, para los campos de fecha. */
function fecha(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}
