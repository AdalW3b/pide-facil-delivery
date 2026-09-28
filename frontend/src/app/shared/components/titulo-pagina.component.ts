import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Título y descripción de cada pantalla del panel. Todas las pantallas lo usan
 * para que el encabezado se vea y se lea igual en todo el sistema; los botones
 * de cada pantalla van al lado, fuera de este componente.
 */
@Component({
  selector: 'app-titulo-pagina',
  standalone: true,
  template: `
    <h1 class="text-2xl md:text-3xl font-extrabold text-white tracking-tight [text-wrap:balance]">{{ titulo() }}</h1>
    @if (descripcion()) {
      <p class="text-sm text-slate-400 mt-1 max-w-2xl">{{ descripcion() }}</p>
    }
  `,
  host: { class: 'block min-w-0' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TituloPaginaComponent {
  readonly titulo = input.required<string>();
  readonly descripcion = input<string>('');
}
