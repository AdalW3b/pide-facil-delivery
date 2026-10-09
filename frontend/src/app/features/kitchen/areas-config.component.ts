import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnInit, Output, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { LucideChevronDown, LucideLoader2, LucidePlus, LucideX } from '@lucide/angular';
import { environment } from '../../../environments/environment';
import { AvisosService } from '../../core/services/avisos.service';
import type { AreaCocina } from './kitchen.component';

interface CategoriaArea { id: string; nombre: string; areaId: string | null }
interface ProductoArea { id: string; nombre: string; categoriaId: string; areaId: string | null; sinPreparacion: boolean }
interface Asignacion { areas: AreaCocina[]; categorias: CategoriaArea[]; productos: ProductoArea[] }

const CAMPO = 'bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-sm text-white outline-none focus:border-indigo-500 min-h-[40px]';

/**
 * Las áreas de preparación y qué va a cada una. Se asigna por categoría; un
 * platillo puede ir a otra área o marcarse "sin preparación" (nace listo).
 */
@Component({
  selector: 'app-areas-config',
  standalone: true,
  imports: [FormsModule, LucideChevronDown, LucideLoader2, LucidePlus, LucideX],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="fixed inset-0 z-[80] flex items-start sm:items-center justify-center bg-black/60 p-3 sm:p-6 overflow-y-auto" (click)="cerrar.emit()">
      <div class="w-full max-w-3xl rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="areas-titulo" (click)="$event.stopPropagation()">
        <header class="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-800">
          <div>
            <h2 id="areas-titulo" class="text-lg font-bold text-white">Áreas de preparación</h2>
            <p class="text-xs text-slate-400">Cada área tiene su pantalla y avanza solo lo suyo. Empaque junta lo de domicilio y para llevar.</p>
          </div>
          <button type="button" (click)="cerrar.emit()" class="w-10 h-10 rounded-lg text-slate-400 hover:text-white flex items-center justify-center cursor-pointer" aria-label="Cerrar">
            <svg lucideX class="w-5 h-5"></svg>
          </button>
        </header>

        @if (datos(); as d) {
          <div class="p-5 space-y-6 max-h-[calc(100dvh-12rem)] overflow-y-auto">
            <!-- Áreas -->
            <section class="space-y-2">
              <h3 class="text-sm font-bold text-white">Áreas</h3>
              <ul class="divide-y divide-slate-800 rounded-xl border border-slate-800">
                @for (a of d.areas; track a.id) {
                  <li class="flex flex-wrap items-center gap-3 px-3 py-2.5" [class.opacity-50]="!a.activa">
                    <input [id]="'area-' + a.id" [ngModel]="a.nombre" (blur)="renombrar(a, $any($event.target).value)" maxlength="40"
                      class="${CAMPO} flex-1 min-w-[10rem]" [attr.aria-label]="'Nombre del área ' + a.nombre" />
                    <span class="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded"
                      [class]="a.tipo === 'EMPAQUE' ? 'bg-violet-500/15 text-violet-300' : 'bg-slate-800 text-slate-300'">{{ a.tipo === 'EMPAQUE' ? 'Empaque' : 'Prepara' }}</span>
                    @if (a.tipo === 'PREPARACION') {
                      <label class="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
                        <input type="radio" name="predeterminada" [checked]="a.predeterminada" (change)="predeterminada(a)" [disabled]="!a.activa" class="accent-indigo-500" />
                        Predeterminada
                      </label>
                    }
                    <button type="button" (click)="activar(a, !a.activa)" [disabled]="a.predeterminada"
                      class="text-xs font-semibold cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                      [class]="a.activa ? 'text-slate-400 hover:text-rose-300' : 'text-emerald-300 hover:text-emerald-200'">{{ a.activa ? 'Apagar' : 'Encender' }}</button>
                  </li>
                }
              </ul>
              <form ngNoForm class="flex flex-wrap items-center gap-2" (submit)="crear($event)" novalidate>
                <label for="area-nueva" class="sr-only">Nueva área</label>
                <input id="area-nueva" [ngModel]="nueva()" (ngModelChange)="nueva.set($event)" maxlength="40" placeholder="Nueva área, por ejemplo Freidora" class="${CAMPO} flex-1 min-w-[12rem]" />
                <label for="area-tipo" class="sr-only">Tipo</label>
                <select id="area-tipo" [ngModel]="tipoNueva()" (ngModelChange)="tipoNueva.set($event)" class="${CAMPO} [color-scheme:dark] cursor-pointer">
                  <option value="PREPARACION">Prepara platillos</option>
                  <option value="EMPAQUE">Empaque</option>
                </select>
                <button type="submit" [disabled]="!nueva().trim() || guardando()" class="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold cursor-pointer disabled:opacity-40 min-h-[40px]">
                  <svg lucidePlus class="w-4 h-4"></svg> Agregar
                </button>
              </form>
              <p class="text-[11px] text-slate-500">Lo que no tiene área va a la predeterminada. Un área apagada deja de recibir platillos; los suyos van a la predeterminada.</p>
            </section>

            <!-- Qué va a cada área -->
            <section class="space-y-2">
              <h3 class="text-sm font-bold text-white">Qué va a cada área</h3>
              <p class="text-xs text-slate-400">Por categoría. Abre una categoría para cambiar un platillo en particular o marcarlo <b class="text-slate-200">sin preparación</b>: refrescos y agua embotellada salen listos solos.</p>
              <ul class="space-y-2">
                @for (c of categorias(); track c.id) {
                  <li class="rounded-xl border border-slate-800">
                    <div class="flex flex-wrap items-center gap-3 px-3 py-2.5">
                      <button type="button" (click)="alternar(c.id)" class="flex-1 min-w-[10rem] flex items-center gap-2 text-left text-sm font-semibold text-white cursor-pointer" [attr.aria-expanded]="abiertas().has(c.id)">
                        <svg lucideChevronDown class="w-4 h-4 text-slate-400 transition-transform" [class.-rotate-90]="!abiertas().has(c.id)"></svg>
                        {{ c.nombre }} <span class="text-xs font-normal text-slate-500">· {{ productosDe(c.id).length }}</span>
                      </button>
                      <label [for]="'cat-' + c.id" class="sr-only">Área de {{ c.nombre }}</label>
                      <select [id]="'cat-' + c.id" [ngModel]="c.areaId ?? ''" (ngModelChange)="areaDeCategoria(c, $event)" class="${CAMPO} [color-scheme:dark] cursor-pointer">
                        <option value="">{{ nombrePredeterminada() }} (predeterminada)</option>
                        @for (a of preparan(); track a.id) { <option [value]="a.id">{{ a.nombre }}</option> }
                      </select>
                    </div>
                    @if (abiertas().has(c.id)) {
                      <ul class="border-t border-slate-800 divide-y divide-slate-800/60">
                        @for (p of productosDe(c.id); track p.id) {
                          <li class="flex flex-wrap items-center gap-3 px-3 py-2 pl-9">
                            <span class="flex-1 min-w-[9rem] text-sm text-slate-200">{{ p.nombre }}</span>
                            <label class="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
                              <input type="checkbox" [checked]="p.sinPreparacion" (change)="sinPreparacion(p, $any($event.target).checked)" class="accent-indigo-500 w-4 h-4" />
                              Sin preparación
                            </label>
                            <label [for]="'prod-' + p.id" class="sr-only">Área de {{ p.nombre }}</label>
                            <select [id]="'prod-' + p.id" [ngModel]="p.areaId ?? ''" (ngModelChange)="areaDeProducto(p, $event)" class="${CAMPO} [color-scheme:dark] cursor-pointer text-xs">
                              <option value="">Como su categoría</option>
                              @for (a of preparan(); track a.id) { <option [value]="a.id">{{ a.nombre }}</option> }
                            </select>
                          </li>
                        } @empty {
                          <li class="px-3 py-2 pl-9 text-xs text-slate-500">Sin platillos activos.</li>
                        }
                      </ul>
                    }
                  </li>
                }
              </ul>
            </section>
          </div>
          <footer class="flex items-center justify-end gap-3 px-5 py-4 border-t border-slate-800">
            @if (cambios() > 0) { <span class="text-xs text-amber-300">{{ cambios() }} {{ cambios() === 1 ? 'cambio sin guardar' : 'cambios sin guardar' }}</span> }
            <button type="button" (click)="cerrar.emit()" class="px-4 py-2.5 rounded-lg border border-slate-700 text-sm text-slate-300 cursor-pointer">Cerrar</button>
            <button type="button" (click)="guardar()" [disabled]="!cambios() || guardando()" class="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold cursor-pointer disabled:opacity-40">
              @if (guardando()) { <svg lucideLoader2 class="w-4 h-4 animate-spin"></svg> }
              Guardar asignación
            </button>
          </footer>
        } @else {
          <div class="flex items-center justify-center gap-2 py-16 text-sm text-slate-400">
            <svg lucideLoader2 class="w-4 h-4 animate-spin"></svg> Cargando áreas…
          </div>
        }
      </div>
    </div>
  `,
})
export class AreasConfigComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly avisos = inject(AvisosService);

  @Input({ required: true }) branchId!: string;
  @Output() cerrar = new EventEmitter<void>();
  /** Cambiaron las áreas: la pantalla de cocina las vuelve a pedir. */
  @Output() cambiaron = new EventEmitter<void>();

  readonly datos = signal<Asignacion | null>(null);
  readonly nueva = signal('');
  readonly tipoNueva = signal<'PREPARACION' | 'EMPAQUE'>('PREPARACION');
  readonly guardando = signal(false);
  readonly abiertas = signal<Set<string>>(new Set());
  private readonly catCambiadas = signal<Map<string, string | null>>(new Map());
  private readonly prodCambiados = signal<Map<string, ProductoArea>>(new Map());

  readonly categorias = computed(() => (this.datos()?.categorias ?? []).map((c) =>
    this.catCambiadas().has(c.id) ? { ...c, areaId: this.catCambiadas().get(c.id) ?? null } : c));
  readonly preparan = computed(() => (this.datos()?.areas ?? []).filter((a) => a.tipo === 'PREPARACION' && a.activa));
  readonly nombrePredeterminada = computed(() => this.datos()?.areas.find((a) => a.predeterminada)?.nombre ?? 'Cocina');
  readonly cambios = computed(() => this.catCambiadas().size + this.prodCambiados().size);

  ngOnInit(): void {
    this.cargar();
  }

  private api(ruta = ''): string {
    return `${environment.apiUrl}/branches/${this.branchId}/areas${ruta}`;
  }

  private cargar(): void {
    this.http.get<Asignacion>(this.api('/asignacion')).subscribe({
      next: (d) => this.datos.set(d),
      error: (err) => this.avisos.error(err.error?.error || 'No se pudieron cargar las áreas.'),
    });
  }

  productosDe(categoriaId: string): ProductoArea[] {
    return (this.datos()?.productos ?? [])
      .filter((p) => p.categoriaId === categoriaId)
      .map((p) => this.prodCambiados().get(p.id) ?? p);
  }

  alternar(id: string): void {
    this.abiertas.update((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  areaDeCategoria(c: CategoriaArea, areaId: string): void {
    this.catCambiadas.update((m) => new Map(m).set(c.id, areaId || null));
  }

  areaDeProducto(p: ProductoArea, areaId: string): void {
    this.prodCambiados.update((m) => new Map(m).set(p.id, { ...p, areaId: areaId || null }));
  }

  sinPreparacion(p: ProductoArea, si: boolean): void {
    this.prodCambiados.update((m) => new Map(m).set(p.id, { ...p, sinPreparacion: si }));
  }

  guardar(): void {
    if (!this.cambios() || this.guardando()) return;
    this.guardando.set(true);
    const categorias = [...this.catCambiadas()].map(([id, areaId]) => ({ id, nombre: '', areaId }));
    const productos = [...this.prodCambiados().values()];
    this.http.put<void>(this.api('/asignacion'), { categorias, productos }).subscribe({
      next: () => {
        this.guardando.set(false);
        this.catCambiadas.set(new Map());
        this.prodCambiados.set(new Map());
        this.avisos.exito('Asignación guardada. Aplica a lo que se pida desde ahora.');
        this.cargar();
      },
      error: (err) => {
        this.guardando.set(false);
        this.avisos.error(err.error?.error || 'No se pudo guardar la asignación.');
      },
    });
  }

  // ------------------------------------------------------------------ áreas

  crear(e: Event): void {
    e.preventDefault();
    const nombre = this.nueva().trim();
    if (!nombre || this.guardando()) return;
    this.guardando.set(true);
    this.http.post<AreaCocina>(this.api(), { nombre, tipo: this.tipoNueva() }).subscribe({
      next: () => {
        this.guardando.set(false);
        this.nueva.set('');
        this.avisos.exito(`Área ${nombre} agregada.`);
        this.recargar();
      },
      error: (err) => {
        this.guardando.set(false);
        this.avisos.error(err.error?.error || 'No se pudo agregar el área.');
      },
    });
  }

  renombrar(a: AreaCocina, nombre: string): void {
    const n = nombre.trim();
    if (!n || n === a.nombre) return;
    this.http.put<AreaCocina>(this.api(`/${a.id}`), { nombre: n, tipo: a.tipo }).subscribe({
      next: () => this.recargar(),
      error: (err) => {
        this.avisos.error(err.error?.error || 'No se pudo cambiar el nombre.');
        this.cargar();
      },
    });
  }

  activar(a: AreaCocina, activa: boolean): void {
    this.http.patch<AreaCocina>(this.api(`/${a.id}/activa`), { activa }).subscribe({
      next: () => this.recargar(),
      error: (err) => this.avisos.error(err.error?.error || 'No se pudo cambiar el área.'),
    });
  }

  predeterminada(a: AreaCocina): void {
    this.http.post<AreaCocina>(this.api(`/${a.id}/predeterminada`), {}).subscribe({
      next: () => this.recargar(),
      error: (err) => this.avisos.error(err.error?.error || 'No se pudo cambiar la predeterminada.'),
    });
  }

  private recargar(): void {
    this.cargar();
    this.cambiaron.emit();
  }
}
