-- Migration: Metas — adicionar KPI N1 + cadência semester (PE 2026)
-- Suporta o "Layout Portal Metas Ga360 (COMPLETO)" entregue pelo Felipe Silva (GPE)

-- ===================================================
-- 1. Coluna KPI N1 (categoria do KPI)
-- ===================================================
ALTER TABLE public.goals ADD COLUMN IF NOT EXISTS kpi_n1 TEXT;

COMMENT ON COLUMN public.goals.kpi_n1 IS
  'Categoria do KPI (nivel 1) — ex: GANHOS VARIAVEIS, INVESTIMENTO ADMINISTRATIVO. Vem da coluna "KPI (N1)" do CSV PE2026.';

-- ===================================================
-- 2. Indices para agrupamento e filtros
-- ===================================================
CREATE INDEX IF NOT EXISTS idx_goals_kpi_n1
  ON public.goals(kpi_n1);

CREATE INDEX IF NOT EXISTS idx_goals_company_area_indicator
  ON public.goals(company_id, area_id, indicator_type);

-- ===================================================
-- 3. Adicionar 'semester' ao enum goal_cadence
-- ===================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'goal_cadence' AND e.enumlabel = 'semester'
  ) THEN
    ALTER TYPE goal_cadence ADD VALUE 'semester';
  END IF;
END$$;
