-- Atualizar políticas RLS para incluir super_admin

-- Tabela: companies
DROP POLICY IF EXISTS "Only CEO can insert companies" ON public.companies;
CREATE POLICY "Only CEO can insert companies" 
ON public.companies 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'ceo'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "Only CEO can update companies" ON public.companies;
CREATE POLICY "Only CEO can update companies" 
ON public.companies 
FOR UPDATE 
USING (has_role(auth.uid(), 'ceo'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "Only CEO can delete companies" ON public.companies;
CREATE POLICY "Only CEO can delete companies" 
ON public.companies 
FOR DELETE 
USING (has_role(auth.uid(), 'ceo'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- Tabela: areas
DROP POLICY IF EXISTS "Only CEO can insert areas" ON public.areas;
CREATE POLICY "Only CEO can insert areas" 
ON public.areas 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'ceo'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "Only CEO can update areas" ON public.areas;
CREATE POLICY "Only CEO can update areas" 
ON public.areas 
FOR UPDATE 
USING (has_role(auth.uid(), 'ceo'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "Only CEO can delete areas" ON public.areas;
CREATE POLICY "Only CEO can delete areas" 
ON public.areas 
FOR DELETE 
USING (has_role(auth.uid(), 'ceo'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- Tabela: meeting_rooms
DROP POLICY IF EXISTS "CEO can manage meeting rooms" ON public.meeting_rooms;
CREATE POLICY "CEO can manage meeting rooms" 
ON public.meeting_rooms 
FOR ALL 
USING (has_role(auth.uid(), 'ceo'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- Tabela: meetings
DROP POLICY IF EXISTS "CEO can delete meetings" ON public.meetings;
CREATE POLICY "CEO can delete meetings" 
ON public.meetings 
FOR DELETE 
USING (has_role(auth.uid(), 'ceo'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- Tabela: user_roles
DROP POLICY IF EXISTS "CEO can view all roles" ON public.user_roles;
CREATE POLICY "CEO can view all roles" 
ON public.user_roles 
FOR SELECT 
USING (has_role(auth.uid(), 'ceo'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "Only CEO can insert roles" ON public.user_roles;
CREATE POLICY "Only CEO can insert roles" 
ON public.user_roles 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'ceo'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "Only CEO can update roles" ON public.user_roles;
CREATE POLICY "Only CEO can update roles" 
ON public.user_roles 
FOR UPDATE 
USING (has_role(auth.uid(), 'ceo'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "Only CEO can delete roles" ON public.user_roles;
CREATE POLICY "Only CEO can delete roles" 
ON public.user_roles 
FOR DELETE 
USING (has_role(auth.uid(), 'ceo'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- Tabela: profiles
DROP POLICY IF EXISTS "CEO can view all profiles" ON public.profiles;
CREATE POLICY "CEO can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (has_role(auth.uid(), 'ceo'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "CEO can update all profiles" ON public.profiles;
CREATE POLICY "CEO can update all profiles" 
ON public.profiles 
FOR UPDATE 
USING (has_role(auth.uid(), 'ceo'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));