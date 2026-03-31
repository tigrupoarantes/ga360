-- ============================================================
-- Refactor: Verbas Indenizatórias — Empresa de REGISTRO CLT
--
-- Altera get_vi_employees_for_competencia() para usar
-- employee_contract_company_id em vez de employee_accounting_company_id.
--
-- Motivo legal: verba indenizatória deve ser vinculada à empresa
-- onde o colaborador tem registro CLT, não à empresa contábil.
-- (CLT Art. 2º, Art. 457 §2º)
-- ============================================================

-- DROP primeiro porque mudou a lógica interna
DROP FUNCTION IF EXISTS get_vi_employees_for_competencia(UUID, INTEGER, TEXT);

CREATE FUNCTION get_vi_employees_for_competencia(
  p_company_id UUID,
  p_ano        INTEGER,
  p_mes_nome   TEXT
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

  -- Usa employee_contract_company_id (empresa de registro CLT)
  -- em vez de employee_accounting_company_id (empresa contábil)
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
      MAX(c_contract.external_id)               AS accounting_company_cnpj,
      MAX(c_contract.name)                      AS accounting_company_name
    FROM payroll_verba_pivot p
    LEFT JOIN external_employees e
      ON REGEXP_REPLACE(e.cpf, '\D', '', 'g') = REGEXP_REPLACE(p.cpf, '\D', '', 'g')
     AND e.company_id   = p.company_id
     AND e.is_active     = true
     AND (e.is_disabled IS NOT TRUE)
    LEFT JOIN auth.users au
      ON au.id = e.linked_profile_id
    LEFT JOIN companies c_contract
      ON c_contract.id = p.employee_contract_company_id
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
