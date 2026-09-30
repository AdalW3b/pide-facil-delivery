import { ChangeDetectionStrategy, Component, OnInit, inject, input, output, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import { environment } from '../../../environments/environment';
import { cantidadLegible } from '../../shared/utils/unidades';
import { ObjetivoInventario } from './movimiento-inventario.component';

interface Movimiento {
  id: string;
  tipo: 'VENTA' | 'CANCELACION' | 'ENTRADA' | 'MERMA' | 'CONTEO' | 'AJUSTE';
  cantidad: number;
  saldo: number;
  costoUnitario: number | null;
  proveedor: string | null;
  nota: string | null;
  usuario: string | null;
  orderId: string | null;
  creadoEn: string;
}

const ETIQUETAS: Record<Movimiento['tipo'], { texto: string; clase: string }> = {
  VENTA: { texto: 'Venta', clase: 'bg-slate-800 text-slate-300' },
  CANCELACION: { texto: 'Cancelación', clase: 'bg-slate-800 text-slate-300' },
  ENTRADA: { texto: 'Entrada', clase: 'bg-emerald-500/15 text-emerald-300' },
  MERMA: { texto: 'Merma', clase: 'bg-rose-500/15 text-rose-300' },
  CONTEO: { texto: 'Conteo', clase: 'bg-sky-500/15 text-sky-300' },
  AJUSTE: { texto: 'Ajuste', clase: 'bg-amber-500/15 text-amber-300' },
};

/** Los últimos movimientos de un ingrediente o producto: qué pasó, quién y cómo quedó. */
@Component({
  selector: 'app-historial-inventario',
  standalone: true,
  imports: [DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-labelledby="hist-titulo">
      <div (click)="cerrar.emit()" class="absolute inset-0 bg-slate-950/60"></div>
      <aside class="relative w-full max-w-md h-full bg-slate-900 border-l border-slate-800 flex flex-col">
        <div class="px-5 py-4 border-b border-slate-800 flex items-start justify-between gap-3">
          <div>
            <h3 id="hist-titulo" class="text-base font-bold text-white">{{ objetivo().nombre }}</h3>
            <p class="text-xs text-slate-400 mt-0.5">Hoy hay {{ legible(objetivo().stock) }} · últimos 100 movimientos</p>
          </div>
          <button (click)="cerrar.emit()" class="text-slate-400 hover:text-white text-sm cursor-pointer" aria-label="Cerrar">✕</button>
        </div>

        <div class="flex-1 overflow-y-auto">
          @if (cargando()) {
            <p class="p-6 text-sm text-slate-500">Cargando…</p>
          } @else if (movimientos().length === 0) {
            <p class="p-6 text-sm text-slate-500">Todavía no hay movimientos. Aparecen al vender, cancelar o registrar entradas, mermas y conteos.</p>
          } @else {
            <ol class="divide-y divide-slate-800">
              @for (m of movimientos(); track m.id) {
                <li class="px-5 py-3 text-xs space-y-1">
                  <div class="flex items-center gap-2">
                    <span class="px-2 py-0.5 rounded font-bold" [class]="etiqueta(m).clase">{{ etiqueta(m).texto }}</span>
                    <span class="font-bold tabular-nums" [class]="m.cantidad < 0 ? 'text-rose-300' : m.cantidad > 0 ? 'text-emerald-300' : 'text-slate-400'">
                      {{ m.cantidad > 0 ? '+' : m.cantidad < 0 ? '−' : '' }}{{ legible(abs(m.cantidad)) }}
                    </span>
                    <span class="ml-auto text-slate-500 tabular-nums">quedó {{ legible(m.saldo) }}</span>
                  </div>
                  @if (m.nota) {
                    <p class="text-slate-300">{{ m.nota }}</p>
                  }
                  <p class="text-slate-500">
                    {{ m.creadoEn | date: 'd MMM, HH:mm' }}@if (m.usuario) { · {{ m.usuario }} }
                    @if (m.costoUnitario) { · {{ m.costoUnitario.toFixed(2) }} $/{{ objetivo().unidad }} }
                    @if (m.proveedor) { · {{ m.proveedor }} }
                  </p>
                </li>
              }
            </ol>
          }
        </div>
      </aside>
    </div>
  `,
})
export class HistorialInventarioComponent implements OnInit {
  private readonly http = inject(HttpClient);

  readonly branchId = input.required<string>();
  readonly objetivo = input.required<ObjetivoInventario>();
  readonly cerrar = output<void>();

  readonly movimientos = signal<Movimiento[]>([]);
  readonly cargando = signal(true);

  ngOnInit(): void {
    const o = this.objetivo();
    const filtro = o.tipo === 'INGREDIENTE' ? `ingredientId=${o.id}` : `productId=${o.id}`;
    this.http.get<Movimiento[]>(`${environment.apiUrl}/branches/${this.branchId()}/inventario/movimientos?${filtro}`).subscribe({
      next: (lista) => {
        this.movimientos.set(lista);
        this.cargando.set(false);
      },
      error: () => this.cargando.set(false),
    });
  }

  etiqueta(m: Movimiento) {
    return ETIQUETAS[m.tipo];
  }

  abs(n: number): number {
    return Math.abs(n);
  }

  legible(n: number): string {
    return this.objetivo().tipo === 'PRODUCTO'
      ? `${Math.round(n * 1000) / 1000} ${Math.abs(n) === 1 ? 'pieza' : 'piezas'}`
      : cantidadLegible(n, this.objetivo().unidad);
  }
}
