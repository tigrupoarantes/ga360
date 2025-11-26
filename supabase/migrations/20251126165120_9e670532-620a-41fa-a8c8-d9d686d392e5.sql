-- Create enum for system modules
CREATE TYPE public.system_module AS ENUM (
  'dashboard_executivo',
  'dashboard_pessoal', 
  'meetings',
  'calendar',
  'tasks',
  'processes',
  'trade',
  'reports',
  'admin'
);

-- Create user_permissions table for granular access control
CREATE TABLE public.user_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module system_module NOT NULL,
  can_view BOOLEAN NOT NULL DEFAULT false,
  can_create BOOLEAN NOT NULL DEFAULT false,
  can_edit BOOLEAN NOT NULL DEFAULT false,
  can_delete BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, module)
);

-- Enable RLS
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

-- Only super_admin can view all permissions
CREATE POLICY "Super admin can view all permissions"
ON public.user_permissions
FOR SELECT
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Only super_admin can manage permissions
CREATE POLICY "Super admin can manage all permissions"
ON public.user_permissions
FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Users can view their own permissions
CREATE POLICY "Users can view own permissions"
ON public.user_permissions
FOR SELECT
USING (auth.uid() = user_id);

-- Create function to check user permission
CREATE OR REPLACE FUNCTION public.has_permission(
  _user_id UUID,
  _module system_module,
  _action TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN _action = 'view' THEN COALESCE(can_view, false)
    WHEN _action = 'create' THEN COALESCE(can_create, false)
    WHEN _action = 'edit' THEN COALESCE(can_edit, false)
    WHEN _action = 'delete' THEN COALESCE(can_delete, false)
    ELSE false
  END
  FROM public.user_permissions
  WHERE user_id = _user_id AND module = _module
  LIMIT 1
$$;

-- Create trigger for updated_at
CREATE TRIGGER update_user_permissions_updated_at
  BEFORE UPDATE ON public.user_permissions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();