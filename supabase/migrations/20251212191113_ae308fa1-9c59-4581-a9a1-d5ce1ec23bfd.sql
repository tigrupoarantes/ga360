-- Tabela de tipos de meta por empresa
CREATE TABLE public.goal_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  unit TEXT,
  calculation_type TEXT DEFAULT 'sum',
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de metas
CREATE TABLE public.goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  goal_type_id UUID REFERENCES public.goal_types(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  target_value NUMERIC NOT NULL,
  current_value NUMERIC DEFAULT 0,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  period_type TEXT DEFAULT 'monthly',
  area_id UUID REFERENCES public.areas(id) ON DELETE SET NULL,
  responsible_id UUID REFERENCES auth.users(id),
  status TEXT DEFAULT 'active',
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de lançamentos de valores
CREATE TABLE public.goal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID REFERENCES public.goals(id) ON DELETE CASCADE NOT NULL,
  entry_date DATE NOT NULL,
  value NUMERIC NOT NULL,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de templates de importação CSV
CREATE TABLE public.csv_import_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  column_mapping JSONB NOT NULL,
  delimiter TEXT DEFAULT ',',
  has_header BOOLEAN DEFAULT true,
  date_format TEXT DEFAULT 'YYYY-MM-DD',
  is_default BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.goal_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.csv_import_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for goal_types
CREATE POLICY "Authenticated users can view goal types"
ON public.goal_types FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "CEO and Directors can manage goal types"
ON public.goal_types FOR ALL
USING (has_role(auth.uid(), 'ceo') OR has_role(auth.uid(), 'diretor') OR has_role(auth.uid(), 'super_admin'));

-- RLS Policies for goals
CREATE POLICY "Authenticated users can view goals"
ON public.goals FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "CEO and Directors can manage goals"
ON public.goals FOR ALL
USING (has_role(auth.uid(), 'ceo') OR has_role(auth.uid(), 'diretor') OR has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Managers can create and update goals"
ON public.goals FOR INSERT
WITH CHECK (has_role(auth.uid(), 'gerente') OR has_role(auth.uid(), 'ceo') OR has_role(auth.uid(), 'diretor') OR has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Managers can update goals"
ON public.goals FOR UPDATE
USING (has_role(auth.uid(), 'gerente') OR has_role(auth.uid(), 'ceo') OR has_role(auth.uid(), 'diretor') OR has_role(auth.uid(), 'super_admin'));

-- RLS Policies for goal_entries
CREATE POLICY "Authenticated users can view goal entries"
ON public.goal_entries FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Managers and above can create entries"
ON public.goal_entries FOR INSERT
WITH CHECK (has_role(auth.uid(), 'gerente') OR has_role(auth.uid(), 'ceo') OR has_role(auth.uid(), 'diretor') OR has_role(auth.uid(), 'super_admin'));

CREATE POLICY "CEO and Directors can manage entries"
ON public.goal_entries FOR ALL
USING (has_role(auth.uid(), 'ceo') OR has_role(auth.uid(), 'diretor') OR has_role(auth.uid(), 'super_admin'));

-- RLS Policies for csv_import_templates
CREATE POLICY "Authenticated users can view templates"
ON public.csv_import_templates FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "CEO and Directors can manage templates"
ON public.csv_import_templates FOR ALL
USING (has_role(auth.uid(), 'ceo') OR has_role(auth.uid(), 'diretor') OR has_role(auth.uid(), 'super_admin'));

-- Triggers for updated_at
CREATE TRIGGER update_goal_types_updated_at
BEFORE UPDATE ON public.goal_types
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_goals_updated_at
BEFORE UPDATE ON public.goals
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_csv_import_templates_updated_at
BEFORE UPDATE ON public.csv_import_templates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();