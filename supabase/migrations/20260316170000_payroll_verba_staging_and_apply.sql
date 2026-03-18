-- =============================================================================
-- payroll_verba_staging: recebe dados brutos do DAB sem company_id
-- apply_payroll_staging(): JOIN com external_employees por CPF → popula pivot
--
-- Arquitetura corrigida:
--   DAB → staging (cpf + tipo_verba + valores, sem empresa)
--         → apply_payroll_staging()
--           → JOIN external_employees ON cpf = cpf (normalizado)
--           → UPSERT payroll_verba_pivot (com company_id resolvido)
-- =============================================================================

-- ─── 1. Tabela staging ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.payroll_verba_staging (
  id               BIGSERIAL     PRIMARY KEY,
  cpf              TEXT          NOT NULL,
  nome_funcionario TEXT          NOT NULL DEFAULT '',
  tipo_verba       TEXT          NOT NULL,
  ano              INTEGER       NOT NULL CHECK (ano >= 2000),
  janeiro          NUMERIC(14,2) NOT NULL DEFAULT 0,
  fevereiro        NUMERIC(14,2) NOT NULL DEFAULT 0,
  marco            NUMERIC(14,2) NOT NULL DEFAULT 0,
  abril            NUMERIC(14,2) NOT NULL DEFAULT 0,
  maio             NUMERIC(14,2) NOT NULL DEFAULT 0,
  junho            NUMERIC(14,2) NOT NULL DEFAULT 0,
  julho            NUMERIC(14,2) NOT NULL DEFAULT 0,
  agosto           NUMERIC(14,2) NOT NULL DEFAULT 0,
  setembro         NUMERIC(14,2) NOT NULL DEFAULT 0,
  outubro          NUMERIC(14,2) NOT NULL DEFAULT 0,
  novembro         NUMERIC(14,2) NOT NULL DEFAULT 0,
  dezembro         NUMERIC(14,2) NOT NULL DEFAULT 0,
  synced_at        TIMESTAMPTZ   NOT NULL DEFAULT now(),

  CONSTRAINT ux_payroll_staging_natural UNIQUE (cpf, tipo_verba, ano)
);

CREATE INDEX IF NOT EXISTS idx_payroll_staging_cpf ON public.payroll_verba_staging(cpf);
CREATE INDEX IF NOT EXISTS idx_payroll_staging_ano ON public.payroll_verba_staging(ano);

ALTER TABLE public.payroll_verba_staging ENABLE ROW LEVEL SECURITY;
-- Apenas service_role acessa (Edge Functions usam service_role_key)

-- ─── 2. Função apply_payroll_staging ─────────────────────────────────────────
-- Recebe p_ano (opcional). Se NULL, processa todo o staging.
-- Normaliza CPF removendo qualquer não-dígito antes do JOIN.
-- Prioridade: accounting_company_id > company_id (modelo contábil).
-- Em caso de CPF em múltiplas empresas: prefere is_active=true, is_disabled=false.
-- Retorna JSONB com: inserted_or_updated, cpfs_sem_empresa.

CREATE OR REPLACE FUNCTION public.apply_payroll_staging(p_ano INTEGER DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_inserted    INTEGER := 0;
  v_sem_empresa INTEGER := 0;
BEGIN
  -- Conta CPFs do staging que não têm match em external_employees
  SELECT COUNT(DISTINCT REGEXP_REPLACE(s.cpf, '\D', '', 'g'))
  INTO v_sem_empresa
  FROM public.payroll_verba_staging s
  WHERE (p_ano IS NULL OR s.ano = p_ano)
    AND NOT EXISTS (
      SELECT 1
      FROM public.external_employees ee
      WHERE REGEXP_REPLACE(ee.cpf, '\D', '', 'g') = REGEXP_REPLACE(s.cpf, '\D', '', 'g')
        AND ee.company_id IS NOT NULL
    );

  -- JOIN staging × external_employees → upsert pivot
  WITH resolved AS (
    SELECT DISTINCT ON (
      REGEXP_REPLACE(s.cpf, '\D', '', 'g'),
      s.tipo_verba,
      s.ano
    )
      COALESCE(ee.accounting_company_id, ee.company_id) AS company_id,
      c.name                                            AS razao_social,
      REGEXP_REPLACE(s.cpf, '\D', '', 'g')              AS cpf,
      s.nome_funcionario,
      s.tipo_verba,
      s.ano,
      s.janeiro, s.fevereiro, s.marco,    s.abril,
      s.maio,    s.junho,     s.julho,    s.agosto,
      s.setembro,s.outubro,  s.novembro, s.dezembro,
      ee.department          AS employee_department,
      ee.position            AS employee_position,
      ee.unidade             AS employee_unidade,
      ee.accounting_group    AS employee_accounting_group,
      ee.contract_company_id    AS employee_contract_company_id,
      ee.accounting_company_id  AS employee_accounting_company_id
    FROM public.payroll_verba_staging s
    JOIN public.external_employees ee
      ON REGEXP_REPLACE(ee.cpf, '\D', '', 'g') = REGEXP_REPLACE(s.cpf, '\D', '', 'g')
     AND ee.company_id IS NOT NULL
    JOIN public.companies c
      ON c.id = COALESCE(ee.accounting_company_id, ee.company_id)
    WHERE (p_ano IS NULL OR s.ano = p_ano)
    ORDER BY
      REGEXP_REPLACE(s.cpf, '\D', '', 'g'),
      s.tipo_verba,
      s.ano,
      ee.is_active     DESC,   -- prefere ativo
      ee.is_disabled   ASC,    -- prefere não-desabilitado
      ee.id            ASC     -- desempate determinístico
  )
  INSERT INTO public.payroll_verba_pivot (
    company_id, razao_social, cpf, nome_funcionario, tipo_verba, ano,
    janeiro,  fevereiro, marco,    abril,
    maio,     junho,     julho,    agosto,
    setembro, outubro,   novembro, dezembro,
    employee_department, employee_position, employee_unidade,
    employee_accounting_group,
    employee_contract_company_id, employee_accounting_company_id,
    updated_at
  )
  SELECT
    company_id, razao_social, cpf, nome_funcionario, tipo_verba, ano,
    janeiro,  fevereiro, marco,    abril,
    maio,     junho,     julho,    agosto,
    setembro, outubro,   novembro, dezembro,
    employee_department, employee_position, employee_unidade,
    employee_accounting_group,
    employee_contract_company_id, employee_accounting_company_id,
    now()
  FROM resolved
  ON CONFLICT (company_id, cpf, tipo_verba, ano)
  DO UPDATE SET
    razao_social                  = EXCLUDED.razao_social,
    nome_funcionario              = EXCLUDED.nome_funcionario,
    janeiro                       = EXCLUDED.janeiro,
    fevereiro                     = EXCLUDED.fevereiro,
    marco                         = EXCLUDED.marco,
    abril                         = EXCLUDED.abril,
    maio                          = EXCLUDED.maio,
    junho                         = EXCLUDED.junho,
    julho                         = EXCLUDED.julho,
    agosto                        = EXCLUDED.agosto,
    setembro                      = EXCLUDED.setembro,
    outubro                       = EXCLUDED.outubro,
    novembro                      = EXCLUDED.novembro,
    dezembro                      = EXCLUDED.dezembro,
    employee_department           = EXCLUDED.employee_department,
    employee_position             = EXCLUDED.employee_position,
    employee_unidade              = EXCLUDED.employee_unidade,
    employee_accounting_group     = EXCLUDED.employee_accounting_group,
    employee_contract_company_id  = EXCLUDED.employee_contract_company_id,
    employee_accounting_company_id = EXCLUDED.employee_accounting_company_id,
    updated_at                    = now();

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  RETURN jsonb_build_object(
    'inserted_or_updated', v_inserted,
    'cpfs_sem_empresa',    v_sem_empresa
  );
END;
$$;

-- Garante que apenas roles privilegiadas podem chamar diretamente
REVOKE ALL ON FUNCTION public.apply_payroll_staging(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_payroll_staging(INTEGER) TO service_role;
