import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { LucideCopy, LucideLoader2, LucideMessageCircle, LucidePackageCheck, LucideX } from '@lucide/angular';
import { environment } from '../../../environments/environment';
import { AvisosService } from '../../core/services/avisos.service';
import { unidadesCompatibles } from '../../shared/utils/unidades';
import { SelectorFechaComponent, hoyIso } from '../../shared/components/selector-fecha.component';
import type { ArticuloCompra, Pedido, Presentacion, Proveedor } from './compras-inventario.component';

interface Sugerido {
  tipo: string;
  articuloId: string;
  nombre: string;
  unidad: string;
  existencia: number;
  sugerido: number;
  proveedores: string[];
}

/** Un renglón del pedido que se arma. "u:kg" = unidad suelta; "p:<id>" = presentación. */
interface LineaPedido {
  articulo: ArticuloCompra;
  cantidad: number | null;
  como: string;
  /** Lo que sugiere el reporte, en la unidad del inventario. */
  sugerido: number | null;
}

const CAMPO = 'w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-sm text-white outline-none focus:border-indigo-500 min-h-[40px]';
const DIAS_JS = ['DOM', 'LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB'];

/**
 * Pedirle al proveedor: lo que conviene comprar ya viene separado por quien lo
 * surte; se ajusta, se arma el mensaje de WhatsApp y queda pendiente hasta que
 * llega y se recibe.
 */
@Component({
  selector: 'app-pedidos-proveedor',
  standalone: true,
  imports: [FormsModule, SelectorFechaComponent, LucideCopy, LucideLoader2, LucideMessageCircle, LucidePackageCheck, LucideX],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="grid grid-cols-1 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-6 items-start">
      <!-- Armar pedido -->
      <div class="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 sm:p-5 space-y-4">
        <div>
          <h2 class="text-base font-bold text-white">Armar pedido</h2>
          <p class="text-xs text-slate-400">Lo que conviene pedir para una semana, según lo que se usó y lo que hay.</p>
        </div>

        @if (activos().length) {
          <div>
            <span class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">¿A quién le pides?</span>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2" role="radiogroup" aria-label="Proveedor">
              @for (p of activos(); track p.id) {
                <button type="button" role="radio" [attr.aria-checked]="elegido()?.id === p.id" (click)="elegir(p)"
                  class="text-left rounded-xl border px-3 py-2.5 cursor-pointer min-h-[52px]"
                  [class]="elegido()?.id === p.id ? 'border-indigo-500 bg-indigo-500/10' : 'border-slate-800 bg-slate-950 hover:border-slate-600'">
                  <span class="block text-sm font-bold text-white truncate">{{ p.nombre }}</span>
                  <span class="block text-[11px]" [class]="porPedir(p) ? 'text-amber-300' : 'text-slate-500'">
                    {{ porPedir(p) ? porPedir(p) + (porPedir(p) === 1 ? ' artículo por pedir' : ' artículos por pedir') : 'Nada urgente' }}{{ viene(p) }}
                  </span>
                </button>
              }
            </div>
            @if (sinProveedor().length) {
              <p class="mt-2 text-[11px] text-slate-500">
                Sin proveedor asignado: {{ sinProveedor().join(', ') }}. Asígnalos en Proveedores › Qué surte.
              </p>
            }
          </div>
        } @else {
          <p class="rounded-xl border border-dashed border-slate-800 py-6 px-4 text-center text-sm text-slate-400">
            Primero da de alta a tus proveedores (pestaña Proveedores) y marca qué te surte cada uno.
          </p>
        }

        @if (elegido(); as prov) {
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <span class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">¿Para cuándo?</span>
              <app-selector-fecha idBoton="pd-para" [soloFuturo]="true" [valor]="para()" (valorChange)="para.set($event)" />
            </div>
            <div class="relative">
              <label for="pd-buscar" class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Agregar artículo</label>
              <input id="pd-buscar" autocomplete="off" [ngModel]="busqueda()" (ngModelChange)="busqueda.set($event)" (blur)="cerrarBusqueda()" placeholder="Busca…" class="${CAMPO}" />
              @if (resultados().length) {
                <div class="absolute inset-x-0 top-[calc(100%+4px)] z-30 rounded-xl border border-slate-700 bg-slate-900 p-1 shadow-2xl max-h-64 overflow-y-auto">
                  @for (a of resultados(); track a.tipo + a.id) {
                    <button type="button" (mousedown)="$event.preventDefault(); agregar(a)" class="w-full text-left px-3 py-2 rounded-lg text-sm text-slate-200 hover:bg-slate-800 cursor-pointer">{{ a.nombre }}</button>
                  }
                </div>
              }
            </div>
          </div>

          <div class="space-y-2">
            @for (l of lineas(); track l.articulo.tipo + l.articulo.id; let i = $index) {
              <div class="grid grid-cols-[minmax(0,1fr)_80px_minmax(0,1fr)_auto] gap-2 items-end rounded-xl border border-slate-800 bg-slate-950/50 p-3">
                <div class="min-w-0 col-span-4 sm:col-span-1">
                  <p class="text-sm font-bold text-white truncate">{{ l.articulo.nombre }}</p>
                  <p class="text-[11px] text-slate-500">{{ ayuda(l) }}</p>
                </div>
                <div class="col-start-1 sm:col-start-auto">
                  <label [for]="'pd-c' + i" class="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Cant.</label>
                  <input [id]="'pd-c' + i" type="number" min="0" step="any" inputmode="decimal" [ngModel]="l.cantidad" (ngModelChange)="cambiar(i, { cantidad: $event })" class="${CAMPO} tabular-nums" />
                </div>
                <div>
                  <label [for]="'pd-p' + i" class="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Cómo</label>
                  <select [id]="'pd-p' + i" [ngModel]="l.como" (ngModelChange)="cambiarComo(i, $event)" class="${CAMPO} [color-scheme:dark] cursor-pointer">
                    @for (o of opcionesDe(l.articulo); track o.valor) { <option [value]="o.valor">{{ o.nombre }}</option> }
                  </select>
                </div>
                <button type="button" (click)="quitar(i)" class="h-10 w-10 rounded-lg border border-slate-800 text-slate-500 hover:text-rose-400 flex items-center justify-center cursor-pointer" [attr.aria-label]="'Quitar ' + l.articulo.nombre">
                  <svg lucideX class="w-4 h-4"></svg>
                </button>
              </div>
            } @empty {
              <p class="rounded-xl border border-dashed border-slate-800 py-6 text-center text-sm text-slate-500">
                {{ prov.surte.length ? 'No hay nada urgente de ' + prov.nombre + '. Agrega lo que quieras pedir.' : 'Busca lo que le quieres pedir.' }}
              </p>
            }
          </div>

          <div>
            <label for="pd-nota" class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Nota para el proveedor</label>
            <input id="pd-nota" [ngModel]="nota()" (ngModelChange)="nota.set($event)" maxlength="300" placeholder="Opcional: antes de las 9, factura a nombre de…" class="${CAMPO}" />
          </div>

          <div class="flex flex-wrap items-center justify-end gap-3">
            @if (faltante(); as f) { <p class="text-xs text-amber-300">{{ f }}</p> }
            <button type="button" (click)="guardar()" [disabled]="!!faltante() || guardando()"
              class="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed min-h-[48px]">
              @if (guardando()) { <svg lucideLoader2 class="w-4 h-4 animate-spin"></svg> }
              Guardar y armar mensaje
            </button>
          </div>
        }
      </div>

      <!-- Pedidos -->
      <aside class="space-y-3">
        <h2 class="text-sm font-bold text-white">Pedidos</h2>
        @for (p of pedidos; track p.id) {
          <article class="rounded-xl border bg-slate-900/40 p-3.5 space-y-1.5" [class]="p.estado === 'PENDIENTE' ? 'border-indigo-500/40' : 'border-slate-800 opacity-75'">
            <div class="flex items-baseline justify-between gap-3">
              <strong class="text-sm text-white truncate">{{ p.proveedor }} <span class="font-mono text-[11px] font-semibold text-slate-500">{{ folio(p) }}</span></strong>
              <span class="shrink-0 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded" [class]="pill(p).clase">{{ pill(p).texto }}</span>
            </div>
            @if (p.estado === 'PENDIENTE') {
              <p class="text-[11px]" [class]="p.enviadoEn ? 'text-emerald-300' : 'text-amber-300'">
                {{ p.enviadoEn ? '✓ Mandado por WhatsApp a las ' + hora(p.enviadoEn) : 'Sin mandar: falta el WhatsApp del proveedor' }}
              </p>
            }
            <ul class="text-xs text-slate-300 space-y-0.5">
              @for (r of p.renglones; track r.id) {
                <li>
                  {{ r.descripcion }}
                  @if (r.recibido !== null && r.recibido < r.cantidad) {
                    <span class="text-amber-300"> · {{ r.recibido === 0 ? 'no llegó' : 'llegó ' + legible(r.recibido) }}{{ r.motivo === 'MAL_ESTADO' ? ' (mal estado)' : '' }}</span>
                  }
                </li>
              }
            </ul>
            @if (p.estado === 'PENDIENTE') {
              <div class="flex flex-wrap items-center gap-2 pt-1">
                <button type="button" (click)="recibir.emit(p)" class="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer min-h-[36px]">
                  <svg lucidePackageCheck class="w-4 h-4"></svg> Recibir
                </button>
                <button type="button" (click)="mensaje.set(p)" class="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-700 text-xs font-semibold text-slate-200 hover:border-slate-500 cursor-pointer min-h-[36px]">
                  <svg lucideMessageCircle class="w-4 h-4"></svg> Mensaje
                </button>
                <button type="button" (click)="cancelar(p)" class="ml-auto text-xs text-slate-400 hover:text-rose-300 cursor-pointer min-h-[36px]">Cancelar</button>
              </div>
            }
          </article>
        } @empty {
          <p class="text-xs text-slate-500">Todavía no hay pedidos.</p>
        }
      </aside>
    </section>

    <!-- Mensaje de WhatsApp -->
    @if (mensaje(); as m) {
      <div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" (click)="mensaje.set(null)">
        <div class="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-5 space-y-3" role="dialog" aria-modal="true" aria-labelledby="msj-titulo" (click)="$event.stopPropagation()">
          <div class="flex items-center justify-between">
            <h3 id="msj-titulo" class="text-base font-bold text-white">Pedido a {{ m.proveedor }}</h3>
            <button type="button" (click)="mensaje.set(null)" class="w-9 h-9 rounded-lg text-slate-400 hover:text-white flex items-center justify-center cursor-pointer" aria-label="Cerrar">
              <svg lucideX class="w-4 h-4"></svg>
            </button>
          </div>
          @if (m.enviadoEn) {
            <p class="rounded-xl bg-emerald-500/10 border border-emerald-500/30 px-3.5 py-2.5 text-sm text-emerald-200" role="status">
              ✓ Se le mandó por el WhatsApp de la sucursal a las {{ hora(m.enviadoEn) }}. Si la sesión de WhatsApp está caída, sale en cuanto se reconecte.
            </p>
          } @else if (m.telefono) {
            <p class="rounded-xl bg-amber-500/10 border border-amber-500/30 px-3.5 py-2.5 text-sm text-amber-200">Todavía no se le manda.</p>
          } @else {
            <p class="rounded-xl bg-amber-500/10 border border-amber-500/30 px-3.5 py-2.5 text-sm text-amber-200">
              {{ m.proveedor }} no tiene WhatsApp en su ficha: ponlo en Proveedores para que el pedido le llegue solo. Mientras, ábrelo en tu WhatsApp o cópialo.
            </p>
          }
          <pre class="whitespace-pre-wrap rounded-xl border border-emerald-900 bg-emerald-950/60 p-3.5 font-mono text-[13px] leading-relaxed text-emerald-100">{{ m.mensaje }}</pre>
          <div class="flex flex-wrap items-center gap-2">
            @if (m.telefono && m.estado === 'PENDIENTE') {
              <button type="button" (click)="enviar(m)" [disabled]="enviando()"
                class="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold cursor-pointer disabled:opacity-40 min-h-[44px]">
                <svg lucideMessageCircle class="w-4 h-4"></svg> {{ m.enviadoEn ? 'Volver a mandar' : 'Mandar por WhatsApp' }}
              </button>
            }
            <a [href]="enlaceWhatsapp(m)" target="_blank" rel="noopener"
              class="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-700 text-sm font-semibold text-slate-200 hover:border-slate-500 min-h-[44px]">
              Abrir en mi WhatsApp
            </a>
            <button type="button" (click)="copiar(m)" class="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-700 text-sm font-semibold text-slate-200 hover:border-slate-500 cursor-pointer min-h-[44px]">
              <svg lucideCopy class="w-4 h-4"></svg> Copiar
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class PedidosProveedorComponent implements OnChanges {
  private readonly http = inject(HttpClient);
  private readonly avisos = inject(AvisosService);

  @Input({ required: true }) branchId!: string;
  @Input({ required: true }) articulos: ArticuloCompra[] = [];
  @Input({ required: true }) proveedores: Proveedor[] = [];
  @Input({ required: true }) presentaciones: Presentacion[] = [];
  @Input({ required: true }) pedidos: Pedido[] = [];
  /** Se guardó o canceló un pedido: hay que recargar la lista. */
  @Output() cambio = new EventEmitter<void>();
  @Output() recibir = new EventEmitter<Pedido>();

  readonly sugeridos = signal<Sugerido[]>([]);
  readonly elegido = signal<Proveedor | null>(null);
  readonly para = signal(manana());
  readonly nota = signal('');
  readonly busqueda = signal('');
  readonly lineas = signal<LineaPedido[]>([]);
  readonly guardando = signal(false);
  readonly mensaje = signal<Pedido | null>(null);
  readonly enviando = signal(false);
  private readonly listaProveedores = signal<Proveedor[]>([]);
  private readonly listaArticulos = signal<ArticuloCompra[]>([]);

  readonly activos = computed(() => this.listaProveedores().filter((p) => p.activo));
  readonly sinProveedor = computed(() => this.sugeridos().filter((s) => !s.proveedores.length).map((s) => s.nombre));

  readonly resultados = computed(() => {
    const q = normal(this.busqueda());
    if (!q) return [];
    const ya = new Set(this.lineas().map((l) => l.articulo.id));
    return this.listaArticulos().filter((a) => a.activo && !ya.has(a.id) && normal(a.nombre).includes(q)).slice(0, 10);
  });

  readonly faltante = computed(() => {
    if (!this.lineas().length) return 'Agrega al menos un artículo.';
    if (this.lineas().some((l) => !(Number(l.cantidad) > 0))) return 'Falta la cantidad de algún artículo.';
    return null;
  });

  ngOnChanges(): void {
    this.listaProveedores.set(this.proveedores);
    this.listaArticulos.set(this.articulos);
    if (this.branchId && !this.sugeridos().length) this.cargarSugerencias();
  }

  private api(ruta: string): string {
    return `${environment.apiUrl}/branches/${this.branchId}/inventario/${ruta}`;
  }

  cargarSugerencias(): void {
    this.http.get<Sugerido[]>(this.api('pedidos/sugerencias')).subscribe({ next: (s) => this.sugeridos.set(s) });
  }

  porPedir(p: Proveedor): number {
    return this.sugeridos().filter((s) => s.proveedores.includes(p.id)).length;
  }

  viene(p: Proveedor): string {
    const nombres: Record<string, string> = { LUN: 'lun', MAR: 'mar', MIE: 'mié', JUE: 'jue', VIE: 'vie', SAB: 'sáb', DOM: 'dom' };
    return p.diasVisita.length ? ' · viene ' + p.diasVisita.map((d) => nombres[d] ?? d).join(', ') : '';
  }

  /** Al elegir proveedor se precarga lo sugerido de lo que surte, y la fecha de su próxima visita. */
  elegir(p: Proveedor): void {
    this.elegido.set(p);
    this.para.set(proximaVisita(p.diasVisita));
    this.lineas.set(this.sugeridos()
      .filter((s) => s.proveedores.includes(p.id))
      .map((s) => this.articuloDe(s.tipo, s.articuloId))
      .filter((a): a is ArticuloCompra => !!a)
      .map((a) => this.lineaSugerida(a)));
  }

  private articuloDe(tipo: string, id: string): ArticuloCompra | undefined {
    return this.listaArticulos().find((a) => a.id === id && (a.tipo === 'PRODUCTO') === (tipo === 'PRODUCTO'));
  }

  /** Lo sugerido en la presentación del proveedor si la hay, redondeado hacia arriba: 30 piezas = 2 cajas de 24. */
  private lineaSugerida(a: ArticuloCompra): LineaPedido {
    const s = this.sugeridos().find((x) => x.articuloId === a.id)?.sugerido ?? null;
    const pres = this.presentacionesDe(a)[0];
    if (pres) return { articulo: a, como: 'p:' + pres.id, cantidad: s ? Math.ceil(s / pres.factor) : 1, sugerido: s };
    const entero = a.tipo === 'PRODUCTO' || a.unidad === 'pieza';
    return { articulo: a, como: 'u:' + this.unidadesDe(a)[0], cantidad: s ? (entero ? Math.ceil(s) : redondear(s)) : null, sugerido: s };
  }

  agregar(a: ArticuloCompra): void {
    this.lineas.update((l) => [...l, this.lineaSugerida(a)]);
    this.busqueda.set('');
  }

  cerrarBusqueda(): void {
    setTimeout(() => this.busqueda.set(''), 150);
  }

  quitar(i: number): void {
    this.lineas.update((l) => l.filter((_, j) => j !== i));
  }

  cambiar(i: number, cambio: Partial<LineaPedido>): void {
    this.lineas.update((l) => l.map((x, j) => (j === i ? { ...x, ...cambio } : x)));
  }

  cambiarComo(i: number, como: string): void {
    this.cambiar(i, { como });
  }

  ayuda(l: LineaPedido): string {
    const s = this.sugeridos().find((x) => x.articuloId === l.articulo.id);
    if (!s) return 'Se lleva en ' + l.articulo.unidad;
    return `Hay ${legible(s.existencia)} ${s.unidad} · conviene pedir ${legible(s.sugerido)} ${s.unidad}`;
  }

  presentacionesDe(a: ArticuloCompra): Presentacion[] {
    return this.presentaciones.filter((p) => p.articuloId === a.id);
  }

  private unidadesDe(a: ArticuloCompra): string[] {
    return a.tipo === 'PRODUCTO' ? ['pieza'] : unidadesCompatibles(a.unidad);
  }

  opcionesDe(a: ArticuloCompra): { valor: string; nombre: string }[] {
    return [
      ...this.presentacionesDe(a).map((p) => ({ valor: 'p:' + p.id, nombre: `${p.nombre} (${legible(p.factor)} ${a.unidad})` })),
      ...this.unidadesDe(a).map((u) => ({ valor: 'u:' + u, nombre: u })),
    ];
  }

  guardar(): void {
    const p = this.elegido();
    if (!p || this.faltante() || this.guardando()) return;
    this.guardando.set(true);
    this.http.post<Pedido>(this.api('pedidos'), {
      proveedorId: p.id,
      para: this.para(),
      nota: this.nota().trim() || null,
      renglones: this.lineas().map((l) => ({
        ingredientId: l.articulo.tipo === 'PRODUCTO' ? null : l.articulo.id,
        productId: l.articulo.tipo === 'PRODUCTO' ? l.articulo.id : null,
        cantidad: Number(l.cantidad),
        unidad: l.como.startsWith('u:') ? l.como.slice(2) : null,
        presentacionId: l.como.startsWith('p:') ? l.como.slice(2) : null,
      })),
    }).subscribe({
      next: (pedido) => {
        this.guardando.set(false);
        this.elegido.set(null);
        this.lineas.set([]);
        this.nota.set('');
        this.mensaje.set(pedido);
        if (pedido.enviadoEn) this.avisos.exito(`Pedido mandado por WhatsApp a ${pedido.proveedor}.`);
        this.cambio.emit();
      },
      error: (err) => {
        this.guardando.set(false);
        this.avisos.error(err.error?.error || 'No se pudo guardar el pedido.');
      },
    });
  }

  async cancelar(p: Pedido): Promise<void> {
    if (!(await this.avisos.confirmar({
      titulo: `¿Cancelar el pedido a ${p.proveedor}?`,
      mensaje: 'Queda en la lista como cancelado. Avísale al proveedor si ya se lo mandaste.',
      confirmar: 'Cancelar pedido', cancelar: 'Volver', peligro: true,
    }))) return;
    this.http.post<{ mensaje: string }>(this.api(`pedidos/${p.id}/cancelar`), {}).subscribe({
      next: (r) => {
        this.avisos.exito(r.mensaje);
        this.cambio.emit();
      },
      error: (err) => this.avisos.error(err.error?.error || 'No se pudo cancelar el pedido.'),
    });
  }

  /** Lo manda (o lo vuelve a mandar) por el WhatsApp de la sucursal. */
  enviar(p: Pedido): void {
    if (this.enviando()) return;
    this.enviando.set(true);
    this.http.post<Pedido>(this.api(`pedidos/${p.id}/enviar`), {}).subscribe({
      next: (r) => {
        this.enviando.set(false);
        this.mensaje.set(r);
        this.avisos.exito(`Pedido mandado por WhatsApp a ${r.proveedor}.`);
        this.cambio.emit();
      },
      error: (err) => {
        this.enviando.set(false);
        this.avisos.error(err.error?.error || 'No se pudo mandar el pedido.');
      },
    });
  }

  /** "P-3F9A2C": el mismo folio que lleva el mensaje al proveedor. */
  folio(p: Pedido): string {
    return 'P-' + p.id.replace(/-/g, '').slice(0, 6).toUpperCase();
  }

  hora(iso: string): string {
    return new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  }

  enlaceWhatsapp(p: Pedido): string {
    const texto = encodeURIComponent(p.mensaje);
    let tel = (p.telefono ?? '').replace(/\D/g, '');
    if (tel.length === 10) tel = '52' + tel; // número de México sin lada de país
    return tel ? `https://wa.me/${tel}?text=${texto}` : `https://wa.me/?text=${texto}`;
  }

  async copiar(p: Pedido): Promise<void> {
    try {
      await navigator.clipboard.writeText(p.mensaje);
      this.avisos.exito('Mensaje copiado.');
    } catch {
      this.avisos.error('No se pudo copiar: selecciona el texto y cópialo a mano.');
    }
  }

  pill(p: Pedido): { texto: string; clase: string } {
    if (p.estado === 'RECIBIDO') {
      const incompleto = p.renglones.some((r) => r.recibido !== null && r.recibido < r.cantidad);
      return incompleto ? { texto: 'Recibido incompleto', clase: 'bg-amber-500/15 text-amber-300' } : { texto: 'Recibido', clase: 'bg-emerald-500/15 text-emerald-300' };
    }
    if (p.estado === 'CANCELADO') return { texto: 'Cancelado', clase: 'bg-slate-800 text-slate-400' };
    if (!p.para) return { texto: 'Pendiente', clase: 'bg-indigo-500/15 text-indigo-300' };
    const hoy = hoyIso();
    if (p.para < hoy) return { texto: 'Atrasado · era para ' + fechaCorta(p.para), clase: 'bg-rose-500/15 text-rose-300' };
    return { texto: 'Para ' + (p.para === hoy ? 'hoy' : p.para === manana() ? 'mañana' : fechaCorta(p.para)), clase: 'bg-indigo-500/15 text-indigo-300' };
  }

  legible = legible;
}

function manana(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return iso(d);
}

/** El siguiente día que viene el proveedor (desde mañana); si no tiene días fijos, mañana. */
function proximaVisita(dias: string[]): string {
  if (!dias.length) return manana();
  const d = new Date();
  for (let i = 1; i <= 7; i++) {
    d.setDate(d.getDate() + 1);
    if (dias.includes(DIAS_JS[d.getDay()])) return iso(d);
  }
  return manana();
}

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fechaCorta(s: string): string {
  const [a, m, d] = s.slice(0, 10).split('-').map(Number);
  return new Date(a, m - 1, d).toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' });
}

function normal(s: string): string {
  return (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

function legible(n: number): string {
  return new Intl.NumberFormat('es-MX', { maximumFractionDigits: 3 }).format(n);
}

function redondear(n: number): number {
  return Math.ceil(n * 10) / 10;
}
