import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { LucideBell, LucideChefHat, LucideCreditCard, LucideHandHelping, LucideX, LucideBoxes } from '@lucide/angular';
import { AuthService } from '../../core/services/auth.service';
import { SonidosService, TipoSonido } from '../../core/services/sonidos.service';
import { SucursalActivaService } from '../../core/services/sucursal-activa.service';
import { WebSocketService } from '../../core/services/websocket.service';

/** Lo que manda el servidor por el canal de avisos de la sucursal. */
interface AvisoServidor {
  tableNumber?: number | null;
  type?: string;
  message?: string;
  assignedUserIds?: (string | number)[];
}

interface AvisoEnPantalla {
  id: number;
  tipo: string;
  titulo: string;
  texto: string;
}

/** Cómo se ve y suena cada aviso. */
const TIPOS: Record<string, { titulo: (mesa: number | null) => string; sonido: TipoSonido | null; segundos: number; color: string }> = {
  KITCHEN_READY: { titulo: (m) => `Mesa ${m}: listo en cocina`, sonido: 'listo', segundos: 15, color: 'border-emerald-500/60 bg-emerald-950/90' },
  PEDIDO_LISTO: { titulo: () => 'Listo para entregar', sonido: 'listo', segundos: 15, color: 'border-emerald-500/60 bg-emerald-950/90' },
  HELP: { titulo: (m) => `Mesa ${m} pide ayuda`, sonido: 'alerta', segundos: 25, color: 'border-amber-500/60 bg-amber-950/90' },
  BILL: { titulo: (m) => `Mesa ${m} pidió la cuenta`, sonido: 'alerta', segundos: 25, color: 'border-sky-500/60 bg-sky-950/90' },
  PAYMENT_INTENT: { titulo: (m) => `Mesa ${m} quiere pagar`, sonido: 'alerta', segundos: 25, color: 'border-sky-500/60 bg-sky-950/90' },
  INVENTARIO: { titulo: () => 'Inventario', sonido: null, segundos: 12, color: 'border-slate-600 bg-slate-900/95' },
};

/**
 * Los avisos de la operación en cualquier pantalla del panel: lo que sale de
 * cocina, una mesa que llama, una que pide la cuenta. Antes solo se veían en
 * Mesas; quien estaba en Domicilio o en Caja no se enteraba.
 *
 * A cada quien le llega lo suyo: al mesero, sus mesas (o todas si la mesa no
 * tiene mesero asignado); al de mostrador y domicilio, lo que sale para
 * entregar; al gerente y al dueño, todo. Cocina no recibe "listo": lo hizo ella.
 */
@Component({
  selector: 'app-avisos-operacion',
  standalone: true,
  imports: [LucideBell, LucideChefHat, LucideCreditCard, LucideHandHelping, LucideX, LucideBoxes],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="fixed top-20 right-3 sm:right-5 z-[65] flex flex-col gap-2 w-[min(92vw,22rem)] pointer-events-none" aria-live="polite" role="status">
      @for (a of avisos(); track a.id) {
        <div class="pointer-events-auto rounded-2xl border-2 shadow-2xl backdrop-blur-md p-3.5 flex items-start gap-3 animate-[entrar_.2s_ease-out]"
          [class]="estilo(a.tipo)">
          <span class="shrink-0 mt-0.5 w-9 h-9 rounded-xl bg-black/30 flex items-center justify-center" aria-hidden="true">
            @switch (a.tipo) {
              @case ('KITCHEN_READY') { <svg lucideChefHat class="w-5 h-5 text-emerald-300"></svg> }
              @case ('PEDIDO_LISTO') { <svg lucideChefHat class="w-5 h-5 text-emerald-300"></svg> }
              @case ('HELP') { <svg lucideHandHelping class="w-5 h-5 text-amber-300"></svg> }
              @case ('BILL') { <svg lucideCreditCard class="w-5 h-5 text-sky-300"></svg> }
              @case ('PAYMENT_INTENT') { <svg lucideCreditCard class="w-5 h-5 text-sky-300"></svg> }
              @case ('INVENTARIO') { <svg lucideBoxes class="w-5 h-5 text-slate-300"></svg> }
              @default { <svg lucideBell class="w-5 h-5 text-slate-300"></svg> }
            }
          </span>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-black text-white leading-tight">{{ a.titulo }}</p>
            <p class="text-xs text-slate-200 mt-1 whitespace-pre-line leading-snug">{{ a.texto }}</p>
          </div>
          <button type="button" (click)="quitar(a.id)" class="shrink-0 p-1.5 -m-1 rounded-lg text-slate-300 hover:text-white cursor-pointer" aria-label="Cerrar aviso">
            <svg lucideX class="w-4 h-4"></svg>
          </button>
        </div>
      }
    </div>
  `,
  styles: [`
    @keyframes entrar { from { opacity: 0; transform: translateX(16px); } to { opacity: 1; transform: none; } }
    @media (prefers-reduced-motion: reduce) { :host * { animation: none !important; } }
  `],
})
export class AvisosOperacionComponent {
  private readonly ws = inject(WebSocketService);
  private readonly auth = inject(AuthService);
  private readonly sonidos = inject(SonidosService);
  private readonly sucursal = inject(SucursalActivaService);
  private readonly router = inject(Router);

  readonly avisos = signal<AvisoEnPantalla[]>([]);
  private suscripcion: Subscription | null = null;
  private siguiente = 1;

  private readonly branchId = computed(() => this.sucursal.branchId() || this.auth.userBranchId());

  constructor() {
    effect(() => {
      const branchId = this.branchId();
      untracked(() => this.escuchar(branchId));
    });
    inject(DestroyRef).onDestroy(() => this.suscripcion?.unsubscribe());
  }

  quitar(id: number): void {
    this.avisos.update((lista) => lista.filter((a) => a.id !== id));
  }

  estilo(tipo: string): string {
    return (TIPOS[tipo] ?? TIPOS['INVENTARIO']).color;
  }

  private escuchar(branchId: string | null): void {
    this.suscripcion?.unsubscribe();
    this.suscripcion = null;
    this.avisos.set([]);
    if (!branchId) return;
    this.suscripcion = this.ws.subscribe<AvisoServidor>(`/topic/branches/${branchId}/alerts`).subscribe({
      next: (aviso) => this.recibir(aviso),
    });
  }

  private recibir(aviso: AvisoServidor): void {
    const tipo = aviso.type ?? 'HELP';
    if (!this.meToca(aviso, tipo)) return;
    const def = TIPOS[tipo] ?? TIPOS['HELP'];
    const mesa = aviso.tableNumber ?? null;
    const id = this.siguiente++;
    // Lo más nuevo arriba; con más de 4, el más viejo se va.
    this.avisos.update((lista) => [{ id, tipo, titulo: def.titulo(mesa), texto: limpiar(aviso.message ?? '') }, ...lista].slice(0, 4));
    if (def.sonido) this.sonidos.tocar(def.sonido);
    setTimeout(() => this.quitar(id), def.segundos * 1000);
  }

  private meToca(aviso: AvisoServidor, tipo: string): boolean {
    const rol = this.auth.userRole();
    if (rol === 'SYSTEM_ADMIN') return false; // el operador de la plataforma no opera el restaurante
    const esJefe = rol === 'SUPER_ADMIN' || rol === 'BRANCH_MANAGER' || rol === 'ADMIN';
    // "Listo" no se le avisa a cocina: lo acaba de marcar ella.
    const enCocina = this.router.url.startsWith('/kitchen');
    if ((tipo === 'KITCHEN_READY' || tipo === 'PEDIDO_LISTO') && enCocina) return false;

    if (tipo === 'INVENTARIO') return esJefe;
    if (tipo === 'PEDIDO_LISTO') {
      return esJefe || this.auth.hasPermission('ORDERS_READ') || this.auth.hasPermission('CAJA_OPERAR');
    }
    // Avisos de una mesa: sus meseros; si no tiene, todos los que atienden mesas.
    if (esJefe) return true;
    const asignados = (aviso.assignedUserIds ?? []).map(String);
    const yo = String(this.auth.currentUserId());
    if (asignados.length) return asignados.includes(yo);
    return this.auth.hasPermission('TABLES_READ');
  }
}

/** El servidor manda "🔔 ALERTA DE COBRO - Mesa 4\n\n..." pensado para WhatsApp; aquí basta el contenido. */
function limpiar(texto: string): string {
  return texto
    .replace(/^🔔\s*ALERTA[^\n]*\n+/i, '')
    .replace(/^🍽️\s*¡Pedido Listo en Cocina!\n/i, '')
    .replace(/\nPor favor, pasar a recoger\.?/i, '')
    .trim();
}
