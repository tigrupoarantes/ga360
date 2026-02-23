ALTER TABLE public.external_employees
  ADD COLUMN IF NOT EXISTS accounting_group text;

CREATE INDEX IF NOT EXISTS idx_external_employees_accounting_group
  ON public.external_employees(accounting_group);
