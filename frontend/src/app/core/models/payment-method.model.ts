export interface PaymentMethod {
  id: string | number;
  name: string;
  active: boolean;
  branchId?: string;
  instructions?: string;
  /** Entra al cajón y se cuenta en el arqueo. */
  esEfectivo?: boolean;
}

