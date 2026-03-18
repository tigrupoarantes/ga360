export const ACCOUNTING_CODE_TO_NAME: Record<string, string> = {
  "9": "CHOK AGRO",
  "3": "CHOK DISTRIBUIDORA",
  "4": "BROKER J. ARANTES",
  "5": "LOJAS CHOKDOCE",
  "8": "ESCRITORIO CENTRAL",
  "11": "G4 DISTRIBUIDORA",
};

/**
 * Resolve o label legível de um grupo de contabilização.
 * O rawGroup pode vir como código numérico ("9") ou como nome direto ("CHOK AGRO").
 */
export function resolveAccountingGroupLabel(rawGroup: string): string {
  const digits = rawGroup.trim().replace(/\D/g, '');
  if (digits && ACCOUNTING_CODE_TO_NAME[digits]) return ACCOUNTING_CODE_TO_NAME[digits];
  return rawGroup.trim() || 'Sem Grupo';
}
