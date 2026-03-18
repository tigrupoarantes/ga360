-- Migration: popula payroll_verba_pivot a partir dos dados existentes em payroll_verba_events
-- Executa apenas se payroll_verba_events tiver dados (histórico)
-- Se o usuário for refazer o sync completo, esta migration pode ser ignorada

INSERT INTO public.payroll_verba_pivot (
  company_id,
  razao_social,
  cpf,
  nome_funcionario,
  tipo_verba,
  ano,
  janeiro,
  fevereiro,
  marco,
  abril,
  maio,
  junho,
  julho,
  agosto,
  setembro,
  outubro,
  novembro,
  dezembro,
  employee_department,
  employee_position,
  employee_unidade,
  employee_accounting_group,
  employee_contract_company_id,
  employee_accounting_company_id,
  employee_snapshot_at
)
SELECT
  company_id,
  razao_social,
  cpf,
  nome_funcionario,
  CASE
    WHEN cod_evento IN (1,10095,7,540,541,10088,10001,10035,10027,10063,61,87,51,91,10102,23) THEN 'SALDO_SALARIO'
    WHEN cod_evento IN (30,10044)     THEN 'COMISSAO_DSR'
    WHEN cod_evento IN (31)           THEN 'BONUS'
    WHEN cod_evento IN (10087,10114)  THEN 'PREMIO'
    WHEN cod_evento IN (10000)        THEN 'VERBA_INDENIZATORIA'
    WHEN cod_evento IN (10054)        THEN 'ADIANTAMENTO_VERBA_IDENIZATORIA'
    WHEN cod_evento IN (10008,10009)  THEN 'DESC_PLANO_SAUDE'
    WHEN cod_evento IN (10098)        THEN 'PLANO_SAUDE_EMPRESA'
    WHEN cod_evento IN (995,996)      THEN 'FGTS'
    ELSE                                   'OUTROS'
  END AS tipo_verba,
  ano,
  COALESCE(SUM(valor) FILTER (WHERE mes = 1),  0) AS janeiro,
  COALESCE(SUM(valor) FILTER (WHERE mes = 2),  0) AS fevereiro,
  COALESCE(SUM(valor) FILTER (WHERE mes = 3),  0) AS marco,
  COALESCE(SUM(valor) FILTER (WHERE mes = 4),  0) AS abril,
  COALESCE(SUM(valor) FILTER (WHERE mes = 5),  0) AS maio,
  COALESCE(SUM(valor) FILTER (WHERE mes = 6),  0) AS junho,
  COALESCE(SUM(valor) FILTER (WHERE mes = 7),  0) AS julho,
  COALESCE(SUM(valor) FILTER (WHERE mes = 8),  0) AS agosto,
  COALESCE(SUM(valor) FILTER (WHERE mes = 9),  0) AS setembro,
  COALESCE(SUM(valor) FILTER (WHERE mes = 10), 0) AS outubro,
  COALESCE(SUM(valor) FILTER (WHERE mes = 11), 0) AS novembro,
  COALESCE(SUM(valor) FILTER (WHERE mes = 12), 0) AS dezembro,
  MAX(employee_department)              AS employee_department,
  MAX(employee_position)                AS employee_position,
  MAX(employee_unidade)                 AS employee_unidade,
  MAX(employee_accounting_group)        AS employee_accounting_group,
  (array_agg(employee_contract_company_id)    FILTER (WHERE employee_contract_company_id    IS NOT NULL))[1] AS employee_contract_company_id,
  (array_agg(employee_accounting_company_id)  FILTER (WHERE employee_accounting_company_id  IS NOT NULL))[1] AS employee_accounting_company_id,
  MAX(employee_snapshot_at)             AS employee_snapshot_at
FROM public.payroll_verba_events
GROUP BY
  company_id,
  razao_social,
  cpf,
  nome_funcionario,
  CASE
    WHEN cod_evento IN (1,10095,7,540,541,10088,10001,10035,10027,10063,61,87,51,91,10102,23) THEN 'SALDO_SALARIO'
    WHEN cod_evento IN (30,10044)     THEN 'COMISSAO_DSR'
    WHEN cod_evento IN (31)           THEN 'BONUS'
    WHEN cod_evento IN (10087,10114)  THEN 'PREMIO'
    WHEN cod_evento IN (10000)        THEN 'VERBA_INDENIZATORIA'
    WHEN cod_evento IN (10054)        THEN 'ADIANTAMENTO_VERBA_IDENIZATORIA'
    WHEN cod_evento IN (10008,10009)  THEN 'DESC_PLANO_SAUDE'
    WHEN cod_evento IN (10098)        THEN 'PLANO_SAUDE_EMPRESA'
    WHEN cod_evento IN (995,996)      THEN 'FGTS'
    ELSE                                   'OUTROS'
  END,
  ano
HAVING
  (CASE
    WHEN cod_evento IN (1,10095,7,540,541,10088,10001,10035,10027,10063,61,87,51,91,10102,23) THEN 'SALDO_SALARIO'
    WHEN cod_evento IN (30,10044)     THEN 'COMISSAO_DSR'
    WHEN cod_evento IN (31)           THEN 'BONUS'
    WHEN cod_evento IN (10087,10114)  THEN 'PREMIO'
    WHEN cod_evento IN (10000)        THEN 'VERBA_INDENIZATORIA'
    WHEN cod_evento IN (10054)        THEN 'ADIANTAMENTO_VERBA_IDENIZATORIA'
    WHEN cod_evento IN (10008,10009)  THEN 'DESC_PLANO_SAUDE'
    WHEN cod_evento IN (10098)        THEN 'PLANO_SAUDE_EMPRESA'
    WHEN cod_evento IN (995,996)      THEN 'FGTS'
    ELSE                                   'OUTROS'
  END) != 'OUTROS'
ON CONFLICT (company_id, cpf, tipo_verba, ano) DO UPDATE
  SET
    razao_social                    = EXCLUDED.razao_social,
    nome_funcionario                = EXCLUDED.nome_funcionario,
    janeiro                         = EXCLUDED.janeiro,
    fevereiro                       = EXCLUDED.fevereiro,
    marco                           = EXCLUDED.marco,
    abril                           = EXCLUDED.abril,
    maio                            = EXCLUDED.maio,
    junho                           = EXCLUDED.junho,
    julho                           = EXCLUDED.julho,
    agosto                          = EXCLUDED.agosto,
    setembro                        = EXCLUDED.setembro,
    outubro                         = EXCLUDED.outubro,
    novembro                        = EXCLUDED.novembro,
    dezembro                        = EXCLUDED.dezembro,
    employee_department             = EXCLUDED.employee_department,
    employee_position               = EXCLUDED.employee_position,
    employee_unidade                = EXCLUDED.employee_unidade,
    employee_accounting_group       = EXCLUDED.employee_accounting_group,
    employee_contract_company_id    = EXCLUDED.employee_contract_company_id,
    employee_accounting_company_id  = EXCLUDED.employee_accounting_company_id,
    employee_snapshot_at            = EXCLUDED.employee_snapshot_at,
    updated_at                      = now();
