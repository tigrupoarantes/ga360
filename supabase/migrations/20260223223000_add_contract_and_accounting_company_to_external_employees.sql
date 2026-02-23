ALTER TABLE public.external_employees
  ADD COLUMN IF NOT EXISTS contract_company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS accounting_company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_external_employees_contract_company_id
  ON public.external_employees(contract_company_id);

CREATE INDEX IF NOT EXISTS idx_external_employees_accounting_company_id
  ON public.external_employees(accounting_company_id);
