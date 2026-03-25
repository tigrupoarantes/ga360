-- Reverte a abertura de DELETE direto para clientes autenticados no módulo de
-- verbas indenizatórias. A exclusão volta a ser orquestrada apenas por
-- service_role via Edge Function autorizada.

DROP POLICY IF EXISTS "owner_delete_vi_documents"
  ON public.verba_indenizatoria_documents;

DROP POLICY IF EXISTS "authenticated_delete_vi_storage"
  ON storage.objects;
