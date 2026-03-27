-- ============================================================
-- Refactor: Verbas Indenizatórias — CNPJ + Eventos + Email fallback
--
-- 1. Atualiza get_vi_employees_for_competencia():
--    - Email fallback via auth.users (linked_profile_id)
--    - Retorna CNPJ e nome da empresa contábil
-- 2. Novos campos em verba_indenizatoria_documents:
--    - employee_accounting_cnpj (CNPJ da empresa contábil)
--    - event_type (VERBA_INDENIZATORIA ou ADIANT_INDENIZATORIA)
-- 3. Backfill CNPJ nos documentos existentes
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. ATUALIZAR FUNÇÃO RPC
-- ────────────────────────────────────────────────────────────

-- DROP primeiro porque mudou a assinatura (RETURNS TABLE ganhou colunas)
DROP FUNCTION IF EXISTS get_vi_employees_for_competencia(UUID, INTEGER, TEXT);

CREATE FUNCTION get_vi_employees_for_competencia(
  p_company_id UUID,
  p_ano        INTEGER,
  p_mes_nome   TEXT  -- 'janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho',
                     -- 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
)
RETURNS TABLE (
  cpf                        TEXT,
  nome_funcionario           TEXT,
  employee_email             TEXT,
  employee_department        TEXT,
  employee_position          TEXT,
  employee_unidade           TEXT,
  employee_accounting_group  TEXT,
  valor_verba                NUMERIC,
  valor_adiantamento         NUMERIC,
  accounting_company_cnpj    TEXT,
  accounting_company_name    TEXT
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
      MAX(p.nome_funcionario)                   AS nome_funcionario,
      MAX(COALESCE(e.email, au.email))          AS employee_email,
      MAX(p.employee_department)                AS employee_department,
      MAX(p.employee_position)                  AS employee_position,
      MAX(p.employee_unidade)                   AS employee_unidade,
      MAX(p.employee_accounting_group)          AS employee_accounting_group,
      COALESCE(
        MAX(CASE WHEN p.tipo_verba NOT ILIKE '%%ADIANT%%' THEN p.%I ELSE 0 END), 0
      ) AS valor_verba,
      COALESCE(
        MAX(CASE WHEN p.tipo_verba     ILIKE '%%ADIANT%%' THEN p.%I ELSE 0 END), 0
      ) AS valor_adiantamento,
      MAX(c_acc.external_id)                    AS accounting_company_cnpj,
      MAX(c_acc.name)                           AS accounting_company_name
    FROM payroll_verba_pivot p
    LEFT JOIN external_employees e
      ON REGEXP_REPLACE(e.cpf, '\D', '', 'g') = REGEXP_REPLACE(p.cpf, '\D', '', 'g')
     AND e.company_id   = p.company_id
     AND e.is_active     = true
     AND (e.is_disabled IS NOT TRUE)
    LEFT JOIN auth.users au
      ON au.id = e.linked_profile_id
    LEFT JOIN companies c_acc
      ON c_acc.id = p.employee_accounting_company_id
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

-- ────────────────────────────────────────────────────────────
-- 2. NOVOS CAMPOS EM verba_indenizatoria_documents
-- ────────────────────────────────────────────────────────────

ALTER TABLE verba_indenizatoria_documents
  ADD COLUMN IF NOT EXISTS employee_accounting_cnpj TEXT,
  ADD COLUMN IF NOT EXISTS event_type TEXT NOT NULL DEFAULT 'VERBA_INDENIZATORIA';

CREATE INDEX IF NOT EXISTS idx_vi_docs_accounting_cnpj
  ON verba_indenizatoria_documents(company_id, employee_accounting_cnpj);

CREATE INDEX IF NOT EXISTS idx_vi_docs_event_type
  ON verba_indenizatoria_documents(company_id, event_type);

-- ────────────────────────────────────────────────────────────
-- 3. BACKFILL CNPJ NOS DOCUMENTOS EXISTENTES
-- ────────────────────────────────────────────────────────────

UPDATE verba_indenizatoria_documents d
SET employee_accounting_cnpj = sub.cnpj
FROM (
  SELECT DISTINCT ON (p.company_id, norm_cpf)
    p.company_id,
    REGEXP_REPLACE(p.cpf, '\D', '', 'g') AS norm_cpf,
    c.external_id AS cnpj
  FROM payroll_verba_pivot p
  JOIN companies c ON c.id = p.employee_accounting_company_id
  WHERE c.external_id IS NOT NULL
  ORDER BY p.company_id, norm_cpf, p.updated_at DESC
) sub
WHERE REGEXP_REPLACE(d.employee_cpf, '\D', '', 'g') = sub.norm_cpf
  AND d.company_id = sub.company_id
  AND d.employee_accounting_cnpj IS NULL;
