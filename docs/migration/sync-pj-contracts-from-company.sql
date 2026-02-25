BEGIN;

DO $$
DECLARE
  v_company_name TEXT := 'contratos';
  v_company_id UUID;
  v_only_active BOOLEAN := true;

  v_employees_found INT := 0;
  v_candidates_after_filter INT := 0;
  v_ready_to_insert INT := 0;
  v_inserted INT := 0;
  v_without_email INT := 0;
  v_without_document INT := 0;
BEGIN
  SELECT c.id
    INTO v_company_id
  FROM public.companies c
  WHERE lower(c.name) = lower(v_company_name)
  LIMIT 1;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Empresa "%" não encontrada em public.companies', v_company_name;
  END IF;

  CREATE TEMP TABLE tmp_source_employees ON COMMIT DROP AS
  SELECT
    ee.id,
    ee.full_name,
    NULLIF(trim(ee.email), '') AS email,
    NULLIF(regexp_replace(COALESCE(ee.cpf, ee.registration_number, ''), '\\D', '', 'g'), '') AS raw_document,
    ee.is_active
  FROM public.external_employees ee
  WHERE ee.contract_company_id = v_company_id
     OR ee.company_id = v_company_id;

  SELECT COUNT(*) INTO v_employees_found
  FROM tmp_source_employees;

  IF v_employees_found = 0 THEN
    RAISE NOTICE 'Nenhum funcionário encontrado para a empresa "%" (%).', v_company_name, v_company_id;
    RETURN;
  END IF;

  CREATE TEMP TABLE tmp_sync_candidates ON COMMIT DROP AS
  SELECT
    e.id,
    e.full_name,
    COALESCE(e.raw_document, 'SEM-DOC-' || e.id::text) AS document_for_insert,
    COALESCE(lower(e.email), 'pj-sem-email+' || e.id::text || '@invalid.local') AS email_for_insert,
    e.email IS NULL AS used_email_fallback,
    e.raw_document IS NULL AS used_document_fallback,
    e.is_active
  FROM tmp_source_employees e
  WHERE (NOT v_only_active) OR COALESCE(e.is_active, true);

  SELECT COUNT(*) INTO v_candidates_after_filter
  FROM tmp_sync_candidates;

  SELECT COUNT(*) INTO v_without_email
  FROM tmp_sync_candidates
  WHERE used_email_fallback;

  SELECT COUNT(*) INTO v_without_document
  FROM tmp_sync_candidates
  WHERE used_document_fallback;

  CREATE TEMP TABLE tmp_to_insert ON COMMIT DROP AS
  SELECT c.*
  FROM tmp_sync_candidates c
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.pj_contracts p
    WHERE p.company_id = v_company_id
      AND (
        lower(p.document) = lower(c.document_for_insert)
        OR lower(p.email) = lower(c.email_for_insert)
      )
  );

  SELECT COUNT(*) INTO v_ready_to_insert
  FROM tmp_to_insert;

  INSERT INTO public.pj_contracts (
    company_id,
    name,
    document,
    email,
    status,
    created_at,
    updated_at
  )
  SELECT
    v_company_id,
    t.full_name,
    t.document_for_insert,
    t.email_for_insert,
    'active',
    now(),
    now()
  FROM tmp_to_insert t;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  RAISE NOTICE 'Empresa alvo: % (%)', v_company_name, v_company_id;
  RAISE NOTICE 'Funcionários encontrados na fonte: %', v_employees_found;
  RAISE NOTICE 'Candidatos após filtro de ativos: %', v_candidates_after_filter;
  RAISE NOTICE 'Já existentes (não inseridos): %', v_candidates_after_filter - v_ready_to_insert;
  RAISE NOTICE 'Inseridos agora em pj_contracts: %', v_inserted;
  RAISE NOTICE 'Sem email (fallback aplicado): %', v_without_email;
  RAISE NOTICE 'Sem documento (fallback aplicado): %', v_without_document;
END $$;

COMMIT;
