ALTER TABLE public.payroll_verba_events
  ADD COLUMN IF NOT EXISTS employee_department TEXT,
  ADD COLUMN IF NOT EXISTS employee_position TEXT,
  ADD COLUMN IF NOT EXISTS employee_unidade TEXT,
  ADD COLUMN IF NOT EXISTS employee_accounting_group TEXT,
  ADD COLUMN IF NOT EXISTS employee_contract_company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS employee_accounting_company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS employee_snapshot_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_payroll_verba_events_company_group_ano_mes
  ON public.payroll_verba_events(company_id, employee_accounting_group, ano, mes);

CREATE INDEX IF NOT EXISTS idx_payroll_verba_events_company_department_ano_mes
  ON public.payroll_verba_events(company_id, employee_department, ano, mes);
