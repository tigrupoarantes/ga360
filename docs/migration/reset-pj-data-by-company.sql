BEGIN;

DO $$
DECLARE
  v_company_id UUID := NULL;
  v_contracts_deleted INT := 0;
  v_storage_deleted INT := 0;
BEGIN
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Defina v_company_id com o UUID da empresa antes de executar o script';
  END IF;

  CREATE TEMP TABLE tmp_pj_contracts_to_delete ON COMMIT DROP AS
  SELECT id
  FROM public.pj_contracts
  WHERE company_id = v_company_id;

  IF NOT EXISTS (SELECT 1 FROM tmp_pj_contracts_to_delete) THEN
    RAISE NOTICE 'Nenhum contrato PJ encontrado para company_id=%', v_company_id;
    RETURN;
  END IF;

  DELETE FROM storage.objects so
  USING tmp_pj_contracts_to_delete t
  WHERE so.bucket_id = 'holerites'
    AND so.name LIKE t.id::TEXT || '/%';
  GET DIAGNOSTICS v_storage_deleted = ROW_COUNT;

  DELETE FROM public.pj_contracts c
  USING tmp_pj_contracts_to_delete t
  WHERE c.id = t.id;
  GET DIAGNOSTICS v_contracts_deleted = ROW_COUNT;

  RAISE NOTICE 'Contratos PJ removidos: %', v_contracts_deleted;
  RAISE NOTICE 'Arquivos de holerite removidos: %', v_storage_deleted;
END $$;

COMMIT;
