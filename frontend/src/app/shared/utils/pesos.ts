import { Pipe, PipeTransform } from '@angular/core';

const FORMATO = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  currencyDisplay: 'narrowSymbol',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** $42,874.00: el mismo formato de dinero en todo el sistema. */
export function formatearPesos(valor: number | null | undefined): string {
  return FORMATO.format(Number(valor) || 0);
}

/** En plantillas: {{ total | pesos }} → $42,874.00 */
@Pipe({ name: 'pesos', standalone: true })
export class PesosPipe implements PipeTransform {
  transform(valor: number | null | undefined): string {
    return formatearPesos(valor);
  }
}
