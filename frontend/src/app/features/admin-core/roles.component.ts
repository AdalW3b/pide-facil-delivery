import { TituloPaginaComponent } from '../../shared/components/titulo-pagina.component';
import { AvisosService } from '../../core/services/avisos.service';
import { Component, ChangeDetectionStrategy, signal, computed, inject, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/services/auth.service';
import { Restaurant, Branch } from './models/admin.model';
import {
  LucidePlus,
  LucideEdit,
  LucideTrash2,
  LucideX,
  LucideLoader2,
  LucideAlertCircle,
  LucideShield,
  LucideCheck,
  LucideGlobe,
  LucideBuilding2,
  LucideStore
} from '@lucide/angular';

export interface Permission {
  id: string;
  name: string;
  description: string;
}

export interface Role {
  id?: string | number;
  name: string;
  description: string;
  defaultRoute?: string;
  isCustom?: boolean;
  is_custom?: boolean;
  permissions?: Permission[] | string[];
  restaurantId?: string | null;
  branchId?: string | null;
  restaurant_id?: string | null;
  branch_id?: string | null;
}


// ── Static permission matrix definition ─────────────────────
interface CrudAction {
  key: 'READ' | 'CREATE' | 'UPDATE' | 'DELETE';
  label: string;
}

interface PermissionModule {
  label: string;
  prefix: string;           // Eg. "TABLES"
  actions: CrudAction[];    // Applicable actions for this module
}

const CRUD_ACTIONS: CrudAction[] = [
  { key: 'READ', label: 'Ver' },
  { key: 'CREATE', label: 'Crear' },
  { key: 'UPDATE', label: 'Editar' },
  { key: 'DELETE', label: 'Eliminar' },
];

const PERMISSION_MODULES: PermissionModule[] = [
  {
    label: 'Mesas',
    prefix: 'TABLES',
    actions: [
      { key: 'READ', label: 'Ver' },
      { key: 'CREATE', label: 'Crear' },
      { key: 'UPDATE', label: 'Editar' },
      { key: 'DELETE', label: 'Eliminar' },
    ]
  },
  {
    label: 'Cocina (KDS)',
    prefix: 'KITCHEN',
    actions: [
      { key: 'READ', label: 'Ver' },
      { key: 'UPDATE', label: 'Editar' },
    ]
  },
  {
    label: 'Catálogo',
    prefix: 'CATALOG',
    actions: [
      { key: 'READ', label: 'Ver' },
      { key: 'CREATE', label: 'Crear' },
      { key: 'UPDATE', label: 'Editar' },
      { key: 'DELETE', label: 'Eliminar' },
    ]
  },
  {
    label: 'Usuarios & Roles',
    prefix: 'ROLES',
    actions: [
      { key: 'READ', label: 'Ver' },
      { key: 'CREATE', label: 'Crear' },
      { key: 'UPDATE', label: 'Editar' },
      { key: 'DELETE', label: 'Eliminar' },
    ]
  },
  {
    label: 'WhatsApp',
    prefix: 'WHATSAPP',
    actions: [
      { key: 'READ', label: 'Ver' },
      { key: 'UPDATE', label: 'Editar' },
    ]
  },
];

@Component({
  selector: 'app-roles',
  standalone: true,
  imports: [TituloPaginaComponent, 
    CommonModule,
    FormsModule,
    LucidePlus,
    LucideEdit,
    LucideTrash2,
    LucideX,
    LucideLoader2,
    LucideAlertCircle,
    LucideShield,
    LucideGlobe,
    LucideBuilding2,
    LucideStore
  ],
  template: `
    <div class="p-6 space-y-6 max-w-[1600px] mx-auto select-none">
      
      <!-- Top Header Bar -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
        <div>
          <div class="flex items-center gap-2.5">
            <app-titulo-pagina titulo="Roles y permisos" descripcion="Qué puede ver y hacer cada puesto." />
          </div>
        </div>

        <button
          (click)="showCreateRoleModal()"
          class="flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500 text-white font-semibold text-sm rounded-xl shadow-lg shadow-indigo-500/20 transition-all duration-200 cursor-pointer shrink-0"
        >
          <svg lucidePlus class="w-4 h-4"></svg>
          <span>Nuevo Rol</span>
        </button>
      </div>

      <!-- Alert Notification -->
      @if (errorMessage()) {
        <div class="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex items-center justify-between animate-fadeIn">
          <div class="flex items-center gap-3">
            <svg lucideAlertCircle class="w-5 h-5 shrink-0 text-rose-400"></svg>
            <span>{{ errorMessage() }}</span>
          </div>
          <button aria-label="Cerrar" (click)="errorMessage.set(null)" class="text-rose-400 hover:text-rose-300">
            <svg lucideX class="w-4 h-4"></svg>
          </button>
        </div>
      }

      <!-- Roles Table / Cards Grid -->
      <div class="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        
        <!-- Table Header / Search Bar -->
        <div class="p-5 border-b border-slate-800/80 flex items-center justify-between">
          <h2 class="text-sm font-bold text-white uppercase tracking-wider">Roles Registrados</h2>
          <span class="text-xs text-slate-400 font-medium">{{ roles().length }} roles en total</span>
        </div>

        <!-- Loading State -->
        @if (isLoading()) {
          <div class="py-20 flex flex-col items-center justify-center text-slate-500 gap-3">
            <svg lucideLoader2 class="animate-spin w-8 h-8 text-indigo-500"></svg>
            <span class="text-xs font-medium">Cargando roles...</span>
          </div>
        } @else if (roles().length === 0) {
          <!-- Empty State -->
          <div class="py-20 text-center space-y-3">
            <div class="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-800/80 text-slate-500 mb-1">
              <svg lucideShield class="w-6 h-6"></svg>
            </div>
            <p class="text-sm font-semibold text-slate-400">No hay roles registrados</p>
            <p class="text-xs text-slate-600 max-w-sm mx-auto">Comienza creando un rol personalizado como "Cocinero", "Cajero" o "Mesero".</p>
          </div>
        } @else {
          <!-- Table -->
          <div class="overflow-x-auto">
            <div class="min-w-[700px]">
              <div class="grid grid-cols-12 bg-slate-950/60 border-b border-slate-800/80 px-6 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <div class="col-span-3">Nombre del Rol</div>
                <div class="col-span-4">Descripción</div>
                <div class="col-span-2">Alcance</div>
                <div class="col-span-3 text-right">Acciones</div>
              </div>

              @for (role of roles(); track role.id) {
                <div class="grid grid-cols-12 px-6 py-4 border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors items-center">
                  
                  <!-- Role Name -->
                  <div class="col-span-3 flex items-center gap-3">
                    <div class="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0 font-bold text-xs uppercase">
                      {{ role.name.charAt(0) }}
                    </div>
                    <div>
                      <span class="text-sm font-semibold text-white block">{{ role.name }}</span>
                      @if (isSystemRole(role)) {
                        <span class="inline-block px-2 py-0.5 text-[11px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-md mt-0.5">Sistema</span>
                      } @else {
                        <span class="inline-block px-2 py-0.5 text-[11px] font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 rounded-md mt-0.5">Personalizado</span>
                      }
                    </div>
                  </div>

                  <!-- Description -->
                  <div class="col-span-4 text-xs text-slate-400 pr-4">
                    {{ role.description || 'Sin descripción' }}
                  </div>

                  <!-- Scope Badge -->
                  <div class="col-span-2">
                    @if (role.branchId || role.branch_id) {
                      <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                        <svg lucideStore class="w-3.5 h-3.5"></svg>
                        Sucursal
                      </span>
                    } @else if (role.restaurantId || role.restaurant_id) {
                      <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-violet-500/10 text-violet-400 border border-violet-500/20">
                        <svg lucideBuilding2 class="w-3.5 h-3.5"></svg>
                        Restaurante
                      </span>
                    } @else {
                      <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <svg lucideGlobe class="w-3.5 h-3.5"></svg>
                        Global
                      </span>
                    }
                  </div>

                  <!-- Actions -->
                  <div class="col-span-3 flex items-center justify-end gap-1.5">
                    @if (isSystemRole(role)) {
                      <span class="text-xs text-slate-400 italic pr-3 font-semibold select-none">Bloqueado (Sistema)</span>
                    } @else {
                      <button aria-label="Editar Rol"
                        (click)="editRole(role)"
                        class="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                        title="Editar Rol"
                      >
                        <svg lucideEdit class="w-4 h-4"></svg>
                      </button>
                      <button aria-label="Eliminar Rol"
                        (click)="deleteRole(role)"
                        class="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-colors cursor-pointer"
                        title="Eliminar Rol"
                      >
                        <svg lucideTrash2 class="w-4 h-4"></svg>
                      </button>
                    }
                  </div>

                </div>
              }
            </div>
          </div>
        }
      </div>
    </div>

    <!-- Create/Edit Role Modal -->
    @if (isModalOpen()) {
      <div class="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 sm:p-6">
        <div (click)="closeModal()" class="fixed inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity duration-300"></div>

        <div class="w-full max-w-3xl bg-slate-900 border border-slate-800 text-slate-100 rounded-2xl shadow-2xl relative overflow-hidden animate-scaleIn flex flex-col max-h-[85vh] sm:max-h-[90vh] my-auto z-10">
          <div class="h-16 flex items-center justify-between px-6 border-b border-slate-800/80 shrink-0 bg-slate-900 z-10">
            <h3 class="text-base font-bold text-white">
              {{ roleForm.id ? 'Editar Rol' : 'Crear Rol' }}
            </h3>
            <button aria-label="Cerrar"
              (click)="closeModal()"
              class="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <svg lucideX class="w-5 h-5"></svg>
            </button>
          </div>

          <div class="flex-1 min-h-0 p-6 space-y-6 overflow-y-auto">
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Nombre del Rol</label>
                <input aria-label="Nombre del rol"
                  type="text"
                  placeholder="Ej. Cocinero Principal"
                  [(ngModel)]="roleForm.name"
                  class="w-full bg-slate-950/50 border border-slate-800 rounded-xl py-2.5 px-4 text-sm text-white placeholder-slate-600 outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
              <div>
                <label class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Descripción</label>
                <input aria-label="Descripción"
                  type="text"
                  placeholder="Función principal del rol"
                  [(ngModel)]="roleForm.description"
                  class="w-full bg-slate-950/50 border border-slate-800 rounded-xl py-2.5 px-4 text-sm text-white placeholder-slate-600 outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
              <div>
                <label for="rol-inicio" class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Pantalla de inicio</label>
                <!-- Solo pantallas que existen: el backend rechaza cualquier otra ruta. -->
                <select id="rol-inicio"
                  [(ngModel)]="roleForm.defaultRoute"
                  class="w-full bg-slate-950/50 border border-slate-800 rounded-xl py-2.5 px-4 text-sm text-white outline-none focus:border-indigo-500 transition-colors cursor-pointer"
                >
                  @for (p of pantallas; track p.ruta) {
                    <option [value]="p.ruta" class="bg-slate-950">{{ p.nombre }}</option>
                  }
                </select>
              </div>
            </div>

            <div>
              <div class="flex items-center justify-between mb-3">
                <label class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">Matriz de Permisos</label>
                <span class="text-[11px] font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-1 rounded-lg">
                  {{ selectedPermissionIds.size }} activos
                </span>
              </div>
              <div class="rounded-xl border border-slate-800 overflow-x-auto">
                <div class="min-w-[500px]">
                  <div class="grid grid-cols-[1fr_44px_52px_56px_56px_64px] gap-0 bg-slate-950/60 border-b border-slate-800">
                    <div class="px-4 py-3 text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center">Módulo</div>
                    <div class="py-3 text-[11px] font-black text-slate-500 uppercase tracking-wider text-center flex items-center justify-center">Todo</div>
                    @for (action of CRUD_ACTIONS; track action.key) {
                      <div class="py-3 text-[11px] font-black uppercase tracking-wider text-center flex items-center justify-center">{{ action.label }}</div>
                    }
                  </div>
                  @for (mod of PERMISSION_MODULES; track mod.prefix) {
                    <div class="grid grid-cols-[1fr_44px_52px_56px_56px_64px] gap-0 border-b border-slate-800/60 hover:bg-slate-800/20">
                      <div class="px-4 py-3 flex items-center gap-2.5 min-w-0">
                        <span class="text-xs font-semibold text-slate-300 truncate">{{ mod.label }}</span>
                      </div>
                      <div class="flex items-center justify-center">
                        <input [attr.aria-label]="'Todos los permisos de ' + mod.label" type="checkbox" [checked]="isModuleFullySelected(mod)" (change)="toggleModule(mod)" class="w-4 h-4 accent-indigo-600 cursor-pointer" />
                      </div>
                      @for (action of CRUD_ACTIONS; track action.key) {
                        <div class="flex items-center justify-center py-3">
                          @if (moduleHasAction(mod, action.key)) {
                            <input [attr.aria-label]="action.key + ' en ' + mod.label" type="checkbox" [checked]="isPermissionSelected(getPermKey(mod.prefix, action.key))" (change)="togglePermissionByKey(mod.prefix, action.key)" class="w-4 h-4 cursor-pointer" />
                          } @else { <span class="text-slate-700">—</span> }
                        </div>
                      }
                    </div>
                  }
                </div>
              </div>
            </div>
          </div>

          <div class="p-6 border-t border-slate-800/80 bg-slate-900 shrink-0 flex items-center justify-end gap-3 z-10">
            <button (click)="closeModal()" class="px-4 py-2.5 hover:bg-slate-800 rounded-xl text-xs font-bold text-slate-400 hover:text-white transition-colors cursor-pointer">Cancelar</button>
            <button (click)="saveRole()" [disabled]="isSaving() || !roleForm.name.trim()" class="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-2">
              @if (isSaving()) { <svg lucideLoader2 class="animate-spin w-3.5 h-3.5"></svg> }
              <span>{{ roleForm.id ? 'Actualizar' : 'Guardar' }}</span>
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes scaleIn { from { opacity: 0; transform: scale(0.97); } to { opacity: 1; transform: scale(1); } }
    .animate-fadeIn { animation: fadeIn 0.2s ease-out forwards; }
    .animate-scaleIn { animation: scaleIn 0.2s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RolesComponent implements OnInit {
  private readonly avisos = inject(AvisosService);
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);

  readonly isSuperAdmin = computed(() => this.authService.userRole() === 'SUPER_ADMIN');
  readonly restaurants = signal<Restaurant[]>([]);
  readonly branches = signal<{ id: string; name: string; restaurantId?: string }[]>([]);

  readonly CRUD_ACTIONS = CRUD_ACTIONS;
  readonly PERMISSION_MODULES = PERMISSION_MODULES;

  readonly roles = signal<Role[]>([]);
  readonly availablePermissions = signal<Permission[]>([]);
  readonly isLoading = signal(true);
  readonly isSaving = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly isModalOpen = signal(false);

  roleForm: Role = { name: '', description: '', defaultRoute: '/dashboard' };

  /** Las pantallas a las que puede mandar un rol al entrar (las mismas que acepta el backend). */
  readonly pantallas = [
    { ruta: '/dashboard', nombre: 'Mesas' },
    { ruta: '/kitchen', nombre: 'Cocina' },
    { ruta: '/delivery', nombre: 'Domicilio' },
    { ruta: '/caja', nombre: 'Caja' },
    { ruta: '/sales-history', nombre: 'Historial de ventas' },
    { ruta: '/analytics', nombre: 'Reportes' },
    { ruta: '/catalog', nombre: 'Catálogo' },
    { ruta: '/inventario', nombre: 'Inventario' },
    { ruta: '/settings', nombre: 'Métodos de pago' },
    { ruta: '/settings/sucursales', nombre: 'Sucursales' },
    { ruta: '/settings/whatsapp', nombre: 'WhatsApp' },
    { ruta: '/admin/employees', nombre: 'Empleados' },
    { ruta: '/admin/roles', nombre: 'Roles y permisos' },
  ];
  readonly selectedPermissionIds = new Set<string>();
  private permByName = new Map<string, Permission>();

  ngOnInit(): void {
    this.loadRoles();
    this.loadPermissions();
    this.loadRestaurantsAndBranches();
  }

  loadRestaurantsAndBranches(): void {
    if (!this.isSuperAdmin()) return;

    this.http.get<Restaurant[]>(`${environment.apiUrl}/admin/restaurants`).subscribe({
      next: (data) => {
        this.restaurants.set(data || []);
        const branchList: { id: string; name: string; restaurantId?: string }[] = [];
        (data || []).forEach(r => {
          if (r.branches) {
            r.branches.forEach(b => {
              branchList.push({
                id: String(b.id),
                name: `${r.name} - ${b.name}`,
                restaurantId: String(r.id)
              });
            });
          }
        });
        this.branches.set(branchList);
      },
      error: (err) => console.error('Error loading restaurants', err)
    });
  }

  isSystemRole(role: Role): boolean {
    return role.isCustom === false || role.is_custom === false;
  }

  getPermKey(prefix: string, actionKey: string): string {
    return `${prefix}_${actionKey}`;
  }

  moduleHasAction(mod: PermissionModule, actionKey: string): boolean {
    return mod.actions.some(a => a.key === actionKey);
  }

  isPermissionSelected(key: string): boolean {
    return this.selectedPermissionIds.has(key);
  }

  togglePermissionByKey(prefix: string, actionKey: string): void {
    const key = this.getPermKey(prefix, actionKey);
    this.selectedPermissionIds.has(key) ? this.selectedPermissionIds.delete(key) : this.selectedPermissionIds.add(key);
  }

  isModuleFullySelected(mod: PermissionModule): boolean {
    return mod.actions.every(a => this.selectedPermissionIds.has(this.getPermKey(mod.prefix, a.key)));
  }

  toggleModule(mod: PermissionModule): void {
    const allSelected = this.isModuleFullySelected(mod);
    mod.actions.forEach(a => {
      const key = this.getPermKey(mod.prefix, a.key);
      allSelected ? this.selectedPermissionIds.delete(key) : this.selectedPermissionIds.add(key);
    });
  }

  loadRoles(): void {
    this.isLoading.set(true);
    this.http.get<Role[]>(`${environment.apiUrl}/admin/roles`).subscribe({
      next: (data) => {
        this.roles.set(data || []);
        this.isLoading.set(false);
      },
      error: () => { this.isLoading.set(false); this.errorMessage.set('Error al cargar roles.'); }
    });
  }

  loadPermissions(): void {
    this.http.get<Permission[]>(`${environment.apiUrl}/admin/permissions`).subscribe({
      next: (data) => {
        this.availablePermissions.set(data || []);
        this.permByName.clear();
        (data || []).forEach(p => this.permByName.set(p.name, p));
      }
    });
  }

  showCreateRoleModal(): void {
    this.roleForm = { name: '', description: '', defaultRoute: '/dashboard' };
    this.selectedPermissionIds.clear();
    this.errorMessage.set(null);
    this.isModalOpen.set(true);
  }

  editRole(role: Role): void {
    this.roleForm = {
      id: role.id,
      name: role.name,
      description: role.description,
      // Un rol viejo puede apuntar a una pantalla que ya no existe: se propone Mesas.
      defaultRoute: this.pantallas.some((p) => p.ruta === role.defaultRoute) ? role.defaultRoute : '/dashboard'
    };

    this.selectedPermissionIds.clear();
    (role.permissions || []).forEach((p: any) => {
      const permName = typeof p === 'string' ? p : (p.name || '');
      if (permName) this.selectedPermissionIds.add(permName);
    });

    this.errorMessage.set(null);
    this.isModalOpen.set(true);
  }

  closeModal(): void { this.isModalOpen.set(false); }

  saveRole(): void {
    if (!this.roleForm.name.trim()) return;

    this.isSaving.set(true);
    const permissionIds: string[] = [];
    const permissionNames: string[] = [];

    this.selectedPermissionIds.forEach(key => {
      const perm = this.permByName.get(key);
      if (perm) { permissionIds.push(perm.id); permissionNames.push(perm.name); }
    });

    const body = {
      name: this.roleForm.name.trim(),
      description: this.roleForm.description?.trim() ?? '',
      defaultRoute: this.roleForm.defaultRoute?.trim() || '/dashboard',
      permissionIds,
      permissions: permissionNames
    };

    const request$ = this.roleForm.id
      ? this.http.put<Role>(`${environment.apiUrl}/admin/roles/${this.roleForm.id}`, body)
      : this.http.post<Role>(`${environment.apiUrl}/admin/roles`, body);

    request$.subscribe({
      next: () => { this.isSaving.set(false); this.isModalOpen.set(false); this.loadRoles(); },
      error: (err) => { this.isSaving.set(false); this.errorMessage.set(err.error?.error || err.error?.message || 'Error al guardar.'); }
    });
  }

  async deleteRole(role: Role): Promise<void> {
    if (!role.id) return;
    if (this.isSystemRole(role)) return;

    const confirmDelete = (await this.avisos.confirmar({ titulo: `¿Eliminar el rol ${role.name}?`, mensaje: 'Solo se puede eliminar si ningún empleado lo tiene. Si alguno lo tiene, primero asígnale otro rol.', confirmar: 'Eliminar rol', peligro: true }));
    if (!confirmDelete) return;

    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.http.delete<void>(`${environment.apiUrl}/admin/roles/${role.id}`).subscribe({
      next: () => {
        this.loadRoles();
      },
      error: (err) => {
        this.isLoading.set(false);
        console.error('Error deleting role', err);
        this.errorMessage.set(err.error?.error || err.error?.message || 'No se pudo eliminar el rol.');
      }
    });
  }
}
