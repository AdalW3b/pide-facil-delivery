import {
  ChangeDetectionStrategy, Component, DestroyRef, ElementRef, OnInit, computed, inject, input, output, signal, viewChild,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { PesosPipe } from '../../shared/utils/pesos';

/** Lo que manda el servidor al crear un pedido con tarjeta. */
export interface PagoEnLinea {
  transaccionId: string;
  clientSecret: string;
  llavePublica: string;
  cuenta: string;
  monto: number;
  expiraEn: string;
}

/** Cómo va el pago según el servidor (que le pregunta a Stripe). */
export interface EstadoPago {
  estado: 'PENDIENTE' | 'PROCESANDO' | 'PAGADO' | 'FALLIDO' | 'CANCELADO' | 'REEMBOLSADO' | 'REEMBOLSO_PARCIAL';
  mensaje: string | null;
  marca: string | null;
  ultimos4: string | null;
}

/* Stripe.js se carga de js.stripe.com (no se puede empaquetar): los datos de la
   tarjeta van del navegador a Stripe y nunca pasan por Pide Fácil. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type StripeJs = any;
declare global {
  interface Window { Stripe?: (llave: string, opciones?: object) => StripeJs; }
}

let cargandoStripe: Promise<void> | null = null;

function cargarStripe(): Promise<void> {
  if (window.Stripe) return Promise.resolve();
  cargandoStripe ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://js.stripe.com/v3/';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => { cargandoStripe = null; reject(new Error('stripe')); };
    document.head.appendChild(s);
  });
  return cargandoStripe;
}

/**
 * El paso de pagar con tarjeta del menú en línea. El pedido ya existe, pero
 * nadie lo ve hasta que Stripe confirma el pago; aquí se espera esa
 * confirmación del servidor, no basta con que el navegador diga "listo".
 */
@Component({
  selector: 'app-pago-tarjeta',
  standalone: true,
  imports: [PesosPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="max-w-md mx-auto px-4 py-10">
      <h1 class="text-2xl font-bold">Paga tu pedido</h1>
      <p class="text-sm text-stone-600 mt-1">
        Total: <strong class="tabular-nums text-stone-900">{{ pago().monto | pesos }}</strong>
        @if (minutosRestantes() !== null) {
          · tienes {{ minutosRestantes() }} min para pagar
        }
      </p>

      <div class="mt-6 bg-white border border-stone-200 rounded-2xl p-4">
        @if (cargando()) {
          <p class="text-sm text-stone-500 py-6 text-center">Cargando el formulario de pago…</p>
        }
        <div #formulario [class.hidden]="cargando() || esperando()"></div>

        @if (esperando()) {
          <div class="py-8 text-center space-y-2" role="status">
            <div class="w-8 h-8 mx-auto rounded-full border-4 border-orange-200 border-t-orange-600 animate-spin"></div>
            <p class="text-sm font-semibold">Confirmando tu pago…</p>
            <p class="text-xs text-stone-500">{{ mensajeEspera() }}</p>
          </div>
        }
      </div>

      @if (error()) {
        <p class="mt-3 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-3" role="alert">{{ error() }}</p>
      }

      @if (!esperando()) {
        <button type="button" (click)="pagar()" [disabled]="cargando() || pagando() || vencido()"
          class="mt-4 w-full bg-orange-600 text-white rounded-xl py-3.5 font-bold text-sm hover:bg-orange-700 cursor-pointer disabled:bg-stone-300 disabled:text-stone-500 disabled:cursor-not-allowed">
          {{ pagando() ? 'Procesando…' : 'Pagar ' + (pago().monto | pesos) }}
        </button>
        <button type="button" (click)="cancelar.emit()" [disabled]="pagando()"
          class="mt-3 w-full text-sm text-stone-600 underline underline-offset-4 hover:text-stone-900 cursor-pointer">
          Volver a mi pedido
        </button>
        <p class="mt-4 text-[11px] text-stone-500 text-center">
          Pago seguro procesado por Stripe. El restaurante no ve los datos de tu tarjeta.
        </p>
      }
    </div>
  `,
})
export class PagoTarjetaComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);

  readonly pago = input.required<PagoEnLinea>();
  /** Base de la API pública (local o la del dominio público). */
  readonly api = input.required<string>();
  /** Al volver de una verificación del banco: solo falta esperar la confirmación. */
  readonly soloEsperar = input(false);

  readonly pagado = output<EstadoPago>();
  readonly cancelar = output<void>();

  private readonly formulario = viewChild.required<ElementRef<HTMLElement>>('formulario');

  readonly cargando = signal(true);
  readonly pagando = signal(false);
  readonly esperando = signal(false);
  readonly error = signal<string | null>(null);
  readonly mensajeEspera = signal('Esto toma unos segundos.');
  private readonly ahora = signal(Date.now());

  readonly minutosRestantes = computed(() => {
    const fin = new Date(this.pago().expiraEn).getTime();
    if (isNaN(fin)) return null;
    return Math.max(0, Math.ceil((fin - this.ahora()) / 60000));
  });
  readonly vencido = computed(() => this.minutosRestantes() === 0);

  private stripe: StripeJs = null;
  private elements: StripeJs = null;
  private reloj?: ReturnType<typeof setInterval>;
  private consulta?: ReturnType<typeof setTimeout>;

  ngOnInit(): void {
    this.reloj = setInterval(() => this.ahora.set(Date.now()), 15000);
    this.destroyRef.onDestroy(() => { clearInterval(this.reloj); clearTimeout(this.consulta); });

    if (this.soloEsperar()) {
      this.cargando.set(false);
      this.esperarConfirmacion();
      return;
    }
    cargarStripe().then(() => this.montar()).catch(() => {
      this.cargando.set(false);
      this.error.set('No se pudo cargar el formulario de pago. Revisa tu conexión y recarga la página.');
    });
  }

  private montar(): void {
    const p = this.pago();
    this.stripe = window.Stripe!(p.llavePublica, { stripeAccount: p.cuenta, locale: 'es-419' });
    this.elements = this.stripe.elements({
      clientSecret: p.clientSecret,
      appearance: { theme: 'stripe', variables: { colorPrimary: '#ea580c', borderRadius: '10px' } },
    });
    const elemento = this.elements.create('payment', { layout: 'tabs' });
    elemento.on('ready', () => this.cargando.set(false));
    elemento.mount(this.formulario().nativeElement);
  }

  async pagar(): Promise<void> {
    if (!this.stripe || this.pagando()) return;
    this.pagando.set(true);
    this.error.set(null);
    const regreso = new URL(window.location.href);
    regreso.searchParams.set('pago', this.pago().transaccionId);
    try {
      const r = await this.stripe.confirmPayment({
        elements: this.elements,
        // Con tarjeta la verificación del banco abre en una ventana encima; solo
        // algunos bancos sacan de la página y regresan a esta dirección.
        redirect: 'if_required',
        confirmParams: { return_url: regreso.toString() },
      });
      if (r.error) {
        // Tarjeta rechazada o datos incompletos: el mensaje de Stripe ya viene en español.
        this.error.set(r.error.message ?? 'No se pudo cobrar la tarjeta. Prueba con otra.');
        this.pagando.set(false);
        return;
      }
      this.esperarConfirmacion();
    } catch {
      this.error.set('Se perdió la conexión. Revisa tu internet e intenta de nuevo: no se te cobrará dos veces.');
      this.pagando.set(false);
    }
  }

  /** El servidor dice "pagado" solo cuando Stripe lo confirma. */
  private esperarConfirmacion(intento = 0): void {
    this.esperando.set(true);
    this.http.get<EstadoPago>(`${this.api()}/public/pagos-linea/${this.pago().transaccionId}`).subscribe({
      next: (e) => {
        if (e.estado === 'PAGADO') {
          this.pagado.emit(e);
          return;
        }
        if (e.estado === 'FALLIDO' || e.estado === 'CANCELADO') {
          this.esperando.set(false);
          this.pagando.set(false);
          this.error.set(e.mensaje ?? 'No se pudo cobrar la tarjeta.');
          return;
        }
        if (e.estado === 'PROCESANDO') this.mensajeEspera.set(e.mensaje ?? 'Tu banco está procesando el pago.');
        this.siguiente(intento);
      },
      error: () => this.siguiente(intento),
    });
  }

  private siguiente(intento: number): void {
    if (intento >= 90) {
      this.mensajeEspera.set('Está tardando más de lo normal. Te avisamos por WhatsApp en cuanto se confirme.');
    }
    // Cada 2 s el primer minuto; luego cada 5 s.
    this.consulta = setTimeout(() => this.esperarConfirmacion(intento + 1), intento < 30 ? 2000 : 5000);
  }
}
