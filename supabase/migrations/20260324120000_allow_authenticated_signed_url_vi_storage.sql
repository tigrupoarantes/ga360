-- Permite que usuários autenticados gerem signed URLs para PDFs de verbas indenizatórias.
-- O bucket permanece privado (public = false): o SELECT aqui só habilita createSignedUrl,
-- não torna os objetos publicamente acessíveis.
-- Escrita (INSERT/UPDATE/DELETE) continua restrita ao service_role via policy existente.
CREATE POLICY "authenticated_select_vi_storage"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'verbas-indenizatorias'
    AND auth.role() = 'authenticated'
  );
