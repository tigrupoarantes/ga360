-- Create user_companies table for granular company permissions
CREATE TABLE public.user_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  all_companies BOOLEAN DEFAULT false,
  can_view BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT user_companies_unique UNIQUE(user_id, company_id)
);

-- Add comment
COMMENT ON TABLE public.user_companies IS 'Granular company access permissions for users';

-- Enable RLS
ALTER TABLE public.user_companies ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Super admin and CEO can manage user_companies"
ON public.user_companies
FOR ALL
USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'ceo'));

CREATE POLICY "Users can view their own company permissions"
ON public.user_companies
FOR SELECT
USING (auth.uid() = user_id);

-- Create function to check company access
CREATE OR REPLACE FUNCTION public.has_company_access(_user_id uuid, _company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    -- Super admin and CEO can access all companies
    has_role(_user_id, 'super_admin') OR has_role(_user_id, 'ceo')
    -- Or user belongs to this company
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

-- Add trigger for updated_at
CREATE TRIGGER update_user_companies_updated_at
  BEFORE UPDATE ON public.user_companies
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();