-- =============================================================================
-- Fix payroll verba tenant resolution using company_external_id (CNPJ) first.
--
-- Problem:
-- - payroll_verba_staging currently relies on external_employees or company name
--   fallback to resolve company_id in apply_payroll_staging().
-- - When a CPF does not exist in external_employees, name-based matching can still
--   miss valid rows from DAB, causing the pivot to show only a subset of employees.
-- - sync-verbas already receives company_external_id/cnpj_empresa from the API,
--   but staging does not persist this canonical company identifier.
--
-- Fix:
-- 1. Add company_external_id to payroll_verba_staging.
-- 2. Resolve company_id by companies.external_id first.
-- 3. Keep existing fallbacks via external_employees, razao_social and tenant_id.
-- =============================================================================

ALTER TABLE public.payroll_verba_staging
  ADD COLUMN IF NOT EXISTS company_external_id TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_payroll_staging_company_external_id
  ON public.payroll_verba_staging(company_external_id);

CREATE OR REPLACE FUNCTION public.apply_payroll_staging(p_ano INTEGER DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted    INTEGER := 0;
  v_sem_empresa INTEGER := 0;
BEGIN

  SELECT COUNT(DISTINCT REGEXP_REPLACE(s.cpf, '\D', '', 'g'))
  INTO v_sem_empresa
  FROM public.payroll_verba_staging s
  WHERE (p_ano IS NULL OR s.ano = p_ano)
    AND NOT EXISTS (
      SELECT 1
      FROM public.external_employees ee
      WHERE REGEXP_REPLACE(ee.cpf, '\D', '', 'g') = REGEXP_REPLACE(s.cpf, '\D', '', 'g')
        AND ee.company_id IS NOT NULL
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.companies c
      WHERE (
        (s.company_external_id <> '' AND c.external_id = s.company_external_id)
        OR
        (s.razao_social <> ''
          AND lower(REGEXP_REPLACE(trim(c.name), '[^a-zA-Z0-9]+', ' ', 'g'))
            = lower(REGEXP_REPLACE(trim(s.razao_social), '[^a-zA-Z0-9]+', ' ', 'g')))
        OR
        (s.tenant_id <> ''
          AND UPPER(REGEXP_REPLACE(REGEXP_REPLACE(trim(c.name), '[^A-Za-z0-9 ]', '', 'g'), ' +', '_', 'g'))
            = s.tenant_id)
      )
    );

  WITH
    from_employees AS (
      SELECT DISTINCT ON (
        REGEXP_REPLACE(s.cpf, '\D', '', 'g'),
        s.tipo_verba,
        s.ano
      )
        1                                                     AS priority,
        COALESCE(ee.accounting_company_id, ee.company_id)    AS company_id,
        c.name                                                AS razao_social,
        REGEXP_REPLACE(s.cpf, '\D', '', 'g')                 AS cpf,
        s.nome_funcionario,
        s.tipo_verba,
        s.ano,
        s.janeiro,   s.fevereiro, s.marco,    s.abril,
        s.maio,      s.junho,     s.julho,    s.agosto,
        s.setembro,  s.outubro,   s.novembro, s.dezembro,
        ee.department             AS employee_department,
        ee.position               AS employee_position,
        ee.unidade                AS employee_unidade,
        ee.accounting_group       AS employee_accounting_group,
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
        ee.is_active  DESC,
        ee.is_disabled ASC,
        ee.id          ASC
    ),

    from_company_external_id AS (
      SELECT DISTINCT ON (
        REGEXP_REPLACE(s.cpf, '\D', '', 'g'),
        s.tipo_verba,
        s.ano
      )
        2                                    AS priority,
        c.id                                 AS company_id,
        c.name                               AS razao_social,
        REGEXP_REPLACE(s.cpf, '\D', '', 'g') AS cpf,
        s.nome_funcionario,
        s.tipo_verba,
        s.ano,
        s.janeiro,   s.fevereiro, s.marco,    s.abril,
        s.maio,      s.junho,     s.julho,    s.agosto,
        s.setembro,  s.outubro,   s.novembro, s.dezembro,
        NULL::TEXT   AS employee_department,
        NULL::TEXT   AS employee_position,
        NULL::TEXT   AS employee_unidade,
        NULL::TEXT   AS employee_accounting_group,
        NULL::UUID   AS employee_contract_company_id,
        NULL::UUID   AS employee_accounting_company_id
      FROM public.payroll_verba_staging s
      JOIN public.companies c
        ON s.company_external_id <> ''
       AND c.external_id = s.company_external_id
      WHERE (p_ano IS NULL OR s.ano = p_ano)
        AND NOT EXISTS (
          SELECT 1
          FROM public.external_employees ee2
          WHERE REGEXP_REPLACE(ee2.cpf, '\D', '', 'g') = REGEXP_REPLACE(s.cpf, '\D', '', 'g')
            AND ee2.company_id IS NOT NULL
        )
      ORDER BY
        REGEXP_REPLACE(s.cpf, '\D', '', 'g'),
        s.tipo_verba,
        s.ano,
        c.id ASC
    ),

    from_company_name AS (
      SELECT DISTINCT ON (
        REGEXP_REPLACE(s.cpf, '\D', '', 'g'),
        s.tipo_verba,
        s.ano
      )
        3                                    AS priority,
        c.id                                 AS company_id,
        c.name                               AS razao_social,
        REGEXP_REPLACE(s.cpf, '\D', '', 'g') AS cpf,
        s.nome_funcionario,
        s.tipo_verba,
        s.ano,
        s.janeiro,   s.fevereiro, s.marco,    s.abril,
        s.maio,      s.junho,     s.julho,    s.agosto,
        s.setembro,  s.outubro,   s.novembro, s.dezembro,
        NULL::TEXT   AS employee_department,
        NULL::TEXT   AS employee_position,
        NULL::TEXT   AS employee_unidade,
        NULL::TEXT   AS employee_accounting_group,
        NULL::UUID   AS employee_contract_company_id,
        NULL::UUID   AS employee_accounting_company_id
      FROM public.payroll_verba_staging s
      JOIN public.companies c
        ON (
          (s.razao_social <> ''
            AND lower(REGEXP_REPLACE(trim(c.name), '[^a-zA-Z0-9]+', ' ', 'g'))
              = lower(REGEXP_REPLACE(trim(s.razao_social), '[^a-zA-Z0-9]+', ' ', 'g')))
          OR
          (s.tenant_id <> ''
            AND UPPER(REGEXP_REPLACE(REGEXP_REPLACE(trim(c.name), '[^A-Za-z0-9 ]', '', 'g'), ' +', '_', 'g'))
              = s.tenant_id)
        )
      WHERE (p_ano IS NULL OR s.ano = p_ano)
        AND NOT EXISTS (
          SELECT 1
          FROM public.external_employees ee2
          WHERE REGEXP_REPLACE(ee2.cpf, '\D', '', 'g') = REGEXP_REPLACE(s.cpf, '\D', '', 'g')
            AND ee2.company_id IS NOT NULL
        )
        AND NOT EXISTS (
          SELECT 1
          FROM public.companies c2
          WHERE s.company_external_id <> ''
            AND c2.external_id = s.company_external_id
        )
      ORDER BY
        REGEXP_REPLACE(s.cpf, '\D', '', 'g'),
        s.tipo_verba,
        s.ano,
        c.id ASC
    ),

    all_resolved AS (
      SELECT * FROM from_employees
      UNION ALL
      SELECT * FROM from_company_external_id
      UNION ALL
      SELECT * FROM from_company_name
    ),

    final_resolved AS (
      SELECT DISTINCT ON (cpf, tipo_verba, ano) *
      FROM all_resolved
      ORDER BY cpf, tipo_verba, ano, priority ASC
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
  FROM final_resolved
  ON CONFLICT (company_id, cpf, tipo_verba, ano)
  DO UPDATE SET
    razao_social                   = EXCLUDED.razao_social,
    nome_funcionario               = EXCLUDED.nome_funcionario,
    janeiro                        = EXCLUDED.janeiro,
    fevereiro                      = EXCLUDED.fevereiro,
    marco                          = EXCLUDED.marco,
    abril                          = EXCLUDED.abril,
    maio                           = EXCLUDED.maio,
    junho                          = EXCLUDED.junho,
    julho                          = EXCLUDED.julho,
    agosto                         = EXCLUDED.agosto,
    setembro                       = EXCLUDED.setembro,
    outubro                        = EXCLUDED.outubro,
    novembro                       = EXCLUDED.novembro,
    dezembro                       = EXCLUDED.dezembro,
    employee_department            = COALESCE(EXCLUDED.employee_department, payroll_verba_pivot.employee_department),
    employee_position              = COALESCE(EXCLUDED.employee_position, payroll_verba_pivot.employee_position),
    employee_unidade               = COALESCE(EXCLUDED.employee_unidade, payroll_verba_pivot.employee_unidade),
    employee_accounting_group      = COALESCE(EXCLUDED.employee_accounting_group, payroll_verba_pivot.employee_accounting_group),
    employee_contract_company_id   = COALESCE(EXCLUDED.employee_contract_company_id, payroll_verba_pivot.employee_contract_company_id),
    employee_accounting_company_id = COALESCE(EXCLUDED.employee_accounting_company_id, payroll_verba_pivot.employee_accounting_company_id),
    updated_at                     = now();

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  RETURN jsonb_build_object(
    'inserted_or_updated', v_inserted,
    'cpfs_sem_empresa',    v_sem_empresa
  );
END;
$$;

REVOKE ALL ON FUNCTION public.apply_payroll_staging(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_payroll_staging(INTEGER) TO service_role;
