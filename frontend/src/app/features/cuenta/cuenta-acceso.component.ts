import {
  Component,
  ChangeDetectionStrategy,
  signal,
  computed,
  inject,
  OnInit,
  DestroyRef,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CuentaService, TipoCuenta } from './cuenta.service';
import {
  LucideUser,
  LucideBike,
  LucideTriangleAlert,
  LucideCheckCircle,
  LucideArrowLeft,
} from '@lucide/angular';

/** Los tres momentos de esta pantalla. */
type Modo = 'entrar' | 'crear' | 'recuperar';

/**
 * Entrar, crear cuenta o recuperar la contraseña. Una sola pantalla porque el
 * usuario no sabe de antemano cuál necesita: llega con su teléfono y desde
 * aquí resuelve cualquiera de las tres.
 */
@Component({
  selector: 'app-cuenta-acceso',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    LucideUser,
    LucideBike,
    LucideTriangleAlert,
    LucideCheckCircle,
    LucideArrowLeft,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-stone-50 text-stone-900 [color-scheme:light]">
      <div class="max-w-md mx-auto px-4 py-10">
        <h1 class="text-2xl font-bold text-center">
          {{ modo() === 'entrar' ? 'Entra a tu cuenta' : modo() === 'crear' ? 'Crea tu cuenta' : 'Recupera tu acceso' }}
        </h1>
        <p class="text-sm text-stone-600 text-center mt-2">
          {{
            modo() === 'entrar'
              ? 'Con tu WhatsApp y tu contraseña.'
              : modo() === 'crear'
                ? 'Te mandamos un código por WhatsApp para confirmar que el número es tuyo.'
                : 'Te mandamos un código por WhatsApp para poner una contraseña nueva.'
          }}
        </p>

        <!-- Quién eres: cambia qué historial verás -->
        <div class="mt-8 grid grid-cols-2 gap-2" role="group" aria-label="Tipo de cuenta">
          <button
            (click)="tipo.set('CLIENTE')"
            class="flex items-center justify-center gap-2 py-3 rounded-xl border-2 text-sm font-semibold transition-colors cursor-pointer"
            [class]="tipo() === 'CLIENTE' ? 'border-orange-600 bg-orange-50 text-orange-800' : 'border-stone-200 bg-white text-stone-500'"
          >
            <svg lucideUser class="w-4 h-4"></svg>
            Soy cliente
          </button>
          <button
            (click)="tipo.set('REPARTIDOR')"
            class="flex items-center justify-center gap-2 py-3 rounded-xl border-2 text-sm font-semibold transition-colors cursor-pointer"
            [class]="tipo() === 'REPARTIDOR' ? 'border-indigo-600 bg-indigo-50 text-indigo-800' : 'border-stone-200 bg-white text-stone-500'"
          >
            <svg lucideBike class="w-4 h-4"></svg>
            Soy repartidor
          </button>
        </div>

        <div class="mt-6 bg-white border border-stone-200 rounded-2xl p-5 space-y-4">
          <div>
            <label for="ca-tel" class="block text-xs font-semibold text-stone-600 mb-1.5">Tu WhatsApp</label>
            <div class="flex items-stretch border border-stone-300 rounded-lg focus-within:border-orange-500 overflow-hidden">
              <span class="px-3 flex items-center text-sm text-stone-500 bg-stone-100 border-r border-stone-300" aria-hidden="true">+52</span>
              <input id="ca-tel" type="tel" inputmode="tel" autocomplete="tel-national"
                [ngModel]="telefono()" (ngModelChange)="telefono.set($event)"
                placeholder="55 1234 5678" aria-describedby="ca-tel-ayuda"
                class="flex-1 min-w-0 px-3 py-2.5 text-sm outline-none bg-white" />
            </div>
            <p id="ca-tel-ayuda" class="text-xs text-stone-500 mt-1.5">Los 10 dígitos de tu celular.</p>
          </div>

          @if (modo() !== 'entrar') {
            <!-- Código: solo tiene sentido cuando ya se pidió -->
            <div>
              <label for="ca-codigo" class="block text-xs font-semibold text-stone-600 mb-1.5">
                Código que te llegó por WhatsApp
              </label>
              <div class="flex gap-2">
                <input id="ca-codigo" type="text" inputmode="numeric" maxlength="10"
                  [ngModel]="codigo()" (ngModelChange)="codigo.set($event)"
                  placeholder="6 dígitos"
                  class="flex-1 min-w-0 border border-stone-300 rounded-lg px-3 py-2.5 text-sm tabular-nums tracking-widest outline-none focus:border-orange-500" />
                <button
                  (click)="pedirCodigo()"
                  [disabled]="!telefonoValido() || enviandoCodigo() || esperaReenvio() > 0"
                  class="shrink-0 px-3 py-2.5 rounded-lg text-xs font-bold bg-stone-900 text-white hover:bg-stone-800 cursor-pointer disabled:bg-stone-300 disabled:cursor-not-allowed"
                >
                  {{ enviandoCodigo() ? 'Enviando...'
                    : esperaReenvio() > 0 ? 'Reenviar en ' + esperaReenvio() + 's'
                    : codigoPedido() ? 'Reenviar' : 'Enviar código' }}
                </button>
              </div>
              @if (codigoPedido()) {
                <p class="text-[11px] text-stone-500 mt-1.5">Vence en 10 minutos. Revisa tu WhatsApp.</p>
              }
            </div>
          }

          @if (modo() === 'crear') {
            <div>
              <label for="ca-nombre" class="block text-xs font-semibold text-stone-600 mb-1.5">Tu nombre</label>
              <input id="ca-nombre" type="text" autocomplete="name"
                [ngModel]="nombre()" (ngModelChange)="nombre.set($event)"
                class="w-full border border-stone-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-orange-500" />
            </div>
          }

          <div>
            <label for="ca-pass" class="block text-xs font-semibold text-stone-600 mb-1.5">
              {{ modo() === 'entrar' ? 'Tu contraseña' : 'Contraseña nueva' }}
            </label>
            <input id="ca-pass" type="password"
              [attr.autocomplete]="modo() === 'entrar' ? 'current-password' : 'new-password'"
              [ngModel]="password()" (ngModelChange)="password.set($event)"
              class="w-full border border-stone-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-orange-500" />
            @if (modo() !== 'entrar') {
              <p class="text-[11px] text-stone-500 mt-1.5">Al menos 8 caracteres.</p>
            }
          </div>

          @if (error()) {
            <p class="flex items-start gap-2 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-3">
              <svg lucideTriangleAlert class="w-4 h-4 shrink-0 mt-0.5"></svg>
              <span>{{ error() }}</span>
            </p>
          }
          @if (aviso()) {
            <p class="flex items-start gap-2 text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
              <svg lucideCheckCircle class="w-4 h-4 shrink-0 mt-0.5"></svg>
              <span>{{ aviso() }}</span>
            </p>
          }

          <button
            (click)="enviar()"
            [disabled]="motivoBloqueo() !== null || enviando()"
            class="w-full bg-orange-600 text-white rounded-xl py-3 font-bold text-sm hover:bg-orange-700 transition-colors cursor-pointer disabled:bg-stone-300 disabled:text-stone-500 disabled:cursor-not-allowed"
          >
            {{
              enviando()
                ? 'Un momento...'
                : modo() === 'entrar' ? 'Entrar' : modo() === 'crear' ? 'Crear cuenta' : 'Cambiar contraseña'
            }}
          </button>

          @if (motivoBloqueo(); as motivo) {
            <p class="text-[11px] text-stone-500 text-center">{{ motivo }}</p>
          }
        </div>

        <!-- Cambiar de modo -->
        <div class="mt-6 text-center text-sm space-y-2">
          @if (modo() === 'entrar') {
            <p>
              <button (click)="cambiarModo('crear')" class="text-orange-700 underline underline-offset-4 cursor-pointer">
                No tengo cuenta
              </button>
            </p>
            <p>
              <button (click)="cambiarModo('recuperar')" class="text-stone-500 underline underline-offset-4 cursor-pointer">
                Olvidé mi contraseña
              </button>
            </p>
          } @else {
            <button (click)="cambiarModo('entrar')" class="inline-flex items-center gap-1.5 text-stone-600 underline underline-offset-4 cursor-pointer">
              <svg lucideArrowLeft class="w-3.5 h-3.5"></svg>
              Ya tengo cuenta
            </button>
          }
        </div>

        @if (branchId()) {
          <p class="mt-8 text-center text-xs text-stone-400">
            <a [routerLink]="['/pedir', branchId()]" class="underline underline-offset-4">Volver al menú</a>
          </p>
        }
      </div>
    </div>
  `,
})
export class CuentaAccesoComponent implements OnInit {
  private readonly cuentaService = inject(CuentaService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  /** Igual a la espera que exige el servidor entre un código y otro. */
  private static readonly SEGUNDOS_PARA_REENVIAR = 60;
  private temporizador: ReturnType<typeof setInterval> | null = null;

  readonly branchId = signal('');
  readonly modo = signal<Modo>('entrar');
  readonly tipo = signal<TipoCuenta>('CLIENTE');

  readonly telefono = signal('');
  readonly codigo = signal('');
  readonly nombre = signal('');
  readonly password = signal('');

  readonly enviando = signal(false);
  readonly enviandoCodigo = signal(false);
  readonly codigoPedido = signal(false);
  /**
   * Segundos que faltan para poder pedir otro código. El servidor rechaza el
   * reenvío antes de un minuto; mejor que el botón lo diga a que falle.
   */
  readonly esperaReenvio = signal(0);
  readonly error = signal<string | null>(null);
  readonly aviso = signal<string | null>(null);

  readonly telefonoValido = computed(() => this.telefono().replace(/\D/g, '').length >= 10);

  /**
   * Por qué todavía no se puede enviar. Se devuelve el motivo en vez de un
   * booleano para poder decírselo: un botón gris sin explicación es lo que
   * hace a la gente abandonar un formulario.
   */
  readonly motivoBloqueo = computed<string | null>(() => {
    if (!this.telefonoValido()) return 'Escribe los 10 dígitos de tu celular.';
    if (this.modo() !== 'entrar' && this.codigo().trim().length < 4) {
      return 'Falta el código que te llegó por WhatsApp.';
    }
    if (this.modo() === 'entrar' && this.password().length === 0) return 'Escribe tu contraseña.';
    if (this.modo() !== 'entrar' && this.password().length < 8) {
      return 'La contraseña necesita al menos 8 caracteres.';
    }
    return null;
  });

  ngOnInit(): void {
    this.destroyRef.onDestroy(() => this.detenerCuenta());

    this.branchId.set(this.route.snapshot.paramMap.get('branchId') ?? '');

    const tipoUrl = this.route.snapshot.queryParamMap.get('tipo');
    if (tipoUrl === 'REPARTIDOR' || tipoUrl === 'CLIENTE') {
      this.tipo.set(tipoUrl);
    }

    // Si ya hay sesión abierta no tiene sentido pedirla otra vez.
    if (this.cuentaService.haIniciado()) {
      this.router.navigate(['/mi-cuenta', this.branchId()]);
    }
  }

  cambiarModo(modo: Modo): void {
    this.modo.set(modo);
    this.error.set(null);
    this.aviso.set(null);
  }

  pedirCodigo(): void {
    if (!this.telefonoValido() || this.enviandoCodigo()) return;

    this.enviandoCodigo.set(true);
    this.error.set(null);

    this.cuentaService.solicitarCodigo(this.branchId(), this.tipo(), this.telefono().trim()).subscribe({
      next: (r) => {
        this.enviandoCodigo.set(false);
        this.codigoPedido.set(true);
        this.aviso.set(r.message);
        this.iniciarCuentaRegresiva();
      },
      error: (err) => {
        this.enviandoCodigo.set(false);
        this.error.set(err.error?.error || 'No pudimos enviar el código. Intenta de nuevo.');
      },
    });
  }

  private iniciarCuentaRegresiva(): void {
    this.detenerCuenta();
    this.esperaReenvio.set(CuentaAccesoComponent.SEGUNDOS_PARA_REENVIAR);
    this.temporizador = setInterval(() => {
      const quedan = this.esperaReenvio() - 1;
      this.esperaReenvio.set(Math.max(quedan, 0));
      if (quedan <= 0) this.detenerCuenta();
    }, 1000);
  }

  private detenerCuenta(): void {
    if (this.temporizador !== null) {
      clearInterval(this.temporizador);
      this.temporizador = null;
    }
  }

  enviar(): void {
    if (this.motivoBloqueo() !== null || this.enviando()) return;

    this.enviando.set(true);
    this.error.set(null);
    this.aviso.set(null);

    if (this.modo() === 'entrar') {
      this.cuentaService
        .iniciarSesion(this.branchId(), this.tipo(), this.telefono().trim(), this.password())
        .subscribe({
          next: () => this.entrar(),
          error: (err) => this.fallo(err),
        });
      return;
    }

    const cuerpo = {
      tipo: this.tipo(),
      phoneNumber: this.telefono().trim(),
      codigo: this.codigo().trim(),
      password: this.password(),
      nombre: this.nombre().trim() || null,
    };

    if (this.modo() === 'crear') {
      this.cuentaService.registrar(this.branchId(), cuerpo).subscribe({
        next: () => this.entrar(),
        error: (err) => this.fallo(err),
      });
    } else {
      this.cuentaService.restablecer(this.branchId(), cuerpo).subscribe({
        next: () => {
          this.enviando.set(false);
          this.modo.set('entrar');
          this.codigo.set('');
          this.codigoPedido.set(false);
          this.aviso.set('Tu contraseña quedó lista. Ya puedes entrar.');
        },
        error: (err) => this.fallo(err),
      });
    }
  }

  private entrar(): void {
    this.enviando.set(false);
    this.router.navigate(['/mi-cuenta', this.branchId()]);
  }

  private fallo(err: { error?: { error?: string } }): void {
    this.enviando.set(false);
    this.error.set(err.error?.error || 'No pudimos completar la operación. Intenta de nuevo.');
  }
}
