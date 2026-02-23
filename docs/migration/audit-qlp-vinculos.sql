-- Auditoria de vínculo contratual x vínculo contábil no QLP
-- Uso: executar no SQL Editor do Supabase antes e depois da sincronização.

-- 1) Resumo geral de consistência
SELECT
  COUNT(*) AS total_funcionarios,
  COUNT(*) FILTER (WHERE ee.contract_company_id IS NULL) AS sem_empresa_contrato,
  COUNT(*) FILTER (WHERE ee.accounting_company_id IS NULL) AS sem_empresa_contabil,
  COUNT(*) FILTER (
    WHERE ee.contract_company_id IS NOT NULL
      AND ee.accounting_company_id IS NOT NULL
      AND ee.contract_company_id <> ee.accounting_company_id
  ) AS contrato_diferente_contabil,
  COUNT(*) FILTER (
    WHERE ee.contract_company_id IS NOT NULL
      AND ee.accounting_company_id IS NOT NULL
      AND ee.contract_company_id = ee.accounting_company_id
  ) AS contrato_igual_contabil
FROM public.external_employees ee
WHERE ee.source_system = 'dab_api'
  AND ee.is_active = true;


-- 2) Distribuição por empresa contratual x empresa contábil
SELECT
  COALESCE(c_contract.name, 'SEM EMPRESA CONTRATO') AS empresa_contrato,
  COALESCE(c_accounting.name, 'SEM EMPRESA CONTABIL') AS empresa_contabil,
  COUNT(*) AS quantidade
FROM public.external_employees ee
LEFT JOIN public.companies c_contract
  ON c_contract.id = ee.contract_company_id
LEFT JOIN public.companies c_accounting
  ON c_accounting.id = ee.accounting_company_id
WHERE ee.source_system = 'dab_api'
  AND ee.is_active = true
GROUP BY 1, 2
ORDER BY quantidade DESC, empresa_contrato, empresa_contabil;


-- 3) Top casos divergentes (detalhe)
SELECT
  ee.full_name,
  ee.cpf,
  COALESCE(c_contract.name, 'SEM EMPRESA CONTRATO') AS empresa_contrato,
  COALESCE(c_accounting.name, 'SEM EMPRESA CONTABIL') AS empresa_contabil,
  ee.accounting_group,
  ee.metadata ->> 'cod_contabilizacao' AS cod_contabilizacao,
  ee.metadata ->> 'contabilizacao' AS contabilizacao_normalizada,
  ee.metadata ->> 'contabilizacao_raw' AS contabilizacao_raw,
  ee.department,
  ee.position,
  ee.updated_at
FROM public.external_employees ee
LEFT JOIN public.companies c_contract
  ON c_contract.id = ee.contract_company_id
LEFT JOIN public.companies c_accounting
  ON c_accounting.id = ee.accounting_company_id
WHERE ee.source_system = 'dab_api'
  AND ee.is_active = true
  AND ee.contract_company_id IS NOT NULL
  AND ee.accounting_company_id IS NOT NULL
  AND ee.contract_company_id <> ee.accounting_company_id
ORDER BY ee.updated_at DESC, ee.full_name
LIMIT 200;


-- 4) Caso específico informado (CPF 47126691874)
SELECT
  ee.full_name,
  ee.cpf,
  COALESCE(c_contract.name, 'SEM EMPRESA CONTRATO') AS empresa_contrato,
  COALESCE(c_accounting.name, 'SEM EMPRESA CONTABIL') AS empresa_contabil,
  ee.accounting_group,
  ee.metadata ->> 'cod_contabilizacao' AS cod_contabilizacao,
  ee.metadata ->> 'contabilizacao' AS contabilizacao_normalizada,
  ee.metadata ->> 'contabilizacao_raw' AS contabilizacao_raw,
  ee.department,
  ee.position,
  ee.updated_at
FROM public.external_employees ee
LEFT JOIN public.companies c_contract
  ON c_contract.id = ee.contract_company_id
LEFT JOIN public.companies c_accounting
  ON c_accounting.id = ee.accounting_company_id
WHERE ee.source_system = 'dab_api'
  AND ee.cpf = '47126691874'
ORDER BY ee.updated_at DESC;


-- 5) Contagem para monitorar efeito do ajuste de regra (executar antes/depois)
-- Esperado após sync com regra nova: queda dos casos indevidos de contabilização.
SELECT
  DATE_TRUNC('day', ee.updated_at) AS dia_sync,
  COUNT(*) FILTER (
    WHERE ee.contract_company_id IS NOT NULL
      AND ee.accounting_company_id IS NOT NULL
      AND ee.contract_company_id <> ee.accounting_company_id
  ) AS divergentes_no_dia,
  COUNT(*) AS total_no_dia
FROM public.external_employees ee
WHERE ee.source_system = 'dab_api'
  AND ee.is_active = true
GROUP BY 1
ORDER BY 1 DESC
LIMIT 14;
