import { TituloPaginaComponent } from '../../shared/components/titulo-pagina.component';
import { AvisosService } from '../../core/services/avisos.service';
import { Component, ChangeDetectionStrategy, signal, computed, inject, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/services/auth.service';
import { Restaurant } from './models/admin.model';
import { 
  LucidePlus, 
  LucideEdit, 
  LucideTrash2, 
  LucideX, 
  LucideLoader2, 
  LucideAlertCircle, 
  LucideUser 
} from '@lucide/angular';

export interface UserRoleInfo {
  id: string;
  name: string;
  defaultRoute?: string;
}

export interface UserBranchInfo {
  id: string;
  name: string;
}

export interface Employee {
  id: string;
  name: string;
  username: string;
  phoneNumber?: string;
  role: UserRoleInfo | null;
  branch: UserBranchInfo | null;
  active: boolean;
  assignedTableIds?: string[];
  assigned_table_ids?: string[];
  assignedTables?: any[];
}

@Component({
  selector: 'app-employees',
  standalone: true,
  imports: [TituloPaginaComponent, 
    CommonModule, 
    ReactiveFormsModule, 
    LucidePlus, 
    LucideEdit, 
    LucideTrash2, 
    LucideX, 
    LucideLoader2, 
    LucideAlertCircle, 
    LucideUser
  ],
  template: `
    <div class="space-y-8 select-none text-slate-100 p-2 sm:p-4">
      <!-- Header section -->
      <div class="flex items-center justify-between">
        <div>
          <app-titulo-pagina titulo="Empleados" descripcion="Quién entra al panel, con qué rol y en qué sucursal." />
        </div>
        <button
          (click)="showCreateModal()"
          class="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-indigo-600/15 cursor-pointer"
        >
          <svg lucidePlus class="w-4 h-4"></svg>
          <span>Crear Empleado</span>
        </button>
      </div>

      <!-- Error alert -->
      @if (errorMessage()) {
        <div class="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex items-start gap-3 animate-fadeIn">
          <svg lucideAlertCircle class="w-5 h-5 shrink-0 mt-0.5 text-rose-400"></svg>
          <span>{{ errorMessage() }}</span>
        </div>
      }

      <!-- Main table list -->
      <div class="bg-slate-900/40 border border-slate-800/80 rounded-2xl backdrop-blur-md p-6 flex flex-col min-h-[400px]">
        @if (isLoading()) {
          <div class="flex-1 flex flex-col items-center justify-center py-20">
            <svg lucideLoader2 class="animate-spin w-8 h-8 text-indigo-500"></svg>
            <span class="text-xs text-slate-400 mt-3 font-semibold">Cargando personal...</span>
          </div>
        } @else if (users().length === 0) {
          <div class="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-4">
            <svg lucideUser class="w-12 h-12 text-slate-700"></svg>
            <h3 class="font-bold text-white text-sm">No se encontraron empleados</h3>
            <p class="text-xs text-slate-400 max-w-xs">No hay empleados registrados en tu sucursal o restaurante en este momento.</p>
          </div>
        } @else {
          <div class="divide-y divide-slate-800/60 overflow-x-auto">
            <!-- Table Header -->
            <div class="hidden md:grid grid-cols-12 gap-4 px-6 py-4 bg-slate-950/20 text-xs font-bold text-slate-400 uppercase tracking-wider rounded-xl">
              <div class="col-span-5">Empleado</div>
              <div class="col-span-3">Rol</div>
              <div class="col-span-3">Sucursal</div>
              <div class="col-span-1 text-right"><span class="sr-only">Acciones</span></div>
            </div>

            <!-- Table Rows -->
            <div class="space-y-1 mt-2">
              @for (user of users(); track user.id) {
                <div class="grid grid-cols-1 md:grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-slate-800/20 border border-transparent hover:border-slate-800/40 rounded-xl transition-all">
                  
                  <!-- Nombre Real -->
                  <div class="col-span-1 md:col-span-5 flex items-center gap-3 min-w-0">
                    <div class="w-9 h-9 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center text-indigo-400 shrink-0">
                      <svg lucideUser class="w-4 h-4"></svg>
                    </div>
                    <div class="min-w-0">
                      <p class="font-bold text-white text-sm truncate" [title]="user.name">{{ user.name }}</p>
                      <p class="text-xs text-slate-400 truncate">&#64;{{ user.username }}</p>
                      <span 
                        [class.bg-emerald-500/10]="user.active"
                        [class.text-emerald-400]="user.active"
                        [class.border-emerald-500/20]="user.active"
                        [class.bg-slate-850]="!user.active"
                        [class.text-slate-500]="!user.active"
                        [class.border-slate-800]="!user.active"
                        class="inline-block mt-0.5 px-1.5 py-0.5 rounded border text-[10px] font-black uppercase tracking-wider"
                      >
                        {{ user.active ? 'Activo' : 'Inactivo' }}
                      </span>
                    </div>
                  </div>

                  <!-- Rol -->
                  <div class="col-span-1 md:col-span-3">
                    <span class="px-2 py-1 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[11px] font-bold uppercase tracking-wider">
                      {{ user.role?.name || 'Sin rol' }}
                    </span>
                  </div>

                  <!-- Sucursal -->
                  <div class="col-span-1 md:col-span-3 text-xs text-slate-300 font-semibold truncate" [title]="user.branch?.name || ''">
                    {{ user.branch?.name || 'Todas / General' }}
                  </div>

                  <!-- Acciones -->
                  <div class="col-span-1 md:col-span-1 flex items-center justify-end gap-1">
                    <button aria-label="Editar Empleado"
                      (click)="showEditModal(user)"
                      class="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                      title="Editar Empleado"
                    >
                      <svg lucideEdit class="w-4 h-4"></svg>
                    </button>
                    <button aria-label="Eliminar Empleado"
                      (click)="deleteEmployee(user)"
                      class="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-colors cursor-pointer"
                      title="Eliminar Empleado"
                    >
                      <svg lucideTrash2 class="w-4 h-4"></svg>
                    </button>
                  </div>

                </div>
              }
            </div>
          </div>
        }
      </div>
    </div>

    <!-- Create/Edit Employee Modal -->
    @if (isModalOpen()) {
      <div class="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 sm:p-6">
        <!-- Backdrop -->
        <div (click)="closeModal()" class="fixed inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity duration-300"></div>

        <!-- Dialog Box -->
        <form 
          [formGroup]="employeeForm" 
          (ngSubmit)="saveEmployee()" 
          class="w-full max-w-lg bg-slate-900 border border-slate-800 text-slate-100 rounded-2xl shadow-2xl relative overflow-hidden animate-scaleIn flex flex-col max-h-[85vh] sm:max-h-[90vh] my-auto z-10"
        >
          <!-- Modal Header -->
          <div class="h-16 flex items-center justify-between px-6 border-b border-slate-800/80 shrink-0 bg-slate-900 z-10">
            <h3 class="text-base font-bold text-white">
              {{ isEditMode() ? 'Editar Empleado' : 'Crear Empleado' }}
            </h3>
            <button aria-label="Cerrar"
              type="button"
              (click)="closeModal()"
              class="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <svg lucideX class="w-5 h-5"></svg>
            </button>
          </div>

          <!-- Modal Body -->
          <div class="flex-1 min-h-0 p-6 space-y-4 overflow-y-auto">
            <!-- Nombre Real -->
            <div>
              <label class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Nombre Real</label>
              <input aria-label="Nombre completo"
                type="text"
                placeholder="Ej. Juan Pérez"
                formControlName="name"
                class="w-full bg-slate-955 border border-slate-800 rounded-xl py-2.5 px-4 text-sm text-white placeholder-slate-600 outline-none focus:border-indigo-500 transition-colors"
                [class.border-rose-500]="isFieldInvalid('name')"
              />
              @if (isFieldInvalid('name')) {
                <p class="text-[11px] text-rose-400 mt-1">El nombre real es obligatorio.</p>
              }
            </div>

            <!-- Username -->
            <div>
              <label class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Usuario (Username)</label>
              <input aria-label="Usuario"
                type="text"
                placeholder="Ej. juanp"
                formControlName="username"
                class="w-full bg-slate-955 border border-slate-800 rounded-xl py-2.5 px-4 text-sm text-white placeholder-slate-600 outline-none focus:border-indigo-500 transition-colors"
                [class.border-rose-500]="isFieldInvalid('username')"
              />
              @if (isFieldInvalid('username')) {
                <p class="text-[11px] text-rose-400 mt-1">El nombre de usuario es obligatorio.</p>
              }
            </div>

            <!-- Número de WhatsApp -->
            <div>
              <label class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Número de WhatsApp <span class="text-slate-600 normal-case font-medium">(Opcional)</span></label>
              <div class="relative">
                <span class="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400 text-sm font-semibold pointer-events-none select-none">+</span>
                <input aria-label="WhatsApp"
                  type="tel"
                  placeholder="521234567890"
                  formControlName="phoneNumber"
                  class="w-full bg-slate-955 border border-slate-800 rounded-xl py-2.5 pl-8 pr-4 text-sm text-white placeholder-slate-600 outline-none focus:border-indigo-500 transition-colors"
                  [class.border-rose-500]="isFieldInvalid('phoneNumber')"
                />
              </div>
              @if (isFieldInvalid('phoneNumber')) {
                <p class="text-[11px] text-rose-400 mt-1">Formato inválido. Ingresa el número con código de país (ej. 521234567890).</p>
              }
            </div>

            <!-- Password -->
            <div>
              <label class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Contraseña {{ isEditMode() ? '(Opcional)' : '' }}
              </label>
              <input aria-label="Contraseña"
                type="password"
                placeholder="{{ isEditMode() ? 'Dejar en blanco para no modificar' : 'Mínimo 6 caracteres' }}"
                formControlName="password"
                class="w-full bg-slate-955 border border-slate-800 rounded-xl py-2.5 px-4 text-sm text-white placeholder-slate-600 outline-none focus:border-indigo-500 transition-colors"
                [class.border-rose-500]="isFieldInvalid('password')"
              />
              @if (isFieldInvalid('password')) {
                <p class="text-[11px] text-rose-400 mt-1">La contraseña debe tener al menos 6 caracteres.</p>
              }
            </div>

            <!-- Rol Select -->
            <div>
              <label class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Rol</label>
              <select aria-label="Rol"
                formControlName="roleId"
                class="w-full bg-slate-955 border border-slate-800 rounded-xl py-2.5 px-4 text-sm text-white outline-none focus:border-indigo-500 transition-colors cursor-pointer"
                [class.border-rose-500]="isFieldInvalid('roleId')"
              >
                <option value="" disabled selected class="bg-slate-950 text-slate-400">Selecciona un rol</option>
                @for (role of roles(); track role.id) {
                  <option [value]="role.id" class="bg-slate-950 text-white">{{ role.name }}</option>
                }
              </select>
              @if (isFieldInvalid('roleId')) {
                <p class="text-[11px] text-rose-400 mt-1">Debes asignar un rol al empleado.</p>
              }
            </div>

            <!-- Sucursal Select -->
            <div>
              <label class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Sucursal</label>
              <select aria-label="Sucursal"
                formControlName="branchId"
                (change)="onBranchSelectChange($event)"
                class="w-full bg-slate-955 border border-slate-800 rounded-xl py-2.5 px-4 text-sm text-white outline-none focus:border-indigo-500 transition-colors cursor-pointer"
              >
                <option value="" class="bg-slate-950 text-slate-400">Todas / Acceso General</option>
                @for (branch of branches(); track branch.id) {
                  <option [value]="branch.id" class="bg-slate-950 text-white">{{ branch.name }}</option>
                }
              </select>
            </div>

            <!-- Mesas Asignadas (Multi-select) -->
            <div>
              <div class="flex items-center justify-between mb-1.5">
                <label class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Mesas Asignadas
                </label>
                <span class="text-[11px] font-bold text-indigo-400">
                  {{ (employeeForm.get('assignedTableIds')?.value || []).length }} seleccionadas
                </span>
              </div>

              @if (availableBranchTables().length === 0) {
                <div class="p-3 rounded-xl bg-slate-955 border border-slate-800 text-xs text-slate-400 text-center">
                  {{ employeeForm.get('branchId')?.value ? 'No hay mesas disponibles en esta sucursal.' : 'Selecciona una sucursal para ver sus mesas.' }}
                </div>
              } @else {
                <div class="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-36 overflow-y-auto p-2 rounded-xl bg-slate-955 border border-slate-800">
                  @for (table of availableBranchTables(); track table.id) {
                    <button
                      type="button"
                      (click)="toggleTableSelection(table.id)"
                      [class.bg-indigo-600]="isTableAssigned(table.id)"
                      [class.border-indigo-500]="isTableAssigned(table.id)"
                      [class.text-white]="isTableAssigned(table.id)"
                      [class.bg-slate-900]="!isTableAssigned(table.id)"
                      [class.border-slate-800]="!isTableAssigned(table.id)"
                      [class.text-slate-400]="!isTableAssigned(table.id)"
                      class="px-2.5 py-2 rounded-lg border text-xs font-semibold flex items-center justify-between transition-all cursor-pointer hover:border-indigo-500/50"
                    >
                      <span>Mesa {{ table.tableNumber }}</span>
                      @if (isTableAssigned(table.id)) {
                        <span class="w-1.5 h-1.5 rounded-full bg-white"></span>
                      }
                    </button>
                  }
                </div>
              }
            </div>
          </div>

          <!-- Modal Footer -->
          <div class="p-6 border-t border-slate-800/80 bg-slate-900/40 shrink-0 flex items-center justify-end gap-3">
            <button
              type="button"
              (click)="closeModal()"
              class="px-4 py-2.5 hover:bg-slate-800 rounded-xl text-xs font-bold text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              [disabled]="isSaving() || employeeForm.invalid"
              class="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              @if (isSaving()) {
                <svg lucideLoader2 class="animate-spin w-3.5 h-3.5"></svg>
                <span>Guardando...</span>
              } @else {
                <span>{{ isEditMode() ? 'Actualizar' : 'Guardar' }}</span>
              }
            </button>
          </div>
        </form>
      </div>
    }
  `,
  styles: [`
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(4px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes scaleIn {
      from { opacity: 0; transform: scale(0.97); }
      to { opacity: 1; transform: scale(1); }
    }
    .animate-fadeIn {
      animation: fadeIn 0.2s ease-out forwards;
    }
    .animate-scaleIn {
      animation: scaleIn 0.2s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
    }
    /* Estilo de inputs oscuros */
    .bg-slate-955 {
      background-color: rgb(5, 8, 16);
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmployeesComponent implements OnInit {
  private readonly avisos = inject(AvisosService);
  private readonly http = inject(HttpClient);
  private readonly fb = inject(FormBuilder);
  readonly authService = inject(AuthService);

  // State Signals
  readonly users = signal<Employee[]>([]);
  readonly roles = signal<any[]>([]);
  readonly branches = signal<any[]>([]);
  readonly availableBranchTables = signal<any[]>([]);
  readonly isLoading = signal(true);
  readonly isSaving = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly isModalOpen = signal(false);
  readonly isEditMode = signal(false);

  // Form definition
  employeeForm!: FormGroup;

  ngOnInit(): void {
    this.initForm();
    this.loadUsers();
    this.loadRoles();
    this.loadBranches();
  }

  initForm(): void {
    this.employeeForm = this.fb.group({
      id: [null],
      name: ['', [Validators.required]],
      username: ['', [Validators.required]],
      phoneNumber: ['', [Validators.pattern(/^\+?[1-9]\d{6,14}$/)]],
      password: ['', []],
      roleId: ['', [Validators.required]],
      branchId: [''],
      assignedTableIds: [[]]
    });
  }

  isFieldInvalid(controlName: string): boolean {
    const control = this.employeeForm.get(controlName);
    return !!(control && control.invalid && (control.dirty || control.touched));
  }

  loadUsers(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.http.get<Employee[]>(`${environment.apiUrl}/admin/users`).subscribe({
      next: (data) => {
        this.users.set(data || []);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.isLoading.set(false);
        console.error('Error fetching users', err);
        this.errorMessage.set('Error al cargar la lista de empleados.');
      }
    });
  }

  loadRoles(): void {
    this.http.get<any[]>(`${environment.apiUrl}/admin/roles`).subscribe({
      next: (data) => {
        this.roles.set(data || []);
      },
      error: (err) => console.error('Error loading roles catalog', err)
    });
  }

  loadBranches(): void {
    if (this.authService.userRole() === 'SUPER_ADMIN') {
      this.http.get<Restaurant[]>(`${environment.apiUrl}/admin/restaurants`).subscribe({
        next: (data) => {
          const list: any[] = [];
          data.forEach(r => {
            if (r.branches) {
              r.branches.forEach(b => {
                list.push({ id: b.id, name: `${r.name} - ${b.name}` });
              });
            }
          });
          this.branches.set(list);
        },
        error: (err) => console.error('Error loading admin restaurants/branches', err)
      });
    } else {
      this.http.get<any[]>(`${environment.apiUrl}/branches`).subscribe({
        next: (data) => {
          this.branches.set(data || []);
        },
        error: (err) => console.error('Error loading branches', err)
      });
    }
  }

  loadTablesForBranch(branchId: string | null): void {
    if (!branchId) {
      this.http.get<any[]>(`${environment.apiUrl}/tables`).subscribe({
        next: (data) => this.availableBranchTables.set(data || []),
        error: () => this.availableBranchTables.set([])
      });
      return;
    }

    this.http.get<any[]>(`${environment.apiUrl}/tables?branchId=${branchId}`).subscribe({
      next: (data) => this.availableBranchTables.set(data || []),
      error: () => this.availableBranchTables.set([])
    });
  }

  onBranchSelectChange(event: Event): void {
    const val = (event.target as HTMLSelectElement).value;
    this.loadTablesForBranch(val || null);
  }

  toggleTableSelection(tableId: string | number): void {
    const current: string[] = this.employeeForm.get('assignedTableIds')?.value || [];
    const idStr = String(tableId);
    const exists = current.some(id => String(id) === idStr);
    const updated = exists ? current.filter(id => String(id) !== idStr) : [...current, idStr];
    this.employeeForm.patchValue({ assignedTableIds: updated });
  }

  isTableAssigned(tableId: string | number): boolean {
    const current: string[] = this.employeeForm.get('assignedTableIds')?.value || [];
    const idStr = String(tableId);
    return current.some(id => String(id) === idStr);
  }

  showCreateModal(): void {
    this.isEditMode.set(false);
    this.employeeForm.reset({
      id: null,
      name: '',
      username: '',
      phoneNumber: '',
      password: '',
      roleId: '',
      branchId: '',
      assignedTableIds: []
    });
    
    // Password required when creating
    this.employeeForm.get('password')?.setValidators([Validators.required, Validators.minLength(6)]);
    this.employeeForm.get('password')?.updateValueAndValidity();

    this.loadTablesForBranch(null);
    
    this.errorMessage.set(null);
    this.isModalOpen.set(true);
  }

  showEditModal(user: Employee): void {
    this.isEditMode.set(true);
    const tableIds = user.assignedTableIds || user.assigned_table_ids || (user.assignedTables || []).map(t => String(t.id || t));
    const selectedBranch = user.branch?.id || '';

    this.employeeForm.reset({
      id: user.id,
      name: user.name,
      username: user.username,
      phoneNumber: user.phoneNumber || '',
      password: '',
      roleId: user.role?.id || '',
      branchId: selectedBranch,
      assignedTableIds: tableIds.map(id => String(id))
    });
    
    // Password optional when editing, but min length if entered
    this.employeeForm.get('password')?.setValidators([Validators.minLength(6)]);
    this.employeeForm.get('password')?.updateValueAndValidity();

    this.loadTablesForBranch(selectedBranch || null);
    
    this.errorMessage.set(null);
    this.isModalOpen.set(true);
  }

  closeModal(): void {
    this.isModalOpen.set(false);
  }

  saveEmployee(): void {
    if (this.employeeForm.invalid) {
      this.employeeForm.markAllAsTouched();
      return;
    }

    this.isSaving.set(true);
    this.errorMessage.set(null);

    const formVal = this.employeeForm.value;
    const isEdit = this.isEditMode();

    const payload: any = {
      name: formVal.name.trim(),
      username: formVal.username.trim(),
      phoneNumber: formVal.phoneNumber?.trim() || null,
      roleId: formVal.roleId,
      branchId: formVal.branchId || null,
      assignedTableIds: formVal.assignedTableIds || []
    };

    // Password optional on update, required on create
    if (!isEdit) {
      payload.password = formVal.password;
    } else if (formVal.password && formVal.password.trim().length >= 6) {
      payload.password = formVal.password;
    }

    const request$ = isEdit
      ? this.http.put<Employee>(`${environment.apiUrl}/admin/users/${formVal.id}`, payload)
      : this.http.post<Employee>(`${environment.apiUrl}/admin/users`, payload);

    request$.subscribe({
      next: (savedUser) => {
        this.isSaving.set(false);
        this.isModalOpen.set(false);

        // Update the table locally without reloading the page
        const currentList = this.users();
        if (isEdit) {
          const index = currentList.findIndex(u => u.id === savedUser.id);
          if (index !== -1) {
            currentList[index] = savedUser;
            this.users.set([...currentList]);
          } else {
            this.loadUsers();
          }
        } else {
          this.users.set([...currentList, savedUser]);
        }
      },
      error: (err) => {
        this.isSaving.set(false);
        console.error('Error saving employee', err);
        this.errorMessage.set(err.error?.message || 'Ocurrió un error al guardar el empleado.');
      }
    });
  }

  async deleteEmployee(user: Employee): Promise<void> {
    const confirmDelete = (await this.avisos.confirmar({ titulo: `¿Eliminar a ${user.name}?`, mensaje: 'Ya no podrá entrar al panel.', confirmar: 'Eliminar empleado', peligro: true }));
    if (!confirmDelete) return;

    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.http.delete<void>(`${environment.apiUrl}/admin/users/${user.id}`).subscribe({
      next: () => {
        // Remove locally
        const updated = this.users().filter(u => u.id !== user.id);
        this.users.set(updated);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.isLoading.set(false);
        console.error('Error deleting employee', err);
        this.errorMessage.set(err.error?.message || 'No se pudo eliminar el empleado.');
      }
    });
  }
}
