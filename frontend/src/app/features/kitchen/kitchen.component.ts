import { AgotadosCocinaComponent } from './agotados-cocina.component';
import { ComandaCocinaComponent } from './comanda-cocina.component';
import { ComandaDetalleComponent } from './comanda-detalle.component';
import { TableroCocinaComponent } from './tablero-cocina.component';
import { estadoDe, etiquetaDe, minutosDe } from './comanda';
import { NgTemplateOutlet } from '@angular/common';
import { SonidosService } from '../../core/services/sonidos.service';
import { TituloPaginaComponent } from '../../shared/components/titulo-pagina.component';
import { AvisosService } from '../../core/services/avisos.service';
import { SucursalActivaService } from '../../core/services/sucursal-activa.service';
import { Component, ChangeDetectionStrategy, signal, computed, inject, OnInit, OnDestroy, effect, untracked } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { timer, Subscription } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { WebSocketService } from '../../core/services/websocket.service';
import { EstadoEnVivoComponent } from '../../shared/components/estado-en-vivo.component';
import { environment } from '../../../environments/environment';
import { Restaurant, Branch } from '../admin-core/models/admin.model';
import {
  LucideChefHat,
  LucideTriangleAlert,
  LucideVolume2,
  LucideVolumeX,
  LucideBuilding,
  LucideMonitor
} from '@lucide/angular';

export type KitchenItemStatus = 'PENDING' | 'PREPARING' | 'READY' | 'DELIVERED';

/** Un aviso en la pantalla de cocina. */
interface AvisoCocina {
  id: number;
  tipo: 'nueva' | 'ronda' | 'cancelado';
  orderId: string;
  titulo: string;
  detalle: string;
}

export interface KitchenTicketItemDTO {
  itemId: string;
  productName: string;
  quantity: number;
  specialInstructions: string | null;
  kitchenStatus: KitchenItemStatus;
  /** "Tortilla: Harina", "Extras: Carne extra, Queso". Vacía si no lleva. */
  adicionales?: string[];
  /** Cuándo se pidió; separa las rondas de una mesa. Null si acaba de entrar. */
  createdAt?: string | null;
}

export interface KitchenTicketDTO {
  orderId: string;
  /** Null si el pedido no es de mesa (domicilio, mostrador). */
  tableNumber: number | null;
  createdAt: string; // ISO LocalDateTime string
  items: KitchenTicketItemDTO[];
  /** SALON, DOMICILIO, PARA_LLEVAR… */
  orderType?: string | null;
  /** "Mesa 5", "Domicilio ABC123", "Turno A-007 · Para llevar". */
  etiqueta?: string | null;
}

@Component({
  selector: 'app-kitchen',
  standalone: true,
  imports: [AgotadosCocinaComponent, ComandaCocinaComponent, ComandaDetalleComponent, TableroCocinaComponent, NgTemplateOutlet, TituloPaginaComponent, EstadoEnVivoComponent, LucideMonitor,
    LucideChefHat,
    LucideTriangleAlert,
    LucideVolume2,
    LucideVolumeX,
    LucideBuilding
  ],
  template: `
    <!-- Modo TV: la cocina a pantalla completa, sin menú, solo para leer -->
    @if (modoTv()) {
      <div class="fixed inset-0 z-[70] bg-slate-950 text-slate-100 flex flex-col">
        <header class="shrink-0 flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-b border-slate-800">
          <div class="flex items-baseline gap-4">
            <h1 class="text-2xl font-black text-white">Cocina</h1>
            <p class="text-lg text-slate-300 tabular-nums">
              <strong class="text-white">{{ comandasActivas().length }}</strong> comandas ·
              <strong class="text-amber-300">{{ tarde() }}</strong> tarde
            </p>
          </div>
          <div class="flex items-center gap-3">
            <span class="text-2xl font-black tabular-nums text-slate-300">{{ reloj() }}</span>
            <button type="button" (click)="salirTv()" class="px-4 py-2.5 rounded-xl border border-slate-700 text-sm font-bold text-slate-300 hover:text-white cursor-pointer">Salir de modo TV</button>
          </div>
        </header>
        @if (porPlatillo().length) {
          <ng-container *ngTemplateOutlet="barraPlatillos; context: { $implicit: true }" />
        }
        <div class="flex-1 min-h-0 overflow-y-auto p-4">
          <div class="grid gap-4 items-start [grid-template-columns:repeat(auto-fill,minmax(min(100%,320px),1fr))]">
            @for (ticket of comandasActivas(); track ticket.orderId) {
              <app-comanda-cocina [ticket]="ticket" [ahora]="currentTime()" [tv]="true" [maxLineas]="null" [nueva]="nuevas().has(ticket.orderId)" />
            } @empty {
              <p class="col-span-full py-24 text-center text-2xl text-slate-500">Todo al día</p>
            }
          </div>
        </div>
      </div>
    }

    <div class="space-y-5 select-none min-h-screen bg-slate-950 text-slate-100 p-2 sm:p-4">
      <app-estado-en-vivo [branchId]="activeBranchId()" />
      @if (sonidoQuerido() && audioBlocked()) {
        <button
          (click)="enableAudio()"
          class="sticky top-0 z-20 w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-bold shadow-lg cursor-pointer"
        >
          <svg lucideVolumeX class="w-5 h-5 shrink-0"></svg>
          <span>El navegador bloqueó el sonido. Toca aquí para oír las comandas nuevas.</span>
        </button>
      }

      <!-- Encabezado -->
      <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-slate-800/60 pb-5">
        <app-titulo-pagina titulo="Cocina" descripcion="Comandas por preparar, la más atrasada primero." />

        <div class="flex flex-wrap items-center gap-2">
          <!-- Cómo se ven las comandas; cada equipo recuerda la suya -->
          <div class="flex rounded-xl border border-slate-800 bg-slate-900 p-1" role="group" aria-label="Cómo ver las comandas">
            <button type="button" (click)="elegirVista('tablero')" [attr.aria-pressed]="vista() === 'tablero'"
              class="px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer"
              [class]="vista() === 'tablero' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'">Tablero</button>
            <button type="button" (click)="elegirVista('tarjetas')" [attr.aria-pressed]="vista() === 'tarjetas'"
              class="px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer"
              [class]="vista() === 'tarjetas' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'">Tarjetas</button>
          </div>
          <button type="button" (click)="entrarTv()"
            class="flex items-center gap-2 px-3 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
            title="Pantalla completa, letra grande y sin botones: para una TV en la cocina">
            <svg lucideMonitor class="w-4 h-4"></svg>
            <span>Modo TV</span>
          </button>

          <!-- Se acabó un platillo: deja de ofrecerse hoy -->
          <app-agotados-cocina [branchId]="activeBranchId()" />

          <!-- Sonido de comandas nuevas: se recuerda en este equipo -->
          @if (sonidoQuerido()) {
            <button (click)="silenciar()" class="flex items-center gap-2 px-3 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer" title="Silenciar las comandas nuevas">
              <svg lucideVolume2 class="w-4 h-4 text-emerald-400"></svg>
              <span>Sonido</span>
            </button>
          } @else {
            <button (click)="enableAudio()" class="flex items-center gap-2 px-3 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 rounded-xl text-xs font-semibold cursor-pointer">
              <svg lucideVolumeX class="w-4 h-4"></svg>
              <span>Sonido apagado</span>
            </button>
          }

          @if (isWsConnected()) {
            <div class="flex items-center gap-1.5 px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-[11px] font-bold uppercase tracking-wider">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>En vivo
            </div>
          } @else {
            <div class="flex items-center gap-1.5 px-3 py-2 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-[11px] font-bold uppercase tracking-wider">
              <span class="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>Reconectando
            </div>
          }
        </div>
      </div>

      @if (isSuperAdmin() && !selectedBranchId()) {
        <div class="py-24 border border-dashed border-slate-800 rounded-3xl flex flex-col items-center justify-center text-center gap-4 bg-slate-900/10">
          <div class="w-16 h-16 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <svg lucideBuilding class="w-8 h-8"></svg>
          </div>
          <div>
            <h3 class="font-bold text-white text-lg">Selecciona una sucursal</h3>
            <p class="text-xs text-slate-400 max-w-sm mt-1">Elige la sucursal en la barra de arriba para ver sus comandas.</p>
          </div>
        </div>
      } @else if (errorMessage()) {
        <div class="p-8 rounded-3xl bg-rose-500/5 border border-rose-500/10 text-rose-400 flex flex-col items-center justify-center text-center gap-3">
          <svg lucideTriangleAlert class="w-12 h-12 text-rose-500/80"></svg>
          <h3 class="font-bold text-white">Error de conexión</h3>
          <p class="text-xs text-slate-400 max-w-md">{{ errorMessage() }}</p>
          <button (click)="retryLoading()" class="px-5 py-2.5 mt-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 rounded-xl text-xs font-bold cursor-pointer border border-rose-500/20">Reintentar</button>
        </div>
      } @else if (isLoading()) {
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 animate-pulse">
          @for (x of [1, 2, 3]; track x) {
            <div class="h-80 bg-slate-900/40 border border-slate-800 rounded-2xl"></div>
          }
        </div>
      } @else if (comandasActivas().length === 0) {
        <div class="py-24 border border-dashed border-slate-800 rounded-3xl flex flex-col items-center justify-center text-center gap-4 bg-slate-900/10">
          <div class="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <svg lucideChefHat class="w-8 h-8"></svg>
          </div>
          <div>
            <h3 class="font-bold text-white text-lg">Todo al día</h3>
            <p class="text-xs text-slate-400 max-w-sm mt-1">Las comandas nuevas aparecen aquí y suenan al llegar.</p>
          </div>
        </div>
      } @else {
        <!-- Lo que hay que preparar, por platillo, para cocinar por lote -->
        @if (porPlatillo().length) {
          <ng-container *ngTemplateOutlet="barraPlatillos; context: { $implicit: false }" />
        }

        @if (vista() === 'tablero') {
          <app-tablero-cocina [comandas]="comandasActivas()" [entregadas]="entregadas()" [ahora]="currentTime()" [nuevas]="nuevas()" (ver)="comandaAbierta.set($event)" />
        } @else {
          <div class="grid gap-3 items-start [grid-template-columns:repeat(auto-fill,minmax(min(100%,280px),1fr))]">
            @for (ticket of comandasActivas(); track ticket.orderId) {
              <app-comanda-cocina
                [ticket]="ticket"
                [ahora]="currentTime()"
                [nueva]="nuevas().has(ticket.orderId)"
                [maxLineas]="4"
                (ver)="comandaAbierta.set(ticket.orderId)"
                (avanzarItem)="toggleItemStatus($event)"
                (cancelarItem)="cancelItem($event)"
                (cambiarTodo)="cambiarTodo(ticket, $event.de, $event.a)"
              />
            }
          </div>
        }
      }
    </div>

    <!-- Lo que acaba de pasar: comanda nueva, ronda nueva, cancelado. Encima también del modo TV. -->
    <div class="fixed top-4 right-4 z-[75] flex flex-col gap-2 pointer-events-none" [class]="modoTv() ? 'w-[min(92vw,30rem)]' : 'w-[min(92vw,24rem)]'" aria-live="assertive" role="status">
      @for (a of avisosCocina(); track a.id) {
        <button type="button" (click)="abrirDesdeAviso(a)"
          class="pointer-events-auto text-left rounded-2xl border-2 shadow-2xl p-4 cursor-pointer animate-[entrar_.2s_ease-out]"
          [class]="a.tipo === 'cancelado' ? 'border-rose-500/70 bg-rose-950/95' : a.tipo === 'ronda' ? 'border-amber-400/70 bg-amber-950/95' : 'border-sky-400/70 bg-sky-950/95'">
          <span class="block font-black uppercase tracking-wider" [class]="(modoTv() ? 'text-sm ' : 'text-[11px] ') + (a.tipo === 'cancelado' ? 'text-rose-300' : a.tipo === 'ronda' ? 'text-amber-300' : 'text-sky-300')">
            {{ a.tipo === 'cancelado' ? 'Se canceló' : a.tipo === 'ronda' ? 'Agregaron a la comanda' : 'Comanda nueva' }}
          </span>
          <span class="block font-black text-white leading-tight mt-0.5" [class]="modoTv() ? 'text-3xl' : 'text-xl'">{{ a.titulo }}</span>
          <span class="block text-slate-200 mt-1 leading-snug" [class]="modoTv() ? 'text-lg' : 'text-sm'">{{ a.detalle }}</span>
        </button>
      }
    </div>

    <!-- La comanda completa -->
    @if (comandaVista(); as ticket) {
      <app-comanda-detalle
        [ticket]="ticket"
        [ahora]="currentTime()"
        (cerrar)="comandaAbierta.set(null)"
        (avanzarItem)="toggleItemStatus($event)"
        (cancelarItem)="cancelItem($event)"
        (cambiarTodo)="cambiarTodo(ticket, $event.de, $event.a)"
      />
    }

    <ng-template #barraPlatillos let-grande>
      <div class="flex flex-wrap items-center gap-2" [class]="grande ? 'px-5 py-3 border-b border-slate-800' : ''" aria-label="Por preparar, por platillo">
        <span class="font-bold uppercase tracking-wider text-slate-500" [class]="grande ? 'text-sm' : 'text-[11px]'">Por preparar</span>
        @for (p of porPlatillo(); track p.nombre) {
          <span class="rounded-lg border border-slate-800 bg-slate-900 text-slate-300" [class]="grande ? 'px-3 py-1.5 text-lg' : 'px-2.5 py-1 text-xs'">
            <strong class="text-white tabular-nums">{{ p.cantidad }}</strong> {{ p.nombre }}
          </span>
        }
      </div>
    </ng-template>
  `,
  styles: [`
    @keyframes entrar { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: none; } }
    @keyframes resaltar { 0%, 100% { box-shadow: 0 0 0 0 rgba(56, 189, 248, 0); } 50% { box-shadow: 0 0 0 6px rgba(56, 189, 248, .35); } }
    @media (prefers-reduced-motion: reduce) { :host * { animation: none !important; } }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KitchenComponent implements OnInit, OnDestroy {
  private readonly avisos = inject(AvisosService);
  private readonly sonidos = inject(SonidosService);
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly webSocketService = inject(WebSocketService);

  private timerSubscription: Subscription | null = null;
  private wsSubscription: Subscription | null = null;

  // State Signals
  readonly tickets = signal<KitchenTicketDTO[]>([]);
  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  /** El estado real de la conexión lo lleva el servicio, no esta pantalla. */
  readonly isWsConnected = this.webSocketService.connected;
  /**
   * El navegador solo deja sonar después de que alguien tocó la página. Si se
   * llegó a Cocina desde el menú, ya hubo toque y suena desde el principio; si
   * se recargó, hay que tocar una vez.
   */
  readonly audioBlocked = this.sonidos.bloqueado;
  /** Quien trabaja en este equipo quiere oír las comandas (se recuerda). */
  readonly sonidoQuerido = signal(this.leerPreferenciaSonido());

  readonly currentTime = signal<number>(Date.now());

  /** "tablero": filas compactas por estado (la principal). "tarjetas": una tarjeta por pedido. */
  readonly vista = signal<'tablero' | 'tarjetas'>(this.leerVista());
  /** Pantalla completa para una TV: solo leer. Se recuerda en este equipo. */
  readonly modoTv = signal(this.leer('pidefacil.cocina.tv') === 'si');
  /** Avisos de lo que acaba de pasar en cocina (se van solos). */
  readonly avisosCocina = signal<AvisoCocina[]>([]);
  private siguienteAviso = 1;
  /** Comandas recién llegadas o con ronda nueva: orderId -> hasta cuándo se marcan. */
  private readonly recientes = signal<Map<string, number>>(new Map());
  readonly nuevas = computed(() => {
    const ahora = this.currentTime();
    return new Set([...this.recientes()].filter(([, hasta]) => hasta > ahora).map(([id]) => id));
  });

  /** La comanda abierta en la ventana. Se sigue de los datos en vivo. */
  readonly comandaAbierta = signal<string | null>(null);
  readonly comandaVista = computed(() => {
    const id = this.comandaAbierta();
    return id ? this.tickets().find((t) => t.orderId === id) ?? null : null;
  });

  /** Mesas que siguen abiertas con todo entregado: en el tablero son solo un número. */
  readonly entregadas = computed(() => this.sortedTickets().filter((t) => estadoDe(t) === 'ENTREGADA').length);

  readonly tarde = computed(() => this.comandasActivas()
    .filter((t) => estadoDe(t) !== 'LISTA' && minutosDe(t, this.currentTime()) >= 20).length);

  /** "14 Tacos al pastor · 6 Gringa": lo que falta hacer, sumado entre comandas. */
  readonly porPlatillo = computed(() => {
    const suma = new Map<string, number>();
    for (const t of this.tickets()) {
      for (const i of t.items) {
        if (i.kitchenStatus === 'PENDING' || i.kitchenStatus === 'PREPARING') {
          suma.set(i.productName, (suma.get(i.productName) ?? 0) + (i.quantity ?? 0));
        }
      }
    }
    return [...suma.entries()].map(([nombre, cantidad]) => ({ nombre, cantidad }))
      .sort((a, b) => b.cantidad - a.cantidad).slice(0, 8);
  });

  readonly reloj = computed(() => new Date(this.currentTime()).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }));

  /**
   * Lo que sigue en cocina, lo que más lleva esperando primero; las comandas
   * ya listas van al final hasta que se entregan, y las entregadas se van.
   */
  readonly comandasActivas = computed(() => {
    const enCocina = (t: KitchenTicketDTO) => t.items.some((i) => i.kitchenStatus === 'PENDING' || i.kitchenStatus === 'PREPARING');
    const espera = (t: KitchenTicketDTO) => Math.min(...t.items
      .filter((i) => i.kitchenStatus === 'PENDING' || i.kitchenStatus === 'PREPARING')
      .map((i) => (i.createdAt ? new Date(i.createdAt).getTime() : Date.now())));
    const activas = this.sortedTickets().filter((t) => t.items.some((i) => i.kitchenStatus !== 'DELIVERED'));
    const cocinando = activas.filter(enCocina).sort((a, b) => espera(a) - espera(b));
    const listas = activas.filter((t) => !enCocina(t));
    return [...cocinando, ...listas];
  });
  readonly completedSessionItemsCount = signal<number>(0);

  // SUPER_ADMIN dropdown bindings
  // Restaurante y sucursal: los mismos para todo el panel (se eligen en la barra superior).
  private readonly sucursalActiva = inject(SucursalActivaService);
  readonly restaurants = this.sucursalActiva.restaurantes;
  readonly selectedRestaurantId = this.sucursalActiva.restaurantId;
  readonly selectedBranchId = this.sucursalActiva.branchId;

  // Active branch ID resolved dynamically based on role/selection
  readonly activeBranchId = computed<string | null>(() => {
    if (this.isSuperAdmin()) {
      return this.selectedBranchId() || null;
    }
    const token = this.authService.decodedToken() as any;
    const tokenBranch = token?.branchId || token?.branch_id || null;
    return tokenBranch ? String(tokenBranch) : null;
  });

  // El operador de la plataforma también elige sucursal: entra en modo soporte.
  readonly isSuperAdmin = computed(() => this.authService.userRole() === 'SUPER_ADMIN' || this.authService.userRole() === 'SYSTEM_ADMIN');

  readonly availableBranches = computed(() => {
    const rId = this.selectedRestaurantId();
    if (!rId) return [];
    const matched = this.restaurants().find((r) => r.id === rId);
    return matched ? matched.branches : [];
  });

  // Stats computed from active branch tickets
  readonly pendingItemsCount = computed(() =>
    this.tickets().reduce(
      (sum, ticket) =>
        sum + ticket.items.filter((i) => i.kitchenStatus === 'PENDING').length,
      0
    )
  );

  readonly preparingItemsCount = computed(() =>
    this.tickets().reduce(
      (sum, ticket) =>
        sum + ticket.items.filter((i) => i.kitchenStatus === 'PREPARING').length,
      0
    )
  );

  readonly readyItemsCount = computed(() =>
    this.tickets().reduce(
      (sum, ticket) =>
        sum + ticket.items.filter((i) => i.kitchenStatus === 'READY').length,
      0
    )
  );

  // Tickets sorted so that oldest command (longest elapsed time) is first, filtering out empty tickets
  readonly sortedTickets = computed(() => {
    return [...this.tickets()]
      .filter((t) => t.items.length > 0)
      .sort((a, b) => {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });
  });

  constructor() {
    effect(() => {
      const branchId = this.activeBranchId();
      if (branchId) {
        this.loadTickets(branchId);
        this.setupWebSocket(branchId);
      } else {
        this.unsubscribeWebSocket();
        this.tickets.set([]);
        this.isLoading.set(false);
      }
    });


    // Tras una reconexión, o cada 20 s mientras no hay conexión en vivo, se
    // vuelve a pedir todo: lo que pasó durante la caída no llegó por el canal.
    effect(() => {
      if (this.webSocketService.sincronizar() === 0) return;
      const branchId = untracked(this.activeBranchId);
      if (branchId) untracked(() => this.loadTickets(branchId, true));
    });

  }

  ngOnInit(): void {
    // Tick clock every 10 seconds for elapsed time updates
    this.timerSubscription = timer(0, 10000).subscribe(() => {
      this.currentTime.set(Date.now());
    });
  }

  ngOnDestroy(): void {
    this.unsubscribeWebSocket();
    if (this.timerSubscription) {
      this.timerSubscription.unsubscribe();
    }
  }

  retryLoading(): void {
    const branchId = this.activeBranchId();
    if (branchId) {
      this.loadTickets(branchId);
      this.setupWebSocket(branchId);
    }
  }

  /**
   * Loads list of restaurants for SUPER_ADMIN selector
   */
  loadRestaurants(): void {
    this.http.get<Restaurant[]>(`${environment.apiUrl}/admin/restaurants`).subscribe({
      next: (data) => {
        const sorted = data.sort((a, b) => a.name.localeCompare(b.name));
        this.restaurants.set(sorted);
        this.preseleccionarPrimeraSucursal(sorted);
      },
      error: (err) => {
        console.error('Error fetching restaurants in KDS selector', err);
      },
    });
  }

  /**
   * Deja elegido el primer restaurante y su primera sucursal, para no abrir
   * el módulo en blanco esperando que el super admin seleccione.
   * El efecto sobre activeBranchId se encarga de cargar las comandas.
   */
  private preseleccionarPrimeraSucursal(lista: Restaurant[]): void {
    if (this.selectedRestaurantId() || lista.length === 0) return;

    // La sucursal del propio usuario primero: antes se abría la primera de la
    // lista, y quien trabajaba en otra veía una sucursal ajena y no le llegaban
    // sus pedidos ni sus avisos.
    const propia = this.authService.userBranchId();
    const conPropia = propia ? lista.find((r) => r.branches?.some((b) => b.id === propia)) : undefined;
    const restaurante = conPropia ?? lista[0];
    const sucursal = conPropia ? restaurante.branches!.find((b) => b.id === propia)! : restaurante.branches?.[0];
    if (!sucursal) return;
    this.selectedRestaurantId.set(restaurante.id);
    this.selectedBranchId.set(sucursal.id);
  }

  onRestaurantChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.selectedRestaurantId.set(select.value);
    this.selectedBranchId.set('');
    this.tickets.set([]);
  }

  onBranchChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.selectedBranchId.set(select.value);
  }

  /**
   * Initial GET load of active tickets for a branch
   */
  loadTickets(branchId: string, silencioso = false): void {
    if (!silencioso) {
      this.isLoading.set(true);
      this.errorMessage.set(null);
    }

    this.http.get<KitchenTicketDTO[]>(`${environment.apiUrl}/branches/${branchId}/kitchen/tickets`).subscribe({
      next: (data) => {
        // Una recarga silenciosa entra por el mismo camino que un aviso en
        // vivo, así un pedido recuperado tras una caída también hace sonar la campana.
        if (silencioso) {
          this.handleIncomingTickets(data);
        } else {
          this.tickets.set(data);
        }
        this.isLoading.set(false);
      },
      error: (err) => {
        this.isLoading.set(false);
        if (silencioso) return; // Se queda con lo que ya mostraba.
        console.error('Error fetching active kitchen tickets', err);
        if (err.status === 0) {
          this.errorMessage.set('No se pudo conectar con el servidor.');
        } else {
          this.errorMessage.set('Error al cargar comandas de la cocina.');
        }
      },
    });
  }

  /**
   * Avanza el platillo: pendiente -> preparando -> listo -> entregado, y desde
   * entregado regresa a listo, por si se marcó por error.
   */
  toggleItemStatus(item: KitchenTicketItemDTO): void {
    let nextStatus: KitchenItemStatus;

    if (item.kitchenStatus === 'PENDING') {
      nextStatus = 'PREPARING';
    } else if (item.kitchenStatus === 'PREPARING') {
      nextStatus = 'READY';
    } else if (item.kitchenStatus === 'READY') {
      nextStatus = 'DELIVERED';
    } else {
      nextStatus = 'READY';
    }

    const prevStatus = item.kitchenStatus;
    this.updateLocalItemStatus(item.itemId, nextStatus);

    if (nextStatus === 'READY') {
      this.completedSessionItemsCount.update(c => c + 1);
    }

    this.http.patch<void>(`${environment.apiUrl}/branches/${this.activeBranchId()}/kitchen/items/${item.itemId}/status`, null, {
      params: { status: nextStatus }
    }).subscribe({
      error: (err) => {
        console.error('Error updating kitchen item status', err);
        this.updateLocalItemStatus(item.itemId, prevStatus);
        this.avisos.error('Ocurrió un error al actualizar el estado del plato en cocina.');
      }
    });
  }

  /**
   * Mueve de un toque los platillos de una comanda: "Empezar" (pendientes a
   * preparando), "Todo listo" o "Entregado". Es una sola petición: el servidor
   * cambia todo junto y avisa una vez, así la pantalla no recibe estados a medias.
   */
  cambiarTodo(ticket: KitchenTicketDTO, de: KitchenItemStatus[], a: KitchenItemStatus): void {
    const branchId = this.activeBranchId();
    const items = ticket.items.filter((i) => de.includes(i.kitchenStatus));
    if (!branchId || items.length === 0) return;
    items.forEach((i) => this.updateLocalItemStatus(i.itemId, a));
    if (a === 'READY') this.completedSessionItemsCount.update((c) => c + items.length);
    this.http.patch(`${environment.apiUrl}/branches/${branchId}/kitchen/orders/${ticket.orderId}/status`, null, {
      params: { desde: de.join(','), a },
    }).subscribe({
      error: (err) => {
        this.avisos.error(err.error?.error || 'No se pudo actualizar la comanda. Se volvió a cargar.');
        this.loadTickets(branchId, true);
      },
    });
  }

  elegirVista(v: 'tablero' | 'tarjetas'): void {
    this.vista.set(v);
    this.guardar('pidefacil.cocina.vista', v);
  }

  /** Pantalla completa si el navegador lo permite; si no, igual ocupa toda la ventana. */
  entrarTv(): void {
    this.modoTv.set(true);
    this.guardar('pidefacil.cocina.tv', 'si');
    document.documentElement.requestFullscreen?.().catch(() => undefined);
  }

  salirTv(): void {
    this.modoTv.set(false);
    this.guardar('pidefacil.cocina.tv', 'no');
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => undefined);
  }

  private leerVista(): 'tablero' | 'tarjetas' {
    return this.leer('pidefacil.cocina.vista') === 'tarjetas' ? 'tarjetas' : 'tablero';
  }

  private leer(clave: string): string | null {
    try {
      return localStorage.getItem(clave);
    } catch {
      return null;
    }
  }

  private guardar(clave: string, valor: string): void {
    try {
      localStorage.setItem(clave, valor);
    } catch {
      /* sin almacenamiento: vale solo esta visita */
    }
  }

  /**
   * Cancels an individual kitchen item, removing it locally and notifying backend / client
   */
  async cancelItem(item: KitchenTicketItemDTO): Promise<void> {
    if (!(await this.avisos.confirmar({ titulo: `¿Cancelar ${item.productName}?`, mensaje: 'Desaparece de la comanda y se le avisa al cliente.', confirmar: 'Cancelar platillo', cancelar: 'Volver', peligro: true }))) {
      return;
    }

    this.http.patch<void>(`${environment.apiUrl}/branches/${this.activeBranchId()}/kitchen/items/${item.itemId}/status`, null, {
      params: { status: 'CANCELLED' }
    }).subscribe({
      next: () => {
        this.removeLocalItem(item.itemId);
      },
      error: (err) => {
        console.error('Error cancelling kitchen item', err);
        this.avisos.error(err.error?.message || 'Ocurrió un error al cancelar el platillo.');
      }
    });
  }

  private updateLocalItemStatus(itemId: string, status: KitchenItemStatus): void {
    const list = this.tickets();
    const updated = list.map((t) => {
      const items = t.items.map((i) => {
        if (i.itemId === itemId) {
          return { ...i, kitchenStatus: status };
        }
        return i;
      });
      return { ...t, items };
    });
    this.tickets.set(updated);
  }

  private removeLocalItem(itemId: string): void {
    const list = this.tickets();
    const updated = list.map((t) => {
      const items = t.items.filter((i) => i.itemId !== itemId);
      return { ...t, items };
    });
    this.tickets.set(updated);
  }

  /**
   * Connects to branch WebSocket for kitchen updates
   */
  private setupWebSocket(branchId: string): void {
    this.unsubscribeWebSocket();

    console.log(`Setting up KDS WebSocket subscription for branch: ${branchId}`);
    const topic = `/topic/branches/${branchId}/kitchen`;

    this.wsSubscription = this.webSocketService.subscribe<KitchenTicketDTO[]>(topic).subscribe({
      next: (newTickets) => {
        this.handleIncomingTickets(newTickets);
      },
      error: (err) => {
        console.error('KDS WebSocket subscription error:', err);
      }
    });
  }

  private unsubscribeWebSocket(): void {
    if (this.wsSubscription) {
      console.log('Unsubscribing from branch kitchen WebSocket topic');
      this.wsSubscription.unsubscribe();
      this.wsSubscription = null;
    }
  }

  /**
   * Handles WebSocket payloads, checking for new PENDING items to trigger bell alerts
   */
  abrirDesdeAviso(a: AvisoCocina): void {
    this.avisosCocina.update((lista) => lista.filter((x) => x.id !== a.id));
    if (this.tickets().some((t) => t.orderId === a.orderId)) this.comandaAbierta.set(a.orderId);
  }

  /**
   * Compara lo que había con lo que llegó: comandas nuevas, platillos que
   * agregaron a una comanda que ya estaba y lo que se canceló mientras seguía
   * en cocina. Cada cosa avisa en pantalla y con su sonido.
   */
  private avisarCambios(antes: KitchenTicketDTO[], ahora: KitchenTicketDTO[]): void {
    const previos = new Map<string, { estado: KitchenItemStatus; orderId: string; item: KitchenTicketItemDTO }>();
    antes.forEach((t) => t.items.forEach((i) => previos.set(i.itemId, { estado: i.kitchenStatus, orderId: t.orderId, item: i })));
    const ordenesAntes = new Set(antes.map((t) => t.orderId));
    const vigentes = new Set<string>();
    ahora.forEach((t) => t.items.forEach((i) => vigentes.add(i.itemId)));

    let hayNuevo = false;
    for (const t of ahora) {
      const llegaron = t.items.filter((i) => i.kitchenStatus === 'PENDING' && !previos.has(i.itemId));
      if (!llegaron.length) continue;
      hayNuevo = true;
      const ronda = ordenesAntes.has(t.orderId);
      const piezas = llegaron.reduce((n, i) => n + (i.quantity ?? 0), 0);
      this.avisar({
        tipo: ronda ? 'ronda' : 'nueva',
        orderId: t.orderId,
        titulo: etiquetaDe(t),
        detalle: (ronda ? `+${piezas} ` : `${piezas} `) + (piezas === 1 ? 'platillo: ' : 'platillos: ')
          + llegaron.map((i) => `${i.quantity} ${i.productName}`).join(' · '),
      });
      this.recientes.update((m) => new Map(m).set(t.orderId, Date.now() + 90_000));
    }

    // Lo que estaba por hacerse y ya no viene: se canceló. Lo listo o entregado
    // que desaparece es una cuenta cerrada, no se avisa.
    const cancelados = new Map<string, KitchenTicketItemDTO[]>();
    previos.forEach((p, itemId) => {
      if (vigentes.has(itemId) || (p.estado !== 'PENDING' && p.estado !== 'PREPARING')) return;
      cancelados.set(p.orderId, [...(cancelados.get(p.orderId) ?? []), p.item]);
    });
    cancelados.forEach((items, orderId) => {
      const ticket = antes.find((t) => t.orderId === orderId)!;
      const toda = !ahora.some((t) => t.orderId === orderId);
      this.avisar({
        tipo: 'cancelado',
        orderId,
        titulo: etiquetaDe(ticket),
        detalle: (toda ? 'Toda la comanda: ' : '') + items.map((i) => `${i.quantity} ${i.productName}`).join(' · '),
      });
    });

    if (hayNuevo) this.playNotificationSound();
    else if (cancelados.size && this.sonidoQuerido()) this.sonidos.tocar('cancelado');
  }

  private avisar(a: Omit<AvisoCocina, 'id'>): void {
    const id = this.siguienteAviso++;
    this.avisosCocina.update((lista) => [{ ...a, id }, ...lista].slice(0, 4));
    setTimeout(() => this.avisosCocina.update((lista) => lista.filter((x) => x.id !== id)), a.tipo === 'cancelado' ? 20_000 : 12_000);
  }

  private handleIncomingTickets(newTickets: KitchenTicketDTO[]): void {
    this.avisarCambios(this.tickets(), newTickets);
    this.tickets.set(newTickets);
  }

  /**
   * Unblocks browser audio APIs
   */
  enableAudio(): void {
    this.guardarPreferenciaSonido(true);
    this.sonidos.desbloquear();
    // Una muestra, para confirmar que se oye y a qué volumen.
    this.sonidos.tocar('comanda');
  }

  /**
   * Triggers the bell notification sound
   */
  silenciar(): void {
    this.guardarPreferenciaSonido(false);
  }

  private leerPreferenciaSonido(): boolean {
    try {
      return localStorage.getItem('pidefacil.cocina.sonido') !== 'no';
    } catch {
      return true;
    }
  }

  private guardarPreferenciaSonido(si: boolean): void {
    this.sonidoQuerido.set(si);
    try {
      localStorage.setItem('pidefacil.cocina.sonido', si ? 'si' : 'no');
    } catch {
      /* sin almacenamiento: vale solo esta visita */
    }
  }

  playNotificationSound(): void {
    if (!this.sonidoQuerido()) return;
    this.sonidos.tocar('comanda');
  }
}
