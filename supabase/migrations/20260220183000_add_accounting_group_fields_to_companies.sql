ALTER TABLE public.companies
ADD COLUMN IF NOT EXISTS accounting_group_code TEXT,
ADD COLUMN IF NOT EXISTS accounting_group_description TEXT;