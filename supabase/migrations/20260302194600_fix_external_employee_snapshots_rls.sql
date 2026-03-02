-- Alinhar visibilidade do histórico com external_employees.

DROP POLICY IF EXISTS "Users can view external employee snapshots of their company" ON public.external_employee_snapshots;

CREATE POLICY "Users can view external employee snapshots"
ON public.external_employee_snapshots
FOR SELECT
USING (
  public.has_role(auth.uid(), 'super_admin') OR
  public.has_role(auth.uid(), 'ceo') OR
  EXISTS (
    SELECT 1 FROM user_companies uc
    WHERE uc.user_id = auth.uid() AND uc.all_companies = true
  ) OR
  company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  )
);
