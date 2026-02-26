-- ============================================================
-- VERBAS (Pessoas & Cultura) - Estrutura sensível de remuneração
-- ============================================================

CREATE SCHEMA IF NOT EXISTS gold;

CREATE TABLE IF NOT EXISTS public.payroll_verba_events (
  id BIGSERIAL PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  razao_social TEXT NOT NULL,
  cpf TEXT NOT NULL,
  nome_funcionario TEXT NOT NULL,
  ano INTEGER NOT NULL CHECK (ano >= 2000),
  mes INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
  cod_evento INTEGER NOT NULL,
  valor NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payroll_verba_events_company_ano_mes
  ON public.payroll_verba_events (company_id, ano, mes);

CREATE INDEX IF NOT EXISTS idx_payroll_verba_events_company_cpf
  ON public.payroll_verba_events (company_id, cpf);

CREATE INDEX IF NOT EXISTS idx_payroll_verba_events_company_funcionario
  ON public.payroll_verba_events (company_id, nome_funcionario);

DROP TRIGGER IF EXISTS update_payroll_verba_events_updated_at
  ON public.payroll_verba_events;

CREATE TRIGGER update_payroll_verba_events_updated_at
  BEFORE UPDATE ON public.payroll_verba_events
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.payroll_verba_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_only_payroll_verba_events" ON public.payroll_verba_events;
CREATE POLICY "service_role_only_payroll_verba_events"
  ON public.payroll_verba_events
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE OR REPLACE VIEW gold.vw_pagamento_verba_pivot_mensal AS
WITH base AS (
  SELECT
    company_id,
    razao_social,
    cpf,
    nome_funcionario,
    ano,
    mes,
    cod_evento,
    valor
  FROM public.payroll_verba_events
),
classificacao AS (
  SELECT
    company_id,
    razao_social,
    cpf,
    nome_funcionario,
    ano,
    mes,
    CASE
      WHEN cod_evento IN (1,10095,7,540,541,10088,10001,10035,10027,10063)
        THEN 'SALDO_SALARIO'
      WHEN cod_evento IN (10102,23)
        THEN 'COMPLEMENTO_SALARIAL'
      WHEN cod_evento IN (30,10044)
        THEN 'COMISSAO_DSR'
      WHEN cod_evento IN (31)
        THEN 'BONUS'
      WHEN cod_evento IN (10087,10114)
        THEN 'PREMIO'
      WHEN cod_evento IN (61,87,51,91)
        THEN 'ADCNOT_HORAEXTRA_DSR'
      WHEN cod_evento IN (10000,10054)
        THEN 'VERBA_INDENIZATORIA'
      WHEN cod_evento IN (10096)
        THEN 'VALE_ALIMENTACAO'
      WHEN cod_evento IN (10008,10009)
        THEN 'DESC_PLANO_SAUDE'
      WHEN cod_evento IN (10098)
        THEN 'PLANO_SAUDE_EMPRESA'
      WHEN cod_evento IN (10097)
        THEN 'SEGURO_VIDA'
      WHEN cod_evento IN (10100)
        THEN 'SST'
      WHEN cod_evento IN (995,996)
        THEN 'FGTS'
      ELSE 'OUTROS'
    END AS tipo_verba,
    valor
  FROM base
),
agregado AS (
  SELECT
    company_id,
    razao_social,
    cpf,
    nome_funcionario,
    tipo_verba,
    ano,
    mes,
    SUM(valor) AS valor
  FROM classificacao
  GROUP BY
    company_id,
    razao_social,
    cpf,
    nome_funcionario,
    tipo_verba,
    ano,
    mes
)
SELECT
  company_id,
  razao_social,
  cpf,
  nome_funcionario,
  tipo_verba,
  ano,
  COALESCE(SUM(valor) FILTER (WHERE mes = 1), 0)  AS janeiro,
  COALESCE(SUM(valor) FILTER (WHERE mes = 2), 0)  AS fevereiro,
  COALESCE(SUM(valor) FILTER (WHERE mes = 3), 0)  AS marco,
  COALESCE(SUM(valor) FILTER (WHERE mes = 4), 0)  AS abril,
  COALESCE(SUM(valor) FILTER (WHERE mes = 5), 0)  AS maio,
  COALESCE(SUM(valor) FILTER (WHERE mes = 6), 0)  AS junho,
  COALESCE(SUM(valor) FILTER (WHERE mes = 7), 0)  AS julho,
  COALESCE(SUM(valor) FILTER (WHERE mes = 8), 0)  AS agosto,
  COALESCE(SUM(valor) FILTER (WHERE mes = 9), 0)  AS setembro,
  COALESCE(SUM(valor) FILTER (WHERE mes = 10), 0) AS outubro,
  COALESCE(SUM(valor) FILTER (WHERE mes = 11), 0) AS novembro,
  COALESCE(SUM(valor) FILTER (WHERE mes = 12), 0) AS dezembro
FROM agregado
GROUP BY
  company_id,
  razao_social,
  cpf,
  nome_funcionario,
  tipo_verba,
  ano;

REVOKE ALL ON TABLE public.payroll_verba_events FROM anon, authenticated;
REVOKE ALL ON TABLE gold.vw_pagamento_verba_pivot_mensal FROM anon, authenticated;

GRANT SELECT ON TABLE gold.vw_pagamento_verba_pivot_mensal TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.payroll_verba_events TO service_role;

CREATE OR REPLACE FUNCTION public.get_verbas_card_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id
  FROM public.ec_cards c
  JOIN public.ec_areas a ON a.id = c.area_id
  WHERE a.slug = 'pessoas-cultura'
    AND c.is_active = true
    AND lower(c.title) = 'verbas'
  LIMIT 1;
$$;

DO $$
DECLARE
  v_area_id UUID;
BEGIN
  SELECT id INTO v_area_id
  FROM public.ec_areas
  WHERE slug = 'pessoas-cultura'
    AND is_active = true
  LIMIT 1;

  IF v_area_id IS NOT NULL THEN
    INSERT INTO public.ec_cards (
      area_id,
      title,
      description,
      periodicity_type,
      is_active,
      "order"
    ) VALUES (
      v_area_id,
      'VERBAS',
      'Visão sensível da remuneração de funcionários com controle estrito de acesso.',
      'monthly',
      true,
      100
    )
    ON CONFLICT DO NOTHING;
  END IF;
END;
$$;
