import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { AvisosService } from '../../core/services/avisos.service';

interface Agotado {
  productId: string;
  nombre: string;
  /** false = se agotó solo porque ya no alcanza el inventario (modo Bloquear). */
  aMano: boolean;
  por: string | null;
}

interface PlatilloMenu {
  id: string;
  nombre: string;
  agotado: boolean;
}

/**
 * "Se acabó": desde Cocina se marca un platillo que ya no hay. Deja de
 * ofrecerse hoy en el menú en línea, el bot y con los meseros; mañana vuelve
 * solo. Es lo más rápido cuando se termina algo a media comida.
 */
@Component({
  selector: 'app-agotados-cocina',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" (click)="abrir()"
      class="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer">
      Se acabó
      @if (agotados().length > 0) {
        <span class="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 tabular-nums">{{ agotados().length }}</span>
      }
    </button>

    @if (abierto()) {
      <div class="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-labelledby="ago-titulo">
        <div (click)="abierto.set(false)" class="absolute inset-0 bg-slate-950/60"></div>
        <aside class="relative w-full max-w-sm h-full bg-slate-900 border-l border-slate-800 flex flex-col">
          <div class="px-5 py-4 border-b border-slate-800">
            <h2 id="ago-titulo" class="text-base font-bold text-white">¿Qué se acabó?</h2>
            <p class="text-xs text-slate-400 mt-0.5">Deja de ofrecerse hoy en el menú en línea, el bot y con los meseros. Mañana vuelve solo.</p>
          </div>

          <div class="flex-1 overflow-y-auto p-5 space-y-5">
            @if (agotados().length > 0) {
              <section>
                <h3 class="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Agotado hoy</h3>
                <ul class="space-y-1.5">
                  @for (a of agotados(); track a.productId) {
                    <li class="flex items-center gap-2 rounded-lg bg-rose-500/10 border border-rose-500/20 px-3 py-2 text-sm">
                      <span class="flex-1 min-w-0 text-rose-200 truncate">{{ a.nombre }}</span>
                      @if (a.aMano) {
                        <button (click)="yaHay(a)" class="text-xs font-bold text-emerald-300 hover:text-emerald-200 cursor-pointer">Ya hay</button>
                      } @else {
                        <span class="text-[11px] text-rose-300/80" title="Se agotó porque ya no alcanza el inventario">sin inventario</span>
                      }
                    </li>
                  }
                </ul>
              </section>
            }

            <section>
              <label for="ago-buscar" class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Marcar como agotado</label>
              <input id="ago-buscar" type="search" placeholder="Buscar platillo…" [value]="busqueda()" (input)="busqueda.set($any($event.target).value)"
                class="mt-2 w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3 text-sm text-white outline-none focus:border-indigo-500" />
              <ul class="mt-2 space-y-1">
                @for (p of disponibles(); track p.id) {
                  <li>
                    <button (click)="seAcabo(p)" class="w-full text-left rounded-lg px-3 py-2 text-sm text-slate-200 hover:bg-slate-800 cursor-pointer">
                      {{ p.nombre }}
                    </button>
                  </li>
                }
              </ul>
            </section>
          </div>
        </aside>
      </div>
    }
  `,
})
export class AgotadosCocinaComponent {
  private readonly http = inject(HttpClient);
  private readonly avisos = inject(AvisosService);

  readonly branchId = input<string | null>(null);
  readonly abierto = signal(false);
  readonly agotados = signal<Agotado[]>([]);
  readonly platillos = signal<PlatilloMenu[]>([]);
  readonly busqueda = signal('');

  readonly disponibles = computed(() => {
    const q = this.busqueda().trim().toLowerCase();
    const fuera = new Set(this.agotados().map((a) => a.productId));
    return this.platillos()
      .filter((p) => !fuera.has(p.id) && (!q || p.nombre.toLowerCase().includes(q)))
      .slice(0, 40);
  });

  constructor() {
    // El contador del botón se ve sin abrir el panel.
    effect(() => {
      const id = this.branchId();
      untracked(() => {
        if (!id) return;
        this.http.get<Agotado[]>(`${environment.apiUrl}/branches/${id}/agotados`).subscribe({
          next: (lista) => this.agotados.set(lista),
          error: () => this.agotados.set([]),
        });
      });
    });
  }

  abrir(): void {
    this.abierto.set(true);
    this.cargar();
  }

  private cargar(): void {
    const id = this.branchId();
    if (!id) return;
    this.http.get<Agotado[]>(`${environment.apiUrl}/branches/${id}/agotados`).subscribe({
      next: (lista) => this.agotados.set(lista),
    });
    this.http
      .get<{ items: PlatilloMenu[] }[]>(`${environment.apiUrl}/public/branches/${id}/menu`)
      .subscribe({
        next: (menu) => this.platillos.set(menu.flatMap((c) => c.items).sort((a, b) => a.nombre.localeCompare(b.nombre))),
      });
  }

  seAcabo(p: PlatilloMenu): void {
    const id = this.branchId();
    if (!id) return;
    this.http.post(`${environment.apiUrl}/branches/${id}/products/${p.id}/agotado`, {}).subscribe({
      next: () => {
        this.avisos.exito(`${p.nombre} ya no se ofrece por hoy.`);
        this.busqueda.set('');
        this.cargar();
      },
      error: (err) => this.avisos.error(err.error?.error || 'No se pudo marcar.'),
    });
  }

  yaHay(a: Agotado): void {
    const id = this.branchId();
    if (!id) return;
    this.http.delete(`${environment.apiUrl}/branches/${id}/products/${a.productId}/agotado`).subscribe({
      next: () => {
        this.avisos.exito(`${a.nombre} vuelve a ofrecerse.`);
        this.cargar();
      },
      error: (err) => this.avisos.error(err.error?.error || 'No se pudo cambiar.'),
    });
  }
}
