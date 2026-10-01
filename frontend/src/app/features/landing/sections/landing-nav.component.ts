import { ChangeDetectionStrategy, Component, HostListener, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideMenu, LucideX, LucideArrowRight, LucideLayoutDashboard } from '@lucide/angular';
import { AuthService } from '../../../core/services/auth.service';
import { BrandLogoComponent } from '../../../shared/components/brand-logo.component';

interface NavLink {
  readonly label: string;
  readonly fragment: string;
}

@Component({
  selector: 'app-landing-nav',
  standalone: true,
  imports: [RouterLink, BrandLogoComponent, LucideMenu, LucideX, LucideArrowRight, LucideLayoutDashboard],
  template: `
    <header
      class="fixed top-0 inset-x-0 z-50 border-b transition-colors duration-300"
      [class]="
        scrolled()
          ? 'border-(--linea) bg-(--papel)/92 backdrop-blur-md'
          : 'border-transparent bg-transparent'
      "
    >
      <nav class="mx-auto max-w-6xl px-5 sm:px-8" aria-label="Navegación principal">
        <div
          class="flex h-16 items-center justify-between gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]"
        >
          <a routerLink="/" class="shrink-0 lg:justify-self-start" aria-label="Pide Facil · Inicio">
            <app-brand-logo size="sm" tono="claro" />
          </a>

          <!-- Enlaces de escritorio -->
          <ul class="hidden lg:flex items-center gap-7 lg:justify-self-center">
            @for (link of links; track link.fragment) {
              <li>
                <a
                  [href]="'#' + link.fragment"
                  class="relative text-sm font-medium text-(--tinta-2) transition-colors hover:text-(--tinta) after:absolute after:-bottom-1.5 after:left-0 after:h-0.5 after:w-0 after:bg-(--chile) after:transition-[width] after:duration-300 hover:after:w-full"
                >
                  {{ link.label }}
                </a>
              </li>
            }
          </ul>

          <!-- Acciones -->
          <div class="hidden lg:flex items-center gap-5 lg:justify-self-end">
            @if (isAuthenticated()) {
              <a
                [routerLink]="panelRoute()"
                class="inline-flex items-center gap-2 rounded-full bg-(--chile) px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-(--chile-osc)"
              >
                <svg lucideLayoutDashboard class="w-4 h-4"></svg>
                Ir al panel
              </a>
            } @else {
              <a
                routerLink="/login"
                class="text-sm font-medium text-(--tinta-2) transition-colors hover:text-(--tinta) whitespace-nowrap"
              >
                Iniciar sesión
              </a>
              <a
                routerLink="/register"
                class="group inline-flex items-center gap-2 whitespace-nowrap rounded-full bg-(--chile) px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-(--chile-osc)"
              >
                Probar gratis
                <svg lucideArrowRight class="w-4 h-4 transition-transform group-hover:translate-x-0.5"></svg>
              </a>
            }
          </div>

          <!-- Botón menú móvil -->
          <button
            type="button"
            class="lg:hidden -mr-1 inline-flex h-10 w-10 items-center justify-center rounded-lg text-(--tinta) transition-colors hover:bg-(--papel-2)"
            (click)="toggleMenu()"
            [attr.aria-expanded]="menuOpen()"
            aria-controls="landing-mobile-menu"
            [attr.aria-label]="menuOpen() ? 'Cerrar menú' : 'Abrir menú'"
          >
            @if (menuOpen()) {
              <svg lucideX class="w-5 h-5"></svg>
            } @else {
              <svg lucideMenu class="w-5 h-5"></svg>
            }
          </button>
        </div>
      </nav>

      <!-- Menú móvil -->
      @if (menuOpen()) {
        <div
          id="landing-mobile-menu"
          class="animate-fade-in lg:hidden border-t border-(--linea) bg-(--papel)"
        >
          <ul class="mx-auto max-w-6xl divide-y divide-(--linea) px-5 sm:px-8">
            @for (link of links; track link.fragment) {
              <li>
                <a
                  [href]="'#' + link.fragment"
                  (click)="closeMenu()"
                  class="block py-4 text-[15px] font-medium text-(--tinta) transition-colors hover:text-(--chile)"
                >
                  {{ link.label }}
                </a>
              </li>
            }
          </ul>
          <div class="mx-auto flex max-w-6xl flex-col gap-3 border-t border-(--linea) px-5 py-6 sm:px-8">
            @if (isAuthenticated()) {
              <a
                [routerLink]="panelRoute()"
                (click)="closeMenu()"
                class="rounded-full bg-(--chile) px-4 py-3 text-center text-sm font-semibold text-white"
              >
                Ir al panel
              </a>
            } @else {
              <a
                routerLink="/register"
                (click)="closeMenu()"
                class="rounded-full bg-(--chile) px-4 py-3 text-center text-sm font-semibold text-white"
              >
                Prueba 14 días gratis
              </a>
              <a
                routerLink="/login"
                (click)="closeMenu()"
                class="rounded-full border border-(--tinta)/25 px-4 py-3 text-center text-sm font-semibold text-(--tinta) transition-colors hover:border-(--tinta)"
              >
                Iniciar sesión
              </a>
            }
          </div>
        </div>
      }
    </header>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LandingNavComponent {
  private readonly auth = inject(AuthService);

  readonly links: readonly NavLink[] = [
    { label: 'Calcula tu ahorro', fragment: 'ahorro' },
    { label: 'Funciones', fragment: 'funciones' },
    { label: 'El sistema', fragment: 'modulos' },
    { label: 'Precios', fragment: 'precios' },
    { label: 'Preguntas', fragment: 'faq' },
  ];

  readonly menuOpen = signal(false);
  readonly scrolled = signal(false);

  readonly isAuthenticated = computed(() => this.auth.isAuthenticated());
  readonly panelRoute = computed(() => this.auth.defaultRoute());

  @HostListener('window:scroll')
  onScroll(): void {
    this.scrolled.set(window.scrollY > 12);
  }

  toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  closeMenu(): void {
    this.menuOpen.set(false);
  }
}
