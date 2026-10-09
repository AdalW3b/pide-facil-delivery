import { Routes } from '@angular/router';
import { authGuard, roleGuard, permissionGuard } from './core/guards/auth.guard';
import { LoginComponent } from './features/auth/login.component';
import { RegisterComponent } from './features/auth/register.component';
import { UnauthorizedComponent } from './features/auth/unauthorized.component';
import { AdminLayoutComponent } from './core/layout/admin-layout.component';
import { DashboardComponent } from './features/tables/dashboard.component';
import { WhatsappConfigComponent } from './features/settings/whatsapp-config.component';
import { SettingsComponent } from './features/settings/settings.component';
import { SuperAdminDashboardComponent } from './features/admin-core/super-admin-dashboard.component';
import { CatalogComponent } from './features/catalog/catalog.component';
import { KitchenComponent } from './features/kitchen/kitchen.component';
import { DeliveryBoardComponent } from './features/delivery/delivery-board.component';
import { RolesComponent } from './features/admin-core/roles.component';
import { EmployeesComponent } from './features/admin-core/employees.component';
import { SalesHistoryComponent } from './features/sales/sales-history.component';
import { AnalyticsDashboardComponent } from './features/analytics/analytics-dashboard.component';

export const routes: Routes = [
  // Página pública de aterrizaje: se carga aparte para no pesar sobre el panel.
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./features/landing/landing.component').then((m) => m.LandingComponent),
  },
  // Menú público para pedir a domicilio: entra el comensal por un enlace, sin
  // cuenta y fuera del panel. Se carga aparte para no arrastrar el admin.
  {
    path: 'pedir/:branchId',
    loadComponent: () =>
      import('./features/delivery/public-order.component').then((m) => m.PublicOrderComponent),
  },
  // Kiosko de la sucursal: una tablet donde el cliente pide solo. Pública: la
  // tablet se identifica con el token que le deja el panel al activarla.
  {
    path: 'kiosko',
    loadComponent: () => import('./features/kiosko/kiosko.component').then((m) => m.KioskoComponent),
  },
  // Pantalla del repartidor: se abre desde el enlace que se publica en el grupo
  // de WhatsApp. Sin cuenta; el token del pedido es lo que autoriza.
  {
    path: 'repartidor/:token',
    loadComponent: () =>
      import('./features/delivery/driver-order.component').then((m) => m.DriverOrderComponent),
  },
  // Cuenta de clientes y repartidores: entrar, registrarse y ver su historial.
  // Nada que ver con la sesion del personal, que vive en /login.
  {
    path: 'cuenta/:branchId',
    loadComponent: () =>
      import('./features/cuenta/cuenta-acceso.component').then((m) => m.CuentaAccesoComponent),
  },
  {
    path: 'mi-cuenta/:branchId',
    loadComponent: () =>
      import('./features/cuenta/mi-cuenta.component').then((m) => m.MiCuentaComponent),
  },
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'unauthorized', component: UnauthorizedComponent },
  {
    path: '',
    component: AdminLayoutComponent,
    canActivate: [authGuard],
    children: [
      {
        path: 'dashboard',
        component: DashboardComponent,
        canActivate: [permissionGuard],
        data: { requiredPermission: 'TABLES_READ' },
      },
      {
        path: 'analytics',
        component: AnalyticsDashboardComponent,
        canActivate: [roleGuard],
        data: {
          roles: ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'ADMIN', 'BRANCH_MANAGER'],
          expectedRoles: ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'ADMIN', 'BRANCH_MANAGER'],
        },
      },
      {
        path: 'sales-history',
        component: SalesHistoryComponent,
        canActivate: [permissionGuard],
        data: { requiredPermission: 'TABLES_READ' },
      },
      {
        // Abrir, cerrar y arquear la caja. Cobrar una mesa se hace desde Mesas.
        path: 'caja',
        loadComponent: () => import('./features/caja/caja.component').then((m) => m.CajaComponent),
        canActivate: [permissionGuard],
        data: { requiredPermission: 'CAJA_OPERAR' },
      },
      {
        // Pagos con tarjeta del menú en línea: lista, detalle y devoluciones.
        path: 'cobros-en-linea',
        loadComponent: () => import('./features/caja/cobros-linea.component').then((m) => m.CobrosLineaComponent),
        canActivate: [roleGuard],
        data: { expectedRoles: ['SUPER_ADMIN', 'ADMIN', 'BRANCH_MANAGER'] },
      },
      {
        // Renta, luz, nómina: lo lleva el dueño o el gerente.
        path: 'gastos',
        loadComponent: () => import('./features/gastos/gastos.component').then((m) => m.GastosComponent),
        canActivate: [roleGuard],
        data: { expectedRoles: ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'ADMIN', 'BRANCH_MANAGER'] },
      },
      {
        path: 'kitchen',
        component: KitchenComponent,
        canActivate: [permissionGuard],
        data: { requiredPermission: 'KITCHEN_READ' },
      },
      {
        path: 'delivery',
        component: DeliveryBoardComponent,
        canActivate: [permissionGuard],
        data: { requiredPermission: 'ORDERS_READ' },
      },
      {
        path: 'catalog',
        component: CatalogComponent,
        canActivate: [permissionGuard],
        data: { requiredPermission: 'CATALOG_READ' },
      },
      {
        // Inventario con su propio permiso: quien lleva el almacén no necesita el catálogo.
        path: 'inventario',
        loadComponent: () => import('./features/inventario/inventario.component').then((m) => m.InventarioComponent),
        canActivate: [permissionGuard],
        data: { requiredPermission: 'INVENTORY_READ', permisosAlternos: ['CATALOG_READ'] },
      },
      {
        path: 'settings',
        component: SettingsComponent,
        canActivate: [roleGuard],
        data: { expectedRoles: ['BRANCH_MANAGER', 'ADMIN', 'SUPER_ADMIN', 'SYSTEM_ADMIN'] },
      },
      {
        path: 'settings/sucursales',
        loadComponent: () =>
          import('./features/settings/branch-settings.component').then((m) => m.BranchSettingsComponent),
        canActivate: [roleGuard],
        data: { expectedRoles: ['BRANCH_MANAGER', 'ADMIN', 'SUPER_ADMIN', 'SYSTEM_ADMIN'] },
      },
      {
        path: 'settings/whatsapp',
        component: WhatsappConfigComponent,
        canActivate: [roleGuard],
        data: { expectedRoles: ['BRANCH_MANAGER', 'ADMIN', 'SUPER_ADMIN', 'SYSTEM_ADMIN'] },
      },
      {
        // Nombre, color y logo con que ven el sistema sus clientes y su equipo.
        path: 'settings/marca',
        loadComponent: () => import('./features/settings/marca-settings.component').then((m) => m.MarcaSettingsComponent),
        canActivate: [roleGuard],
        data: { expectedRoles: ['SUPER_ADMIN'] },
      },
      {
        // El dueño conecta su cuenta de Stripe para cobrar en el menú en línea.
        path: 'settings/pagos-en-linea',
        loadComponent: () =>
          import('./features/settings/pagos-linea-settings.component').then((m) => m.PagosLineaSettingsComponent),
        canActivate: [roleGuard],
        data: { expectedRoles: ['SUPER_ADMIN'] },
      },
      {
        path: 'admin',
        component: SuperAdminDashboardComponent,
        canActivate: [roleGuard],
        data: { expectedRoles: ['SUPER_ADMIN', 'SYSTEM_ADMIN'] },
      },
      {
        // El dueño frente a soporte: su código de autorización y la bitácora.
        path: 'soporte',
        loadComponent: () => import('./features/admin-core/soporte-dueno.component').then((m) => m.SoporteDuenoComponent),
        canActivate: [roleGuard],
        data: { expectedRoles: ['SUPER_ADMIN'] },
      },
      {
        // El asistente operativo: quién lo usa y qué ve lo decide el backend.
        path: 'asistente',
        loadComponent: () => import('./features/asistente/asistente.component').then((m) => m.AsistenteComponent),
      },
      {
        // La pantalla del operador de la plataforma; el dueño no entra.
        path: 'system',
        loadComponent: () => import('./features/admin-core/plataforma.component').then((m) => m.PlataformaComponent),
        canActivate: [roleGuard],
        data: { soloOperador: true },
      },
      {
        path: 'admin/roles',
        component: RolesComponent,
        canActivate: [roleGuard],
        data: { expectedRoles: ['BRANCH_MANAGER', 'SUPER_ADMIN'] },
      },
      {
        path: 'admin/employees',
        component: EmployeesComponent,
        canActivate: [roleGuard],
        data: { expectedRoles: ['BRANCH_MANAGER', 'SUPER_ADMIN'] },
      },
    ],
  },
  // Cualquier ruta desconocida cae en la landing, que ya ofrece el acceso al panel
  // a quien tenga sesión abierta.
  { path: '**', redirectTo: '' },
];
