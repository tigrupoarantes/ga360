CREATE POLICY "Admins can delete external employees"
ON public.external_employees
FOR DELETE
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR has_role(auth.uid(), 'ceo'::app_role)
);