import { ChangeDetectionStrategy, Component, Input, OnChanges, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { LucideLoader2, LucidePencil, LucideTruck, LucideUserPlus, LucideX } from '@lucide/angular';
import { environment } from '../../../environments/environment';
import { AvisosService } from '../../core/services/avisos.service';
import { PesosPipe } from '../../shared/utils/pesos';
import type { ArticuloCompra, Proveedor } from './compras-inventario.component';

interface Ficha {
  id: string | null;
  nombre: string;
  contacto: string;
  telefono: string;
  diasCredito: number | null;
  diasVisita: string[];
  notas: string;
  surte: { tipo: string; id: string; nombre: string | null }[];
}

const DIAS = [
  { id: 'LUN', nombre: 'Lun' }, { id: 'MAR', nombre: 'Mar' }, { id: 'MIE', nombre: 'Mié' }, { id: 'JUE', nombre: 'Jue' },
  { id: 'VIE', nombre: 'Vie' }, { id: 'SAB', nombre: 'Sáb' }, { id: 'DOM', nombre: 'Dom' },
];
const CAMPO = 'w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-sm text-white outline-none focus:border-indigo-500 min-h-[40px]';

/** El directorio de proveedores: quién surte qué, cuándo viene, a cuántos días da crédito y cuánto se le debe. */
@Component({
  selector: 'app-proveedores-inventario',
  standalone: true,
  imports: [FormsModule, PesosPipe, LucideLoader2, LucidePencil, LucideTruck, LucideUserPlus, LucideX],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 class="text-base font-bold text-white">Proveedores</h2>
          <p class="text-xs text-slate-400">Se comparten entre las sucursales del restaurante.</p>
        </div>
        <div class="flex items-center gap-2">
          <label class="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
            <input type="checkbox" [ngModel]="verInactivos()" (ngModelChange)="verInactivos.set($event)" class="accent-indigo-500" /> Ver inactivos
          </label>
          @if (puedeEditar) {
            <button type="button" (click)="nuevo()" class="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold cursor-pointer min-h-[44px]">
              <svg lucideUserPlus class="w-4 h-4"></svg> Nuevo proveedor
            </button>
          }
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-3">
        @for (p of visibles(); track p.id) {
          <article class="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-2" [class.opacity-55]="!p.activo">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <h3 class="text-sm font-bold text-white truncate">{{ p.nombre }}</h3>
                <p class="text-xs text-slate-400 truncate">{{ contactoTexto(p) }}</p>
              </div>
              @if (p.debemos > 0) {
                <span class="shrink-0 text-[11px] font-bold px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 tabular-nums">Le debemos {{ p.debemos | pesos }}</span>
              }
            </div>
            <dl class="text-xs text-slate-300 space-y-0.5">
              <div class="flex gap-2"><dt class="text-slate-500 w-16 shrink-0">Viene</dt><dd>{{ diasTexto(p.diasVisita) }}</dd></div>
              <div class="flex gap-2"><dt class="text-slate-500 w-16 shrink-0">Crédito</dt><dd>{{ p.diasCredito > 0 ? p.diasCredito + ' días' : 'De contado' }}</dd></div>
              <div class="flex gap-2"><dt class="text-slate-500 w-16 shrink-0">Surte</dt><dd class="min-w-0">{{ surteTexto(p) }}</dd></div>
            </dl>
            @if (p.notas) { <p class="text-[11px] text-slate-500">{{ p.notas }}</p> }
            @if (puedeEditar) {
              <div class="flex items-center gap-3 pt-1">
                <button type="button" (click)="editar(p)" class="inline-flex items-center gap-1 text-xs font-semibold text-indigo-300 hover:text-indigo-200 cursor-pointer min-h-[32px]">
                  <svg lucidePencil class="w-3.5 h-3.5"></svg> Editar
                </button>
                <button type="button" (click)="activar(p, !p.activo)" class="text-xs text-slate-400 hover:text-white cursor-pointer min-h-[32px]">{{ p.activo ? 'Desactivar' : 'Reactivar' }}</button>
              </div>
            }
          </article>
        } @empty {
          <div class="md:col-span-2 2xl:col-span-3 rounded-xl border border-dashed border-slate-800 py-10 text-center space-y-2">
            <svg lucideTruck class="w-8 h-8 mx-auto text-slate-600"></svg>
            <p class="text-sm text-slate-400">Aún no hay proveedores. Da de alta a quien te surte para ver cuándo viene y cuánto le debes.</p>
          </div>
        }
      </div>
    </section>

    @if (ficha(); as f) {
      <div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" (click)="ficha.set(null)">
        <form class="w-full max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-5 space-y-3" role="dialog" aria-modal="true" aria-labelledby="prov-titulo"
          (click)="$event.stopPropagation()" (submit)="guardar($event)" novalidate>
          <div class="flex items-center justify-between">
            <h3 id="prov-titulo" class="text-base font-bold text-white">{{ f.id ? 'Editar proveedor' : 'Nuevo proveedor' }}</h3>
            <button type="button" (click)="ficha.set(null)" class="w-9 h-9 rounded-lg text-slate-400 hover:text-white flex items-center justify-center cursor-pointer" aria-label="Cerrar">
              <svg lucideX class="w-4 h-4"></svg>
            </button>
          </div>
          <div>
            <label for="pv-nombre" class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Nombre *</label>
            <input id="pv-nombre" [ngModel]="f.nombre" (ngModelChange)="cambiar({ nombre: $event })" maxlength="120" placeholder="Carnicería López" class="${CAMPO}" />
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label for="pv-contacto" class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Contacto</label>
              <input id="pv-contacto" [ngModel]="f.contacto" (ngModelChange)="cambiar({ contacto: $event })" maxlength="120" placeholder="Don Pepe" class="${CAMPO}" />
            </div>
            <div>
              <label for="pv-tel" class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">WhatsApp</label>
              <input id="pv-tel" type="tel" inputmode="tel" [ngModel]="f.telefono" (ngModelChange)="cambiar({ telefono: $event })" maxlength="30" class="${CAMPO}" />
            </div>
          </div>
          <div>
            <span class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Días que viene</span>
            <div class="flex flex-wrap gap-1.5" role="group" aria-label="Días que viene">
              @for (d of dias; track d.id) {
                <button type="button" [attr.aria-pressed]="f.diasVisita.includes(d.id)" (click)="alternarDia(d.id)"
                  class="w-12 h-10 rounded-lg border text-xs font-bold cursor-pointer"
                  [class]="f.diasVisita.includes(d.id) ? 'border-indigo-500 bg-indigo-500/15 text-white' : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-600'">{{ d.nombre }}</button>
              }
            </div>
          </div>
          <div>
            <label for="pv-credito" class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Días de crédito</label>
            <input id="pv-credito" type="number" min="0" step="1" inputmode="numeric" [ngModel]="f.diasCredito" (ngModelChange)="cambiar({ diasCredito: $event })" placeholder="0 = de contado" class="${CAMPO} tabular-nums sm:max-w-[10rem]" />
            <p class="text-[11px] text-slate-500 mt-1">Las compras a crédito vencen a estos días (15 si se deja en 0).</p>
          </div>
          <div class="relative">
            <label for="pv-surte" class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Qué surte</label>
            @if (f.surte.length) {
              <div class="flex flex-wrap gap-1.5 mb-2">
                @for (s of f.surte; track s.tipo + s.id) {
                  <span class="inline-flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-full bg-slate-800 text-xs text-slate-200">
                    {{ s.nombre }}
                    <button type="button" (click)="quitarSurte(s.id)" class="w-6 h-6 rounded-full hover:bg-slate-700 flex items-center justify-center cursor-pointer" [attr.aria-label]="'Quitar ' + s.nombre">
                      <svg lucideX class="w-3 h-3"></svg>
                    </button>
                  </span>
                }
              </div>
            }
            <input id="pv-surte" autocomplete="off" [ngModel]="busqueda()" (ngModelChange)="busqueda.set($event)" (blur)="cerrarBusqueda()" placeholder="Busca artículos" class="${CAMPO}" />
            @if (resultados().length) {
              <div class="absolute inset-x-0 top-[calc(100%+4px)] z-10 rounded-xl border border-slate-700 bg-slate-900 p-1 shadow-2xl max-h-52 overflow-y-auto">
                @for (a of resultados(); track a.tipo + a.id) {
                  <button type="button" (mousedown)="$event.preventDefault(); agregarSurte(a)" class="w-full text-left px-3 py-2 rounded-lg text-sm text-slate-200 hover:bg-slate-800 cursor-pointer">{{ a.nombre }}</button>
                }
              </div>
            }
          </div>
          <div>
            <label for="pv-notas" class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Notas</label>
            <textarea id="pv-notas" rows="2" [ngModel]="f.notas" (ngModelChange)="cambiar({ notas: $event })" maxlength="500" placeholder="Pedido mínimo, cuenta para transferir…" class="${CAMPO}"></textarea>
          </div>
          <div class="flex justify-end gap-2 pt-1">
            <button type="button" (click)="ficha.set(null)" class="px-4 py-2.5 rounded-lg border border-slate-700 text-sm text-slate-300 cursor-pointer">Cancelar</button>
            <button type="submit" [disabled]="!f.nombre.trim() || guardando()" class="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold cursor-pointer disabled:opacity-40">
              @if (guardando()) { <svg lucideLoader2 class="w-4 h-4 animate-spin"></svg> }
              Guardar
            </button>
          </div>
        </form>
      </div>
    }
  `,
})
export class ProveedoresInventarioComponent implements OnChanges {
  private readonly http = inject(HttpClient);
  private readonly avisos = inject(AvisosService);

  @Input({ required: true }) branchId!: string;
  @Input({ required: true }) articulos: ArticuloCompra[] = [];
  @Input() puedeEditar = true;

  readonly dias = DIAS;
  readonly proveedores = signal<Proveedor[]>([]);
  readonly verInactivos = signal(false);
  readonly ficha = signal<Ficha | null>(null);
  readonly busqueda = signal('');
  readonly guardando = signal(false);

  readonly visibles = computed(() => this.proveedores().filter((p) => p.activo || this.verInactivos()));

  readonly resultados = computed(() => {
    const q = normal(this.busqueda());
    const f = this.ficha();
    if (!q || !f) return [];
    return this.articulos
      .filter((a) => a.activo && normal(a.nombre).includes(q) && !f.surte.some((s) => s.id === a.id))
      .slice(0, 8);
  });

  ngOnChanges(): void {
    if (this.branchId) this.cargar();
  }

  private api(ruta: string): string {
    return `${environment.apiUrl}/branches/${this.branchId}/inventario/${ruta}`;
  }

  cargar(): void {
    this.http.get<Proveedor[]>(this.api('proveedores')).subscribe({ next: (p) => this.proveedores.set(p) });
  }

  nuevo(): void {
    this.ficha.set({ id: null, nombre: '', contacto: '', telefono: '', diasCredito: null, diasVisita: [], notas: '', surte: [] });
  }

  editar(p: Proveedor): void {
    this.ficha.set({
      id: p.id, nombre: p.nombre, contacto: p.contacto ?? '', telefono: p.telefono ?? '',
      diasCredito: p.diasCredito || null, diasVisita: [...p.diasVisita], notas: p.notas ?? '', surte: [...p.surte],
    });
  }

  cambiar(cambio: Partial<Ficha>): void {
    this.ficha.update((f) => (f ? { ...f, ...cambio } : f));
  }

  alternarDia(d: string): void {
    const f = this.ficha();
    if (!f) return;
    const dias = f.diasVisita.includes(d) ? f.diasVisita.filter((x) => x !== d) : [...f.diasVisita, d];
    this.cambiar({ diasVisita: DIAS.map((x) => x.id).filter((x) => dias.includes(x)) });
  }

  agregarSurte(a: ArticuloCompra): void {
    const f = this.ficha();
    if (!f) return;
    this.cambiar({ surte: [...f.surte, { tipo: a.tipo === 'PRODUCTO' ? 'PRODUCTO' : 'INGREDIENTE', id: a.id, nombre: a.nombre }] });
    this.busqueda.set('');
  }

  quitarSurte(id: string): void {
    const f = this.ficha();
    if (f) this.cambiar({ surte: f.surte.filter((s) => s.id !== id) });
  }

  cerrarBusqueda(): void {
    setTimeout(() => this.busqueda.set(''), 150);
  }

  guardar(e: Event): void {
    e.preventDefault();
    const f = this.ficha();
    if (!f || !f.nombre.trim() || this.guardando()) return;
    this.guardando.set(true);
    const cuerpo = {
      nombre: f.nombre.trim(),
      contacto: f.contacto.trim() || null,
      telefono: f.telefono.trim() || null,
      diasCredito: Number(f.diasCredito) > 0 ? Math.round(Number(f.diasCredito)) : 0,
      diasVisita: f.diasVisita,
      notas: f.notas.trim() || null,
      surte: f.surte,
    };
    const peticion = f.id
      ? this.http.put<Proveedor>(this.api(`proveedores/${f.id}`), cuerpo)
      : this.http.post<Proveedor>(this.api('proveedores'), cuerpo);
    peticion.subscribe({
      next: () => {
        this.guardando.set(false);
        this.avisos.exito(f.id ? 'Proveedor actualizado.' : 'Proveedor dado de alta.');
        this.ficha.set(null);
        this.cargar();
      },
      error: (err) => {
        this.guardando.set(false);
        this.avisos.error(err.error?.error || 'No se pudo guardar el proveedor.');
      },
    });
  }

  activar(p: Proveedor, activo: boolean): void {
    this.http.patch<void>(this.api(`proveedores/${p.id}/activo`), { activo }).subscribe({
      next: () => this.proveedores.update((l) => l.map((x) => (x.id === p.id ? { ...x, activo } : x))),
      error: (err) => this.avisos.error(err.error?.error || 'No se pudo cambiar el proveedor.'),
    });
  }

  diasTexto(dias: string[]): string {
    return dias.length ? dias.map((d) => DIAS.find((x) => x.id === d)?.nombre ?? d).join(', ') : 'Sin días fijos';
  }

  contactoTexto(p: Proveedor): string {
    return [p.contacto, p.telefono].filter(Boolean).join(' · ') || 'Sin contacto';
  }

  surteTexto(p: Proveedor): string {
    return p.surte.map((s) => s.nombre).filter(Boolean).join(', ') || '—';
  }
}

function normal(s: string): string {
  return (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}
