-- Corrige RLS de payroll_verba_pivot:
-- A policy anterior só liberava acesso se o usuário estava em user_companies para aquela empresa.
-- Super_admins não têm user_companies para TODAS as empresas, então viam [] nas queries diretas.
-- Nova lógica: membro da empresa OU role senior (via has_role + app_role enum) → acesso total.
-- Usa has_role() e public.user_roles (user_id, role app_role) — NÃO existe tabela "roles".

DROP POLICY IF EXISTS "authenticated_read_payroll_verba_pivot" ON public.payroll_verba_pivot;

CREATE POLICY "authenticated_read_payroll_verba_pivot"
  ON public.payroll_verba_pivot
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM user_companies uc
      WHERE uc.user_id = auth.uid()
        AND uc.company_id = payroll_verba_pivot.company_id
    )
    OR has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'ceo'::app_role)
    OR has_role(auth.uid(), 'diretor'::app_role)
  );
