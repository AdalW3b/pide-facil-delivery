import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { LucideLoader2, LucideUpload, LucideTrash2, LucideRotateCcw } from '@lucide/angular';
import { Marca, MarcaService } from '../../core/services/marca.service';
import { TituloPaginaComponent } from '../../shared/components/titulo-pagina.component';
import { esColorValido } from '../../shared/utils/paleta';

/** Colores para empezar; el dueño puede escribir cualquiera. */
const SUGERIDOS = ['#C8381F', '#E11D48', '#EA580C', '#CA8A04', '#16A34A', '#0D9488', '#2563EB', '#7C3AED', '#475569'];

/** El tope del servidor; se revisa antes de subir para no esperar el error. */
const LOGO_MAXIMO_BYTES = 2 * 1024 * 1024;

/**
 * El dueño elige con qué nombre, color y logo ven el sistema sus clientes
 * (menú, kiosko, su cuenta) y su equipo (panel, repartidores). Solo cambia la
 * apariencia: ninguna función depende de esto.
 */
@Component({
  selector: 'app-marca-settings',
  standalone: true,
  imports: [NgTemplateOutlet, TituloPaginaComponent, LucideLoader2, LucideUpload, LucideTrash2, LucideRotateCcw],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6 text-slate-100 p-2 sm:p-4">
      <app-titulo-pagina titulo="Marca"
        descripcion="El nombre, el color y el logo con que te ven tus clientes y tu equipo. Solo cambia cómo se ve el sistema." />

      <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <form class="space-y-6 min-w-0" (submit)="guardar($event)">
          <!-- Nombre -->
          <section class="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 space-y-2">
            <label for="marca-nombre" class="text-sm font-bold text-white">Nombre</label>
            <p class="text-xs text-slate-400">Aparece en el menú, el kiosko, el panel y la pestaña del navegador. Vacío: el nombre de tu restaurante.</p>
            <input id="marca-nombre" type="text" maxlength="60" [value]="nombre()" (input)="nombre.set($any($event.target).value)"
              placeholder="Ej. Tacos El Farolito"
              class="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none" />
          </section>

          <!-- Color -->
          <section class="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 space-y-3">
            <div>
              <p class="text-sm font-bold text-white">Color principal</p>
              <p class="text-xs text-slate-400">Botones, enlaces y lo que está seleccionado. Ajustamos el tono para que el texto siempre se lea.</p>
            </div>
            <div class="flex flex-wrap gap-2" role="radiogroup" aria-label="Colores sugeridos">
              @for (c of sugeridos; track c) {
                <button type="button" role="radio" [attr.aria-checked]="color() === c" [attr.aria-label]="'Color ' + c"
                  (click)="elegirColor(c)" [style.background-color]="c"
                  class="w-9 h-9 rounded-full cursor-pointer ring-offset-2 ring-offset-slate-900 transition"
                  [class.ring-2]="color() === c" [class.ring-white]="color() === c"></button>
              }
            </div>
            <div class="flex flex-wrap items-center gap-3">
              <label for="marca-color-selector" class="sr-only">Elegir otro color</label>
              <input id="marca-color-selector" type="color" [value]="color() ?? '#6366F1'" (input)="elegirColor($any($event.target).value)"
                class="w-11 h-11 rounded-lg bg-transparent border border-slate-700 cursor-pointer" />
              <label for="marca-color" class="sr-only">Color en hexadecimal</label>
              <input id="marca-color" type="text" maxlength="7" [value]="color() ?? ''" (input)="escribirColor($any($event.target).value)"
                placeholder="#C8381F" spellcheck="false"
                class="w-32 rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm font-mono uppercase text-white focus:border-indigo-500 outline-none" />
              @if (color()) {
                <button type="button" (click)="elegirColor(null)"
                  class="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white cursor-pointer">
                  <svg lucideRotateCcw class="w-3.5 h-3.5"></svg> Usar los colores de Pide Facil
                </button>
              }
            </div>
            @if (colorInvalido()) {
              <p class="text-xs text-rose-400">Escribe el color como #RRGGBB, por ejemplo #C8381F.</p>
            }
          </section>

          @if (error()) {
            <p class="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-300" role="alert">{{ error() }}</p>
          }
          @if (aviso()) {
            <p class="text-sm text-emerald-400" role="status">{{ aviso() }}</p>
          }

          <div class="flex flex-wrap gap-3">
            <button type="submit" [disabled]="guardando() || colorInvalido() || !hayCambios()"
              class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
              @if (guardando()) { <svg lucideLoader2 class="w-4 h-4 animate-spin"></svg> }
              Guardar nombre y color
            </button>
            @if (hayCambios()) {
              <button type="button" (click)="descartar()" class="px-4 py-2 rounded-lg border border-slate-700 text-sm text-slate-300 hover:text-white cursor-pointer">
                Descartar cambios
              </button>
            }
          </div>

          <!-- Logo -->
          <section class="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 space-y-3">
            <div>
              <p class="text-sm font-bold text-white">Logo</p>
              <p class="text-xs text-slate-400">PNG con fondo transparente o JPG, de hasta 2 MB. Se guarda en cuanto lo eliges.</p>
            </div>
            <div class="flex flex-wrap items-center gap-4">
              <div class="w-20 h-20 rounded-2xl border border-slate-700 bg-slate-950 flex items-center justify-center overflow-hidden">
                @if (marca.urlLogo(); as url) {
                  <img [src]="url" alt="Tu logo" class="max-w-full max-h-full object-contain" />
                } @else {
                  <span class="text-xs text-slate-500">Sin logo</span>
                }
              </div>
              <div class="flex flex-wrap gap-2">
                <label for="marca-logo"
                  class="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-700 text-sm text-slate-200 hover:border-indigo-500 cursor-pointer"
                  [class.opacity-50]="subiendo()">
                  @if (subiendo()) { <svg lucideLoader2 class="w-4 h-4 animate-spin"></svg> } @else { <svg lucideUpload class="w-4 h-4"></svg> }
                  {{ marca.urlLogo() ? 'Cambiar logo' : 'Subir logo' }}
                </label>
                <input id="marca-logo" type="file" accept="image/png,image/jpeg,image/webp" class="sr-only"
                  [disabled]="subiendo()" (change)="subirLogo($event)" />
                @if (marca.urlLogo()) {
                  <button type="button" (click)="quitarLogo()" [disabled]="subiendo()"
                    class="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-rose-300 hover:bg-rose-500/10 cursor-pointer">
                    <svg lucideTrash2 class="w-4 h-4"></svg> Quitar
                  </button>
                }
              </div>
            </div>
          </section>
        </form>

        <!-- Vista previa: se pinta con los mismos colores que el resto del sistema -->
        <aside class="space-y-4 min-w-0" aria-label="Vista previa">
          <p class="text-xs font-semibold uppercase tracking-wider text-slate-500">Así se verá</p>

          <div class="rounded-2xl border border-slate-800 bg-slate-900 p-4 space-y-3">
            <p class="text-[11px] text-slate-400">Panel de tu equipo</p>
            <div class="flex items-center gap-2.5 min-w-0">
              <ng-container *ngTemplateOutlet="logo" />
              <span class="font-display font-extrabold text-white truncate">{{ nombreVisible() }}</span>
            </div>
            <div class="rounded-xl bg-indigo-600 text-white text-sm font-medium px-4 py-2.5">Mesas</div>
            <div class="flex gap-2">
              <span class="rounded-lg bg-indigo-500/15 border border-indigo-500/40 text-indigo-300 text-xs font-bold px-3 py-1.5">Mesa 4 · Abierta</span>
              <span class="rounded-lg bg-indigo-600 text-white text-xs font-bold px-3 py-1.5">Cobrar</span>
            </div>
          </div>

          <div class="rounded-2xl overflow-hidden border border-stone-200 bg-stone-50 text-stone-900">
            <div class="flex items-center gap-2.5 bg-white border-b border-stone-200 px-4 py-3 min-w-0">
              <ng-container *ngTemplateOutlet="logo" />
              <div class="min-w-0">
                <p class="font-extrabold truncate">{{ nombreVisible() }}</p>
                <p class="text-xs text-stone-500">Menú en línea de tus clientes</p>
              </div>
            </div>
            <div class="p-4 space-y-3">
              <div class="flex gap-2">
                <span class="rounded-full bg-orange-600 text-white text-xs font-bold px-3 py-1.5">Tacos</span>
                <span class="rounded-full border border-stone-300 text-xs font-bold px-3 py-1.5">Bebidas</span>
              </div>
              <div class="rounded-xl border-2 border-orange-500 bg-white p-3 flex items-center justify-between">
                <span class="text-sm font-bold">Taco al pastor</span>
                <span class="text-sm font-bold text-orange-700">$25.00</span>
              </div>
              <div class="rounded-xl bg-orange-600 text-white text-center text-sm font-bold py-3">Ver mi pedido · $75.00</div>
            </div>
          </div>
        </aside>
      </div>
    </div>

    <ng-template #logo>
      @if (marca.urlLogo(); as url) {
        <img [src]="url" alt="" class="w-9 h-9 rounded-xl object-contain shrink-0" />
      } @else {
        <span class="w-9 h-9 rounded-xl bg-indigo-600 text-white font-extrabold inline-flex items-center justify-center shrink-0">
          {{ nombreVisible().charAt(0).toUpperCase() }}
        </span>
      }
    </ng-template>
  `,
})
export class MarcaSettingsComponent {
  readonly marca = inject(MarcaService);
  readonly sugeridos = SUGERIDOS;

  readonly nombre = signal('');
  readonly color = signal<string | null>(null);
  /** Lo que el dueño escribe a mano mientras no es un color completo. */
  readonly colorInvalido = signal(false);

  readonly guardando = signal(false);
  readonly subiendo = signal(false);
  readonly error = signal<string | null>(null);
  readonly aviso = signal<string | null>(null);

  /** Lo guardado, para saber si hay cambios y para descartarlos. */
  private readonly guardado = signal<{ nombre: string; color: string | null }>({ nombre: '', color: null });
  /** El nombre del restaurante, que se usa cuando el campo queda vacío. */
  private nombreDelRestaurante = '';

  readonly nombreVisible = computed(() => this.nombre().trim() || this.nombreDelRestaurante || 'Tu restaurante');
  readonly hayCambios = computed(() =>
    this.nombre().trim() !== this.guardado().nombre || (this.color() ?? null) !== this.guardado().color);

  constructor() {
    // Lo guardado llega (o cambia al guardar): se pasa al formulario si no hay cambios sin guardar.
    effect(() => {
      const m = this.marca.marca();
      if (m) untracked(() => (!this.cargado || !this.hayCambios()) && this.cargarDe(m));
    });
    // Al salir, el sistema vuelve al color guardado aunque haya quedado una prueba sin guardar.
    inject(DestroyRef).onDestroy(() => this.marca.pintar(this.marca.marca()?.color ?? null));
  }

  private cargado = false;

  elegirColor(c: string | null): void {
    this.color.set(c ? c.toUpperCase() : null);
    this.colorInvalido.set(false);
    this.aviso.set(null);
    // Vista previa en todo el panel mientras decide.
    this.marca.pintar(this.color());
  }

  escribirColor(texto: string): void {
    const valor = texto.trim();
    if (!valor) {
      this.elegirColor(null);
      return;
    }
    const conGato = valor.startsWith('#') ? valor : `#${valor}`;
    if (esColorValido(conGato)) {
      this.elegirColor(conGato);
    } else {
      this.colorInvalido.set(true);
    }
  }

  descartar(): void {
    this.nombre.set(this.guardado().nombre);
    this.elegirColor(this.guardado().color);
    this.error.set(null);
  }

  guardar(evento: Event): void {
    evento.preventDefault();
    if (this.colorInvalido() || this.guardando()) return;
    this.guardando.set(true);
    this.error.set(null);
    this.marca.guardar(this.nombre().trim() || null, this.color()).subscribe({
      next: (m) => {
        this.cargarDe(m);
        this.guardando.set(false);
        this.aviso.set('Listo. Tus clientes y tu equipo ya ven la marca nueva.');
      },
      error: (e: HttpErrorResponse) => {
        this.guardando.set(false);
        this.error.set(mensaje(e, 'No se pudo guardar la marca.'));
      },
    });
  }

  subirLogo(evento: Event): void {
    const entrada = evento.target as HTMLInputElement;
    const archivo = entrada.files?.[0];
    entrada.value = '';
    if (!archivo) return;
    this.error.set(null);
    this.aviso.set(null);
    if (!archivo.type.startsWith('image/')) {
      this.error.set('Ese archivo no es una imagen. Usa un logo en PNG o JPG.');
      return;
    }
    if (archivo.size > LOGO_MAXIMO_BYTES) {
      this.error.set('El logo pesa más de 2 MB. Usa uno más ligero.');
      return;
    }
    this.subiendo.set(true);
    this.marca.subirLogo(archivo).subscribe({
      next: (m) => {
        this.subiendo.set(false);
        this.reaplicarPrueba(m.color);
        this.aviso.set('Logo guardado.');
      },
      error: (e: HttpErrorResponse) => {
        this.subiendo.set(false);
        this.error.set(mensaje(e, 'No se pudo subir el logo.'));
      },
    });
  }

  quitarLogo(): void {
    this.subiendo.set(true);
    this.error.set(null);
    this.marca.quitarLogo().subscribe({
      next: (m) => {
        this.subiendo.set(false);
        this.reaplicarPrueba(m.color);
        this.aviso.set('Logo quitado.');
      },
      error: (e: HttpErrorResponse) => {
        this.subiendo.set(false);
        this.error.set(mensaje(e, 'No se pudo quitar el logo.'));
      },
    });
  }

  private cargarDe(m: Marca): void {
    this.cargado = true;
    // Sin nombre propio, el que se muestra es el del restaurante.
    if (!m.nombrePropio) this.nombreDelRestaurante = m.nombre;
    this.guardado.set({ nombre: m.nombrePropio ?? '', color: m.color });
    this.nombre.set(m.nombrePropio ?? '');
    this.color.set(m.color);
    this.colorInvalido.set(false);
  }

  /** Subir el logo vuelve a pintar la marca guardada; si el dueño estaba probando un color, se respeta. */
  private reaplicarPrueba(guardado: string | null): void {
    if (this.color() !== guardado) this.marca.pintar(this.color());
  }
}

function mensaje(e: HttpErrorResponse, porDefecto: string): string {
  const cuerpo = e.error as { error?: string; message?: string } | null;
  return cuerpo?.error || cuerpo?.message || porDefecto;
}
