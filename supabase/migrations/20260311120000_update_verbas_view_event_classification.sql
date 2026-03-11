-- Atualiza classificação de eventos da view de verbas para alinhar com o Datalake.
--
-- Mudanças:
--   • SALDO_SALARIO absorve eventos 61,87,51,91 (antes ADCNOT_HORAEXTRA_DSR) e 10102,23 (antes COMPLEMENTO_SALARIAL)
--   • VERBA_INDENIZATORIA passa a ser somente cod_evento 10000
--   • ADIANTAMENTO_VERBA_IDENIZATORIA (novo) recebe cod_evento 10054
--   • COMPLEMENTO_SALARIAL, ADCNOT_HORAEXTRA_DSR, VALE_ALIMENTACAO, SEGURO_VIDA e SST caem em OUTROS

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
    valor,
    employee_department,
    employee_position,
    employee_unidade,
    employee_accounting_group
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
    employee_department,
    employee_position,
    employee_unidade,
    employee_accounting_group,
    CASE
      WHEN cod_evento IN (1,10095,7,540,541,10088,10001,10035,10027,10063,61,87,51,91,10102,23)
        THEN 'SALDO_SALARIO'
      WHEN cod_evento IN (30,10044)
        THEN 'COMISSAO_DSR'
      WHEN cod_evento IN (31)
        THEN 'BONUS'
      WHEN cod_evento IN (10087,10114)
        THEN 'PREMIO'
      WHEN cod_evento IN (10000)
        THEN 'VERBA_INDENIZATORIA'
      WHEN cod_evento IN (10054)
        THEN 'ADIANTAMENTO_VERBA_IDENIZATORIA'
      WHEN cod_evento IN (10008,10009)
        THEN 'DESC_PLANO_SAUDE'
      WHEN cod_evento IN (10098)
        THEN 'PLANO_SAUDE_EMPRESA'
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
    employee_department,
    employee_position,
    employee_unidade,
    employee_accounting_group,
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
    employee_department,
    employee_position,
    employee_unidade,
    employee_accounting_group,
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
  employee_department,
  employee_position,
  employee_unidade AS employee_unit,
  employee_accounting_group
FROM agregado
GROUP BY
  company_id,
  razao_social,
  cpf,
  nome_funcionario,
  tipo_verba,
  ano,
  employee_department,
  employee_position,
  employee_unidade,
  employee_accounting_group;

-- Mantém o mirror público em sincronia
CREATE OR REPLACE VIEW public.vw_pagamento_verba_pivot_mensal AS
SELECT * FROM gold.vw_pagamento_verba_pivot_mensal;

REVOKE ALL ON TABLE gold.vw_pagamento_verba_pivot_mensal FROM anon, authenticated;
REVOKE ALL ON TABLE public.vw_pagamento_verba_pivot_mensal FROM anon, authenticated;

GRANT SELECT ON TABLE gold.vw_pagamento_verba_pivot_mensal TO service_role;
GRANT SELECT ON TABLE public.vw_pagamento_verba_pivot_mensal TO service_role;
