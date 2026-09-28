export interface Restaurant {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
  branches: Branch[];
}

export interface Branch {
  id: string;
  restaurantId: string;
  restaurantName: string;
  name: string;
  address: string | null;
  whatsappNumber: string | null;
  n8nWebhookUrl: string | null;
  active: boolean;
  createdAt: string;
}

export interface CreatedUser {
  id: string;
  username: string;
  role: string;
  restaurantId: string;
  branchId: string | null;
  active: boolean;
  createdAt: string;
}

// ─── Wizard Step Data ─────────────────────────────────────────────────────────

export interface WizardStep1Data {
  restaurantName: string;
}

export interface WizardStep2Data {
  branchName: string;
  branchAddress: string;
  whatsappNumber: string;
}

export interface WizardStep3Data {
  username: string;
  password: string;
  confirmPassword: string;
}
