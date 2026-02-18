-- Update has_permission function to include role-based inheritance
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
  WITH user_role_check AS (
    SELECT role FROM public.user_roles WHERE user_id = _user_id LIMIT 1
  )
  SELECT 
    CASE 
      -- Super Admin and CEO have full access to everything
      WHEN EXISTS (
        SELECT 1 FROM user_role_check 
        WHERE role IN ('super_admin'::app_role, 'ceo'::app_role)
      ) THEN true
      
      -- For other roles, check specific permissions
      ELSE (
        SELECT 
          CASE
            WHEN _action = 'view' THEN COALESCE(can_view, false)
            WHEN _action = 'create' THEN COALESCE(can_create, false)
            WHEN _action = 'edit' THEN COALESCE(can_edit, false)
            WHEN _action = 'delete' THEN COALESCE(can_delete, false)
            ELSE false
          END
        FROM public.user_permissions
        WHERE user_id = _user_id AND module = _module
        LIMIT 1
      )
    END
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.has_permission(UUID, system_module, TEXT) TO authenticated;
