import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Isotipo + logotipo de Pide Facil.
 * Se reutiliza en la landing, el shell de autenticación y el pie de página.
 */
@Component({
  selector: 'app-brand-logo',
  standalone: true,
  template: `
    <span class="inline-flex items-center gap-2.5 select-none">
      <span
        class="relative inline-flex items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/25"
        [class]="markSize()"
      >
        <!-- Isotipo: gorro de chef con señal de mensaje -->
        <svg [attr.width]="glyphSize()" [attr.height]="glyphSize()" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <g fill="white">
            <circle cx="8.6" cy="9.2" r="3.5" />
            <circle cx="15.4" cy="9.2" r="3.5" />
            <circle cx="12" cy="7.8" r="4.1" />
            <rect x="7.2" y="12.2" width="9.6" height="5.4" rx="1.4" />
          </g>
          <!-- Punto de mensaje: el pedido que entra por WhatsApp -->
          <circle cx="18.6" cy="17.2" r="2.7" fill="#34d399" stroke="white" stroke-width="1.3" />
        </svg>
      </span>

      @if (showWordmark()) {
        <span class="font-display font-extrabold tracking-tight text-white" [class]="textSize()">
          Pide <span class="text-indigo-400">Facil</span>
        </span>
      }
    </span>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BrandLogoComponent {
  /** `sm` para barras compactas, `md` por defecto, `lg` para cabeceras de página. */
  readonly size = input<'sm' | 'md' | 'lg'>('md');
  readonly showWordmark = input(true);

  markSize(): string {
    return { sm: 'w-8 h-8', md: 'w-9 h-9', lg: 'w-12 h-12' }[this.size()];
  }

  glyphSize(): number {
    return { sm: 18, md: 20, lg: 26 }[this.size()];
  }

  textSize(): string {
    return { sm: 'text-base', md: 'text-lg', lg: 'text-2xl' }[this.size()];
  }
}
