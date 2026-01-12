-- Tabela para armazenar funcionários sincronizados de sistemas externos
CREATE TABLE public.external_employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  
  -- Identificador único no sistema de origem
  external_id TEXT NOT NULL,
  source_system TEXT DEFAULT 'gestao_ativos',
  
  -- Dados do funcionário
  registration_number TEXT,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  department TEXT,
  position TEXT,
  hire_date DATE,
  is_active BOOLEAN DEFAULT true,
  
  -- Dados adicionais em JSON para flexibilidade
  metadata JSONB,
  
  -- Controle de sincronização
  synced_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Constraint de unicidade por empresa + external_id + source_system
  UNIQUE(company_id, external_id, source_system)
);

-- Índices para performance
CREATE INDEX idx_external_employees_company ON public.external_employees(company_id);
CREATE INDEX idx_external_employees_external_id ON public.external_employees(external_id);
CREATE INDEX idx_external_employees_active ON public.external_employees(is_active);
CREATE INDEX idx_external_employees_department ON public.external_employees(department);
CREATE INDEX idx_external_employees_source ON public.external_employees(source_system);

-- Habilitar RLS
ALTER TABLE public.external_employees ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Users can view external employees of their company"
  ON public.external_employees FOR SELECT
  USING (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Service role can manage external employees"
  ON public.external_employees FOR ALL
  USING (auth.role() = 'service_role');

-- Trigger para atualizar updated_at
CREATE TRIGGER update_external_employees_updated_at
  BEFORE UPDATE ON public.external_employees
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();