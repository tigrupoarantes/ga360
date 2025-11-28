-- Create trade_industries table (Indústrias/Fornecedores)
CREATE TABLE public.trade_industries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  cnpj text,
  contact_name text,
  contact_email text,
  contact_phone text,
  logo_url text,
  is_active boolean DEFAULT true,
  company_id uuid REFERENCES public.companies(id),
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create trade_materials table (Catálogo de Materiais)
CREATE TABLE public.trade_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  category text NOT NULL,
  industry_id uuid REFERENCES public.trade_industries(id) ON DELETE CASCADE,
  unit text DEFAULT 'unidade',
  image_url text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create trade_inventory_movements table (Movimentações de Estoque)
CREATE TABLE public.trade_inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id uuid REFERENCES public.trade_materials(id) ON DELETE CASCADE NOT NULL,
  movement_type text NOT NULL CHECK (movement_type IN ('entrada', 'saida', 'ajuste')),
  quantity integer NOT NULL,
  unit_cost decimal(10,2),
  reference_number text,
  notes text,
  movement_date date NOT NULL DEFAULT CURRENT_DATE,
  received_by uuid,
  company_id uuid REFERENCES public.companies(id),
  created_by uuid,
  created_at timestamptz DEFAULT now()
);

-- Create view for inventory balance
CREATE OR REPLACE VIEW public.trade_inventory_balance AS
SELECT 
  m.id as material_id,
  m.name as material_name,
  m.category,
  m.unit,
  m.image_url as material_image,
  i.id as industry_id,
  i.name as industry_name,
  i.logo_url as industry_logo,
  COALESCE(SUM(mov.quantity), 0) as current_stock,
  MAX(mov.movement_date) as last_movement,
  mov.company_id
FROM public.trade_materials m
LEFT JOIN public.trade_industries i ON m.industry_id = i.id
LEFT JOIN public.trade_inventory_movements mov ON mov.material_id = m.id
WHERE m.is_active = true
GROUP BY m.id, m.name, m.category, m.unit, m.image_url, i.id, i.name, i.logo_url, mov.company_id;

-- Enable RLS
ALTER TABLE public.trade_industries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_inventory_movements ENABLE ROW LEVEL SECURITY;

-- RLS Policies for trade_industries
CREATE POLICY "Authenticated users can view industries"
ON public.trade_industries FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "CEO and Directors can manage industries"
ON public.trade_industries FOR ALL
USING (has_role(auth.uid(), 'ceo'::app_role) OR has_role(auth.uid(), 'diretor'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- RLS Policies for trade_materials
CREATE POLICY "Authenticated users can view materials"
ON public.trade_materials FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "CEO and Directors can manage materials"
ON public.trade_materials FOR ALL
USING (has_role(auth.uid(), 'ceo'::app_role) OR has_role(auth.uid(), 'diretor'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- RLS Policies for trade_inventory_movements
CREATE POLICY "Authenticated users can view movements"
ON public.trade_inventory_movements FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Managers and above can create movements"
ON public.trade_inventory_movements FOR INSERT
WITH CHECK (has_role(auth.uid(), 'ceo'::app_role) OR has_role(auth.uid(), 'diretor'::app_role) OR has_role(auth.uid(), 'gerente'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "CEO and Directors can manage movements"
ON public.trade_inventory_movements FOR ALL
USING (has_role(auth.uid(), 'ceo'::app_role) OR has_role(auth.uid(), 'diretor'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- Triggers for updated_at
CREATE TRIGGER update_trade_industries_updated_at
BEFORE UPDATE ON public.trade_industries
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_trade_materials_updated_at
BEFORE UPDATE ON public.trade_materials
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();