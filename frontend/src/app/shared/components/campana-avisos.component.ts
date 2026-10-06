import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { LucideBell } from '@lucide/angular';
import { environment } from '../../../environments/environment';

interface Aviso {
  id: string;
  tipo: string;
  titulo: string;
  detalle: string | null;
  creadoEn: string;
  leido: boolean;
}

/** Cada cuánto se revisa si hay avisos nuevos. */
const CADA_MS = 60_000;

/**
 * La campana del dueño: avisos de la plataforma (soporte entró a su cuenta,
 * usó su código, cobros de la renta). Al abrirla quedan como leídos.
 */
@Component({
  selector: 'app-campana-avisos',
  standalone: true,
  imports: [DatePipe, RouterLink, LucideBell],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'relative block' },
  template: `
    <button type="button" (click)="alternar()" [attr.aria-expanded]="abierta()"
      [attr.aria-label]="noLeidos() ? noLeidos() + ' avisos sin leer' : 'Avisos'"
      class="relative p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer">
      <svg lucideBell class="w-5 h-5"></svg>
      @if (noLeidos() > 0) {
        <span class="absolute -top-0.5 -right-0.5 min-w-5 h-5 px-1 rounded-full bg-rose-500 text-white text-[11px] font-black flex items-center justify-center tabular-nums">
          {{ noLeidos() > 9 ? '9+' : noLeidos() }}
        </span>
      }
    </button>

    @if (abierta()) {
      <div class="fixed inset-0 z-30" (click)="abierta.set(false)" aria-hidden="true"></div>
      <div class="absolute right-0 mt-2 z-40 w-[min(22rem,calc(100vw-2rem))] max-h-[70vh] overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl" role="dialog" aria-label="Avisos">
        <div class="flex items-center justify-between px-4 py-3 border-b border-slate-800">
          <p class="text-sm font-bold text-white">Avisos</p>
          <a routerLink="/soporte" (click)="abierta.set(false)" class="text-xs font-bold text-indigo-400 hover:text-indigo-300">Soporte y código</a>
        </div>
        @if (avisos().length === 0) {
          <p class="px-4 py-8 text-center text-sm text-slate-500">Sin avisos.</p>
        } @else {
          <ul class="divide-y divide-slate-800">
            @for (a of avisos(); track a.id) {
              <li class="px-4 py-3" [class.bg-indigo-500/5]="!a.leido">
                <p class="text-xs font-bold" [class]="a.tipo === 'RENTA' ? 'text-emerald-300' : a.tipo === 'ASISTENTE' ? 'text-indigo-300' : 'text-amber-300'">{{ a.tipo === 'RENTA' ? 'Renta' : a.tipo === 'ASISTENTE' ? 'Asistente' : 'Soporte' }}</p>
                <p class="text-sm font-semibold text-white">{{ a.titulo }}</p>
                @if (a.detalle) {
                  <!-- El resumen diario es largo: aquí solo el principio; completo en la pantalla del asistente -->
                  <p class="text-xs text-slate-400 mt-0.5 whitespace-pre-line" [class.line-clamp-4]="a.tipo === 'ASISTENTE'">{{ a.detalle }}</p>
                }
                <p class="text-[11px] text-slate-500 mt-1 tabular-nums">{{ a.creadoEn | date: 'dd/MM HH:mm' }}</p>
              </li>
            }
          </ul>
        }
      </div>
    }
  `,
})
export class CampanaAvisosComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.apiUrl}/avisos`;

  readonly avisos = signal<Aviso[]>([]);
  readonly noLeidos = signal(0);
  readonly abierta = signal(false);

  constructor() {
    const reloj = setInterval(() => this.cargar(), CADA_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(reloj));
  }

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.http.get<{ noLeidos: number; avisos: Aviso[] }>(this.api).subscribe({
      next: (b) => {
        this.noLeidos.set(b.noLeidos);
        this.avisos.set(b.avisos);
      },
      error: () => {
        /* sin avisos no pasa nada: se reintenta en un minuto */
      },
    });
  }

  alternar(): void {
    const abrir = !this.abierta();
    this.abierta.set(abrir);
    if (abrir && this.noLeidos() > 0) {
      this.http.patch<void>(`${this.api}/leidos`, {}).subscribe({ next: () => this.noLeidos.set(0) });
    }
  }
}
