-- Create companies table
CREATE TABLE public.companies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  cnpj TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  logo_url TEXT,
  color TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- RLS Policies for companies
CREATE POLICY "Authenticated users can view companies"
ON public.companies
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Only CEO can insert companies"
ON public.companies
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'ceo'::app_role));

CREATE POLICY "Only CEO can update companies"
ON public.companies
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'ceo'::app_role));

CREATE POLICY "Only CEO can delete companies"
ON public.companies
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'ceo'::app_role));

-- Add company_id to areas table
ALTER TABLE public.areas
ADD COLUMN company_id UUID REFERENCES public.companies(id);

-- Add company_id to meeting_rooms table
ALTER TABLE public.meeting_rooms
ADD COLUMN company_id UUID REFERENCES public.companies(id);

-- Add company_id to profiles table
ALTER TABLE public.profiles
ADD COLUMN company_id UUID REFERENCES public.companies(id);

-- Add trigger for companies updated_at
CREATE TRIGGER update_companies_updated_at
BEFORE UPDATE ON public.companies
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();