-- Permite que o criador do documento exclua o próprio registro (fase de testes).
-- A política de leitura/escrita permanece restrita ao service_role.
CREATE POLICY "owner_delete_vi_documents"
  ON public.verba_indenizatoria_documents FOR DELETE
  USING (created_by = auth.uid());

-- Permite que usuários autenticados excluam arquivos do bucket (necessário para remover o PDF do Storage).
CREATE POLICY "authenticated_delete_vi_storage"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'verbas-indenizatorias'
    AND auth.role() = 'authenticated'
  );
