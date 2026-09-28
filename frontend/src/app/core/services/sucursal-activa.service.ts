import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';
import { Restaurant } from '../../features/admin-core/models/admin.model';
import { sucursalInicial } from '../../shared/utils/sucursal-inicial';

const CLAVE = 'pidefacil.sucursalActiva';

/**
 * La sucursal con la que se está trabajando en el panel. Es una sola para
 * todas las pantallas: se elige en la barra superior y Mesas, Cocina,
 * Domicilio, Catálogo, etc. la leen de aquí. Así no puede pasar que se edite
 * el menú de una sucursal mientras la barra dice otra.
 *
 * Solo el dueño (SUPER_ADMIN) y el operador (SYSTEM_ADMIN) pueden cambiarla;
 * el resto del personal trabaja siempre en la sucursal de su cuenta.
 */
@Injectable({ providedIn: 'root' })
export class SucursalActivaService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  readonly restaurantes = signal<Restaurant[]>([]);
  readonly restaurantId = signal<string>('');
  readonly branchId = signal<string>('');
  readonly cargando = signal(false);

  readonly puedeElegir = computed(() => {
    const rol = this.auth.userRole();
    return rol === 'SUPER_ADMIN' || rol === 'SYSTEM_ADMIN';
  });

  readonly sucursales = computed(() =>
    this.restaurantes().find((r) => r.id === this.restaurantId())?.branches ?? [],
  );

  readonly restaurante = computed(() => this.restaurantes().find((r) => r.id === this.restaurantId()) ?? null);
  readonly sucursal = computed(() => this.sucursales().find((b) => b.id === this.branchId()) ?? null);

  /** Hay más de una sucursal para elegir: vale la pena mostrar el selector. */
  readonly hayVarias = computed(() => this.restaurantes().reduce((n, r) => n + (r.branches?.length ?? 0), 0) > 1);

  constructor() {
    // Al entrar, al cambiar de cuenta o al salir, se vuelve a armar.
    effect(() => {
      const token = this.auth.token();
      const puede = this.puedeElegir();
      untracked(() => {
        if (!token) {
          this.restaurantes.set([]);
          this.restaurantId.set('');
          this.branchId.set('');
          return;
        }
        if (puede) {
          this.cargar();
        } else {
          this.restaurantes.set([]);
          this.restaurantId.set('');
          this.branchId.set(this.auth.userBranchId() ?? '');
        }
      });
    });
  }

  /** Vuelve a pedir la lista (p. ej. después de crear una sucursal). */
  cargar(): void {
    this.cargando.set(true);
    this.http.get<Restaurant[]>(`${environment.apiUrl}/admin/restaurants`).subscribe({
      next: (data) => {
        const lista = [...(data ?? [])]
          .map((r) => ({ ...r, branches: [...(r.branches ?? [])].sort((a, b) => a.name.localeCompare(b.name)) }))
          .sort((a, b) => a.name.localeCompare(b.name));
        this.restaurantes.set(lista);
        this.cargando.set(false);

        // Se respeta la elegida antes (en esta visita o en la anterior) si sigue existiendo.
        const guardada = this.branchId() || this.leerGuardada();
        const conGuardada = guardada ? lista.find((r) => r.branches.some((b) => b.id === guardada)) : undefined;
        if (conGuardada && guardada) {
          this.fijar(conGuardada.id, guardada);
          return;
        }
        const inicial = sucursalInicial(lista, this.auth.userBranchId());
        if (inicial) this.fijar(inicial.restaurantId, inicial.branchId);
      },
      error: () => {
        this.cargando.set(false);
        // Sin lista, al menos la sucursal de la cuenta.
        if (!this.branchId()) this.branchId.set(this.auth.userBranchId() ?? '');
      },
    });
  }

  /** Cambia de restaurante: queda elegida su primera sucursal. */
  elegirRestaurante(restaurantId: string): void {
    const r = this.restaurantes().find((x) => x.id === restaurantId);
    this.fijar(restaurantId, r?.branches?.[0]?.id ?? '');
  }

  elegirSucursal(branchId: string): void {
    const r = this.restaurantes().find((x) => x.branches.some((b) => b.id === branchId));
    this.fijar(r?.id ?? this.restaurantId(), branchId);
  }

  private fijar(restaurantId: string, branchId: string): void {
    this.restaurantId.set(restaurantId);
    this.branchId.set(branchId);
    try {
      if (branchId) localStorage.setItem(CLAVE, branchId);
    } catch {
      /* sin almacenamiento: solo dura esta visita */
    }
  }

  private leerGuardada(): string | null {
    try {
      return localStorage.getItem(CLAVE);
    } catch {
      return null;
    }
  }
}
