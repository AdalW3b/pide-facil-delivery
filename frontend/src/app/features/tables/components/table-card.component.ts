import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { Table, TableStatus, TableKitchenStatus } from '../models/table.model';
import { LucideQrCode, LucideLock, LucideUsers } from '@lucide/angular';
import { PesosPipe } from '../../../shared/utils/pesos';

@Component({
  selector: 'app-table-card',
  standalone: true,
  imports: [LucideQrCode, LucideLock, LucideUsers, PesosPipe],
  template: `
    <div
      role="button"
      [attr.tabindex]="disabled ? -1 : 0"
      [attr.aria-label]="etiqueta()"
      (click)="onCardClick()"
      (keydown.enter)="onCardClick()"
      (keydown.space)="$event.preventDefault(); onCardClick()"
      [class.opacity-50]="disabled"
      [class.pointer-events-none]="disabled"
      [class.border-emerald-500\/30]="!disabled && table.status === 'AVAILABLE'"
      [class.hover:border-emerald-500\/60]="!disabled && table.status === 'AVAILABLE'"
      [class.border-rose-500\/40]="!disabled && table.status === 'OCCUPIED' && !cocina"
      [class.hover:border-rose-500\/70]="!disabled && table.status === 'OCCUPIED' && !cocina"
      [class.bg-rose-950\/10]="!disabled && table.status === 'OCCUPIED' && !cocina"
      [class]="clasesCocina()"
      [class.border-slate-800]="disabled"
      class="relative w-full h-full min-h-[132px] flex flex-col gap-2 p-4 rounded-2xl border bg-slate-900/40 hover:bg-slate-900/70 transition-colors duration-200 cursor-pointer text-left outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
    >
      <!-- Número y estado -->
      <div class="flex items-start justify-between gap-2">
        <span class="text-3xl font-black leading-none tabular-nums" [class.text-slate-500]="disabled" [class.text-white]="!disabled">
          {{ table.tableNumber }}
        </span>
        @if (disabled) {
          <span class="flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-800/80 text-[11px] font-bold text-slate-400">
            <svg lucideLock class="w-3 h-3"></svg>
            No asignada
          </span>
        } @else if (table.status === 'AVAILABLE') {
          <span class="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-bold text-emerald-400">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            Libre
          </span>
        } @else if (cocina) {
          <span class="flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[11px] font-bold" [class]="claseInsignia()">
            <span class="w-1.5 h-1.5 rounded-full" [class]="clasePunto()"></span>
            {{ textoCocina() }}
          </span>
        } @else {
          <span class="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-[11px] font-bold text-rose-400">
            <span class="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
            Ocupada
          </span>
        }
      </div>

      <!-- Lo que importa durante el servicio: cuánto lleva y desde cuándo -->
      <div class="flex-1 min-h-0">
        @if (!disabled && table.status === 'OCCUPIED') {
          <p class="text-lg font-bold text-white tabular-nums leading-tight">{{ (table.totalAmount ?? 0) | pesos }}</p>
          @if (minutosAbierta() !== null) {
            <p class="text-xs tabular-nums" [class]="minutosAbierta()! >= 90 ? 'text-amber-400' : 'text-slate-400'">
              Abierta hace {{ textoMinutos() }}
            </p>
          }
        } @else if (!disabled) {
          <p class="text-xs text-slate-400">Toca para abrir</p>
        }
      </div>

      <!-- Meseros y acciones secundarias -->
      <div class="flex items-center justify-between gap-2 pt-2 border-t border-slate-800/60" (click)="$event.stopPropagation()">
        <div class="min-w-0 flex flex-wrap gap-1">
          @if (table.assignedWaiters && table.assignedWaiters.length > 0) {
            @for (waiter of table.assignedWaiters; track waiter.id) {
              <span class="text-[11px] bg-indigo-500/15 text-indigo-300 px-1.5 py-0.5 rounded truncate max-w-[88px]" [title]="waiter.name">
                {{ waiter.name.split(' ')[0] }}
              </span>
            }
          } @else {
            <span class="text-[11px] text-slate-500">Sin mesero</span>
          }
        </div>
        @if (!disabled) {
          <div class="flex items-center shrink-0 -mr-1.5">
            @if (hasFullAccess) {
              <button type="button" (click)="onAssignClick($event)"
                class="p-1.5 rounded-md text-slate-400 hover:text-indigo-300 hover:bg-slate-800 cursor-pointer"
                [attr.aria-label]="'Asignar meseros a la mesa ' + table.tableNumber" title="Asignar meseros">
                <svg lucideUsers class="w-4 h-4"></svg>
              </button>
            }
            <button type="button" (click)="onQrClick($event)"
              class="p-1.5 rounded-md text-slate-400 hover:text-indigo-300 hover:bg-slate-800 cursor-pointer"
              [attr.aria-label]="'Ver el QR de la mesa ' + table.tableNumber" title="Ver QR">
              <svg lucideQrCode class="w-4 h-4"></svg>
            </button>
          </div>
        }
      </div>
    </div>
  `,
  host: { class: 'block h-full' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TableCardComponent {
  @Input({ required: true }) table!: Table;
  @Input() disabled: boolean = false;
  @Input() hasFullAccess: boolean = false;
  /** Hora actual (ms); la pasa el mapa y avanza sola para contar los minutos. */
  @Input() ahora: number = Date.now();
  @Output() cardClick = new EventEmitter<Table>();
  @Output() qrClick = new EventEmitter<Table>();
  @Output() assignClick = new EventEmitter<Table>();

  /** Minutos desde que se abrió la cuenta; null si no se sabe. */
  minutosAbierta(): number | null {
    const desde = this.table?.abiertaDesde;
    if (!desde || String(this.table.status) !== 'OCCUPIED') return null;
    const ms = this.ahora - new Date(desde).getTime();
    return Number.isFinite(ms) ? Math.max(0, Math.floor(ms / 60000)) : null;
  }

  textoMinutos(): string {
    const m = this.minutosAbierta() ?? 0;
    if (m < 60) return `${m} min`;
    return `${Math.floor(m / 60)} h ${m % 60} min`;
  }

  /** Lo que anuncia un lector de pantalla al llegar a la tarjeta. */
  etiqueta(): string {
    const n = `Mesa ${this.table.tableNumber}`;
    if (this.disabled) return `${n}, no asignada a ti`;
    if (String(this.table.status) === 'AVAILABLE') return `${n}, libre. Abrir cuenta`;
    return `${n}, ocupada. Ver cuenta`;
  }

  /**
   * Estado de cocina que debe pintar la mesa. Solo aplica a mesas ocupadas:
   * una mesa libre nunca lleva color de cocina.
   */
  get cocina(): TableKitchenStatus | null {
    if (this.disabled || !this.table) return null;
    if (String(this.table.status) !== 'OCCUPIED') return null;
    return this.table.kitchenStatus ?? null;
  }

  /** Mismo código de color que el tablero de cocina, para leerlos igual. */
  clasesCocina(): string {
    switch (this.cocina) {
      case 'PENDING':
        return 'border-indigo-500/40 hover:border-indigo-500/70 bg-indigo-950/10 shadow-indigo-950/20';
      case 'PREPARING':
        return 'border-amber-500/40 hover:border-amber-500/70 bg-amber-950/10 shadow-amber-950/20';
      case 'READY':
        // El anillo distingue "listo" de una mesa libre, que también es verde.
        return 'border-emerald-500/50 hover:border-emerald-400 bg-emerald-950/15 shadow-emerald-950/20 ring-2 ring-emerald-500/40';
      case 'DELIVERED':
        return 'border-slate-700/50 hover:border-slate-600 bg-slate-900/30';
      default:
        return '';
    }
  }

  claseInsignia(): string {
    switch (this.cocina) {
      case 'PENDING':
        return 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400';
      case 'PREPARING':
        return 'bg-amber-500/10 border-amber-500/20 text-amber-400';
      case 'READY':
        return 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400';
      case 'DELIVERED':
        return 'bg-slate-500/10 border-slate-500/20 text-slate-400';
      default:
        return '';
    }
  }

  clasePunto(): string {
    switch (this.cocina) {
      case 'PENDING':
        return 'bg-indigo-500 animate-pulse';
      case 'PREPARING':
        return 'bg-amber-500 animate-pulse';
      case 'READY':
        return 'bg-emerald-500 animate-pulse';
      case 'DELIVERED':
        return 'bg-slate-500';
      default:
        return '';
    }
  }

  textoCocina(): string {
    switch (this.cocina) {
      case 'PENDING':
        return 'En cocina';
      case 'PREPARING':
        return 'Preparando';
      case 'READY':
        return 'Listo';
      case 'DELIVERED':
        return 'Entregado';
      default:
        return '';
    }
  }

  onCardClick(): void {
    if (!this.disabled) {
      this.cardClick.emit(this.table);
    }
  }

  onQrClick(event: Event): void {
    event.stopPropagation();
    if (!this.disabled) {
      this.qrClick.emit(this.table);
    }
  }

  onAssignClick(event: Event): void {
    event.stopPropagation();
    this.assignClick.emit(this.table);
  }
}
