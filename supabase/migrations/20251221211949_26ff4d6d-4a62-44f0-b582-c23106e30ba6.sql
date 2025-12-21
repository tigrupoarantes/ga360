-- Atualizar política de INSERT para incluir super_admin
DROP POLICY IF EXISTS "CEO and Directors can create meetings" ON meetings;

CREATE POLICY "CEO Directors and Super Admin can create meetings" 
ON meetings
FOR INSERT 
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'ceo'::app_role) OR 
  has_role(auth.uid(), 'diretor'::app_role) OR 
  has_role(auth.uid(), 'super_admin'::app_role)
);

-- Atualizar política de UPDATE para incluir super_admin
DROP POLICY IF EXISTS "CEO and Directors can update meetings" ON meetings;

CREATE POLICY "CEO Directors and Super Admin can update meetings" 
ON meetings
FOR UPDATE 
TO authenticated
USING (
  has_role(auth.uid(), 'ceo'::app_role) OR 
  has_role(auth.uid(), 'diretor'::app_role) OR 
  has_role(auth.uid(), 'super_admin'::app_role)
);

-- Atualizar política de DELETE para incluir super_admin (confirmar consistência)
DROP POLICY IF EXISTS "CEO can delete meetings" ON meetings;

CREATE POLICY "CEO and Super Admin can delete meetings" 
ON meetings
FOR DELETE 
TO authenticated
USING (
  has_role(auth.uid(), 'ceo'::app_role) OR 
  has_role(auth.uid(), 'super_admin'::app_role)
);