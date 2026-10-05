import { AsistenteBotComponent } from './asistente-bot.component';
import { TituloPaginaComponent } from '../../shared/components/titulo-pagina.component';
import { AvisosService } from '../../core/services/avisos.service';
import { SucursalActivaService } from '../../core/services/sucursal-activa.service';
import { Component, ChangeDetectionStrategy, signal, computed, OnInit, OnDestroy, inject, effect, untracked } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { Restaurant, Branch } from '../admin-core/models/admin.model';
import {
  LucideBuilding,
  LucideMessageSquare,
  LucideQrCode,
  LucideRefreshCw,
  LucidePower,
  LucideAlertTriangle,
  LucideCheckCircle2,
  LucideLoader2
} from '@lucide/angular';
import * as QRCode from 'qrcode';
import { environment } from '../../../environments/environment';

// ─── Constants ───────────────────────────────────────────────────────────────

/** Spring Boot backend base URL */
const API_BASE_URL = environment.apiUrl;



/** Polling interval in ms while waiting for QR or connected status */
const POLL_INTERVAL_MS = 3000;

// ─── Types ────────────────────────────────────────────────────────────────────

type SessionStatus =
  | 'idle'           // Component just loaded, unknown state
  | 'checking'       // Polling to see current remote status
  | 'disconnected'   // Session exists but not connected
  | 'connecting'     // POST /connect sent, waiting for QR
  | 'qr_ready'       // QR available to scan
  | 'open'           // Successfully connected
  | 'error';         // Unrecoverable error

interface WaStatusResponse {
  accountId: string;
  status: string;
  qr: string | null;
  number: string | null;
  pairingCode: string | null;
  origin: string | null;
  companyId: string | null;
  /** Explicación del backend, p. ej. cuando el número ya es de otra sucursal. */
  message?: string | null;
  /** Conectado, pero el número también está registrado en otra sucursal. */
  warning?: string | null;
}

// ─── Component ────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-whatsapp-config',
  standalone: true,
  imports: [TituloPaginaComponent, AsistenteBotComponent, 
    CommonModule,
    LucideBuilding,
    LucideMessageSquare,
    LucideQrCode,
    LucideRefreshCw,
    LucidePower,
    LucideAlertTriangle,
    LucideCheckCircle2,
    LucideLoader2
  ],
  template: `
    <div class="space-y-8">

      <!-- Page Header -->
      <div>
        <app-titulo-pagina titulo="WhatsApp" descripcion="Conecta el número de la sucursal para que el bot atienda y salgan los avisos a clientes y repartidores." />
      </div>


      <!-- Main Card or Selection Placeholder -->
      @if (isSuperAdmin() && !selectedBranchId()) {
        <div class="py-16 px-4 border border-dashed border-slate-800 rounded-2xl flex flex-col items-center justify-center text-center gap-4 bg-slate-900/10">
          <div class="w-12 h-12 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <svg lucideBuilding class="w-6 h-6"></svg>
          </div>
          <div>
            <h3 class="font-bold text-white text-base">Selecciona una sucursal</h3>
            <p class="text-xs text-slate-400 max-w-sm mt-1">Como administrador global, debes seleccionar un restaurante y una sucursal para ver y gestionar su configuración de WhatsApp.</p>
          </div>
        </div>
      } @else {
        <!-- Main Card -->
        <div class="grid grid-cols-1 lg:grid-cols-5 gap-6">

        <!-- Left: Status & Actions -->
        <div class="lg:col-span-2 flex flex-col gap-5">

          <!-- Connection Status Card -->
          <div class="p-6 bg-slate-900/50 border border-slate-800/80 rounded-2xl backdrop-blur-sm space-y-5">
            <div class="flex items-center justify-between">
              <h2 class="text-sm font-bold text-slate-400 uppercase tracking-wider">Estado de la Sesión</h2>
              <!-- Live indicator dot -->
              <div class="flex items-center gap-1.5">
                <span
                  [class.bg-emerald-400]="uiStatus() === 'open'"
                  [class.animate-pulse]="uiStatus() === 'open'"
                  [class.bg-amber-400]="uiStatus() === 'qr_ready' || uiStatus() === 'connecting'"
                  [class.bg-rose-400]="uiStatus() === 'disconnected' || uiStatus() === 'error'"
                  [class.bg-slate-600]="uiStatus() === 'idle' || uiStatus() === 'checking'"
                  class="w-2 h-2 rounded-full transition-colors duration-500"
                ></span>
                <span class="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  {{ statusLabel() }}
                </span>
              </div>
            </div>

            <!-- Status Icon Hero -->
            <div class="flex items-center justify-center py-4">
              @if (uiStatus() === 'open') {
                <!-- Connected state icon -->
                <div class="w-20 h-20 rounded-full bg-emerald-500/10 border-2 border-emerald-500/20 flex items-center justify-center text-emerald-400 animate-pulse-slow">
                  <svg class="w-10 h-10" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                </div>
              } @else if (uiStatus() === 'qr_ready') {
                <!-- QR ready icon -->
                <div class="w-20 h-20 rounded-full bg-indigo-500/10 border-2 border-indigo-500/20 flex items-center justify-center text-indigo-400">
                  <svg lucideQrCode class="w-10 h-10"></svg>
                </div>
              } @else if (uiStatus() === 'connecting' || uiStatus() === 'checking') {
                <!-- Loading icon -->
                <div class="w-20 h-20 rounded-full bg-slate-800 border-2 border-slate-700/60 flex items-center justify-center text-slate-400">
                  <svg lucideLoader2 class="w-10 h-10 animate-spin text-slate-400"></svg>
                </div>
              } @else {
                <!-- Disconnected/Error/Idle icon -->
                <div class="w-20 h-20 rounded-full bg-slate-800 border-2 border-slate-700/60 flex items-center justify-center text-slate-500">
                  <svg lucideAlertTriangle class="w-10 h-10"></svg>
                </div>
              }
            </div>

            <!-- Status Details -->
            <div class="space-y-2 text-xs text-slate-400">
              <div class="flex justify-between">
                <span>ID de Sesión</span>
                <code class="font-mono text-indigo-400 text-[11px]">{{ activeBranchId() || 'No seleccionado' }}</code>
              </div>
              @if (connectedNumber()) {
                <div class="flex justify-between">
                  <span>Número vinculado</span>
                  <span class="font-semibold text-emerald-400">+{{ connectedNumber() }}</span>
                </div>
              }
              @if (errorMessage()) {
                <div class="mt-2 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-400 text-[11px] leading-relaxed">
                  {{ errorMessage() }}
                </div>
              }
            </div>
          </div>

          <!-- Action Buttons Card -->
          <div class="p-5 bg-slate-900/50 border border-slate-800/80 rounded-2xl backdrop-blur-sm space-y-3">
            <h2 class="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Acciones</h2>

            <!-- Connect Button -->
            <button
              id="btn-connect-whatsapp"
              (click)="startConnection()"
              [disabled]="isConnecting() || uiStatus() === 'open' || !activeBranchId()"
              class="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-xl shadow-lg shadow-indigo-600/10 hover:shadow-indigo-500/20 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer"
            >
              @if (isConnecting()) {
                <span class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                <span>Iniciando conexión...</span>
              } @else if (uiStatus() === 'open') {
                <svg lucideCheckCircle2 class="w-4 h-4"></svg>
                <span>Ya conectado</span>
              } @else {
                <svg lucideQrCode class="w-4 h-4"></svg>
                <span>Generar Código QR</span>
              }
            </button>

            <!-- Check Status Button (manual refresh) -->
            <button
              id="btn-refresh-status-whatsapp"
              (click)="checkStatus()"
              [disabled]="isConnecting() || !activeBranchId()"
              class="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-300 hover:text-white font-semibold text-sm rounded-xl transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer"
            >
              <svg lucideRefreshCw class="w-4 h-4"></svg>
              <span>Verificar Estado</span>
            </button>

            <!-- Logout Button -->
            @if (uiStatus() === 'open' || uiStatus() === 'qr_ready' || uiStatus() === 'connecting') {
              <button
                id="btn-logout-whatsapp"
                (click)="logoutSession()"
                [disabled]="isConnecting() || !activeBranchId()"
                class="w-full py-2.5 px-4 bg-rose-600/10 hover:bg-rose-600/20 border border-rose-600/20 hover:border-rose-600/40 disabled:opacity-40 disabled:cursor-not-allowed text-rose-400 hover:text-rose-300 font-semibold text-sm rounded-xl transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer"
              >
                <svg lucidePower class="w-4 h-4"></svg>
                <span>Cerrar Sesión / Desconectar</span>
              </button>
            }
          </div>
        </div>

        <!-- Right: QR Display Area -->
        <div class="lg:col-span-3">
          <div class="h-full min-h-80 p-6 bg-slate-900/50 border border-slate-800/80 rounded-2xl backdrop-blur-sm flex flex-col items-center justify-center text-center gap-6">

            @if (uiStatus() === 'open') {
              <!-- === CONNECTED STATE === -->
              <div class="space-y-4 py-6">
                <div class="w-24 h-24 mx-auto rounded-full bg-emerald-500/10 border-2 border-emerald-400/30 flex items-center justify-center">
                  <svg lucideCheckCircle2 class="w-12 h-12 text-emerald-400"></svg>
                </div>
                <div class="space-y-2">
                  <h3 class="text-xl font-bold text-white">¡WhatsApp Conectado!</h3>
                  @if (connectedNumber()) {
                    <p class="text-sm text-slate-400">
                      Número activo:
                      <span class="font-bold text-emerald-400">+{{ connectedNumber() }}</span>
                    </p>
                  }
                  <p class="text-xs text-slate-400 max-w-xs mx-auto">
                    Tu bot de Pide Facil está listo para recibir y enviar mensajes automáticos de WhatsApp.
                  </p>
                  @if (avisoNumero()) {
                    <p class="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 max-w-sm mx-auto" role="alert">
                      {{ avisoNumero() }}
                    </p>
                  }
                </div>
                <div class="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 text-xs font-semibold">
                  <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>Sesión activa</span>
                </div>
              </div>
            } @else if (uiStatus() === 'qr_ready' && qrData()) {
              <!-- === QR CODE DISPLAY === -->
              <div class="space-y-5 w-full">
                <div class="space-y-1">
                  <h3 class="text-base font-bold text-white">Escanea el código QR</h3>
                  <p class="text-xs text-slate-400">Abre WhatsApp en tu celular → Dispositivos vinculados → Vincular dispositivo</p>
                </div>

                <!-- QR image container -->
                <div class="mx-auto w-fit p-2 bg-white rounded-2xl shadow-2xl shadow-black/50">
                  @if (isDataUrl()) {
                    <img
                      [src]="qrData()!"
                      alt="Código QR de WhatsApp"
                      class="w-56 h-56 object-contain block"
                    />
                  } @else if (safeSvg()) {
                    <div
                      class="w-56 h-56 flex items-center justify-center [&_svg]:w-full [&_svg]:h-full"
                      [innerHTML]="safeSvg()"
                    ></div>
                  }
                </div>

                <div class="flex items-center justify-center gap-2 text-amber-400 text-[11px] font-semibold">
                  <span class="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                  <span>Esperando escaneo — verificando cada {{ POLL_INTERVAL_MS / 1000 }}s</span>
                </div>
              </div>
            } @else if (uiStatus() === 'connecting' || uiStatus() === 'checking') {
              <!-- === LOADING STATE === -->
              <div class="space-y-4 py-8">
                <div class="relative w-16 h-16 mx-auto">
                  <div class="absolute inset-0 rounded-full border-4 border-slate-800"></div>
                  <div class="absolute inset-0 rounded-full border-4 border-t-indigo-500 animate-spin"></div>
                </div>
                <div class="space-y-1">
                  <p class="text-sm font-semibold text-white">{{ loadingMessage() }}</p>
                  <p class="text-xs text-slate-400">Esto puede tardar unos segundos...</p>
                </div>
              </div>
            } @else if (uiStatus() === 'error') {
              <!-- === ERROR STATE === -->
              <div class="space-y-4 py-8 max-w-sm">
                <div class="w-16 h-16 mx-auto rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
                  <svg lucideAlertTriangle class="w-8 h-8"></svg>
                </div>
                <div class="space-y-2">
                  <h3 class="font-bold text-white">{{ numeroDuplicado() ? 'Este número ya se usa en otra sucursal' : 'Error de conexión' }}</h3>
                  <p class="text-xs text-slate-400 leading-relaxed">{{ errorMessage() }}</p>
                </div>
                <button
                  (click)="startConnection()"
                  class="px-5 py-2 bg-rose-600/10 hover:bg-rose-600/20 border border-rose-600/20 rounded-xl text-rose-400 text-sm font-semibold transition-all duration-200 cursor-pointer"
                >
                  Reintentar
                </button>
              </div>
            } @else {
              <!-- === IDLE / DISCONNECTED STATE === -->
              <div class="space-y-4 py-8 max-w-sm">
                <div class="w-16 h-16 mx-auto rounded-full bg-slate-800 border-2 border-slate-700/60 flex items-center justify-center text-slate-500">
                  <svg lucideMessageSquare class="w-8 h-8"></svg>
                </div>
                <div class="space-y-2">
                  <h3 class="font-bold text-white text-base">Sin sesión activa</h3>
                  <p class="text-xs text-slate-400 leading-relaxed">
                    Haz clic en <strong class="text-indigo-400">Generar Código QR</strong> para iniciar la vinculación del número WhatsApp de tu sucursal.
                  </p>
                </div>
              </div>
            }

          </div>
        </div>
      </div>

      <!-- Instructions section (only shown when not connected) -->
      @if (uiStatus() !== 'open') {
        <div class="p-5 bg-slate-900/40 border border-slate-800/60 rounded-2xl">
          <h3 class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">¿Cómo vincular tu WhatsApp?</h3>
          <ol class="space-y-3 text-sm text-slate-400">
            <li class="flex gap-3">
              <span class="shrink-0 w-5 h-5 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-[11px] font-bold text-indigo-400">1</span>
              <span>Haz clic en <strong class="text-white">Generar Código QR</strong> para iniciar el proceso.</span>
            </li>
            <li class="flex gap-3">
              <span class="shrink-0 w-5 h-5 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-[11px] font-bold text-indigo-400">2</span>
              <span>Espera a que aparezca el código QR en la pantalla (puede tardar 5-10 segundos).</span>
            </li>
            <li class="flex gap-3">
              <span class="shrink-0 w-5 h-5 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-[11px] font-bold text-indigo-400">3</span>
              <span>En tu celular, abre WhatsApp → <strong class="text-white">⋮ Más → Dispositivos vinculados → Vincular dispositivo</strong>.</span>
            </li>
            <li class="flex gap-3">
              <span class="shrink-0 w-5 h-5 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-[11px] font-bold text-indigo-400">4</span>
              <span>Escanea el código QR que aparece en pantalla. La conexión se establecerá automáticamente.</span>
            </li>
          </ol>
        </div>
      }

      <!-- Nombre y personalidad del asistente de esta sucursal -->
      <app-asistente-bot [branchId]="activeBranchId()" />
      }

    </div>
  `,
  styles: [`
    @keyframes pulse-slow {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.7; }
    }
    .animate-pulse-slow {
      animation: pulse-slow 3s ease-in-out infinite;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WhatsappConfigComponent implements OnInit, OnDestroy {
  private readonly avisos = inject(AvisosService);
  private readonly http = inject(HttpClient);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly authService = inject(AuthService);

  // Expose constants to template
  readonly POLL_INTERVAL_MS = POLL_INTERVAL_MS;

  // ─── Multitenant State & Auth Signals ─────────────────────────────────────
  
  readonly userRole = computed(() => this.authService.userRole());
  // El operador de la plataforma también elige sucursal: entra en modo soporte.
  readonly isSuperAdmin = computed(() => this.userRole() === 'SUPER_ADMIN' || this.userRole() === 'SYSTEM_ADMIN');
  
  // Writable signal for SUPER_ADMIN branch selection

  // SUPER_ADMIN dropdown bindings
  // Restaurante y sucursal: los mismos para todo el panel (se eligen en la barra superior).
  private readonly sucursalActiva = inject(SucursalActivaService);
  readonly restaurants = this.sucursalActiva.restaurantes;
  readonly selectedRestaurantId = this.sucursalActiva.restaurantId;
  readonly selectedBranchId = this.sucursalActiva.branchId;

  /** Al elegir otra sucursal en la barra superior se recarga esta pantalla. */
  private readonly recargarAlCambiarSucursal = effect(() => {
    const b = this.selectedBranchId();
    if (!this.isSuperAdmin()) return;
    untracked(() => this.alCambiarSucursal(b));
  });

  readonly availableBranches = computed(() => {
    const rId = this.selectedRestaurantId();
    if (!rId) return [];
    const matched = this.restaurants().find((r) => r.id === rId);
    return matched ? matched.branches.slice().sort((a, b) => a.name.localeCompare(b.name)) : [];
  });
  
  // Extract branch ID from JWT if they are a BRANCH_MANAGER or other role
  readonly tokenBranchId = computed(() => {
    const token = this.authService.decodedToken() as any;
    return token?.branchId || token?.branch_id || null;
  });

  // Active branch ID resolved dynamically based on role
  readonly activeBranchId = computed<string | null>(() => {
    if (this.isSuperAdmin()) {
      return this.selectedBranchId();
    }
    const tokenBranch = this.tokenBranchId();
    return tokenBranch ? String(tokenBranch) : null;
  });

  // ─── Signals ──────────────────────────────────────────────────────────────

  /** Current mapped UI status */
  readonly uiStatus = signal<SessionStatus>('idle');

  /** QR code string (base64 data URL or raw SVG) */
  readonly qrData = signal<string | null>(null);

  /** Connected phone number */
  readonly connectedNumber = signal<string | null>(null);

  /** Error message when status is 'error' */
  readonly errorMessage = signal<string | null>(null);
  /** El teléfono ya estaba conectado en otra sucursal y el servicio lo rechazó. */
  readonly numeroDuplicado = signal(false);
  readonly avisoNumero = signal<string | null>(null);

  // ─── Computed Signals ─────────────────────────────────────────────────────

  /** True when any loading action is in progress */
  readonly isConnecting = computed(() =>
    this.uiStatus() === 'connecting' || this.uiStatus() === 'checking'
  );

  /** Human-readable status label */
  readonly statusLabel = computed((): string => {
    switch (this.uiStatus()) {
      case 'open':        return 'Conectado';
      case 'qr_ready':    return 'Esperando escaneo';
      case 'connecting':  return 'Conectando...';
      case 'checking':    return 'Verificando...';
      case 'disconnected':return 'Desconectado';
      case 'error':       return 'Error';
      default:            return 'Sin sesión';
    }
  });

  /** Context-aware loading message for the spinner */
  readonly loadingMessage = computed((): string => {
    if (this.uiStatus() === 'checking') return 'Verificando estado de la sesión...';
    return 'Iniciando conexión con WhatsApp...';
  });

  /** True if the QR data is a base64 image data URL */
  readonly isDataUrl = computed(() => !!this.qrData()?.startsWith('data:'));

  /** Sanitized SVG string for [innerHTML] binding */
  readonly safeSvg = computed((): SafeHtml | null => {
    const qr = this.qrData();
    if (!qr || qr.startsWith('data:') || !qr.includes('<svg')) return null;
    return this.sanitizer.bypassSecurityTrustHtml(qr);
  });

  // ─── Polling ──────────────────────────────────────────────────────────────

  private pollingTimer: ReturnType<typeof setInterval> | null = null;

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  ngOnInit(): void {
    if (!this.isSuperAdmin()) {
      // For BRANCH_MANAGER, immediately check status
      this.checkStatus();
    }
  }

  /**
   * Carga las sucursales del restaurante del usuario y las agrupa para los
   * desplegables.
   *
   * Antes pedia /admin/restaurants, que exige el permiso MANAGE_RESTAURANTS y
   * solo tiene el operador de la plataforma (SYSTEM_ADMIN). Un SUPER_ADMIN es el
   * dueno de UN restaurante: recibia 403 y el interceptor lo echaba a
   * /unauthorized nada mas registrarse. /branches ya viene acotado al
   * restaurante de quien llama.
   */
  loadRestaurants(): void {
    this.errorMessage.set(null);
    this.http.get<Branch[]>(`${environment.apiUrl}/branches`).subscribe({
      next: (branches) => {
        const porRestaurante = new Map<string, Restaurant>();
        for (const sucursal of branches) {
          let restaurante = porRestaurante.get(sucursal.restaurantId);
          if (!restaurante) {
            restaurante = {
              id: sucursal.restaurantId,
              name: sucursal.restaurantName,
              active: true,
              createdAt: sucursal.createdAt,
              branches: [],
            };
            porRestaurante.set(sucursal.restaurantId, restaurante);
          }
          restaurante.branches.push(sucursal);
        }

        const lista = [...porRestaurante.values()].sort((a, b) => a.name.localeCompare(b.name));
        this.restaurants.set(lista);

        // El dueno tiene un solo restaurante y, recien registrado, una sola
        // sucursal: elegirlos a mano no aporta nada, asi que los damos por
        // seleccionados y consultamos el estado directamente.
        // Con varias sucursales se abre la del propio usuario (o la primera),
        // igual que Mesas y Cocina, en vez de una pantalla vacía.
        if (!this.selectedBranchId() && lista.length > 0) {
          const propia = this.authService.userBranchId();
          const restaurante = lista.find((r) => r.branches.some((b) => b.id === propia)) ?? lista[0];
          const sucursal = restaurante.branches.find((b) => b.id === propia) ?? restaurante.branches[0];
          this.selectedRestaurantId.set(restaurante.id);
          if (sucursal) {
            this.selectedBranchId.set(sucursal.id);
            this.checkStatus();
          }
        }
      },
      error: (err) => {
        console.error('Error loading branches', err);
        this.errorMessage.set('No se pudo cargar la lista de sucursales.');
      }
    });
  }

  /**
   * Triggers when SUPER_ADMIN changes restaurant
   */
  onRestaurantChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.selectedRestaurantId.set(select.value);
    this.stopPolling();
    this.uiStatus.set('idle');
    this.qrData.set(null);
    this.connectedNumber.set(null);
    this.errorMessage.set(null);
    this.selectedBranchId.set('');
  }

  /**
   * Resets status and triggers checkStatus when a branch is selected
   */
  /** Otra sucursal en la barra superior: se limpia lo de la anterior y se consulta la nueva. */
  private alCambiarSucursal(branchId: string): void {
    this.stopPolling();
    this.uiStatus.set('idle');
    this.qrData.set(null);
    this.connectedNumber.set(null);
    this.errorMessage.set(null);
    if (branchId) {
      this.checkStatus();
    }
  }

  onBranchChange(event: Event): void {
    const val = (event.target as HTMLSelectElement).value;
    this.stopPolling();
    this.uiStatus.set('idle');
    this.qrData.set(null);
    this.connectedNumber.set(null);
    this.errorMessage.set(null);
    this.selectedBranchId.set(val || '');
    
    if (val) {
      this.checkStatus();
    }
  }

  ngOnDestroy(): void {
    this.stopPolling();
  }

  // ─── Public Methods ───────────────────────────────────────────────────────

  /**
   * Fetches the current remote status once (no polling).
   * Maps the service status string → our SessionStatus union.
   */
  checkStatus(): void {
    const branchId = this.activeBranchId();
    if (!branchId) return;

    this.uiStatus.set('checking');
    this.errorMessage.set(null);

    this.http
      .get<WaStatusResponse>(`${API_BASE_URL}/branches/${branchId}/whatsapp/status`)
      .subscribe({
        next: (res) => this.applyRemoteStatus(res),
        error: () => {
          this.uiStatus.set('error');
          this.errorMessage.set(
            'No se pudo conectar con el servicio de WhatsApp a través del backend. ' +
            'Asegúrate de que el backend y el microservicio estén corriendo.'
          );
          this.stopPolling();
        },
      });
  }

  /**
   * Sends POST /connect to start the Baileys session, then begins polling.
   */
  startConnection(): void {
    const branchId = this.activeBranchId();
    if (!branchId || this.isConnecting() || this.uiStatus() === 'open') return;

    this.uiStatus.set('connecting');
    this.qrData.set(null);
    this.errorMessage.set(null);

    this.http
      .post<{ message: string; status: string }>(`${API_BASE_URL}/branches/${branchId}/whatsapp/qr`, {})
      .subscribe({
        next: () => {
          // Begin polling for QR / connected status
          this.startPolling();
        },
        error: (err) => {
          this.uiStatus.set('error');
          this.errorMessage.set(
            err.error?.error || 'Error al iniciar la conexión con WhatsApp.'
          );
        },
      });
  }

  /**
   * Sends POST /logout to terminate the session.
   */
  async logoutSession(): Promise<void> {
    const branchId = this.activeBranchId();
    if (!branchId) return;

    if (!(await this.avisos.confirmar({ titulo: '¿Desconectar WhatsApp?', mensaje: 'El bot dejará de responder y no saldrán avisos hasta que vuelvas a escanear el código QR.', confirmar: 'Desconectar', peligro: true }))) return;

    this.stopPolling();
    this.uiStatus.set('checking');

    this.http
      .post<{ success: boolean; message: string }>(`${API_BASE_URL}/branches/${branchId}/whatsapp/logout`, {})
      .subscribe({
        next: () => {
          this.uiStatus.set('disconnected');
          this.qrData.set(null);
          this.connectedNumber.set(null);
        },
        error: () => {
          this.uiStatus.set('error');
          this.errorMessage.set('Error al cerrar la sesión de WhatsApp.');
        },
      });
  }

  // ─── Private Methods ──────────────────────────────────────────────────────

  /**
   * Applies a remote /status response to local signals.
   */
  private applyRemoteStatus(res: WaStatusResponse): void {
    this.connectedNumber.set(res.number);
    this.numeroDuplicado.set(false);
    this.avisoNumero.set(res.warning ?? null);

    switch (res.status) {
      case 'error_duplicate_number':
        // Un número, una sucursal: el servicio desvinculó este intento.
        this.numeroDuplicado.set(true);
        this.connectedNumber.set(null);
        this.uiStatus.set('error');
        this.errorMessage.set(res.message || 'Ese WhatsApp ya está conectado en otra sucursal. Cada sucursal necesita su propio número.');
        this.stopPolling();
        break;

      case 'open':
        this.uiStatus.set('open');
        this.qrData.set(null);
        this.stopPolling(); // No more polling needed
        break;

      case 'qr_ready':
        this.uiStatus.set('qr_ready');
        if (res.qr) {
          if (res.qr.startsWith('data:')) {
            this.qrData.set(res.qr);
          } else {
            // Generate QR image with small margin and WhatsApp logo overlay
            this.generateQrWithLogo(res.qr)
              .then((url) => this.qrData.set(url))
              .catch((err) => {
                console.error('Error generating local QR code:', err);
                this.qrData.set(res.qr); // fallback
              });
          }
        }
        // Keep polling to detect when user scans
        this.startPolling();
        break;

      case 'connecting':
      case 'pairing_code_ready':
        this.uiStatus.set('connecting');
        // Keep polling
        this.startPolling();
        break;

      case 'disconnected':
      case 'closed':
        this.uiStatus.set('disconnected');
        this.stopPolling();
        break;

      default:
        // Unknown / no session
        this.uiStatus.set('disconnected');
        this.stopPolling();
    }
  }

  /**
   * Starts periodic polling against GET /status.
   * Guards against double-starting.
   */
  private startPolling(): void {
    if (this.pollingTimer !== null) return; // Already polling

    this.pollingTimer = setInterval(() => {
      const branchId = this.activeBranchId();
      if (!branchId) {
        this.stopPolling();
        return;
      }

      this.http
        .get<WaStatusResponse>(`${API_BASE_URL}/branches/${branchId}/whatsapp/status`)
        .subscribe({
          next: (res) => this.applyRemoteStatus(res),
          error: () => {
            // If the microservice goes down during polling, show error
            this.uiStatus.set('error');
            this.errorMessage.set('Se perdió la conexión con el servicio de WhatsApp.');
            this.stopPolling();
          },
        });
    }, POLL_INTERVAL_MS);
  }

  /**
   * Generates a QR Code image locally and overlays the WhatsApp logo in the center.
   * Also configures a minimal margin to reduce white padding.
   */
  private generateQrWithLogo(qrText: string): Promise<string> {
    return new Promise((resolve, reject) => {
      // 1. Generate QR Code with minimal margin and custom dark/light colors
      QRCode.toDataURL(qrText, {
        margin: 1, // Minimize margin
        width: 300,
        color: {
          dark: '#0f172a', // slate-900 color for QR dots
          light: '#ffffff' // white background
        }
      })
      .then((qrDataUrl) => {
        const img = new Image();
        img.src = qrDataUrl;
        img.onload = () => {
          // 2. Setup canvas
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(qrDataUrl);
            return;
          }

          // Draw QR Code
          ctx.drawImage(img, 0, 0);

          // 3. Setup central logo overlay dimensions (20% of QR size)
          const qrSize = img.width;
          const logoSize = qrSize * 0.20; 
          const logoX = (qrSize - logoSize) / 2;
          const logoY = (qrSize - logoSize) / 2;

          // Draw rounded white square background card for the logo
          const borderRadius = 8;
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          if (ctx.roundRect) {
            ctx.roundRect(logoX, logoY, logoSize, logoSize, borderRadius);
          } else {
            ctx.rect(logoX, logoY, logoSize, logoSize);
          }
          ctx.fill();

          // Draw green circle inside for WhatsApp background
          const innerSize = logoSize * 0.85;
          const innerX = logoX + (logoSize - innerSize) / 2;
          const innerY = logoY + (logoSize - innerSize) / 2;
          ctx.fillStyle = '#25D366'; // WhatsApp brand green
          ctx.beginPath();
          ctx.arc(innerX + innerSize / 2, innerY + innerSize / 2, innerSize / 2, 0, 2 * Math.PI);
          ctx.fill();

          // Draw WhatsApp white phone icon from inline SVG
          const waLogoImg = new Image();
          waLogoImg.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>';

          waLogoImg.onload = () => {
            const svgSize = innerSize * 0.65;
            const svgX = innerX + (innerSize - svgSize) / 2;
            const svgY = innerY + (innerSize - svgSize) / 2;
            ctx.drawImage(waLogoImg, svgX, svgY, svgSize, svgSize);
            resolve(canvas.toDataURL('image/png'));
          };
          waLogoImg.onerror = () => {
            resolve(canvas.toDataURL('image/png'));
          };
        };
        img.onerror = reject;
      })
      .catch(reject);
    });
  }

  /**
   * Clears the polling interval.
   */
  private stopPolling(): void {
    if (this.pollingTimer !== null) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
  }
}
