import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import { LucideLoader2 } from '@lucide/angular';
import { environment } from '../../../environments/environment';
import { AvisosService } from '../../core/services/avisos.service';
import { TituloPaginaComponent } from '../../shared/components/titulo-pagina.component';

interface Accion {
  metodo: string;
  ruta: string;
  estadoHttp: number | null;
  en: string;
}

interface Bitacora {
  sesion: {
    id: string;
    operador: string | null;
    motivo: string;
    inicio: string;
    fin: string | null;
    abierta: boolean;
  };
  acciones: Accion[];
}

/**
 * El dueño frente al soporte de la plataforma: genera el código con que
 * autoriza cambios (se lo dicta a soporte por teléfono) y revisa cuándo
 * entró soporte, por qué y qué cambió.
 */
@Component({
  selector: 'app-soporte-dueno',
  standalone: true,
  imports: [DatePipe, LucideLoader2, TituloPaginaComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6 min-h-screen bg-slate-950 text-slate-100 p-2 sm:p-4">
      <app-titulo-pagina titulo="Soporte"
        descripcion="Soporte de Pide Fácil puede ver tu cuenta para ayudarte. Para hacer cambios necesita un código que solo tú das." />

      <section class="max-w-xl rounded-2xl border border-slate-800 bg-slate-900/40 p-5 space-y-4">
        <div>
          <h2 class="text-sm font-bold text-white">Autorizar cambios</h2>
          <p class="text-xs text-slate-400 mt-0.5">
            Genera un código y díctaselo a soporte solo si tú se lo pediste. Sirve una vez, vale 15 minutos y
            le permite hacer cambios durante 30 minutos. Te avisamos cuando lo use.
          </p>
        </div>
        @if (codigo(); as c) {
          <div class="rounded-xl bg-indigo-500/10 border border-indigo-500/40 p-4 text-center">
            <p class="text-[11px] uppercase tracking-wider text-indigo-300 font-bold">Tu código</p>
            <p class="text-4xl font-black tracking-[0.3em] text-white tabular-nums">{{ c.codigo }}</p>
            <p class="text-xs text-indigo-200 mt-1">
              @if (segundos() > 0) {
                Vale {{ minutos() }} más
              } @else {
                Ya caducó: genera otro si lo necesitas
              }
            </p>
          </div>
        }
        <button type="button" (click)="generar()" [disabled]="generando()"
          class="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold cursor-pointer disabled:opacity-50">
          {{ generando() ? 'Generando...' : codigo() ? 'Generar otro código' : 'Generar código' }}
        </button>
      </section>

      <section class="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 space-y-3">
        <h2 class="text-sm font-bold text-white">Cuándo entró soporte</h2>
        @if (cargando()) {
          <p class="flex items-center gap-2 text-sm text-slate-400"><svg lucideLoader2 class="w-4 h-4 animate-spin"></svg> Cargando...</p>
        } @else if (bitacora().length === 0) {
          <p class="text-sm text-slate-500">Soporte no ha entrado a tu cuenta.</p>
        } @else {
          <ul class="divide-y divide-slate-800">
            @for (b of bitacora(); track b.sesion.id) {
              <li class="py-3 space-y-1">
                <p class="text-sm text-white">
                  <span class="tabular-nums text-slate-400">{{ b.sesion.inicio | date: 'dd/MM/yy HH:mm' }}</span>
                  · {{ b.sesion.operador || 'Soporte' }}
                  @if (b.sesion.abierta) {
                    <span class="ml-1 px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 text-[11px] font-bold">En curso</span>
                  }
                </p>
                <p class="text-xs text-slate-400">Motivo: {{ b.sesion.motivo }}</p>
                @if (b.acciones.length) {
                  <details class="text-xs text-slate-400">
                    <summary class="cursor-pointer text-amber-300 font-semibold">{{ b.acciones.length }} {{ b.acciones.length === 1 ? 'cambio' : 'cambios' }}</summary>
                    <ul class="mt-1 space-y-0.5 font-mono text-[11px]">
                      @for (a of b.acciones; track $index) {
                        <li>{{ a.en | date: 'HH:mm' }} · {{ a.metodo }} {{ a.ruta }}{{ a.estadoHttp && a.estadoHttp >= 400 ? ' (no se aplicó)' : '' }}</li>
                      }
                    </ul>
                  </details>
                } @else {
                  <p class="text-xs text-slate-500">Solo consultó, sin cambios.</p>
                }
              </li>
            }
          </ul>
        }
      </section>
    </div>
  `,
})
export class SoporteDuenoComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly avisos = inject(AvisosService);
  private readonly api = `${environment.apiUrl}/soporte`;

  readonly codigo = signal<{ codigo: string; expiraEn: string } | null>(null);
  readonly generando = signal(false);
  readonly bitacora = signal<Bitacora[]>([]);
  readonly cargando = signal(true);
  private readonly ahora = signal(Date.now());

  readonly segundos = computed(() => {
    const c = this.codigo();
    return c ? Math.max(0, Math.round((new Date(c.expiraEn).getTime() - this.ahora()) / 1000)) : 0;
  });
  readonly minutos = computed(() => {
    const s = this.segundos();
    return s >= 60 ? `${Math.ceil(s / 60)} min` : `${s} s`;
  });

  constructor() {
    const reloj = setInterval(() => this.ahora.set(Date.now()), 1000);
    inject(DestroyRef).onDestroy(() => clearInterval(reloj));
  }

  ngOnInit(): void {
    this.http.get<Bitacora[]>(`${this.api}/bitacora`).subscribe({
      next: (b) => {
        this.bitacora.set(b);
        this.cargando.set(false);
      },
      error: () => this.cargando.set(false),
    });
  }

  async generar(): Promise<void> {
    const ok = await this.avisos.confirmar({
      titulo: '¿Generar un código para soporte?',
      mensaje: 'Con él, soporte puede hacer cambios en tu cuenta por 30 minutos. Dáselo solo si tú pediste la ayuda.',
      confirmar: 'Generar código',
    });
    if (!ok) return;
    this.generando.set(true);
    this.http.post<{ codigo: string; expiraEn: string }>(`${this.api}/codigos`, {}).subscribe({
      next: (c) => {
        this.generando.set(false);
        this.codigo.set(c);
      },
      error: (err) => {
        this.generando.set(false);
        this.avisos.error(err.error?.error || err.error?.message || 'No se pudo generar el código.');
      },
    });
  }
}
