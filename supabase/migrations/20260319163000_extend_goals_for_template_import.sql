-- Extensões leves para suportar a carga inicial do layout do Portal de Metas
-- sem quebrar o CRUD atual da tela de Metas.

ALTER TABLE public.goals
  ADD COLUMN IF NOT EXISTS indicator_type TEXT,
  ADD COLUMN IF NOT EXISTS evaluation_points NUMERIC,
  ADD COLUMN IF NOT EXISTS effective_value NUMERIC;

CREATE INDEX IF NOT EXISTS idx_goals_indicator_type
  ON public.goals(indicator_type);
