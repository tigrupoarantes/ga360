-- Permite que usuários autenticados leiam payroll_verba_pivot diretamente do client
-- Lógica:
--   • Usuário membro da empresa (user_companies) → vê apenas sua empresa
--   • Usuário com role super_admin, ceo ou diretor em QUALQUER empresa → vê todas
--   Isso replica o comportamento da edge function verbas-secure-query sem precisar
--   de service_role para leituras de dados já armazenados.

CREATE POLICY "authenticated_read_payroll_verba_pivot"
  ON public.payroll_verba_pivot FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM user_companies uc
      JOIN roles r ON uc.role_id = r.id
      WHERE uc.user_id = auth.uid()
        AND (
          uc.company_id = payroll_verba_pivot.company_id
          OR r.name IN ('super_admin', 'ceo', 'diretor')
        )
    )
  );
