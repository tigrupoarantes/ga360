-- Remover política antiga
DROP POLICY IF EXISTS "Users can view external employees of their company" ON public.external_employees;

-- Criar nova política que permite admins e CEOs verem todos os funcionários
CREATE POLICY "Users can view external employees"
ON public.external_employees
FOR SELECT
USING (
  -- Admins e CEOs podem ver todos
  public.has_role(auth.uid(), 'super_admin') OR
  public.has_role(auth.uid(), 'ceo') OR
  -- Usuários com acesso a todas empresas podem ver todos
  EXISTS (
    SELECT 1 FROM user_companies uc 
    WHERE uc.user_id = auth.uid() AND uc.all_companies = true
  ) OR
  -- Outros usuários só veem da própria empresa
  company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  )
);