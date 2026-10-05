import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { SoporteService } from '../../core/services/soporte.service';
import { SucursalActivaService } from '../../core/services/sucursal-activa.service';
import { AvisosService } from '../../core/services/avisos.service';

/**
 * La franja del modo soporte, arriba de cada pantalla del operador cuando ve
 * un restaurante. Sin sesión pide el motivo para abrirla; con sesión dice si
 * es solo lectura y deja usar el código del dueño o terminar.
 */
@Component({
  selector: 'app-franja-soporte',
  standalone: true,
  imports: [FormsModule, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visible()) {
      @let s = soporte.sesion();
      @if (s && s.restaurantId === restauranteId()) {
        <div class="shrink-0 px-4 sm:px-6 py-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs border-b"
          [class]="soporte.puedeCambiar() ? 'bg-amber-500/15 border-amber-500/40 text-amber-100' : 'bg-indigo-500/15 border-indigo-500/40 text-indigo-100'"
          role="status">
          <p class="font-bold">
            Modo soporte · {{ s.restaurante }} ·
            {{ soporte.puedeCambiar() ? 'Cambios permitidos hasta las ' + (s.cambiosHasta | date: 'HH:mm') : 'Solo lectura' }}
          </p>
          <p class="opacity-80 truncate max-w-md">Motivo: {{ s.motivo }}</p>
          <div class="ml-auto flex items-center gap-2">
            @if (!soporte.puedeCambiar()) {
              <input type="text" inputmode="numeric" maxlength="6" [ngModel]="codigo()" (ngModelChange)="codigo.set($event)"
                placeholder="Código del dueño" aria-label="Código de autorización del dueño"
                class="w-32 bg-slate-950/60 border border-slate-700 rounded-lg px-2 py-1 text-white tracking-widest outline-none focus:border-amber-400" />
              <button type="button" (click)="autorizar()" [disabled]="codigo().length !== 6 || enviando()"
                class="px-3 py-1 rounded-lg bg-amber-500 text-slate-950 font-bold cursor-pointer disabled:opacity-40">
                Habilitar cambios
              </button>
            }
            <button type="button" (click)="terminar()" [disabled]="enviando()"
              class="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold cursor-pointer">
              Terminar soporte
            </button>
          </div>
        </div>
      } @else if (restauranteId()) {
        <div class="shrink-0 px-4 sm:px-6 py-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs bg-slate-800/60 border-b border-slate-700 text-slate-200" role="status">
          @if (s) {
            <p>Tu sesión de soporte es de <strong>{{ s.restaurante }}</strong>.</p>
            <button type="button" (click)="volver(s.restaurantId)" class="font-bold text-indigo-300 hover:text-indigo-200 cursor-pointer">Volver a {{ s.restaurante }}</button>
            <span class="opacity-60">o abre una aquí:</span>
          } @else {
            <p>Para ver los datos de <strong>{{ sucursal.restaurante()?.name }}</strong> abre una sesión de soporte. El dueño recibe un aviso.</p>
          }
          <div class="ml-auto flex items-center gap-2 w-full sm:w-auto">
            <input type="text" maxlength="300" [ngModel]="motivo()" (ngModelChange)="motivo.set($event)"
              placeholder="Motivo (ej. no le llegan pedidos)" aria-label="Motivo de la revisión"
              class="flex-1 sm:w-72 bg-slate-950/60 border border-slate-700 rounded-lg px-2 py-1 text-white outline-none focus:border-indigo-400" />
            <button type="button" (click)="abrir()" [disabled]="motivo().trim().length < 5 || enviando()"
              class="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold cursor-pointer disabled:opacity-40">
              Abrir sesión
            </button>
          </div>
        </div>
      }
    }
  `,
})
export class FranjaSoporteComponent {
  readonly soporte = inject(SoporteService);
  readonly sucursal = inject(SucursalActivaService);
  private readonly avisos = inject(AvisosService);
  private readonly router = inject(Router);

  readonly motivo = signal('');
  readonly codigo = signal('');
  readonly enviando = signal(false);

  private readonly ruta = toSignal(
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd), map(() => this.router.url)),
    { initialValue: this.router.url },
  );

  readonly restauranteId = computed(() => this.sucursal.restaurantId());

  /** Solo para el operador y fuera de Plataforma y Super Admin, que no son de un restaurante. */
  readonly visible = computed(() => {
    if (!this.soporte.esOperador()) return false;
    const ruta = this.ruta();
    return !ruta.startsWith('/system') && !ruta.startsWith('/admin');
  });

  abrir(): void {
    const restaurantId = this.restauranteId();
    if (!restaurantId) return;
    this.enviando.set(true);
    this.soporte.abrir(restaurantId, this.motivo().trim()).subscribe({
      next: () => {
        this.enviando.set(false);
        this.motivo.set('');
        // Las pantallas ya pidieron sus datos sin sesión: se recargan con ella.
        window.location.reload();
      },
      error: (err) => {
        this.enviando.set(false);
        this.avisos.error(err.error?.error || err.error?.message || 'No se pudo abrir la sesión de soporte.');
      },
    });
  }

  autorizar(): void {
    this.enviando.set(true);
    this.soporte.autorizar(this.codigo().trim()).subscribe({
      next: () => {
        this.enviando.set(false);
        this.codigo.set('');
        this.avisos.exito('Cambios habilitados por 30 minutos.');
      },
      error: (err) => {
        this.enviando.set(false);
        this.avisos.error(err.error?.error || err.error?.message || 'El código no es válido.');
      },
    });
  }

  terminar(): void {
    this.enviando.set(true);
    this.soporte.terminar().subscribe({
      next: () => {
        this.enviando.set(false);
        this.router.navigateByUrl('/system');
      },
      error: () => this.enviando.set(false),
    });
  }

  volver(restaurantId: string): void {
    this.sucursal.elegirRestaurante(restaurantId);
    window.location.reload();
  }
}
