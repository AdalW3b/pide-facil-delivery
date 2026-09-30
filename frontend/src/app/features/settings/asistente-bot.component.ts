import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../environments/environment';
import { AvisosService } from '../../core/services/avisos.service';

interface BotConfig {
  botName: string;
  botTone: string;
}

/** Personalidades de ejemplo: un clic y se pueden ajustar a mano. */
const PERSONALIDADES: { nombre: string; texto: string }[] = [
  {
    nombre: 'Amable y cercano',
    texto: 'Amable y cercano. Tutea al cliente, usa un par de emojis por mensaje y responde en frases cortas. Recomienda algún platillo cuando el cliente no sepa qué pedir.',
  },
  {
    nombre: 'Formal',
    texto: 'Formal y atento. Trata al cliente de usted, sin emojis. Responde con cortesía y precisión, sin rodeos.',
  },
  {
    nombre: 'Divertido',
    texto: 'Alegre y bromista, con emojis de comida. Usa expresiones mexicanas ligeras ("¡órale!", "¡qué rico!") sin exagerar y sin dejar de ser claro con precios y pedidos.',
  },
  {
    nombre: 'Breve y directo',
    texto: 'Muy breve y directo. Una o dos frases por mensaje, sin emojis ni saludos repetidos. Va al grano: qué quiere, confirma y listo.',
  },
];

/**
 * Nombre y personalidad del asistente de WhatsApp de la sucursal. El flujo de
 * n8n los lee en cada mensaje: el cambio aplica desde la siguiente respuesta.
 */
@Component({
  selector: 'app-asistente-bot',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="p-5 md:p-6 bg-slate-900/40 border border-slate-800/60 rounded-2xl" aria-labelledby="asistente-titulo">
      <div class="flex flex-col md:flex-row md:items-start md:justify-between gap-2 mb-5">
        <div>
          <h2 id="asistente-titulo" class="text-lg font-bold text-white">Tu asistente de WhatsApp</h2>
          <p class="text-sm text-slate-400 mt-1">Cómo se llama y cómo les habla a tus clientes. Aplica desde el siguiente mensaje.</p>
        </div>
      </div>

      @if (cargando()) {
        <p class="text-sm text-slate-400 py-6">Cargando…</p>
      } @else {
        <div class="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div class="lg:col-span-3 space-y-5">
            <div>
              <label for="bot-nombre" class="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Nombre</label>
              <input
                id="bot-nombre"
                type="text"
                maxlength="40"
                [ngModel]="nombre()"
                (ngModelChange)="nombre.set($event)"
                placeholder="Ej. Lupita, Don Taco, Farolito"
                class="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3 text-sm text-white outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <div class="flex items-baseline justify-between mb-1.5">
                <label for="bot-personalidad" class="block text-xs font-bold text-slate-400 uppercase tracking-wider">Personalidad</label>
                <span class="text-xs tabular-nums" [class]="personalidad().length > 600 ? 'text-rose-400' : 'text-slate-500'">
                  {{ personalidad().length }}/600
                </span>
              </div>
              <div class="flex flex-wrap gap-2 mb-2" role="group" aria-label="Personalidades de ejemplo">
                @for (p of personalidades; track p.nombre) {
                  <button
                    type="button"
                    (click)="personalidad.set(p.texto)"
                    [attr.aria-pressed]="personalidad() === p.texto"
                    class="px-3 py-1.5 rounded-full text-xs font-semibold border cursor-pointer transition-colors"
                    [class]="personalidad() === p.texto
                      ? 'bg-indigo-600 border-indigo-500 text-white'
                      : 'bg-slate-950 border-slate-700 text-slate-300 hover:border-slate-500'"
                  >{{ p.nombre }}</button>
                }
              </div>
              <textarea
                id="bot-personalidad"
                rows="4"
                maxlength="600"
                [ngModel]="personalidad()"
                (ngModelChange)="personalidad.set($event)"
                placeholder="Describe cómo debe hablar: si tutea o habla de usted, si usa emojis, si es breve…"
                class="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3 text-sm text-white outline-none focus:border-indigo-500 resize-y"
              ></textarea>
              <p class="text-xs text-slate-500 mt-1.5">
                Describe el trato, no las reglas del pedido: el menú, los precios y cómo se confirma un pedido ya los maneja el sistema.
              </p>
            </div>

            <div class="flex flex-wrap items-center gap-3">
              <button
                type="button"
                (click)="guardar()"
                [disabled]="!puedeGuardar()"
                class="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {{ guardando() ? 'Guardando…' : 'Guardar cambios' }}
              </button>
              @if (cambiado()) {
                <button type="button" (click)="deshacer()" class="text-sm text-slate-400 hover:text-white cursor-pointer">Deshacer</button>
              }
            </div>
          </div>

          <!-- Así se ve en WhatsApp -->
          <div class="lg:col-span-2">
            <p class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Así se presenta</p>
            <div class="rounded-2xl bg-[#0b141a] border border-slate-800 p-4 space-y-2">
              <div class="max-w-[85%] ml-auto rounded-xl rounded-tr-sm bg-[#005c4b] px-3 py-2 text-sm text-white">
                Hola, quiero abrir la mesa 4
              </div>
              <div class="max-w-[90%] rounded-xl rounded-tl-sm bg-[#202c33] px-3 py-2 text-sm text-slate-100">
                <span class="block text-xs font-bold text-emerald-400 mb-0.5">{{ nombre().trim() || 'Asistente' }}</span>
                {{ saludoDeEjemplo() }}
              </div>
            </div>
            <p class="text-xs text-slate-500 mt-2">Es un ejemplo: la respuesta real la escribe la IA siguiendo la personalidad.</p>
          </div>
        </div>
      }
    </section>
  `,
})
export class AsistenteBotComponent {
  private readonly http = inject(HttpClient);
  private readonly avisos = inject(AvisosService);

  readonly branchId = input<string | null>(null);

  readonly personalidades = PERSONALIDADES;
  readonly nombre = signal('');
  readonly personalidad = signal('');
  readonly cargando = signal(false);
  readonly guardando = signal(false);
  private readonly guardado = signal<BotConfig | null>(null);

  readonly cambiado = computed(() => {
    const g = this.guardado();
    return !!g && (g.botName !== this.nombre().trim() || g.botTone !== this.personalidad().trim());
  });

  readonly puedeGuardar = computed(() => {
    const n = this.nombre().trim();
    const p = this.personalidad().trim();
    return !this.guardando() && this.cambiado() && n.length > 0 && n.length <= 40 && p.length > 0 && p.length <= 600;
  });

  /** Una idea de cómo saluda, según palabras clave de la personalidad. */
  readonly saludoDeEjemplo = computed(() => {
    const p = this.personalidad().toLowerCase();
    const nombre = this.nombre().trim() || 'tu asistente';
    if (p.includes('usted') || p.includes('formal')) {
      return `Buenas tardes, le atiende ${nombre}. Con gusto abro la mesa 4. ¿Qué desea ordenar?`;
    }
    if (p.includes('breve') || p.includes('directo')) {
      return `Mesa 4 abierta. ¿Qué te sirvo?`;
    }
    if (p.includes('bromista') || p.includes('divertid') || p.includes('alegre')) {
      return `¡Órale! Soy ${nombre} 🌮 Mesa 4 lista. ¿Qué se te antoja hoy?`;
    }
    return `¡Hola! Soy ${nombre} 😊 Ya abrí tu mesa 4. ¿Qué te gustaría pedir?`;
  });

  constructor() {
    effect(() => {
      const id = this.branchId();
      untracked(() => this.cargar(id));
    });
  }

  private cargar(branchId: string | null): void {
    if (!branchId) return;
    this.cargando.set(true);
    this.http.get<BotConfig>(`${environment.apiUrl}/branches/${branchId}/bot-config`).subscribe({
      next: (c) => {
        this.guardado.set(c);
        this.nombre.set(c.botName ?? '');
        this.personalidad.set(c.botTone ?? '');
        this.cargando.set(false);
      },
      error: () => {
        this.cargando.set(false);
        this.avisos.error('No se pudo cargar la configuración del asistente.');
      },
    });
  }

  deshacer(): void {
    const g = this.guardado();
    if (!g) return;
    this.nombre.set(g.botName);
    this.personalidad.set(g.botTone);
  }

  guardar(): void {
    const branchId = this.branchId();
    if (!branchId || !this.puedeGuardar()) return;
    this.guardando.set(true);
    this.http
      .put<BotConfig>(`${environment.apiUrl}/branches/${branchId}/bot-config`, {
        botName: this.nombre().trim(),
        botTone: this.personalidad().trim(),
      })
      .subscribe({
        next: (c) => {
          this.guardando.set(false);
          this.guardado.set(c);
          this.nombre.set(c.botName);
          this.personalidad.set(c.botTone);
          this.avisos.exito(`Listo: ${c.botName} ya responde con su nueva personalidad.`);
        },
        error: (err) => {
          this.guardando.set(false);
          this.avisos.error(err.error?.error || err.error?.message || 'No se pudo guardar el asistente.');
        },
      });
  }
}
