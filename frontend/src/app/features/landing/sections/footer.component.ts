import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BrandLogoComponent } from '../../../shared/components/brand-logo.component';

interface FooterColumn {
  readonly title: string;
  readonly links: readonly { label: string; href: string }[];
}

@Component({
  selector: 'app-landing-footer',
  standalone: true,
  imports: [RouterLink, BrandLogoComponent],
  template: `
    <footer class="border-t border-slate-800 bg-slate-950">
      <div class="mx-auto max-w-6xl px-5 sm:px-8">
        <div class="grid gap-10 py-16 lg:grid-cols-12 lg:gap-10">
          <div class="lg:col-span-4">
            <a routerLink="/" aria-label="Pide Facil · Inicio">
              <app-brand-logo />
            </a>
            <p class="mt-5 max-w-xs text-sm leading-relaxed text-slate-500">
              El sistema de gestión para restaurantes que toma pedidos por WhatsApp, ordena la cocina y te muestra
              cuánto vendiste sin esperar al cierre.
            </p>
          </div>

          <div class="grid gap-8 sm:grid-cols-3 lg:col-span-7 lg:col-start-6 lg:gap-10">
            @for (column of columns; track column.title) {
              <div class="border-t border-slate-800 pt-5">
                <h3 class="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{{ column.title }}</h3>
                <ul class="mt-4 space-y-3">
                  @for (link of column.links; track link.label) {
                    <li>
                      <a [href]="link.href" class="text-sm text-slate-500 transition-colors hover:text-white">
                        {{ link.label }}
                      </a>
                    </li>
                  }
                </ul>
              </div>
            }
          </div>
        </div>

        <div
          class="flex flex-col items-start justify-between gap-3 border-t border-slate-800 py-7 sm:flex-row sm:items-center"
        >
          <p class="text-xs text-slate-600">© {{ year }} Pide Facil. Todos los derechos reservados.</p>
          <div class="flex items-center gap-6 text-xs text-slate-600">
            <a href="#" class="transition-colors hover:text-slate-300">Términos</a>
            <a href="#" class="transition-colors hover:text-slate-300">Privacidad</a>
            <a routerLink="/login" class="transition-colors hover:text-slate-300">Acceso al panel</a>
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
        { label: 'Módulos', href: '#modulos' },
        { label: 'Precios', href: '#precios' },
        { label: 'Cómo funciona', href: '#como-funciona' },
      ],
    },
    {
      title: 'Recursos',
      links: [
        { label: 'Preguntas frecuentes', href: '#faq' },
        { label: 'Guía de puesta en marcha', href: '#como-funciona' },
        { label: 'Estado del servicio', href: '#' },
      ],
    },
    {
      title: 'Contacto',
      links: [
        { label: 'Escríbenos por WhatsApp', href: '#' },
        { label: 'Soporte', href: '#' },
        { label: 'Ventas', href: '#precios' },
      ],
    },
  ];
}
