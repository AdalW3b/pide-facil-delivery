import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  LucideCircleCheck, LucideExternalLink, LucideLoader2, LucideRefreshCw, LucideTriangleAlert, LucideUnlink,
} from '@lucide/angular';
import { AvisosService } from '../../core/services/avisos.service';
import {
  AjustesPagosLinea, EstadoPagosLinea, MovimientoPagosLinea, PagosLineaService,
} from '../../core/services/pagos-linea.service';
import { TituloPaginaComponent } from '../../shared/components/titulo-pagina.component';

/** Lo que dice cada acción de la bitácora, en palabras del dueño. */
const ACCIONES: Record<string, string> = {
  CONECTAR: 'Conexión', DESCONECTAR: 'Desconexión', ESTADO_CUENTA: 'Stripe', ACTIVAR: 'Activado',
  DESACTIVAR: 'Desactivado', CONFIGURAR: 'Formas de pago', COMISION: 'Comisión', REEMBOLSO: 'Reembolso',
};

/**
 * El dueño conecta la cuenta de Stripe del restaurante (Stripe Connect) para
 * que sus clientes paguen con tarjeta en el menú en línea. El dinero llega
 * directo a su cuenta; Pide Fácil no guarda tarjetas.
 */
@Component({
  selector: 'app-pagos-linea-settings',
  standalone: true,
  imports: [DatePipe, TituloPaginaComponent, LucideLoader2, LucideExternalLink, LucideRefreshCw, LucideUnlink,
    LucideCircleCheck, LucideTriangleAlert],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6 text-slate-100 p-2 sm:p-4 max-w-4xl">
      <app-titulo-pagina titulo="Pagos en línea"
        descripcion="Que tus clientes paguen con tarjeta al pedir desde tu menú en línea. El dinero llega directo a tu cuenta de Stripe." />

      @if (cargando()) {
        <div class="flex items-center gap-2 text-sm text-slate-400"><svg lucideLoader2 class="w-4 h-4 animate-spin"></svg> Cargando…</div>
      } @else if (estado(); as e) {

        @if (!e.servidorListo) {
          <p class="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200" role="alert">
            Los pagos en línea todavía no están disponibles en el sistema. Avísale a soporte de Pide Fácil.
          </p>
        }

        <!-- Conexión con Stripe -->
        <section class="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 space-y-4">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div class="space-y-1 min-w-0">
              <p class="text-sm font-bold text-white">Tu cuenta de Stripe</p>
              <p class="text-xs text-slate-400">Stripe procesa las tarjetas y te deposita en tu banco. Ahí ves tus depósitos, reembolsos y disputas.</p>
            </div>
            <span class="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold" [class]="claseEstado()">
              @if (e.estadoCuenta === 'LISTA') { <svg lucideCircleCheck class="w-3.5 h-3.5"></svg> }
              @if (e.estadoCuenta === 'DETENIDA') { <svg lucideTriangleAlert class="w-3.5 h-3.5"></svg> }
              {{ textoEstado() }}
            </span>
          </div>

          @if (e.conectada) {
            <dl class="grid gap-3 sm:grid-cols-3 text-sm">
              <div><dt class="text-xs text-slate-500">Cuenta</dt><dd class="font-mono text-slate-200">{{ e.cuenta }}</dd></div>
              <div><dt class="text-xs text-slate-500">Conectada</dt><dd class="text-slate-200">{{ e.conectadoEn | date: 'd MMM y' }}</dd></div>
              <div><dt class="text-xs text-slate-500">Modo</dt>
                <dd [class]="e.modoPrueba ? 'text-amber-300' : 'text-emerald-300'">{{ e.modoPrueba ? 'Prueba: sin dinero real' : 'Real' }}</dd></div>
            </dl>
          }

          @if (e.motivo) {
            <p class="rounded-lg px-3 py-2 text-sm"
              [class]="e.estadoCuenta === 'DETENIDA' ? 'border border-rose-500/40 bg-rose-500/10 text-rose-200' : 'border border-amber-500/40 bg-amber-500/10 text-amber-200'">
              {{ e.motivo }}
            </p>
          }

          @if (!e.conectada) {
            <ul class="text-sm text-slate-300 space-y-1.5 list-disc pl-5">
              <li>Si ya tienes cuenta de Stripe, inicia sesión y conéctala. Si no, la creas ahí mismo.</li>
              <li>Stripe te pedirá tu RFC, una identificación y la cuenta de banco donde quieres recibir el dinero.</li>
              <li>Stripe cobra su comisión por cada pago con tarjeta; se descuenta antes de depositarte.</li>
            </ul>
          }

          <div class="flex flex-wrap gap-3">
            @if (e.estadoCuenta !== 'LISTA') {
              <button type="button" (click)="conectar()" [disabled]="ocupado() || !e.servidorListo"
                class="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
                @if (ocupado() === 'conectar') { <svg lucideLoader2 class="w-4 h-4 animate-spin"></svg> } @else { <svg lucideExternalLink class="w-4 h-4"></svg> }
                {{ e.conectada ? 'Terminar el alta en Stripe' : 'Conectar con Stripe' }}
              </button>
            }
            @if (e.conectada) {
              <button type="button" (click)="sincronizar()" [disabled]="ocupado()"
                class="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-700 text-sm text-slate-200 hover:border-indigo-500 cursor-pointer disabled:opacity-50">
                <svg lucideRefreshCw class="w-4 h-4" [class.animate-spin]="ocupado() === 'sincronizar'"></svg>
                Probar conexión
              </button>
              <button type="button" (click)="desconectar()" [disabled]="ocupado()"
                class="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm text-rose-300 hover:bg-rose-500/10 cursor-pointer disabled:opacity-50">
                <svg lucideUnlink class="w-4 h-4"></svg> Desconectar
              </button>
            }
          </div>
        </section>

        <!-- Cobro en línea -->
        <section class="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 space-y-4">
          <label class="flex items-start justify-between gap-4 cursor-pointer" [class.opacity-60]="e.estadoCuenta !== 'LISTA' && !e.activo">
            <span class="space-y-1">
              <span class="block text-sm font-bold text-white">Cobrar con tarjeta en el menú en línea</span>
              <span class="block text-xs text-slate-400">
                @if (e.estadoCuenta === 'LISTA') {
                  El pedido entra a cocina en cuanto Stripe confirma el pago. Si el cliente no paga en 20 minutos, se cancela solo.
                } @else {
                  Se puede activar cuando tu cuenta de Stripe esté lista para cobrar.
                }
              </span>
            </span>
            <input type="checkbox" class="sr-only peer" [checked]="e.activo" (change)="activar($any($event.target).checked, $event)"
              [disabled]="ocupado() || (e.estadoCuenta !== 'LISTA' && !e.activo)" />
            <span aria-hidden="true"
              class="relative mt-1 h-6 w-11 shrink-0 rounded-full bg-slate-700 transition peer-checked:bg-emerald-500 peer-disabled:opacity-50 peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-400 after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-5"></span>
          </label>

          <fieldset class="space-y-2 border-t border-slate-800 pt-4">
            <legend class="text-sm font-bold text-white mb-1">Formas de pago que ve el cliente</legend>
            @for (f of formas; track f.campo) {
              <label class="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 cursor-pointer">
                <input type="checkbox" class="mt-0.5 w-5 h-5 accent-emerald-500 cursor-pointer" [checked]="e[f.campo]" [disabled]="ocupado()"
                  (change)="cambiarForma(f.campo, $any($event.target).checked, $event)" />
                <span>
                  <span class="block text-sm font-semibold text-white">{{ f.nombre }}</span>
                  <span class="block text-xs text-slate-400 mt-0.5">{{ f.detalle }}</span>
                </span>
              </label>
            }
          </fieldset>

          @if (e.comisionPlataformaPct > 0) {
            <p class="text-xs text-slate-400">
              Comisión de Pide Fácil por pago en línea: <b class="text-slate-200">{{ e.comisionPlataformaPct }}%</b>, según tu contrato. Se descuenta sola de cada pago, aparte de la comisión de Stripe.
            </p>
          }
        </section>

        <!-- Bitácora -->
        @if (movimientos().length) {
          <section class="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 space-y-3">
            <p class="text-sm font-bold text-white">Historial de cambios</p>
            <ul class="divide-y divide-slate-800 text-sm">
              @for (m of movimientos(); track $index) {
                <li class="py-2 flex flex-wrap gap-x-3 gap-y-0.5">
                  <span class="text-xs text-slate-500 w-32 shrink-0">{{ m.en | date: 'd MMM, HH:mm' }}</span>
                  <span class="font-semibold text-slate-200">{{ accion(m.accion) }}</span>
                  <span class="text-slate-400 min-w-0 [overflow-wrap:anywhere]">{{ m.detalle }}</span>
                  @if (m.usuario) { <span class="text-xs text-slate-500">· {{ m.usuario }}</span> }
                </li>
              }
            </ul>
          </section>
        }
      } @else if (error()) {
        <p class="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-300" role="alert">{{ error() }}</p>
      }
    </div>
  `,
})
export class PagosLineaSettingsComponent {
  private readonly servicio = inject(PagosLineaService);
  private readonly avisos = inject(AvisosService);
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly estado = signal<EstadoPagosLinea | null>(null);
  readonly movimientos = signal<MovimientoPagosLinea[]>([]);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);
  readonly ocupado = signal<'conectar' | 'sincronizar' | 'guardar' | 'desconectar' | null>(null);

  readonly formas: { campo: 'aceptaTarjeta' | 'aceptaEfectivo' | 'aceptaEnTienda'; nombre: string; detalle: string }[] = [
    { campo: 'aceptaTarjeta', nombre: 'Tarjeta en línea', detalle: 'Paga al pedir, con tarjeta de crédito o débito. Solo aparece con el cobro en línea activado.' },
    { campo: 'aceptaEfectivo', nombre: 'Efectivo al recibir', detalle: 'Paga al repartidor o al recoger, como hoy.' },
    { campo: 'aceptaEnTienda', nombre: 'Pago en tienda', detalle: 'Paga en caja al recoger, con el método que quiera.' },
  ];

  readonly textoEstado = computed(() => {
    switch (this.estado()?.estadoCuenta) {
      case 'LISTA': return 'Lista para cobrar';
      case 'PENDIENTE': return 'Faltan datos en Stripe';
      case 'DETENIDA': return 'Cobros detenidos';
      default: return 'Sin conectar';
    }
  });

  readonly claseEstado = computed(() => {
    switch (this.estado()?.estadoCuenta) {
      case 'LISTA': return 'bg-emerald-500/15 text-emerald-300';
      case 'PENDIENTE': return 'bg-amber-500/15 text-amber-300';
      case 'DETENIDA': return 'bg-rose-500/15 text-rose-300';
      default: return 'bg-slate-700/60 text-slate-300';
    }
  });

  constructor() {
    const regreso = this.ruta.snapshot.queryParamMap.get('stripe');
    if (regreso) {
      // Se quita de la dirección para que recargar no repita lo de abajo.
      this.router.navigate([], { queryParams: {}, replaceUrl: true });
    }
    if (regreso === 'renovar') {
      // La liga de Stripe venció (son de un solo uso): se pide otra y se sigue.
      this.conectar();
    } else if (regreso === 'regreso') {
      this.sincronizar(true);
    } else {
      this.cargar();
    }
  }

  accion(a: string): string {
    return ACCIONES[a] ?? a;
  }

  cargar(): void {
    this.servicio.estado().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (e) => { this.estado.set(e); this.cargando.set(false); this.cargarBitacora(); },
      error: (err) => { this.error.set(this.mensaje(err)); this.cargando.set(false); },
    });
  }

  conectar(): void {
    this.ocupado.set('conectar');
    this.servicio.conectar().subscribe({
      next: ({ url }) => { window.location.href = url; },
      error: (err) => { this.ocupado.set(null); this.cargando.set(false); this.avisos.error(this.mensaje(err)); this.cargar(); },
    });
  }

  sincronizar(alRegresar = false): void {
    this.ocupado.set('sincronizar');
    this.servicio.sincronizar().subscribe({
      next: (e) => {
        this.estado.set(e);
        this.ocupado.set(null);
        this.cargando.set(false);
        this.cargarBitacora();
        if (e.estadoCuenta === 'LISTA') this.avisos.exito(alRegresar ? '¡Tu cuenta de Stripe está lista para cobrar!' : 'Conexión con Stripe correcta.');
        else if (!alRegresar) this.avisos.info('Stripe respondió. ' + (e.motivo ?? ''));
      },
      error: (err) => { this.ocupado.set(null); this.avisos.error(this.mensaje(err)); if (alRegresar) this.cargar(); },
    });
  }

  activar(si: boolean, evento: Event): void {
    this.guardar({ activo: si }, evento);
  }

  cambiarForma(campo: 'aceptaTarjeta' | 'aceptaEfectivo' | 'aceptaEnTienda', si: boolean, evento: Event): void {
    this.guardar({ [campo]: si }, evento);
  }

  async desconectar(): Promise<void> {
    const ok = await this.avisos.confirmar({
      titulo: '¿Desconectar tu cuenta de Stripe?',
      mensaje: 'Tus clientes ya no podrán pagar con tarjeta en el menú en línea. Tu cuenta y tu dinero siguen en Stripe; puedes volver a conectarla después.',
      confirmar: 'Desconectar',
      peligro: true,
    });
    if (!ok) return;
    this.ocupado.set('desconectar');
    this.servicio.desconectar().subscribe({
      next: (e) => { this.estado.set(e); this.ocupado.set(null); this.cargarBitacora(); this.avisos.exito('Cuenta de Stripe desconectada.'); },
      error: (err) => { this.ocupado.set(null); this.avisos.error(this.mensaje(err)); },
    });
  }

  private guardar(cambio: AjustesPagosLinea, evento: Event): void {
    const casilla = evento.target as HTMLInputElement;
    this.ocupado.set('guardar');
    this.servicio.ajustes(cambio).subscribe({
      next: (e) => { this.estado.set(e); this.ocupado.set(null); this.cargarBitacora(); this.avisos.exito('Guardado.'); },
      error: (err) => {
        // La casilla regresa a como estaba: no se guardó.
        casilla.checked = !casilla.checked;
        this.ocupado.set(null);
        this.avisos.error(this.mensaje(err));
      },
    });
  }

  private cargarBitacora(): void {
    this.servicio.bitacora().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (m) => this.movimientos.set(m),
      error: () => this.movimientos.set([]),
    });
  }

  private mensaje(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      return err.error?.message ?? err.error?.error ?? (typeof err.error === 'string' ? err.error : null)
        ?? 'No se pudo completar. Intenta de nuevo.';
    }
    return 'No se pudo completar. Intenta de nuevo.';
  }
}
