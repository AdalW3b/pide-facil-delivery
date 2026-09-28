export interface PaymentMethod {
  id: string | number;
  name: string;
  active: boolean;
  branchId?: string;
  instructions?: string;
}

