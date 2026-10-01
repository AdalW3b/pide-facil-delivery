import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BrandLogoComponent } from '../../../shared/components/brand-logo.component';

interface FooterColumn {
  readonly title: string;
  readonly links: readonly { label: string; href: string }[];
}

/**
 * Pie de página. Solo lleva ligas que existen: términos, privacidad y
 * contacto se agregan cuando haya páginas o números reales.
 */
@Component({
  selector: 'app-landing-footer',
  standalone: true,
  imports: [RouterLink, BrandLogoComponent],
  template: `
    <footer class="bg-(--tinta) text-(--papel)">
      <div class="mx-auto max-w-6xl px-5 sm:px-8">
        <div class="grid gap-10 py-14 lg:grid-cols-12">
          <div class="lg:col-span-5">
            <a routerLink="/" aria-label="Pide Facil · Inicio">
              <app-brand-logo />
            </a>
            <p class="mt-5 max-w-sm text-sm leading-relaxed text-(--papel)/65">
              Pedidos por WhatsApp, menú en línea, cocina, reparto, inventario y reportes para restaurantes.
            </p>
          </div>
          <div class="grid gap-8 sm:grid-cols-2 lg:col-span-6 lg:col-start-7">
            @for (column of columns; track column.title) {
              <div>
                <h3 class="lp-mono text-[11px] uppercase tracking-[0.18em] text-(--maiz)">{{ column.title }}</h3>
                <ul class="mt-4 space-y-3">
                  @for (link of column.links; track link.label) {
                    <li><a [href]="link.href" class="text-sm text-(--papel)/70 transition-colors hover:text-(--papel)">{{ link.label }}</a></li>
                  }
                </ul>
              </div>
            }
          </div>
        </div>
        <div class="flex flex-col items-start justify-between gap-3 border-t border-white/10 py-6 sm:flex-row sm:items-center">
          <p class="text-xs text-(--papel)/50">© {{ year }} Pide Facil</p>
          <div class="flex items-center gap-6 text-xs">
            <a routerLink="/login" class="text-(--papel)/60 transition-colors hover:text-(--papel)">Entrar al panel</a>
            <a routerLink="/register" class="text-(--papel)/60 transition-colors hover:text-(--papel)">Crear cuenta</a>
          </div>
        </div>
      </div>
    </footer>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LandingFooterComponent {
  readonly year = new Date().getFullYear();

  readonly columns: readonly FooterColumn[] = [
    {
      title: 'Producto',
      links: [
        { label: 'Funciones', href: '#funciones' },
        { label: 'El sistema', href: '#modulos' },
        { label: 'Precios', href: '#precios' },
      ],
    },
    {
      title: 'Ayuda',
      links: [
        { label: 'Cómo empiezo', href: '#como-funciona' },
        { label: 'Preguntas frecuentes', href: '#faq' },
      ],
    },
  ];
}
