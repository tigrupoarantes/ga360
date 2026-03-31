-- ============================================================
-- Adiciona coluna cpf_lider em external_employees e external_employee_snapshots
-- Objetivo: persistir o CPF do líder direto retornado pela API DAB (campo CPF_Lider)
-- sem precisar resolver o UUID a cada sync — resolução vira um único UPDATE batch.
-- ============================================================

-- 1. Coluna na tabela principal
ALTER TABLE public.external_employees
  ADD COLUMN IF NOT EXISTS cpf_lider TEXT;

-- Índice para o batch resolution e filtros
CREATE INDEX IF NOT EXISTS idx_ee_cpf_lider
  ON public.external_employees (cpf_lider)
  WHERE cpf_lider IS NOT NULL;

-- 2. Backfill a partir dos registros que já têm lider_direto_id preenchido
UPDATE public.external_employees ee
SET cpf_lider = l.cpf
FROM public.external_employees l
WHERE l.id = ee.lider_direto_id
  AND ee.cpf_lider IS NULL
  AND ee.lider_direto_id IS NOT NULL;

-- 3. Coluna na tabela de snapshot (para rastrear mudanças de líder historicamente)
ALTER TABLE public.external_employee_snapshots
  ADD COLUMN IF NOT EXISTS cpf_lider TEXT;

-- 4. Backfill na snapshot: atualizar snapshots abertos (valid_to IS NULL) com o cpf_lider atual
UPDATE public.external_employee_snapshots es
SET cpf_lider = ee.cpf_lider
FROM public.external_employees ee
WHERE ee.id = es.external_employee_id
  AND es.valid_to IS NULL
  AND es.cpf_lider IS NULL
  AND ee.cpf_lider IS NOT NULL;
