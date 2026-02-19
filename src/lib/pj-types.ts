// ============================================================
// Tipos do módulo Controle PJ
// ============================================================

export interface PJContract {
  id: string;
  company_id: string;
  name: string;
  document: string;
  email: string;
  manager_user_id: string | null;
  cost_center_id: string | null;
  monthly_value: number;
  payment_day: number | null;
  status: 'active' | 'suspended' | 'ended';
  // Folgas
  vacation_enabled: boolean;
  vacation_entitlement_days: number;
  // 13º
  thirteenth_enabled: boolean;
  thirteenth_payment_month: number;
  // 14º
  fourteenth_enabled: boolean;
  fourteenth_mode: string | null;
  // Saúde
  health_enabled: boolean;
  health_dependent_unit_value: number;
  health_dependents_count: number;
  // Meta
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Joins
  company?: { id: string; name: string } | null;
  manager?: { id: string; first_name: string | null; last_name: string | null; avatar_url: string | null } | null;
  cost_center?: { id: string; name: string } | null;
}

export interface PJVacationEvent {
  id: string;
  contract_id: string;
  start_date: string;
  end_date: string;
  days: number;
  note: string | null;
  created_by: string | null;
  created_at: string;
}

export interface PJVacationBalance {
  contract_id: string;
  year: number;
  entitlement_days: number;
  used_days: number;
  remaining_days: number;
  updated_at: string;
}

export interface PJOtherItem {
  description: string;
  value: number;
  type: 'earning' | 'discount';
}

export interface PJClosing {
  id: string;
  contract_id: string;
  competence: string;
  base_value: number;
  restaurant_discount_value: number;
  health_dependents_discount_value: number;
  health_coparticipation_discount_value: number;
  other_items: PJOtherItem[];
  thirteenth_paid_value: number;
  fourteenth_paid_value: number;
  total_value: number;
  status: 'draft' | 'closed' | 'paid';
  paid_at: string | null;
  receipt_url: string | null;
  payslip_pdf_url: string | null;
  payslip_generated_at: string | null;
  email_status: 'pending' | 'queued' | 'sent' | 'failed';
  email_sent_at: string | null;
  email_error: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Joins
  contract?: PJContract | null;
}

export interface PJEmailLog {
  id: string;
  closing_id: string;
  to_email: string;
  subject: string;
  status: 'queued' | 'sent' | 'failed';
  provider_message_id: string | null;
  error: string | null;
  created_at: string;
}

// ============================================================
// Tipos auxiliares para formulários
// ============================================================

export interface PJContractFormData {
  company_id: string;
  name: string;
  document: string;
  email: string;
  manager_user_id: string | null;
  cost_center_id: string | null;
  monthly_value: number;
  payment_day: number | null;
  status: 'active' | 'suspended' | 'ended';
  vacation_enabled: boolean;
  vacation_entitlement_days: number;
  thirteenth_enabled: boolean;
  thirteenth_payment_month: number;
  fourteenth_enabled: boolean;
  fourteenth_mode: string | null;
  health_enabled: boolean;
  health_dependent_unit_value: number;
  health_dependents_count: number;
  notes: string | null;
}

export interface PJClosingFormData {
  contract_id: string;
  competence: string;
  base_value: number;
  restaurant_discount_value: number;
  health_coparticipation_discount_value: number;
  other_items: PJOtherItem[];
  thirteenth_paid_value: number;
  fourteenth_paid_value: number;
}

export interface PJVacationFormData {
  contract_id: string;
  start_date: string;
  end_date: string;
  days: number;
  note: string | null;
}

// ============================================================
// Constantes
// ============================================================

export const PJ_STATUS_LABELS: Record<string, string> = {
  active: 'Ativo',
  suspended: 'Suspenso',
  ended: 'Encerrado',
};

export const PJ_STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  suspended: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  ended: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

export const CLOSING_STATUS_LABELS: Record<string, string> = {
  draft: 'Rascunho',
  closed: 'Fechado',
  paid: 'Pago',
};

export const CLOSING_STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
  closed: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  paid: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
};

export const EMAIL_STATUS_LABELS: Record<string, string> = {
  pending: 'Pendente',
  queued: 'Na fila',
  sent: 'Enviado',
  failed: 'Falhou',
};

export const EMAIL_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
  queued: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  sent: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  failed: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};
