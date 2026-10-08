import { ChangeDetectionStrategy, Component, ElementRef, EventEmitter, Input, Output, computed, inject, signal } from '@angular/core';
import { LucideCalendar, LucideChevronLeft, LucideChevronRight } from '@lucide/angular';

/** "2026-10-08" en la zona del navegador, sin pasar por UTC. */
export function hoyIso(): string {
  return aIso(new Date());
}

function aIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function deIso(s: string): Date {
  const [a, m, d] = s.split('-').map(Number);
  return new Date(a, m - 1, d);
}

/**
 * Elegir una fecha con calendario. Con `soloPasado` (una compra se captura
 * cuando ya llegó) no deja elegir días futuros y trae Hoy, Ayer, Antier; con
 * `soloFuturo` (para cuándo se pide) no deja elegir días pasados y trae Hoy,
 * Mañana, Pasado mañana.
 */
@Component({
  selector: 'app-selector-fecha',
  standalone: true,
  imports: [LucideCalendar, LucideChevronLeft, LucideChevronRight],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'relative block',
    '(document:click)': 'alClicFuera($event)',
    '(document:keydown.escape)': 'abierto.set(false)',
  },
  template: `
    <button type="button" [id]="idBoton" (click)="alternar()" [attr.aria-expanded]="abierto()" aria-haspopup="dialog"
      class="w-full flex items-center justify-between gap-2 bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-sm text-white min-h-[40px] cursor-pointer hover:border-slate-600 focus-visible:border-indigo-500 outline-none">
      <span class="truncate">{{ texto() }}</span>
      <svg lucideCalendar class="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true"></svg>
    </button>
    @if (abierto()) {
      <div class="absolute right-0 top-[calc(100%+4px)] z-40 w-[18rem] max-w-[calc(100vw-2rem)] rounded-2xl border border-slate-700 bg-slate-900 p-3 shadow-2xl space-y-2.5"
        role="dialog" aria-label="Elegir la fecha">
        <div class="grid grid-cols-3 gap-1.5">
          @for (a of atajos; track a.dias) {
            <button type="button" (click)="elegirDesdeHoy(a.dias)" class="py-1.5 rounded-lg border border-slate-700 text-xs font-semibold text-slate-200 hover:border-slate-500 cursor-pointer">{{ a.nombre }}</button>
          }
        </div>
        <div class="flex items-center justify-between">
          <button type="button" (click)="mover(-1)" class="w-9 h-9 rounded-lg border border-slate-700 flex items-center justify-center cursor-pointer" aria-label="Mes anterior">
            <svg lucideChevronLeft class="w-4 h-4"></svg>
          </button>
          <span class="text-sm font-bold text-white capitalize">{{ tituloMes() }}</span>
          <button type="button" (click)="mover(1)" [disabled]="!puedeAvanzar()" class="w-9 h-9 rounded-lg border border-slate-700 flex items-center justify-center cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed" aria-label="Mes siguiente">
            <svg lucideChevronRight class="w-4 h-4"></svg>
          </button>
        </div>
        <div class="grid grid-cols-7 gap-1 text-center">
          @for (d of encabezados; track $index) {
            <span class="text-[10px] font-bold uppercase text-slate-500 py-1">{{ d }}</span>
          }
          @for (c of celdas(); track $index) {
            @if (c) {
              <button type="button" (click)="elegir(c.iso)" [disabled]="c.futuro" [attr.aria-pressed]="c.iso === valor"
                [attr.aria-label]="c.etiqueta"
                class="h-9 rounded-lg text-sm font-semibold tabular-nums cursor-pointer disabled:opacity-25 disabled:cursor-not-allowed"
                [class]="c.iso === valor ? 'bg-indigo-600 text-white' : c.hoy ? 'border border-indigo-500 text-white' : 'text-slate-200 hover:bg-slate-800'">
                {{ c.dia }}
              </button>
            } @else {
              <span></span>
            }
          }
        </div>
        @if (soloFuturo) {
          <p class="text-[11px] text-slate-500">No se pueden elegir días pasados.</p>
        } @else if (soloPasado) {
          <p class="text-[11px] text-slate-500">No se pueden elegir días futuros.</p>
        }
      </div>
    }
  `,
})
export class SelectorFechaComponent {
  private readonly host = inject(ElementRef<HTMLElement>);

  /** "YYYY-MM-DD". */
  @Input({ required: true }) set valor(v: string) {
    this._valor = v;
    const d = deIso(v);
    this.mesVisto.set(new Date(d.getFullYear(), d.getMonth(), 1));
  }
  get valor(): string {
    return this._valor;
  }
  @Input() soloPasado = true;
  /** Para fechas que vienen: tiene prioridad sobre `soloPasado`. */
  @Input() soloFuturo = false;
  @Input() idBoton = 'selector-fecha';
  @Output() valorChange = new EventEmitter<string>();

  private _valor = hoyIso();
  readonly abierto = signal(false);
  readonly mesVisto = signal(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  readonly encabezados = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
  get atajos(): { nombre: string; dias: number }[] {
    return this.soloFuturo
      ? [{ nombre: 'Hoy', dias: 0 }, { nombre: 'Mañana', dias: 1 }, { nombre: 'Pasado mañana', dias: 2 }]
      : [{ nombre: 'Hoy', dias: 0 }, { nombre: 'Ayer', dias: -1 }, { nombre: 'Antier', dias: -2 }];
  }

  readonly tituloMes = computed(() => this.mesVisto().toLocaleDateString('es-MX', { month: 'long', year: 'numeric' }));

  readonly puedeAvanzar = computed(() => {
    if (this.soloFuturo || !this.soloPasado) return true;
    const hoy = new Date();
    const m = this.mesVisto();
    return m.getFullYear() < hoy.getFullYear() || (m.getFullYear() === hoy.getFullYear() && m.getMonth() < hoy.getMonth());
  });

  readonly celdas = computed(() => {
    const m = this.mesVisto();
    const hoy = hoyIso();
    const vacias = (m.getDay() + 6) % 7; // la semana empieza en lunes
    const dias = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
    const celdas: ({ dia: number; iso: string; hoy: boolean; futuro: boolean; etiqueta: string } | null)[] = Array(vacias).fill(null);
    for (let d = 1; d <= dias; d++) {
      const fecha = new Date(m.getFullYear(), m.getMonth(), d);
      const iso = aIso(fecha);
      celdas.push({
        dia: d, iso, hoy: iso === hoy, futuro: this.soloFuturo ? iso < hoy : this.soloPasado && iso > hoy,
        etiqueta: fecha.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' }),
      });
    }
    return celdas;
  });

  /** "Hoy, mié 8 oct", "Ayer, mar 7 oct", "Mañana, jue 9 oct" o "lun 29 sep". */
  texto(): string {
    const d = deIso(this.valor);
    const corta = d.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' });
    const dif = Math.round((deIso(hoyIso()).getTime() - d.getTime()) / 86_400_000);
    return dif === 0 ? `Hoy, ${corta}` : dif === 1 ? `Ayer, ${corta}` : dif === -1 ? `Mañana, ${corta}` : corta;
  }

  alternar(): void {
    this.abierto.update((a) => !a);
  }

  mover(meses: number): void {
    const m = this.mesVisto();
    this.mesVisto.set(new Date(m.getFullYear(), m.getMonth() + meses, 1));
  }

  elegir(iso: string): void {
    this._valor = iso;
    this.valorChange.emit(iso);
    this.abierto.set(false);
  }

  /** Días desde hoy: negativos hacia atrás. */
  elegirDesdeHoy(dias: number): void {
    const d = new Date();
    d.setDate(d.getDate() + dias);
    this.elegir(aIso(d));
  }

  alClicFuera(e: MouseEvent): void {
    if (this.abierto() && !this.host.nativeElement.contains(e.target as Node)) this.abierto.set(false);
  }
}
