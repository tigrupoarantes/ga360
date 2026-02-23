ALTER TABLE public.external_employees
  ADD COLUMN IF NOT EXISTS birth_date date,
  ADD COLUMN IF NOT EXISTS gender text,
  ADD COLUMN IF NOT EXISTS age integer,
  ADD COLUMN IF NOT EXISTS first_job boolean,
  ADD COLUMN IF NOT EXISTS education_level text,
  ADD COLUMN IF NOT EXISTS marital_status text,
  ADD COLUMN IF NOT EXISTS is_disabled boolean;

CREATE INDEX IF NOT EXISTS idx_external_employees_birth_date ON public.external_employees(birth_date);
CREATE INDEX IF NOT EXISTS idx_external_employees_gender ON public.external_employees(gender);
CREATE INDEX IF NOT EXISTS idx_external_employees_first_job ON public.external_employees(first_job);
