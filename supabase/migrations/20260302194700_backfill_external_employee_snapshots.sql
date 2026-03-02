-- Backfill: cria snapshot inicial (aberto) para funcionários existentes que ainda não possuem histórico.
-- Isso não reconstrói mudanças passadas, mas garante baseline para análises a partir deste ponto.

INSERT INTO public.external_employee_snapshots (
  external_employee_id,
  company_id,
  source_system,
  external_id,
  cpf,
  full_name,
  email,
  department,
  position,
  unidade,
  cod_vendedor,
  is_condutor,
  is_active,
  accounting_group,
  contract_company_id,
  accounting_company_id,
  valid_from,
  changed_fields,
  change_source
)
SELECT
  ee.id,
  ee.company_id,
  COALESCE(ee.source_system, 'unknown') as source_system,
  ee.external_id,
  ee.cpf,
  ee.full_name,
  ee.email,
  ee.department,
  ee.position,
  ee.unidade,
  ee.cod_vendedor,
  ee.is_condutor,
  ee.is_active,
  ee.accounting_group,
  ee.contract_company_id,
  ee.accounting_company_id,
  COALESCE(ee.synced_at, ee.updated_at, ee.created_at, now()) as valid_from,
  ARRAY['__backfill__']::TEXT[] as changed_fields,
  'backfill' as change_source
FROM public.external_employees ee
LEFT JOIN public.external_employee_snapshots open_snap
  ON open_snap.external_employee_id = ee.id
 AND open_snap.valid_to IS NULL
WHERE ee.company_id IS NOT NULL
  AND open_snap.id IS NULL;
