-- Fix RLS de payroll_verba_pivot:
-- Adiciona fallback explícito na user_roles para garantir que super_admin/ceo/diretor
-- vejam TODAS as empresas no select sem filtro de company_id.
-- A policy anterior usava has_role() que pode retornar false se user_roles não estiver
-- populada corretamente. Esta policy adiciona um EXISTS direto em user_roles como
-- mecanismo redundante.

DROP POLICY IF EXISTS "authenticated_read_payroll_verba_pivot" ON public.payroll_verba_pivot;

CREATE POLICY "authenticated_read_payroll_verba_pivot"
  ON public.payroll_verba_pivot
  FOR SELECT
  TO authenticated
  USING (
    -- Membro da empresa específica
    EXISTS (
      SELECT 1
      FROM user_companies uc
      WHERE uc.user_id = auth.uid()
        AND uc.company_id = payroll_verba_pivot.company_id
    )
    -- Role senior via has_role() (função utilitária GA360)
    OR has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'ceo'::app_role)
    OR has_role(auth.uid(), 'diretor'::app_role)
    -- Fallback direto em user_roles (evita dependência exclusiva de has_role())
    OR EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('super_admin'::app_role, 'ceo'::app_role, 'diretor'::app_role)
    )
  );
