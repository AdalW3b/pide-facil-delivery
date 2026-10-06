import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideLoader2, LucideSend, LucideSparkles } from '@lucide/angular';
import {
  AsistenteService,
  ConfigAsistente,
  PersonaAsistente,
  ResumenDiario,
  TurnoChat,
} from '../../core/services/asistente.service';
import { AvisosService } from '../../core/services/avisos.service';
import { SucursalActivaService } from '../../core/services/sucursal-activa.service';
import { TituloPaginaComponent } from '../../shared/components/titulo-pagina.component';

type Pestana = 'chat' | 'resumenes' | 'config';

/** Los proveedores que acepta el backend, con modelos de ejemplo (el dueño puede escribir otro). */
const PROVEEDORES = [
  { id: 'ANTHROPIC', nombre: 'Claude (Anthropic)', modelos: ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-4-5'], llave: 'console.anthropic.com' },
  { id: 'OPENAI', nombre: 'ChatGPT (OpenAI)', modelos: ['gpt-5', 'gpt-5-mini'], llave: 'platform.openai.com' },
  { id: 'GEMINI', nombre: 'Gemini (Google)', modelos: ['gemini-2.5-pro', 'gemini-2.5-flash'], llave: 'aistudio.google.com' },
  { id: 'COMPATIBLE', nombre: 'Otro compatible con OpenAI', modelos: [], llave: 'tu proveedor' },
];

/** Cómo se nombran ante el usuario los datos que consultó el asistente. */
const DATOS_CONSULTADOS: Record<string, string> = {
  resumen_ventas: 'ventas',
  ventas_por_dia: 'ventas por día',
  platillos_vendidos: 'platillos vendidos',
  horas_pico: 'horas pico',
  inventario: 'inventario',
  cierres_de_caja: 'cierres de caja',
  pedidos_activos: 'pedidos en curso',
};

const SUGERENCIAS = [
  '¿Cuánto vendí ayer y cómo voy esta semana?',
  '¿Qué ingredientes están por acabarse?',
  '¿Cuáles son mis platillos más vendidos del mes?',
  '¿A qué hora tengo más pedidos?',
  '¿Cómo cerró la caja ayer?',
  '¿Cómo activo una tablet como kiosko?',
];

/**
 * El asistente operativo del restaurante: preguntar (datos del negocio y
 * dudas del sistema), los resúmenes diarios y, para el dueño, el proveedor
 * de IA con su llave y quién del personal puede usarlo.
 */
@Component({
  selector: 'app-asistente',
  standalone: true,
  imports: [DatePipe, DecimalPipe, FormsModule, LucideLoader2, LucideSend, LucideSparkles, TituloPaginaComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-5 text-slate-100">
      <app-titulo-pagina titulo="Asistente"
        descripcion="Pregúntale por tus ventas, tu inventario o cómo hacer algo en el sistema. Solo consulta: no cambia nada." />

      @if (asistente.estado(); as e) {
        @if (pestanas().length > 1) {
          <div class="flex gap-1 border-b border-slate-800" role="tablist">
            @for (p of pestanas(); track p.id) {
              <button type="button" role="tab" [attr.aria-selected]="pestana() === p.id" (click)="cambiar(p.id)"
                class="px-4 py-2 text-sm font-semibold border-b-2 -mb-px cursor-pointer transition-colors"
                [class]="pestana() === p.id ? 'border-indigo-500 text-white' : 'border-transparent text-slate-400 hover:text-white'">
                {{ p.nombre }}
              </button>
            }
          </div>
        }

        @if (!e.puedeUsar && pestana() !== 'config') {
          <p class="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">{{ e.motivo }}</p>
        }

        <!-- Chat -->
        @if (pestana() === 'chat' && e.puedeUsar) {
          <section class="flex flex-col rounded-2xl border border-slate-800 bg-slate-900/40 h-[calc(100dvh-16rem)] min-h-[420px]">
            <div #lista class="flex-1 overflow-y-auto p-4 space-y-4" aria-live="polite">
              @if (asistente.conversacion().length === 0) {
                <div class="h-full flex flex-col items-center justify-center text-center gap-4">
                  <svg lucideSparkles class="w-8 h-8 text-indigo-400"></svg>
                  <p class="text-sm text-slate-400 max-w-md">
                    Contesta con los datos de {{ sucursal.sucursal()?.name || 'tu sucursal' }}. Prueba con alguna de estas:
                  </p>
                  <div class="flex flex-wrap justify-center gap-2 max-w-2xl">
                    @for (s of sugerencias; track s) {
                      <button type="button" (click)="enviar(s)"
                        class="px-3 py-1.5 rounded-full border border-slate-700 text-xs text-slate-300 hover:border-indigo-500 hover:text-white cursor-pointer">
                        {{ s }}
                      </button>
                    }
                  </div>
                </div>
              }
              @for (t of asistente.conversacion(); track $index) {
                @if (t.delUsuario) {
                  <div class="flex justify-end">
                    <p class="max-w-[85%] rounded-2xl rounded-br-sm bg-indigo-600 px-4 py-2 text-sm text-white whitespace-pre-line select-text">{{ t.texto }}</p>
                  </div>
                } @else {
                  <div class="flex justify-start">
                    <div class="max-w-[85%] rounded-2xl rounded-bl-sm px-4 py-2 text-sm select-text"
                      [class]="t.error ? 'bg-rose-500/10 border border-rose-500/30 text-rose-200' : 'bg-slate-800 text-slate-100'">
                      <div class="respuesta space-y-2" [innerHTML]="formatear(t.texto)"></div>
                      @if (t.consulto?.length) {
                        <p class="mt-2 text-[11px] text-slate-400">Consultó: {{ consultado(t.consulto!) }}</p>
                      }
                    </div>
                  </div>
                }
              }
              @if (pensando()) {
                <p class="flex items-center gap-2 text-sm text-slate-400">
                  <svg lucideLoader2 class="w-4 h-4 animate-spin"></svg> Revisando...
                </p>
              }
            </div>
            <form (submit)="$event.preventDefault(); enviar(texto())" class="border-t border-slate-800 p-3 flex gap-2 items-end">
              <label for="pregunta" class="sr-only">Tu pregunta</label>
              <textarea id="pregunta" rows="1" maxlength="2000" [ngModel]="texto()" (ngModelChange)="texto.set($event)" name="pregunta"
                (keydown.enter)="alEnter($event)" placeholder="Escribe tu pregunta"
                class="flex-1 resize-none max-h-32 bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3 text-sm text-white outline-none focus:border-indigo-500"></textarea>
              <button type="submit" [disabled]="pensando() || !texto().trim()" aria-label="Enviar"
                class="p-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer disabled:opacity-40">
                <svg lucideSend class="w-4 h-4"></svg>
              </button>
            </form>
            @if (asistente.conversacion().length) {
              <button type="button" (click)="asistente.conversacion.set([])"
                class="self-start mx-3 mb-2 text-xs text-slate-500 hover:text-slate-300 cursor-pointer">Empezar otra conversación</button>
            }
          </section>
        }

        <!-- Resúmenes diarios -->
        @if (pestana() === 'resumenes' && e.puedeUsar) {
          <section class="space-y-3">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <p class="text-sm text-slate-400">
                Cada mañana a las 7 te dejamos el resumen del día anterior de {{ sucursal.sucursal()?.name || 'la sucursal' }}.
              </p>
              @if (e.puedeConfigurar) {
                <button type="button" (click)="generarResumen()" [disabled]="generando()"
                  class="px-3 py-1.5 rounded-lg border border-slate-700 text-xs font-bold text-slate-200 hover:border-indigo-500 cursor-pointer disabled:opacity-50">
                  {{ generando() ? 'Escribiendo...' : 'Escribir el de ayer ahora' }}
                </button>
              }
            </div>
            @if (cargandoResumenes()) {
              <p class="flex items-center gap-2 text-sm text-slate-400"><svg lucideLoader2 class="w-4 h-4 animate-spin"></svg> Cargando...</p>
            } @else if (resumenes().length === 0) {
              <p class="text-sm text-slate-500 py-6 text-center">Todavía no hay resúmenes.</p>
            } @else {
              @for (r of resumenes(); track r.dia) {
                <article class="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
                  <h2 class="text-sm font-bold text-white capitalize">{{ r.dia | date: 'EEEE d MMMM' }}</h2>
                  <div class="respuesta mt-2 space-y-2 text-sm text-slate-200 select-text" [innerHTML]="formatear(r.contenido)"></div>
                </article>
              }
            }
          </section>
        }

        <!-- Configuración: solo el dueño -->
        @if (pestana() === 'config' && e.puedeConfigurar) {
          @if (config(); as c) {
            <div class="grid gap-5 lg:grid-cols-2 items-start">
              <section class="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 space-y-4">
                <div>
                  <h2 class="text-sm font-bold text-white">Proveedor de IA</h2>
                  <p class="text-xs text-slate-400 mt-0.5">
                    Usa tu propia cuenta: lo que cobra el proveedor por cada pregunta lo pagas directo con ellos.
                  </p>
                </div>
                @if (!c.servidorListo) {
                  <p class="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                    El servidor aún no puede guardar llaves de forma segura. Avisa a soporte de Pide Fácil.
                  </p>
                }
                <label class="block space-y-1">
                  <span class="text-xs font-semibold text-slate-300">Proveedor</span>
                  <select [(ngModel)]="form.proveedor" (ngModelChange)="alCambiarProveedor()" name="proveedor"
                    class="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-sm text-white outline-none focus:border-indigo-500">
                    @for (p of proveedores; track p.id) {
                      <option [value]="p.id" class="bg-slate-950">{{ p.nombre }}</option>
                    }
                  </select>
                </label>
                @if (form.proveedor === 'COMPATIBLE') {
                  <label class="block space-y-1">
                    <span class="text-xs font-semibold text-slate-300">Dirección del servicio</span>
                    <input type="url" [(ngModel)]="form.urlBase" name="urlBase" placeholder="https://api.ejemplo.com/v1"
                      class="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-sm text-white outline-none focus:border-indigo-500" />
                    <span class="block text-[11px] text-slate-500">Debe empezar con https:// (DeepSeek, Mistral, Groq, OpenRouter...).</span>
                  </label>
                }
                <label class="block space-y-1">
                  <span class="text-xs font-semibold text-slate-300">Modelo</span>
                  <input type="text" [(ngModel)]="form.modelo" name="modelo" list="modelos" maxlength="100" autocomplete="off"
                    placeholder="Como lo nombra tu proveedor"
                    class="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-sm text-white outline-none focus:border-indigo-500" />
                  <datalist id="modelos">
                    @for (m of modelosSugeridos(); track m) { <option [value]="m"></option> }
                  </datalist>
                </label>
                <label class="block space-y-1">
                  <span class="text-xs font-semibold text-slate-300">Llave (API key)</span>
                  <input type="password" [(ngModel)]="form.llave" name="llave" autocomplete="off" maxlength="500"
                    [placeholder]="c.llaveFinal ? 'Guardada, termina en ' + c.llaveFinal + ' · escribe otra para cambiarla' : 'Pégala aquí'"
                    class="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-sm text-white outline-none focus:border-indigo-500" />
                  <span class="block text-[11px] text-slate-500">
                    Se crea en {{ proveedorElegido()?.llave }}. Se guarda cifrada y nadie puede volver a verla, ni soporte.
                  </span>
                </label>
                <label class="flex items-center gap-2 text-sm text-slate-200 cursor-pointer">
                  <input type="checkbox" [(ngModel)]="form.resumenDiario" name="resumenDiario" class="accent-indigo-500 w-4 h-4" />
                  Mandarme cada mañana el resumen del día anterior
                </label>
                <div class="flex flex-wrap gap-2 pt-1">
                  <button type="button" (click)="guardar()" [disabled]="guardando() || !c.servidorListo"
                    class="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold cursor-pointer disabled:opacity-50">
                    {{ guardando() ? 'Guardando...' : 'Guardar' }}
                  </button>
                  <button type="button" (click)="probar()" [disabled]="probando() || guardando() || !c.servidorListo || (!c.llaveFinal && !form.llave.trim())"
                    [title]="!c.llaveFinal && !form.llave.trim() ? 'Pega primero tu llave' : ''"
                    class="px-4 py-2 rounded-lg border border-slate-700 text-slate-200 text-sm font-bold hover:border-indigo-500 cursor-pointer disabled:opacity-50">
                    {{ probando() ? 'Probando...' : 'Probar conexión' }}
                  </button>
                </div>
                <p class="text-[11px] text-slate-500 border-t border-slate-800 pt-3">
                  Este mes: {{ c.preguntasDelMes }} preguntas ·
                  {{ c.tokensEntradaDelMes + c.tokensSalidaDelMes | number }} tokens usados en tu cuenta del proveedor.
                </p>
              </section>

              <section class="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 space-y-3">
                <div>
                  <h2 class="text-sm font-bold text-white">Quién lo puede usar</h2>
                  <p class="text-xs text-slate-400 mt-0.5">
                    Tú y los gerentes siempre. Al resto actívalo a quien lo necesite: solo verá los datos que su rol le permite.
                  </p>
                </div>
                <ul class="divide-y divide-slate-800">
                  @for (p of personal(); track p.id) {
                    <li class="py-2.5 flex items-center justify-between gap-3">
                      <div class="min-w-0">
                        <p class="text-sm text-white truncate">{{ p.nombre || p.usuario }}</p>
                        <p class="text-[11px] text-slate-500 truncate">{{ p.usuario }} · {{ nombreRol(p.rol) }}</p>
                      </div>
                      @if (p.siempre) {
                        <span class="text-[11px] text-slate-500 shrink-0">Siempre</span>
                      } @else {
                        <input type="checkbox" [checked]="p.habilitado" (change)="habilitar(p, $any($event.target).checked)"
                          [attr.aria-label]="'Asistente para ' + (p.nombre || p.usuario)" class="accent-indigo-500 w-4 h-4 cursor-pointer shrink-0" />
                      }
                    </li>
                  } @empty {
                    <li class="py-4 text-sm text-slate-500">Sin empleados activos.</li>
                  }
                </ul>
              </section>
            </div>
          } @else {
            <p class="flex items-center gap-2 text-sm text-slate-400"><svg lucideLoader2 class="w-4 h-4 animate-spin"></svg> Cargando...</p>
          }
        }
      } @else {
        <p class="flex items-center gap-2 text-sm text-slate-400"><svg lucideLoader2 class="w-4 h-4 animate-spin"></svg> Cargando...</p>
      }
    </div>
  `,
  styles: [`
    :host ::ng-deep .respuesta ul { list-style: disc; padding-left: 1.25rem; }
    :host ::ng-deep .respuesta ol { list-style: decimal; padding-left: 1.25rem; }
    :host ::ng-deep .respuesta li + li { margin-top: 0.15rem; }
    :host ::ng-deep .respuesta strong { color: white; }
  `],
})
export class AsistenteComponent implements OnInit {
  readonly asistente = inject(AsistenteService);
  readonly sucursal = inject(SucursalActivaService);
  private readonly avisos = inject(AvisosService);
  private readonly lista = viewChild<ElementRef<HTMLElement>>('lista');

  readonly proveedores = PROVEEDORES;
  readonly sugerencias = SUGERENCIAS;

  readonly pestana = signal<Pestana>('chat');
  readonly pestanas = computed(() => {
    const e = this.asistente.estado();
    const ps: { id: Pestana; nombre: string }[] = [];
    if (e?.puedeUsar) ps.push({ id: 'chat', nombre: 'Preguntar' }, { id: 'resumenes', nombre: 'Resúmenes diarios' });
    if (e?.puedeConfigurar) ps.push({ id: 'config', nombre: 'Configuración' });
    return ps;
  });

  readonly texto = signal('');
  readonly pensando = signal(false);

  readonly resumenes = signal<ResumenDiario[]>([]);
  readonly cargandoResumenes = signal(false);
  readonly generando = signal(false);

  readonly config = signal<ConfigAsistente | null>(null);
  readonly personal = signal<PersonaAsistente[]>([]);
  readonly guardando = signal(false);
  readonly probando = signal(false);
  form = { proveedor: 'ANTHROPIC', modelo: '', urlBase: '', llave: '', resumenDiario: true };
  private readonly proveedorForm = signal('ANTHROPIC');
  readonly proveedorElegido = computed(() => PROVEEDORES.find((p) => p.id === this.proveedorForm()));
  readonly modelosSugeridos = computed(() => this.proveedorElegido()?.modelos ?? []);

  constructor() {
    // El dueño que aún no lo configura empieza en Configuración.
    effect(() => {
      const e = this.asistente.estado();
      if (!e) return;
      untracked(() => {
        if (!e.puedeUsar && e.puedeConfigurar) this.cambiar('config');
        else if (!this.pestanas().some((p) => p.id === this.pestana())) this.pestana.set('chat');
      });
    });
    // Los resúmenes son de la sucursal elegida en la barra.
    effect(() => {
      this.sucursal.branchId();
      untracked(() => {
        if (this.pestana() === 'resumenes') this.cargarResumenes();
      });
    });
  }

  ngOnInit(): void {
    this.asistente.cargarEstado();
  }

  cambiar(p: Pestana): void {
    this.pestana.set(p);
    if (p === 'resumenes') this.cargarResumenes();
    if (p === 'config') this.cargarConfig();
  }

  // ------------------------------------------------------------------ chat

  alEnter(ev: Event): void {
    const k = ev as KeyboardEvent;
    if (k.shiftKey) return;
    k.preventDefault();
    this.enviar(this.texto());
  }

  enviar(pregunta: string): void {
    const q = pregunta.trim();
    if (!q || this.pensando()) return;
    const historial = this.asistente.conversacion();
    this.asistente.conversacion.update((c) => [...c, { delUsuario: true, texto: q }]);
    this.texto.set('');
    this.pensando.set(true);
    this.bajar();
    this.asistente.preguntar(q, this.sucursal.branchId() || null, historial).subscribe({
      next: (r) => {
        this.pensando.set(false);
        this.asistente.conversacion.update((c) => [...c, { delUsuario: false, texto: r.texto, consulto: r.consulto }]);
        this.bajar();
      },
      error: (err) => {
        this.pensando.set(false);
        this.asistente.conversacion.update((c) => [
          ...c,
          { delUsuario: false, texto: this.mensaje(err, 'No pude contestar. Intenta de nuevo en un momento.'), error: true },
        ]);
        this.bajar();
      },
    });
  }

  consultado(nombres: string[]): string {
    return [...new Set(nombres.map((n) => DATOS_CONSULTADOS[n] ?? n))].join(', ');
  }

  private bajar(): void {
    setTimeout(() => {
      const el = this.lista()?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }

  /**
   * Un markdown mínimo (negritas y listas) sobre texto ya escapado: lo que
   * escribe el modelo nunca entra como HTML.
   */
  formatear(texto: string): string {
    const esc = (s: string) =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const enLinea = (s: string) => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    const partes: string[] = [];
    let lista = null as { tipo: 'ul' | 'ol'; items: string[] } | null;
    const cerrar = () => {
      if (lista) partes.push(`<${lista.tipo}>${lista.items.map((i) => `<li>${i}</li>`).join('')}</${lista.tipo}>`);
      lista = null;
    };
    for (const cruda of (texto ?? '').split('\n')) {
      const linea = cruda.trim();
      const vi = /^[-*•]\s+(.*)$/.exec(linea);
      const nu = /^\d+[.)]\s+(.*)$/.exec(linea);
      if (vi || nu) {
        const tipo = vi ? 'ul' : 'ol';
        if (lista?.tipo !== tipo) {
          cerrar();
          lista = { tipo, items: [] };
        }
        lista!.items.push(enLinea((vi ?? nu)![1]));
        continue;
      }
      cerrar();
      if (!linea) continue;
      const titulo = /^#{1,6}\s+(.*)$/.exec(linea);
      partes.push(titulo ? `<p><strong>${enLinea(titulo[1])}</strong></p>` : `<p>${enLinea(linea)}</p>`);
    }
    cerrar();
    return partes.join('');
  }

  // ------------------------------------------------------------------ resúmenes

  cargarResumenes(): void {
    this.cargandoResumenes.set(true);
    this.asistente.resumenes(this.sucursal.branchId() || null).subscribe({
      next: (r) => {
        this.resumenes.set(r);
        this.cargandoResumenes.set(false);
      },
      error: (err) => {
        this.cargandoResumenes.set(false);
        this.avisos.error(this.mensaje(err, 'No se pudieron cargar los resúmenes.'));
      },
    });
  }

  generarResumen(): void {
    this.generando.set(true);
    this.asistente.generarResumen(this.sucursal.branchId() || null).subscribe({
      next: (r) => {
        this.generando.set(false);
        this.resumenes.update((rs) => [r, ...rs.filter((x) => x.dia !== r.dia)]);
      },
      error: (err) => {
        this.generando.set(false);
        this.avisos.error(this.mensaje(err, 'No se pudo escribir el resumen.'));
      },
    });
  }

  // ------------------------------------------------------------------ configuración

  cargarConfig(): void {
    this.asistente.config().subscribe({
      next: (c) => this.aplicarConfig(c),
      error: (err) => this.avisos.error(this.mensaje(err, 'No se pudo cargar la configuración.')),
    });
    this.asistente.personal().subscribe({ next: (p) => this.personal.set(p) });
  }

  private aplicarConfig(c: ConfigAsistente): void {
    this.form = {
      proveedor: c.proveedor ?? 'ANTHROPIC',
      modelo: c.modelo ?? '',
      urlBase: c.urlBase ?? '',
      llave: '',
      resumenDiario: c.resumenDiario,
    };
    if (!c.modelo) this.form.modelo = PROVEEDORES.find((p) => p.id === this.form.proveedor)?.modelos[0] ?? '';
    this.proveedorForm.set(this.form.proveedor);
    this.config.set(c);
  }

  alCambiarProveedor(): void {
    this.proveedorForm.set(this.form.proveedor);
    this.form.modelo = this.proveedorElegido()?.modelos[0] ?? '';
  }

  /** Lo escrito difiere de lo guardado (o hay una llave nueva). */
  private hayCambios(): boolean {
    const c = this.config();
    if (!c) return true;
    return !!this.form.llave.trim() || this.form.proveedor !== (c.proveedor ?? '') || this.form.modelo.trim() !== (c.modelo ?? '')
      || (this.form.proveedor === 'COMPATIBLE' && this.form.urlBase.trim() !== (c.urlBase ?? ''))
      || this.form.resumenDiario !== c.resumenDiario;
  }

  /** Guarda; con {@code despues} sigue con eso en vez de avisar. */
  guardar(despues?: () => void): void {
    this.guardando.set(true);
    this.asistente
      .guardar({
        proveedor: this.form.proveedor,
        modelo: this.form.modelo.trim(),
        urlBase: this.form.proveedor === 'COMPATIBLE' ? this.form.urlBase.trim() : null,
        llave: this.form.llave.trim() || null,
        resumenDiario: this.form.resumenDiario,
      })
      .subscribe({
        next: (c) => {
          this.guardando.set(false);
          this.aplicarConfig(c);
          this.asistente.cargarEstado();
          if (despues) despues();
          else this.avisos.exito('Guardado. Usa "Probar conexión" para confirmar que tu llave funciona.');
        },
        error: (err) => {
          this.guardando.set(false);
          this.avisos.error(this.mensaje(err, 'No se pudo guardar.'));
        },
      });
  }

  /** Si hay cambios sin guardar, primero los guarda: se prueba lo que está en pantalla. */
  probar(): void {
    if (this.hayCambios()) {
      this.guardar(() => this.probar());
      return;
    }
    this.probando.set(true);
    this.asistente.probar().subscribe({
      next: (r) => {
        this.probando.set(false);
        this.avisos.exito(`El proveedor respondió: ${r.respuesta}`);
      },
      error: (err) => {
        this.probando.set(false);
        this.avisos.error(this.mensaje(err, 'No se pudo conectar con el proveedor.'));
      },
    });
  }

  habilitar(p: PersonaAsistente, habilitado: boolean): void {
    this.asistente.habilitar(p.id, habilitado).subscribe({
      next: () => this.personal.update((ps) => ps.map((x) => (x.id === p.id ? { ...x, habilitado } : x))),
      error: (err) => {
        this.personal.update((ps) => [...ps]);
        this.avisos.error(this.mensaje(err, 'No se pudo cambiar.'));
      },
    });
  }

  nombreRol(rol: string): string {
    if (rol === 'SUPER_ADMIN') return 'Dueño';
    if (rol === 'BRANCH_MANAGER') return 'Gerente';
    const t = rol.replace(/_/g, ' ').toLowerCase();
    return t.charAt(0).toUpperCase() + t.slice(1);
  }

  private mensaje(err: any, otro: string): string {
    return err?.error?.error || err?.error?.message || otro;
  }
}
