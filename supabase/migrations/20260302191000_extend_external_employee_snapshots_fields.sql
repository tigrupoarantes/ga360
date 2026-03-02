ALTER TABLE public.external_employee_snapshots
  ADD COLUMN IF NOT EXISTS accounting_group TEXT,
  ADD COLUMN IF NOT EXISTS contract_company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS accounting_company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_external_employee_snapshots_accounting_group
  ON public.external_employee_snapshots(company_id, accounting_group);

CREATE INDEX IF NOT EXISTS idx_external_employee_snapshots_contract_company_id
  ON public.external_employee_snapshots(contract_company_id);

CREATE INDEX IF NOT EXISTS idx_external_employee_snapshots_accounting_company_id
  ON public.external_employee_snapshots(accounting_company_id);
