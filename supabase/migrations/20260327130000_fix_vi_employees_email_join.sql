-- ============================================================
-- Fix: emails "sem e-mail" no Gerar em Lote de Verbas Indenizatórias
--
-- Bug 1: is_disabled foi adicionado sem DEFAULT — registros com NULL
--         são rejeitados pela condição "e.is_disabled = false"
-- Bug 2: LEFT JOIN sem company_id podia trazer registro de outra empresa
-- ============================================================

-- 1. Backfill: setar is_disabled = false onde está NULL
UPDATE external_employees SET is_disabled = false WHERE is_disabled IS NULL;
ALTER TABLE external_employees ALTER COLUMN is_disabled SET DEFAULT false;

-- 2. Recriar função com JOIN corrigido
CREATE OR REPLACE FUNCTION get_vi_employees_for_competencia(
  p_company_id UUID,
  p_ano        INTEGER,
  p_mes_nome   TEXT  -- 'janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho',
                     -- 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
)
RETURNS TABLE (
  cpf                       TEXT,
  nome_funcionario          TEXT,
  employee_email            TEXT,
  employee_department       TEXT,
  employee_position         TEXT,
  employee_unidade          TEXT,
  employee_accounting_group TEXT,
  valor_verba               NUMERIC,
  valor_adiantamento        NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sql TEXT;
BEGIN
  -- Valida o nome do mês para evitar SQL injection via identificador dinâmico
  IF p_mes_nome NOT IN (
    'janeiro','fevereiro','marco','abril','maio','junho',
    'julho','agosto','setembro','outubro','novembro','dezembro'
  ) THEN
    RAISE EXCEPTION 'mes_nome inválido: %', p_mes_nome;
  END IF;

  -- Usa format() com %I para nome de coluna dinâmico (mês), %L para literal UUID
  v_sql := format($f$
    SELECT
      p.cpf,
      MAX(p.nome_funcionario)          AS nome_funcionario,
      MAX(e.email)                     AS employee_email,
      MAX(p.employee_department)       AS employee_department,
      MAX(p.employee_position)         AS employee_position,
      MAX(p.employee_unidade)          AS employee_unidade,
      MAX(p.employee_accounting_group) AS employee_accounting_group,
      COALESCE(
        MAX(CASE WHEN p.tipo_verba NOT ILIKE '%%ADIANT%%' THEN p.%I ELSE 0 END), 0
      ) AS valor_verba,
      COALESCE(
        MAX(CASE WHEN p.tipo_verba     ILIKE '%%ADIANT%%' THEN p.%I ELSE 0 END), 0
      ) AS valor_adiantamento
    FROM payroll_verba_pivot p
    LEFT JOIN external_employees e
      ON REGEXP_REPLACE(e.cpf, '\D', '', 'g') = REGEXP_REPLACE(p.cpf, '\D', '', 'g')
     AND e.company_id   = p.company_id
     AND e.is_active     = true
     AND (e.is_disabled IS NOT TRUE)
    WHERE p.company_id = %L
      AND p.ano        = %s
      AND p.tipo_verba ILIKE '%%INDENIZ%%'
    GROUP BY p.cpf
    HAVING
      COALESCE(MAX(CASE WHEN p.tipo_verba NOT ILIKE '%%ADIANT%%' THEN p.%I ELSE 0 END), 0)
    + COALESCE(MAX(CASE WHEN p.tipo_verba     ILIKE '%%ADIANT%%' THEN p.%I ELSE 0 END), 0)
    > 0
    ORDER BY MAX(p.nome_funcionario)
  $f$,
  p_mes_nome, p_mes_nome,   -- %I × 2 no SELECT
  p_company_id,             -- %L
  p_ano,                    -- %s
  p_mes_nome, p_mes_nome    -- %I × 2 no HAVING
  );

  RETURN QUERY EXECUTE v_sql;
END;
$$;

GRANT EXECUTE ON FUNCTION get_vi_employees_for_competencia(UUID, INTEGER, TEXT) TO service_role;
