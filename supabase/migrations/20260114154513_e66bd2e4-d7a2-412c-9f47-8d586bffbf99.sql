-- Function to count convertible employees (with email and not linked)
CREATE OR REPLACE FUNCTION public.count_convertible_employees(p_company_id uuid DEFAULT NULL)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INTEGER
  FROM public.external_employees
  WHERE email IS NOT NULL 
    AND email != ''
    AND linked_profile_id IS NULL
    AND is_active = true
    AND (p_company_id IS NULL OR company_id = p_company_id)
$$;