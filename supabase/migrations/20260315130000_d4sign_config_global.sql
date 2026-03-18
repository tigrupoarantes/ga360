-- ============================================================
-- D4Sign config global (não por empresa)
-- A integração D4Sign usa uma única credencial para todas as empresas.
-- Remove UNIQUE(company_id) e adiciona índice parcial para garantir
-- uma única linha global (company_id IS NULL).
-- ============================================================

ALTER TABLE public.d4sign_config DROP CONSTRAINT IF EXISTS d4sign_config_company_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS d4sign_config_global_unique
  ON public.d4sign_config ((true))
  WHERE company_id IS NULL;
