/** Espejo de los DTO de reparto del backend. */

export type DeliveryStatus =
  | 'NUEVO'
  | 'CONFIRMADO'
  | 'LISTO'
  | 'EN_CAMINO'
  | 'ENTREGADO'
  | 'CANCELADO';

export type OrderType = 'SALON' | 'DOMICILIO' | 'PARA_LLEVAR';

export type KitchenStatus = 'PENDING' | 'PREPARING' | 'READY' | 'DELIVERED' | 'CANCELLED';

export interface DeliveryItem {
  itemId: string;
  productName: string;
  quantity: number;
  specialInstructions: string | null;
  kitchenStatus: KitchenStatus;
  /** "Tortilla: Harina", "Extras: Carne extra, Queso". Vacía si no lleva. */
  adicionales?: string[];
}

export interface DeliveryOrder {
  orderId: string;
  tokenSeguimiento: string;
  orderType: OrderType;
  deliveryStatus: DeliveryStatus;
  /** El estado menos avanzado de la cocina: si algo falta, aquí se ve. */
  kitchenStatus: KitchenStatus | null;
  creadoEn: string;
  minutosEstimados: number | null;

  clienteNombre: string | null;
  clienteTelefono: string | null;

  direccion: string | null;
  referencias: string | null;
  notas: string | null;
  latitud: number | null;
  longitud: number | null;
  distanciaKm: number | null;

  subtotal: number;
  envioTotal: number | null;
  envioAbsorbido: number | null;
  envioCobrado: number;
  propina: number;
  total: number;
  pagaCon: number | null;
  cambio: number | null;

  items: DeliveryItem[];

  /** Quién lleva el pedido. Null mientras nadie lo toma del grupo. */
  repartidorNombre: string | null;
  repartidorTelefono: string | null;
  pagoRepartidor: number | null;

  recogidoEn: string | null;
  entregadoEn: string | null;
  /** Por dónde entró: WEB, TELEFONO, WHATSAPP. Null en pedidos viejos. */
  origen?: string | null;
}

export interface CambiarEstadoEntrega {
  estado: DeliveryStatus;
  motivo?: string;
}

/** Resumen de un repartidor en un periodo: la base para pagarle. */
export interface ReporteRepartidor {
  driverId: string;
  nombre: string;
  telefono: string;
  vehiculo: string | null;
  activo: boolean;
  entregas: number;
  kmTotales: number;
  /** Lo que el negocio le debe. */
  aPagar: number;
  /** Dinero que recibió de clientes y debe entregar en caja. */
  cobrado: number;
  ultimaEntrega: string | null;
}
