import type { KitchenItemStatus, KitchenTicketDTO, KitchenTicketItemDTO } from './kitchen.component';

/**
 * Cómo se lee una comanda en cocina. Lo usan el tablero, las tarjetas, la
 * ventana "Ver comanda" y el modo TV, para que todos digan lo mismo.
 */

/** En qué columna va la comanda. */
export type EstadoComanda = 'PENDIENTE' | 'PREPARANDO' | 'LISTA' | 'ENTREGADA';

/** A tiempo (< 10 min), por vencer (10–19) o tarde (20+). */
export type Semaforo = 'verde' | 'amarillo' | 'rojo';

/** Platillos que se pidieron juntos: una ronda de la mesa. */
export interface Ronda {
  numero: number;
  desde: number;
  items: KitchenTicketItemDTO[];
  /** Llegó cuando cocina ya había empezado lo anterior. */
  nueva: boolean;
}

/** Entre un platillo y otro, más de esto separa rondas. */
const ENTRE_RONDAS_MS = 2 * 60_000;

const enCocina = (i: KitchenTicketItemDTO) => i.kitchenStatus === 'PENDING' || i.kitchenStatus === 'PREPARING';

export function estadoDe(t: KitchenTicketDTO): EstadoComanda {
  const items = t.items;
  if (items.every((i) => i.kitchenStatus === 'DELIVERED')) return 'ENTREGADA';
  if (!items.some(enCocina)) return 'LISTA';
  if (items.every((i) => i.kitchenStatus === 'PENDING' || i.kitchenStatus === 'DELIVERED')) return 'PENDIENTE';
  return 'PREPARANDO';
}

/** Un platillo recién agregado puede venir sin hora: cuenta como de ahora. */
export function horaDe(i: KitchenTicketItemDTO, ahora: number): number {
  return i.createdAt ? new Date(i.createdAt).getTime() : ahora;
}

/** Lo que lleva esperando lo más viejo que sigue en cocina. 0 si ya no hay nada. */
export function minutosDe(t: KitchenTicketDTO, ahora: number): number {
  const desde = Math.min(...t.items.filter(enCocina).map((i) => horaDe(i, ahora)));
  return Number.isFinite(desde) ? Math.max(0, Math.floor((ahora - desde) / 60_000)) : 0;
}

export function semaforoDe(minutos: number): Semaforo {
  if (minutos >= 20) return 'rojo';
  if (minutos >= 10) return 'amarillo';
  return 'verde';
}

export function etiquetaDe(t: KitchenTicketDTO): string {
  return t.etiqueta || (t.tableNumber != null ? `Mesa ${t.tableNumber}` : 'Pedido');
}

/** Mesa, domicilio, mostrador (kiosko o para recoger con turno) o para llevar. */
export function tipoDe(t: KitchenTicketDTO): 'SALON' | 'DOMICILIO' | 'MOSTRADOR' | 'LLEVAR' {
  if (t.orderType === 'DOMICILIO') return 'DOMICILIO';
  if (t.etiqueta?.startsWith('Turno')) return 'MOSTRADOR';
  if (t.orderType && t.orderType !== 'SALON') return 'LLEVAR';
  return 'SALON';
}

/** Lo que la tarjeta muestra: lo entregado ya no estorba. */
export function porHacer(t: KitchenTicketDTO): KitchenTicketItemDTO[] {
  return t.items.filter((i) => i.kitchenStatus !== 'DELIVERED');
}

export function piezasDe(items: KitchenTicketItemDTO[]): number {
  return items.reduce((n, i) => n + (i.quantity ?? 0), 0);
}

/** Los platillos agrupados por cuándo se pidieron. */
export function rondasDe(t: KitchenTicketDTO, ahora: number): Ronda[] {
  const items = [...porHacer(t)].sort((a, b) => horaDe(a, ahora) - horaDe(b, ahora));
  const rondas: Ronda[] = [];
  for (const item of items) {
    const hora = horaDe(item, ahora);
    const ultima = rondas[rondas.length - 1];
    if (ultima && hora - ultima.desde <= ENTRE_RONDAS_MS) ultima.items.push(item);
    else rondas.push({ numero: rondas.length + 1, desde: hora, items: [item], nueva: false });
  }
  if (rondas.length > 1) {
    const ultima = rondas[rondas.length - 1];
    const antes = rondas.slice(0, -1).flatMap((r) => r.items);
    ultima.nueva = ultima.items.some((i) => i.kitchenStatus === 'PENDING') && antes.some((i) => i.kitchenStatus !== 'PENDING');
  }
  return rondas;
}

export function nombreEstado(s: KitchenItemStatus): string {
  return { PENDING: 'Pendiente', PREPARING: 'Preparando', READY: 'Listo', DELIVERED: 'Entregado' }[s];
}

/** Los colores del tiempo, iguales en tablero, tarjetas, ventana y TV. */
export const COLOR_TIEMPO: Record<Semaforo, string> = {
  verde: 'bg-emerald-500/15 text-emerald-300',
  amarillo: 'bg-amber-500/20 text-amber-300',
  rojo: 'bg-rose-500/20 text-rose-300',
};
export const COLOR_BARRA: Record<Semaforo, string> = {
  verde: 'bg-emerald-400',
  amarillo: 'bg-amber-400',
  rojo: 'bg-rose-500',
};
export const COLOR_BORDE: Record<Semaforo, string> = {
  verde: 'border-slate-700',
  amarillo: 'border-amber-500/60',
  rojo: 'border-rose-500/70',
};
