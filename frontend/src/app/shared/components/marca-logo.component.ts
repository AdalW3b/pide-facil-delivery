import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { BrandLogoComponent } from './brand-logo.component';
import { MarcaService } from '../../core/services/marca.service';

/**
 * Logo y nombre del restaurante si personalizó su marca; si no, el de Pide Facil.
 * Sin logo propio se muestra la inicial del nombre sobre su color.
 */
@Component({
  selector: 'app-marca-logo',
  standalone: true,
  imports: [BrandLogoComponent],
  template: `
    @if (marca.marca(); as m) {
      @if (m.personalizada) {
        <span class="inline-flex items-center gap-2.5 min-w-0 select-none">
          @if (marca.urlLogo(m); as url) {
            <img [src]="url" alt="" [class]="lado() + ' shrink-0 rounded-xl object-contain'" />
          } @else {
            <span [class]="lado() + ' shrink-0 rounded-xl bg-indigo-600 text-white font-display font-extrabold inline-flex items-center justify-center'">
              {{ inicial() }}
            </span>
          }
          @if (showWordmark()) {
            <span [class]="'font-display font-extrabold tracking-tight truncate ' + texto() + (tono() === 'claro' ? ' text-stone-900' : ' text-white')">
              {{ m.nombre }}
            </span>
          }
        </span>
      } @else {
        <app-brand-logo [size]="size()" [showWordmark]="showWordmark()" [tono]="tono()" />
      }
    } @else {
      <app-brand-logo [size]="size()" [showWordmark]="showWordmark()" [tono]="tono()" />
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MarcaLogoComponent {
  readonly marca = inject(MarcaService);

  readonly size = input<'sm' | 'md' | 'lg'>('md');
  readonly showWordmark = input(true);
  readonly tono = input<'oscuro' | 'claro'>('oscuro');

  readonly lado = computed(() => ({ sm: 'w-8 h-8', md: 'w-9 h-9', lg: 'w-12 h-12' })[this.size()]);
  readonly texto = computed(() => ({ sm: 'text-base', md: 'text-lg', lg: 'text-2xl' })[this.size()]);
  readonly inicial = computed(() => (this.marca.marca()?.nombre ?? '').trim().charAt(0).toUpperCase() || '·');
}
