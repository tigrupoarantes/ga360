-- Migration to populate user_permissions and user_companies for existing CEOs/Directors
-- and remove role-based bypasses from has_company_access

DO $$
DECLARE
  r_user RECORD;
  sys_module text;
  -- All modules available in system_module enum
  -- 'dashboard_executivo', 'dashboard_pessoal', 'meetings', 'calendar', 'tasks', 'processes', 'trade', 'reports', 'admin', 'governanca'
  all_modules text[] := ARRAY['dashboard_executivo', 'dashboard_pessoal', 'meetings', 'calendar', 'tasks', 'processes', 'trade', 'reports', 'admin', 'governanca'];
  
  -- Director modules (everything) - Safest approach for migration
  director_modules text[] := ARRAY['dashboard_executivo', 'dashboard_pessoal', 'meetings', 'calendar', 'tasks', 'processes', 'trade', 'reports', 'admin', 'governanca'];
BEGIN
  -- 1. Migrate CEOs
  FOR r_user IN SELECT user_id FROM public.user_roles WHERE role = 'ceo'
  LOOP
    -- Grant all modules
    FOREACH sys_module IN ARRAY all_modules
    LOOP
      INSERT INTO public.user_permissions (user_id, module, can_view, can_create, can_edit, can_delete)
      VALUES (r_user.user_id, sys_module::system_module, true, true, true, true)
      ON CONFLICT (user_id, module) DO NOTHING;
    END LOOP;

    -- Grant all companies access
    IF NOT EXISTS (SELECT 1 FROM public.user_companies WHERE user_id = r_user.user_id AND all_companies = true) THEN
        INSERT INTO public.user_companies (user_id, company_id, all_companies, can_view)
        VALUES (r_user.user_id, NULL, true, true);
    END IF;
  END LOOP;

  -- 2. Migrate Directors
  FOR r_user IN SELECT user_id FROM public.user_roles WHERE role = 'diretor'
  LOOP
    -- Grant director modules
    FOREACH sys_module IN ARRAY director_modules
    LOOP
      INSERT INTO public.user_permissions (user_id, module, can_view, can_create, can_edit, can_delete)
      VALUES (r_user.user_id, sys_module::system_module, true, true, true, true)
      ON CONFLICT (user_id, module) DO NOTHING;
    END LOOP;
    
    -- Directors rely on profile.company_id or explicit manual grants
  END LOOP;
  
END $$;

-- 3. Update has_company_access to remove CEO bypass
CREATE OR REPLACE FUNCTION public.has_company_access(_user_id uuid, _company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    -- Only Super admin has implicit full access to all companies
    has_role(_user_id, 'super_admin')
    -- Or user belongs to this company (profile)
    OR EXISTS (SELECT 1 FROM profiles WHERE id = _user_id AND company_id = _company_id)
    -- Or has "all_companies" permission
    OR EXISTS (
      SELECT 1 FROM user_companies
      WHERE user_id = _user_id 
        AND all_companies = true
        AND can_view = true
    )
    -- Or has specific company permission
    OR EXISTS (
      SELECT 1 FROM user_companies
      WHERE user_id = _user_id 
        AND company_id = _company_id
        AND can_view = true
    )
$$;
