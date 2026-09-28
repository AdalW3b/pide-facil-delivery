import { Component, ChangeDetectionStrategy, computed, effect, inject, input, signal, untracked, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { environment } from '../../../environments/environment';
import { WebSocketService } from '../../core/services/websocket.service';
import { AuthService } from '../../core/services/auth.service';

interface SaludWhatsapp {
  pendientes: number;
  vencidosUltimaHora: number;
  ultimoError: string | null;
}

/**
 * Dice en pantalla cuándo los avisos no están llegando. Antes cocina, mesas y
 * domicilio podían quedarse congelados, o WhatsApp dejar de enviar, sin que
 * nadie en el restaurante se enterara.
 */
@Component({
  selector: 'app-estado-en-vivo',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (ws.sesionVencida()) {
      <div role="alert" class="flex flex-wrap items-center gap-3 px-4 py-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-200 text-sm">
        <span class="font-semibold">Tu sesión venció: esta pantalla dejó de recibir pedidos.</span>
        <button (click)="volverAEntrar()" class="ml-auto px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-xs font-bold cursor-pointer">
          Volver a entrar
        </button>
      </div>
    } @else if (sinConexion()) {
      <div role="status" class="px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-sm">
        <span class="font-semibold">Sin conexión en vivo.</span>
        Reintentando; mientras tanto la pantalla se actualiza sola cada 20 segundos.
      </div>
    }

    @if (whatsapp(); as w) {
      @if (w.pendientes > 0 || w.vencidosUltimaHora > 0) {
        <div role="status" class="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-sm">
          <span class="font-semibold">El WhatsApp de la sucursal no está enviando.</span>
          <span>
            @if (w.pendientes > 0) { {{ w.pendientes }} {{ w.pendientes === 1 ? 'aviso espera' : 'avisos esperan' }} para salir. }
            @if (w.vencidosUltimaHora > 0) { {{ w.vencidosUltimaHora }} ya no se enviaron en la última hora. }
          </span>
          @if (w.ultimoError) {
            <span class="text-amber-300/70 text-xs">({{ w.ultimoError }})</span>
          }
          <a routerLink="/settings/whatsapp" class="ml-auto underline underline-offset-2 text-xs font-bold">Revisar conexión</a>
        </div>
      }
    }
  `,
  host: { class: 'flex flex-col gap-2 empty:hidden' },
})
export class EstadoEnVivoComponent implements OnDestroy {
  readonly ws = inject(WebSocketService);
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  /** Sucursal cuya cola de WhatsApp se vigila. */
  readonly branchId = input<string | null>(null);

  readonly whatsapp = signal<SaludWhatsapp | null>(null);

  /**
   * Un parpadeo de un par de segundos no merece alarma: se avisa si la
   * conexión lleva caída más de 8 segundos.
   */
  private readonly caidaDesde = signal<number | null>(null);
  private readonly ahora = signal(Date.now());
  readonly sinConexion = computed(() => {
    const desde = this.caidaDesde();
    return desde !== null && this.ahora() - desde > 8000;
  });

  private readonly reloj = setInterval(() => this.ahora.set(Date.now()), 2000);
  private readonly relojWhatsapp = setInterval(() => this.consultarWhatsapp(), 30000);

  constructor() {
    effect(() => {
      const conectado = this.ws.connected();
      this.caidaDesde.set(conectado ? null : (untracked(this.caidaDesde) ?? Date.now()));
    });
    effect(() => {
      if (this.branchId()) this.consultarWhatsapp();
    });
  }

  private consultarWhatsapp(): void {
    const branchId = this.branchId();
    if (!branchId || this.ws.sesionVencida()) return;
    this.http.get<SaludWhatsapp>(`${environment.apiUrl}/branches/${branchId}/whatsapp/salud`).subscribe({
      next: (s) => this.whatsapp.set(s),
      error: () => this.whatsapp.set(null),
    });
  }

  volverAEntrar(): void {
    this.auth.logout();
  }

  ngOnDestroy(): void {
    clearInterval(this.reloj);
    clearInterval(this.relojWhatsapp);
  }
}
