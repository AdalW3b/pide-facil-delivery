export enum TableStatus {
  AVAILABLE = 'AVAILABLE',
  OCCUPIED = 'OCCUPIED',
}

/** Cómo va la cocina del pedido de la mesa. Null si no hay platillos vivos. */
export type TableKitchenStatus = 'PENDING' | 'PREPARING' | 'READY' | 'DELIVERED';

export interface WaiterSummary {
  id: string;
  name: string;
}

export interface Table {
  id: string;
  branchId: string;
  tableNumber: number;
  status: TableStatus;
  activeOrderId?: string | null;
  totalAmount?: number | null;
  items?: any[] | null;
  qrToken: string;
  assignedUserIds?: (string | number)[] | null;
  assigned_user_ids?: (string | number)[] | null;
  assignedWaiters?: WaiterSummary[];
  kitchenStatus?: TableKitchenStatus | null;
  /** Desde cuándo está abierta la cuenta (hora local del servidor). */
  abiertaDesde?: string | null;
}
