-- Allow super_admin and ceo to insert external employees
CREATE POLICY "Admins can insert external employees"
ON public.external_employees FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'ceo'::app_role)
);

-- Allow super_admin and ceo to update external employees
CREATE POLICY "Admins can update external employees"
ON public.external_employees FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'ceo'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'ceo'::app_role)
);