import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { LucideLoader2, LucideWallet, LucideX } from '@lucide/angular';
import { environment } from '../../../environments/environment';
import { AvisosService } from '../../core/services/avisos.service';
import { PesosPipe, formatearPesos } from '../../shared/utils/pesos';
import { hoyIso } from '../../shared/components/selector-fecha.component';
import type { Compra } from './compras-inventario.component';

interface Grupo {
  clave: string;
  proveedor: string;
  total: number;
  vencido: number;
  compras: Compra[];
}

/** Lo comprado a crédito que falta pagar, por proveedor y por vencimiento. */
@Component({
  selector: 'app-por-pagar',
  standalone: true,
  imports: [PesosPipe, LucideLoader2, LucideWallet, LucideX],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="space-y-4">
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div class="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
          <p class="text-[11px] font-bold uppercase tracking-wider text-slate-400">Por pagar</p>
          <p class="text-2xl font-black text-white tabular-nums mt-1">{{ total() | pesos }}</p>
        </div>
        <div class="rounded-xl border p-4" [class]="vencido() > 0 ? 'border-rose-500/40 bg-rose-500/5' : 'border-slate-800 bg-slate-900/40'">
          <p class="text-[11px] font-bold uppercase tracking-wider text-slate-400">Vencido</p>
          <p class="text-2xl font-black tabular-nums mt-1" [class]="vencido() > 0 ? 'text-rose-300' : 'text-slate-500'">{{ vencido() | pesos }}</p>
        </div>
        <div class="rounded-xl border border-slate-800 bg-slate-900/40 p-4 col-span-2 sm:col-span-1">
          <p class="text-[11px] font-bold uppercase tracking-wider text-slate-400">Vence esta semana</p>
          <p class="text-2xl font-black text-amber-300 tabular-nums mt-1">{{ semana() | pesos }}</p>
        </div>
      </div>

      @for (g of grupos(); track g.clave) {
        <article class="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden">
          <header class="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-slate-800">
            <div class="min-w-0">
              <h3 class="text-sm font-bold text-white truncate">{{ g.proveedor }}</h3>
              <p class="text-xs text-slate-400 tabular-nums">
                {{ g.compras.length }} {{ g.compras.length === 1 ? 'nota' : 'notas' }} · le debemos {{ g.total | pesos }}
                @if (g.vencido > 0) { <span class="text-rose-300"> · {{ g.vencido | pesos }} vencido</span> }
              </p>
            </div>
            @if (puedePagar && g.compras.length > 1) {
              <button type="button" (click)="abrir(g.compras, g.proveedor)" class="px-3 py-2 rounded-lg border border-slate-700 text-xs font-bold text-slate-200 hover:border-slate-500 cursor-pointer min-h-[36px]">Pagar todo</button>
            }
          </header>
          <ul class="divide-y divide-slate-800">
            @for (c of g.compras; track c.id) {
              <li class="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5">
                <div class="min-w-0 flex-1">
                  <p class="text-sm text-slate-200">{{ c.folio ? 'Nota ' + c.folio : 'Sin folio' }} <span class="text-xs text-slate-500">· {{ fechaCorta(c.fecha) }}</span></p>
                  <p class="text-[11px] text-slate-500 truncate">{{ c.renglones.join(' · ') }}</p>
                </div>
                <span class="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded" [class]="vence(c).clase">{{ vence(c).texto }}</span>
                <span class="w-24 text-right text-sm font-bold text-white tabular-nums">{{ (c.total ?? 0) | pesos }}</span>
                @if (puedePagar) {
                  <button type="button" (click)="abrir([c], g.proveedor)" class="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold cursor-pointer min-h-[36px]">Pagar</button>
                }
              </li>
            }
          </ul>
        </article>
      } @empty {
        <div class="rounded-xl border border-dashed border-slate-800 py-10 text-center space-y-2">
          <svg lucideWallet class="w-8 h-8 mx-auto text-slate-600"></svg>
          <p class="text-sm text-slate-400">No se le debe nada a ningún proveedor.</p>
        </div>
      }
    </section>

    @if (pago(); as p) {
      <div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" (click)="pago.set(null)">
        <div class="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-5 space-y-4" role="dialog" aria-modal="true" aria-labelledby="pago-titulo" (click)="$event.stopPropagation()">
          <div class="flex items-start justify-between gap-3">
            <div>
              <h3 id="pago-titulo" class="text-base font-bold text-white">Pagar a {{ p.proveedor }}</h3>
              <p class="text-xs text-slate-400">{{ p.compras.length === 1 ? (p.compras[0].folio ? 'Nota ' + p.compras[0].folio : '1 nota') : p.compras.length + ' notas' }}</p>
            </div>
            <button type="button" (click)="pago.set(null)" class="w-9 h-9 rounded-lg text-slate-400 hover:text-white flex items-center justify-center cursor-pointer" aria-label="Cerrar">
              <svg lucideX class="w-4 h-4"></svg>
            </button>
          </div>
          <p class="text-3xl font-black text-white tabular-nums">{{ p.total | pesos }}</p>
          <div class="grid grid-cols-2 gap-2" role="radiogroup" aria-label="¿Cómo se pagó?">
            <button type="button" role="radio" [attr.aria-checked]="forma() === 'CAJA'" (click)="forma.set('CAJA')"
              class="text-left rounded-xl border px-3 py-2.5 cursor-pointer min-h-[56px]"
              [class]="forma() === 'CAJA' ? 'border-indigo-500 bg-indigo-500/10' : 'border-slate-800 bg-slate-950 hover:border-slate-600'">
              <span class="block text-sm font-bold text-white">Efectivo de caja</span>
              <span class="block text-[11px] text-slate-400">Sale del cajón</span>
            </button>
            <button type="button" role="radio" [attr.aria-checked]="forma() === 'TRANSFERENCIA'" (click)="forma.set('TRANSFERENCIA')"
              class="text-left rounded-xl border px-3 py-2.5 cursor-pointer min-h-[56px]"
              [class]="forma() === 'TRANSFERENCIA' ? 'border-indigo-500 bg-indigo-500/10' : 'border-slate-800 bg-slate-950 hover:border-slate-600'">
              <span class="block text-sm font-bold text-white">Transferencia</span>
              <span class="block text-[11px] text-slate-400">No toca la caja</span>
            </button>
          </div>
          @if (forma() === 'CAJA' && cajaAbierta === false) {
            <p class="rounded-lg px-3 py-2 text-xs bg-rose-500/10 text-rose-300" role="status">La caja está cerrada: ábrela en Caja para pagar con efectivo, o paga por transferencia.</p>
          }
          <div class="flex justify-end gap-2">
            <button type="button" (click)="pago.set(null)" class="px-4 py-2.5 rounded-lg border border-slate-700 text-sm text-slate-300 cursor-pointer">Cancelar</button>
            <button type="button" (click)="pagar()" [disabled]="guardando() || (forma() === 'CAJA' && cajaAbierta === false)"
              class="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
              @if (guardando()) { <svg lucideLoader2 class="w-4 h-4 animate-spin"></svg> }
              Marcar pagado
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class PorPagarComponent implements OnChanges {
  private readonly http = inject(HttpClient);
  private readonly avisos = inject(AvisosService);

  @Input({ required: true }) branchId!: string;
  @Input({ required: true }) compras: Compra[] = [];
  @Input() cajaAbierta: boolean | null = null;
  @Input() puedePagar = true;
  /** Se pagó algo: hay que recargar. */
  @Output() pagado = new EventEmitter<void>();

  private readonly lista = signal<Compra[]>([]);
  readonly pago = signal<{ proveedor: string; compras: Compra[]; total: number } | null>(null);
  readonly forma = signal<'CAJA' | 'TRANSFERENCIA'>('TRANSFERENCIA');
  readonly guardando = signal(false);

  readonly grupos = computed<Grupo[]>(() => {
    const hoy = hoyIso();
    const mapa = new Map<string, Grupo>();
    for (const c of this.lista()) {
      const clave = c.proveedorId ?? c.proveedor ?? '—';
      const g = mapa.get(clave) ?? { clave, proveedor: c.proveedor || 'Sin proveedor', total: 0, vencido: 0, compras: [] };
      g.total += c.total ?? 0;
      if (c.vence && c.vence < hoy) g.vencido += c.total ?? 0;
      g.compras.push(c);
      mapa.set(clave, g);
    }
    // Primero a quien se le debe vencido, luego lo que vence antes.
    return [...mapa.values()].sort((a, b) => b.vencido - a.vencido || (a.compras[0].vence ?? '').localeCompare(b.compras[0].vence ?? ''));
  });
  readonly total = computed(() => this.lista().reduce((n, c) => n + (c.total ?? 0), 0));
  readonly vencido = computed(() => this.grupos().reduce((n, g) => n + g.vencido, 0));
  readonly semana = computed(() => {
    const hoy = hoyIso();
    const d = new Date();
    d.setDate(d.getDate() + 7);
    const limite = d.toLocaleDateString('en-CA');
    return this.lista().filter((c) => c.vence && c.vence >= hoy && c.vence <= limite).reduce((n, c) => n + (c.total ?? 0), 0);
  });

  ngOnChanges(): void {
    this.lista.set(this.compras);
  }

  abrir(compras: Compra[], proveedor: string): void {
    this.forma.set(this.cajaAbierta ? 'CAJA' : 'TRANSFERENCIA');
    this.pago.set({ proveedor, compras, total: compras.reduce((n, c) => n + (c.total ?? 0), 0) });
  }

  pagar(): void {
    const p = this.pago();
    if (!p || this.guardando()) return;
    this.guardando.set(true);
    this.http.post<{ mensaje: string }>(`${environment.apiUrl}/branches/${this.branchId}/inventario/compras/pagar`, {
      compras: p.compras.map((c) => c.id),
      forma: this.forma(),
    }).subscribe({
      next: (r) => {
        this.guardando.set(false);
        this.pago.set(null);
        this.avisos.exito(r.mensaje);
        this.pagado.emit();
      },
      error: (err) => {
        this.guardando.set(false);
        this.avisos.error(err.error?.error || 'No se pudo registrar el pago.');
      },
    });
  }

  vence(c: Compra): { texto: string; clase: string } {
    if (!c.vence) return { texto: 'Sin vencimiento', clase: 'bg-slate-800 text-slate-400' };
    const [a, m, d] = c.vence.split('-').map(Number);
    const [ha, hm, hd] = hoyIso().split('-').map(Number);
    const dias = Math.round((new Date(a, m - 1, d).getTime() - new Date(ha, hm - 1, hd).getTime()) / 86_400_000);
    if (dias < 0) return { texto: dias === -1 ? 'Venció ayer' : `Venció hace ${-dias} días`, clase: 'bg-rose-500/15 text-rose-300' };
    if (dias === 0) return { texto: 'Vence hoy', clase: 'bg-amber-500/15 text-amber-300' };
    if (dias <= 3) return { texto: dias === 1 ? 'Vence mañana' : `Vence en ${dias} días`, clase: 'bg-amber-500/15 text-amber-300' };
    return { texto: `Vence en ${dias} días`, clase: 'bg-slate-800 text-slate-300' };
  }

  fechaCorta(iso: string): string {
    const [a, m, d] = iso.slice(0, 10).split('-').map(Number);
    return new Date(a, m - 1, d).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
  }

  formatearPesos = formatearPesos;
}
