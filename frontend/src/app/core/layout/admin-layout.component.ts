import { Component, ChangeDetectionStrategy, signal, computed, inject, effect, DestroyRef } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { RouterOutlet, RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { environment } from '../../../environments/environment';
import { MarcaLogoComponent } from '../../shared/components/marca-logo.component';
import { MarcaService } from '../services/marca.service';
import {
  LucideChevronsLeft,
  LucideLayoutDashboard,
  LucideBookOpen,
  LucideBoxes,
  LucideMessageSquare,
  LucideShield,
  LucideMenu,
  LucideLogOut,
  LucideChefHat,
  LucideBike,
  LucideStore,
  LucideUserCheck,
  LucideUsers,
  LucideReceipt,
  LucideCreditCard,
  LucideGlobe,
  LucideChevronDown,
  LucideX,
  LucideBarChart3,
  LucideWallet,
  LucideBanknote,
  LucideLifeBuoy,
  LucideSparkles,
  LucidePalette,
  LucideSun,
  LucideMoon
} from '@lucide/angular';
import { AsistenteService } from '../services/asistente.service';
import { SucursalActivaService } from '../services/sucursal-activa.service';
import { TemaService } from '../services/tema.service';
import { FranjaSoporteComponent } from '../../shared/components/franja-soporte.component';
import { CampanaAvisosComponent } from '../../shared/components/campana-avisos.component';
import { AvisosOperacionComponent } from '../../shared/components/avisos-operacion.component';

/** Una opción del menú lateral. */
interface OpcionMenu {
  ruta: string;
  nombre: string;
  /** Nombre corto para la barra inferior del celular. */
  corto?: string;
  icono: string;
  /** Solo se marca activa en su ruta exacta (p. ej. /admin no debe marcarse en /admin/roles). */
  exacta: boolean;
  visible: () => boolean;
}

/** Nombres de rol como los dice la gente del restaurante. */
const NOMBRES_DE_ROL: Record<string, string> = {
  SUPER_ADMIN: 'Super admin',
  SYSTEM_ADMIN: 'Administrador del sistema',
  ADMIN: 'Administrador',
  BRANCH_MANAGER: 'Gerente de sucursal',
};

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MarcaLogoComponent,
    LucideChevronsLeft,
    LucideLayoutDashboard,
    LucideBookOpen,
    LucideBoxes,
    LucideMessageSquare,
    LucideShield,
    LucideMenu,
    LucideLogOut,
    LucideChefHat,
    LucideBike,
    LucideStore,
    LucideUserCheck,
    LucideUsers,
    LucideReceipt,
    LucideCreditCard,
    LucideGlobe,
    LucideChevronDown,
    LucideX,
    LucideBarChart3,
    LucideWallet,
    LucideBanknote,
    LucideLifeBuoy,
    LucideSparkles,
    LucidePalette,
    LucideSun,
    LucideMoon,
    NgTemplateOutlet,
    FranjaSoporteComponent,
    CampanaAvisosComponent,
    AvisosOperacionComponent
  ],
  template: `
    <ng-template #icono let-nombre>
      @switch (nombre) {
        @case ('mesas') { <svg lucideLayoutDashboard class="w-5 h-5 shrink-0"></svg> }
        @case ('cocina') { <svg lucideChefHat class="w-5 h-5 shrink-0"></svg> }
        @case ('domicilio') { <svg lucideBike class="w-5 h-5 shrink-0"></svg> }
        @case ('historial') { <svg lucideReceipt class="w-5 h-5 shrink-0"></svg> }
        @case ('caja') { <svg lucideWallet class="w-5 h-5 shrink-0"></svg> }
        @case ('gastos') { <svg lucideBanknote class="w-5 h-5 shrink-0"></svg> }
        @case ('asistente') { <svg lucideSparkles class="w-5 h-5 shrink-0"></svg> }
        @case ('soporte') { <svg lucideLifeBuoy class="w-5 h-5 shrink-0"></svg> }
        @case ('marca') { <svg lucidePalette class="w-5 h-5 shrink-0"></svg> }
        @case ('reportes') { <svg lucideBarChart3 class="w-5 h-5 shrink-0"></svg> }
        @case ('catalogo') { <svg lucideBookOpen class="w-5 h-5 shrink-0"></svg> }
        @case ('inventario') { <svg lucideBoxes class="w-5 h-5 shrink-0"></svg> }
        @case ('sucursales') { <svg lucideStore class="w-5 h-5 shrink-0"></svg> }
        @case ('pagos') { <svg lucideCreditCard class="w-5 h-5 shrink-0"></svg> }
        @case ('pagosLinea') { <svg lucideGlobe class="w-5 h-5 shrink-0"></svg> }
        @case ('whatsapp') { <svg lucideMessageSquare class="w-5 h-5 shrink-0"></svg> }
        @case ('empleados') { <svg lucideUsers class="w-5 h-5 shrink-0"></svg> }
        @case ('roles') { <svg lucideUserCheck class="w-5 h-5 shrink-0"></svg> }
        @default { <svg lucideShield class="w-5 h-5 shrink-0"></svg> }
      }
    </ng-template>

    <!-- Fijo a la ventana y sin desplazamiento propio (overflow-clip): lo único que
         se desplaza es <main>. Con h-screen + overflow-hidden, un foco o un scroll de
         la ventana recorría todo el panel y dejaba una franja vacía abajo. -->
    <div class="fixed inset-0 flex bg-slate-950 text-slate-100 font-sans overflow-clip select-none">
      <!-- Menú lateral -->
      <!-- En celular y tablet el menú es un cajón encima del contenido -->
      @if (esMovil() && menuMovil()) {
        <div class="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" (click)="menuMovil.set(false)" aria-hidden="true"></div>
      }
      <aside
        id="menu-principal"
        [class]="esMovil()
          ? 'fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] shadow-2xl transition-transform duration-300 ' + (menuMovil() ? 'translate-x-0' : '-translate-x-full')
          : 'relative z-30 transition-all duration-300 ' + (colapsado() ? 'w-20' : 'w-64')"
        [attr.inert]="esMovil() && !menuMovil() ? '' : null"
        class="h-full bg-slate-900 border-r border-slate-800/80 flex flex-col justify-between ease-in-out shrink-0"
      >
        <div class="min-h-0 flex flex-col">
          <!-- Marca -->
          <div class="h-16 flex items-center justify-between px-4 border-b border-slate-800/80 shrink-0">
            <a routerLink="/" class="overflow-hidden rounded-lg min-w-0" [attr.aria-label]="(marca.marca()?.nombre ?? 'Pide Facil') + ', ir al inicio'">
              <app-marca-logo size="sm" [showWordmark]="!colapsado()" />
            </a>
            <button
              (click)="toggleSidebar()"
              class="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors duration-200 cursor-pointer hidden lg:block"
              [attr.aria-label]="colapsado() ? 'Expandir menú' : 'Contraer menú'"
              [title]="colapsado() ? 'Expandir menú' : 'Contraer menú'"
            >
              <svg
                lucideChevronsLeft
                [class.rotate-180]="colapsado()"
                class="w-5 h-5 transition-transform duration-300"
              ></svg>
            </button>
            <button
              (click)="menuMovil.set(false)"
              class="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer lg:hidden"
              aria-label="Cerrar menú"
            >
              <svg lucideX class="w-5 h-5"></svg>
            </button>
          </div>

          <!-- Navegación, agrupada por para qué se usa -->
          <nav class="p-3 overflow-y-auto" aria-label="Menú principal">
            @for (grupo of gruposVisibles(); track grupo.titulo) {
              <div class="mb-3 last:mb-0">
                @if (!colapsado()) {
                  <p class="px-4 pt-1 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{{ grupo.titulo }}</p>
                } @else {
                  <div class="mx-4 my-2 h-px bg-slate-800" aria-hidden="true"></div>
                }
                <div class="space-y-0.5">
                  @for (item of grupo.items; track item.ruta) {
                    <a
                      [routerLink]="item.ruta"
                      routerLinkActive="bg-indigo-600 text-white font-medium shadow-md shadow-indigo-500/10"
                      [routerLinkActiveOptions]="{ exact: item.exacta }"
                      [attr.aria-label]="colapsado() ? item.nombre : null"
                      class="flex items-center gap-4 px-4 py-2.5 rounded-xl text-slate-400 hover:bg-slate-800/50 hover:text-white transition-all duration-200 group relative"
                    >
                      <ng-container *ngTemplateOutlet="icono; context: { $implicit: item.icono }" />
                      <span
                        [class.opacity-0]="colapsado()"
                        [class.translate-x-4]="colapsado()"
                        class="text-sm transition-all duration-300 ease-in-out whitespace-nowrap"
                      >
                        {{ item.nombre }}
                      </span>
                      @if (colapsado()) {
                        <span class="absolute left-16 bg-slate-900 border border-slate-800 text-white text-xs px-2.5 py-1.5 rounded-md shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
                          {{ item.nombre }}
                        </span>
                      }
                    </a>
                  }
                </div>
              </div>
            }
          </nav>
        </div>

        <!-- Usuario -->
        <div class="p-4 border-t border-slate-800/80 flex items-center justify-between shrink-0">
          <div class="flex items-center gap-3 overflow-hidden">
            <div class="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center shrink-0 border border-slate-700">
              <span class="text-xs text-indigo-300 font-bold uppercase">{{ userInitial() }}</span>
            </div>
            <div
              [class.opacity-0]="colapsado()"
              [class.translate-x-4]="colapsado()"
              class="flex flex-col overflow-hidden transition-all duration-300 ease-in-out whitespace-nowrap"
            >
              <span class="text-sm font-medium text-white truncate max-w-[140px]">{{ username() }}</span>
              <span class="text-xs text-slate-400 truncate max-w-[140px]">{{ nombreDelRol() }}</span>
            </div>
          </div>
        </div>
      </aside>

      <!-- Área principal -->
      <div class="flex-1 flex flex-col min-w-0 overflow-hidden">
        <!-- Barra superior: en qué negocio y sucursal se está trabajando -->
        <header class="h-16 bg-slate-900/40 backdrop-blur-md border-b border-slate-800/50 flex items-center justify-between gap-3 px-4 sm:px-6 z-20 shrink-0">
          <div class="flex items-center gap-3 min-w-0">
            <button
              (click)="menuMovil.set(true)"
              class="p-2 -ml-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors duration-200 cursor-pointer block lg:hidden"
              aria-label="Abrir el menú"
              aria-controls="menu-principal"
              [attr.aria-expanded]="menuMovil()"
            >
              <svg lucideMenu class="w-6 h-6"></svg>
            </button>
            @if (sucursalActiva.puedeElegir() && sucursalActiva.hayVarias()) {
              <!-- Quien administra varias sucursales la cambia aquí, para todo el panel -->
              <div class="min-w-0 leading-tight">
                <p class="text-xs text-slate-400 truncate">{{ sucursalActiva.restaurante()?.name }}</p>
                <div class="relative">
                  <label for="sucursal-activa" class="sr-only">Sucursal con la que trabajas</label>
                  <select
                    id="sucursal-activa"
                    (change)="sucursalActiva.elegirSucursal($any($event.target).value)"
                    class="appearance-none bg-transparent pr-6 text-sm font-semibold text-white truncate max-w-[55vw] sm:max-w-md cursor-pointer outline-none rounded focus-visible:ring-2 focus-visible:ring-indigo-500"
                  >
                    @for (r of sucursalActiva.restaurantes(); track r.id) {
                      <optgroup [label]="r.name" class="bg-slate-900">
                        @for (b of r.branches; track b.id) {
                          <option [value]="b.id" [selected]="b.id === sucursalActiva.branchId()" class="bg-slate-900 text-white">{{ b.name }}</option>
                        }
                      </optgroup>
                    }
                  </select>
                  <svg lucideChevronDown class="w-4 h-4 text-slate-400 absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none"></svg>
                </div>
              </div>
            } @else if (negocio(); as n) {
              <div class="min-w-0 leading-tight">
                <p class="text-sm font-semibold text-white truncate">{{ n.restaurante }}</p>
                <p class="text-xs text-slate-400 truncate">{{ n.sucursal }}</p>
              </div>
            } @else {
              <p class="text-sm font-semibold text-white truncate">{{ marca.marca()?.nombre ?? 'Pide Facil' }}</p>
            }
          </div>

          <div class="flex items-center gap-1 shrink-0">
          <button type="button" (click)="tema.alternar()"
            class="w-10 h-10 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
            [attr.aria-label]="tema.tema() === 'claro' ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'"
            [attr.title]="tema.tema() === 'claro' ? 'Modo oscuro' : 'Modo claro'">
            @if (tema.tema() === 'claro') { <svg lucideMoon class="w-5 h-5"></svg> } @else { <svg lucideSun class="w-5 h-5"></svg> }
          </button>
          @if (userRole() === 'SUPER_ADMIN') {
            <app-campana-avisos />
          }
          <button
            (click)="onLogout()"
            class="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 font-medium text-sm transition-colors duration-200 cursor-pointer shrink-0"
            aria-label="Cerrar sesión"
          >
            <svg lucideLogOut class="w-4 h-4"></svg>
            <span class="hidden sm:inline">Cerrar sesión</span>
          </button>
          </div>
        </header>

        <!-- Modo soporte: solo el operador, cuando ve un restaurante -->
        <app-franja-soporte />

        <!-- Lo que sale de cocina y lo que piden las mesas, en cualquier pantalla -->
        <app-avisos-operacion />

        <!-- Main Content (Scrollable & Ultrawide Optimized) -->
        <main class="flex-1 overflow-y-auto bg-slate-950">
          <div class="px-4 pt-5 pb-24 sm:px-6 lg:p-8 xl:p-10 w-full max-w-[1600px] mx-auto animate-fadeIn">
            <router-outlet />
          </div>
        </main>

        <!-- Barra inferior en celular y tablet: lo que se usa durante el servicio -->
        @if (esMovil()) {
          <nav
            class="fixed bottom-0 inset-x-0 z-30 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 grid"
            [style.grid-template-columns]="'repeat(' + (accesosRapidos().length + 1) + ', minmax(0, 1fr))'"
            style="padding-bottom: env(safe-area-inset-bottom, 0px)"
            aria-label="Accesos rápidos"
          >
            @for (item of accesosRapidos(); track item.ruta) {
              <a
                [routerLink]="item.ruta"
                routerLinkActive="!text-indigo-300"
                [routerLinkActiveOptions]="{ exact: item.exacta }"
                class="flex flex-col items-center justify-center gap-1 min-h-[58px] px-1 text-[11px] font-medium text-slate-400"
              >
                <ng-container *ngTemplateOutlet="icono; context: { $implicit: item.icono }" />
                <span class="truncate max-w-full">{{ item.corto ?? item.nombre }}</span>
              </a>
            }
            <button
              (click)="menuMovil.set(true)"
              class="flex flex-col items-center justify-center gap-1 min-h-[58px] px-1 text-[11px] font-medium text-slate-400 cursor-pointer"
              aria-controls="menu-principal"
              [attr.aria-expanded]="menuMovil()"
            >
              <svg lucideMenu class="w-5 h-5"></svg>
              <span>Más</span>
            </button>
          </nav>
        }
      </div>
    </div>
  `,
  styles: [`
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(4px); }
      to { opacity: 1; transform: translateY(0); }
    }
    /*
     * Sin "forwards": al terminar, la animación no debe dejar un transform
     * puesto. Un transform en este contenedor hace que todo lo "fixed" de las
     * pantallas (modales, paneles laterales) se mida contra él y no contra la
     * ventana, y sus botones de abajo quedaban fuera de la pantalla.
     */
    .animate-fadeIn {
      animation: fadeIn 0.2s ease-out;
    }
  `],
  host: { '(document:keydown.escape)': 'menuMovil.set(false)' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminLayoutComponent {
  private readonly authService = inject(AuthService);
  private readonly http = inject(HttpClient);
  readonly sucursalActiva = inject(SucursalActivaService);
  private readonly asistente = inject(AsistenteService);
  readonly marca = inject(MarcaService);
  readonly tema = inject(TemaService);

  // Sidebar state Signal
  readonly isSidebarCollapsed = signal(false);

  /** Pantalla angosta (celular o tablet vertical): menú como cajón y barra inferior. */
  readonly esMovil = signal(false);
  readonly menuMovil = signal(false);
  /** Contraer el menú solo tiene sentido en escritorio. */
  readonly colapsado = computed(() => !this.esMovil() && this.isSidebarCollapsed());

  // Extract auth fields
  readonly username = this.authService.username;
  readonly userRole = this.authService.userRole;
  readonly userBranchId = this.authService.userBranchId;

  /** Restaurante y sucursal del usuario, para la barra superior. */
  readonly negocio = signal<{ restaurante: string; sucursal: string } | null>(null);

  constructor() {
    const consulta = window.matchMedia('(max-width: 1023px)');
    this.esMovil.set(consulta.matches);
    const alCambiar = (e: MediaQueryListEvent) => {
      this.esMovil.set(e.matches);
      if (!e.matches) this.menuMovil.set(false);
    };
    consulta.addEventListener('change', alCambiar);

    // Al elegir una pantalla, el cajón se cierra solo.
    const navegacion = inject(Router).events.subscribe((e) => {
      if (e instanceof NavigationEnd) this.menuMovil.set(false);
    });
    // El equipo ve el panel con la marca de su restaurante; al salir (cerrar
    // sesión, ir a la landing) se regresa a la de Pide Facil.
    this.marca.cargarPropia();
    // Claro u oscuro, como lo dejó cada quien en este dispositivo.
    this.tema.activar();
    inject(DestroyRef).onDestroy(() => {
      this.tema.desactivar();
      consulta.removeEventListener('change', alCambiar);
      navegacion.unsubscribe();
      this.marca.quitar();
    });

    effect(() => {
      const branchId = this.sucursalActiva.branchId() || this.userBranchId();
      if (!branchId) {
        this.negocio.set(null);
        return;
      }
      this.http
        .get<{ restaurante: string; sucursal: string }>(`${environment.apiUrl}/branches/${branchId}/nombre`)
        .subscribe({ next: (n) => this.negocio.set(n), error: () => this.negocio.set(null) });
    });
  }

  // Permission helper (delegates to AuthService.hasPermission)
  hasPermission(permission: string): boolean {
    return this.authService.hasPermission(permission);
  }

  // Computed checks
  readonly isBranchManagerOrHigher = computed(() => {
    const role = this.userRole();
    return role === 'BRANCH_MANAGER' || role === 'ADMIN' || role === 'SUPER_ADMIN';
  });

  readonly isSuperAdmin = computed(() => this.userRole() === 'SUPER_ADMIN' || this.userRole() === 'SYSTEM_ADMIN');

  /** El operador de la plataforma: ve los restaurantes en modo soporte. */
  readonly esOperador = computed(() => this.userRole() === 'SYSTEM_ADMIN');

  readonly userInitial = computed(() => {
    const name = this.username();
    return name ? name.charAt(0) : 'U';
  });

  /** «BRANCH_MANAGER» se muestra como «Gerente de sucursal»; los roles propios, legibles. */
  readonly nombreDelRol = computed(() => {
    const rol = this.userRole();
    if (!rol) return '';
    if (NOMBRES_DE_ROL[rol]) return NOMBRES_DE_ROL[rol];
    const texto = rol.replace(/_/g, ' ').toLowerCase();
    return texto.charAt(0).toUpperCase() + texto.slice(1);
  });

  /** Menú agrupado: lo del servicio arriba, los ajustes abajo. */
  private readonly grupos: { titulo: string; items: OpcionMenu[] }[] = [
    {
      titulo: 'Operación',
      items: [
        { ruta: '/dashboard', nombre: 'Mesas', icono: 'mesas', exacta: true, visible: () => this.hasPermission('TABLES_READ') },
        { ruta: '/kitchen', nombre: 'Cocina', icono: 'cocina', exacta: false, visible: () => this.hasPermission('KITCHEN_READ') },
        { ruta: '/delivery', nombre: 'Domicilio', icono: 'domicilio', exacta: false, visible: () => this.hasPermission('ORDERS_READ') },
      ],
    },
    {
      titulo: 'Ventas',
      items: [
        { ruta: '/caja', nombre: 'Caja', icono: 'caja', exacta: false, visible: () => this.hasPermission('CAJA_OPERAR') },
        { ruta: '/gastos', nombre: 'Gastos', icono: 'gastos', exacta: false, visible: () => this.isBranchManagerOrHigher() },
        {
          ruta: '/sales-history', nombre: 'Historial de ventas', corto: 'Ventas', icono: 'historial', exacta: false,
          visible: () => this.hasPermission('TABLES_READ') || this.hasPermission('ORDERS_READ'),
        },
        {
          ruta: '/analytics', nombre: 'Reportes', icono: 'reportes', exacta: false,
          visible: () => this.hasPermission('TABLES_READ') || this.hasPermission('ORDERS_READ')
            || this.hasPermission('ANALYTICS_READ') || this.isBranchManagerOrHigher(),
        },
      ],
    },
    {
      titulo: 'Asistente',
      items: [
        { ruta: '/asistente', nombre: 'Asistente IA', icono: 'asistente', exacta: false, visible: () => this.asistente.visible() },
      ],
    },
    {
      titulo: 'Menú',
      items: [
        // El catálogo se filtra por el restaurante del usuario, no por la sucursal
        // elegida: en modo soporte el operador vería otro, así que no se le muestra.
        { ruta: '/catalog', nombre: 'Catálogo', icono: 'catalogo', exacta: false, visible: () => this.hasPermission('CATALOG_READ') && !this.esOperador() },
        { ruta: '/inventario', nombre: 'Inventario', icono: 'inventario', exacta: false,
          visible: () => this.hasPermission('INVENTORY_READ') || this.hasPermission('CATALOG_READ') },
      ],
    },
    {
      titulo: 'Ajustes',
      items: [
        { ruta: '/settings/sucursales', nombre: 'Sucursales', icono: 'sucursales', exacta: false, visible: () => this.hasPermission('BRANCH_UPDATE') },
        { ruta: '/settings', nombre: 'Métodos de pago', icono: 'pagos', exacta: true, visible: () => this.isBranchManagerOrHigher() || this.esOperador() },
        { ruta: '/settings/pagos-en-linea', nombre: 'Pagos en línea', icono: 'pagosLinea', exacta: false, visible: () => this.userRole() === 'SUPER_ADMIN' },
        { ruta: '/settings/whatsapp', nombre: 'WhatsApp', icono: 'whatsapp', exacta: false, visible: () => this.isBranchManagerOrHigher() || this.esOperador() },
        { ruta: '/admin/employees', nombre: 'Empleados', icono: 'empleados', exacta: false, visible: () => this.isBranchManagerOrHigher() },
        { ruta: '/admin/roles', nombre: 'Roles y permisos', icono: 'roles', exacta: false, visible: () => this.isBranchManagerOrHigher() },
        { ruta: '/settings/marca', nombre: 'Marca', icono: 'marca', exacta: false, visible: () => this.userRole() === 'SUPER_ADMIN' },
        { ruta: '/soporte', nombre: 'Soporte', icono: 'soporte', exacta: false, visible: () => this.userRole() === 'SUPER_ADMIN' },
      ],
    },
    {
      titulo: 'Plataforma',
      items: [
        { ruta: '/system', nombre: 'Plataforma', icono: 'admin', exacta: true, visible: () => this.userRole() === 'SYSTEM_ADMIN' },
        { ruta: '/admin', nombre: 'Super Admin', icono: 'admin', exacta: true, visible: () => this.isSuperAdmin() },
      ],
    },
  ];

  /** Barra inferior: las primeras cuatro pantallas de Operación y Ventas que puede ver. */
  readonly accesosRapidos = computed(() =>
    this.gruposVisibles()
      .filter((g) => g.titulo === 'Operación' || g.titulo === 'Ventas')
      .flatMap((g) => g.items)
      .slice(0, 4),
  );

  readonly gruposVisibles = computed(() =>
    this.grupos
      .map((g) => ({ titulo: g.titulo, items: g.items.filter((i) => i.visible()) }))
      .filter((g) => g.items.length > 0),
  );

  /**
   * Collapses or expands the sidebar
   */
  toggleSidebar(): void {
    this.isSidebarCollapsed.update((collapsed) => !collapsed);
  }

  /**
   * Triggers service logout
   */
  onLogout(): void {
    this.authService.logout();
  }
}
