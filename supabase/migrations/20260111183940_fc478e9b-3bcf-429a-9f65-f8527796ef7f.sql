-- Tabela principal de processos
CREATE TABLE public.processes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  area_id UUID REFERENCES public.areas(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'biweekly', 'monthly')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de itens do checklist (template)
CREATE TABLE public.process_checklist_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  process_id UUID NOT NULL REFERENCES public.processes(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  is_required BOOLEAN NOT NULL DEFAULT false,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de responsáveis pelo processo
CREATE TABLE public.process_responsibles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  process_id UUID NOT NULL REFERENCES public.processes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(process_id, user_id)
);

-- Tabela de execuções de processos
CREATE TABLE public.process_executions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  process_id UUID NOT NULL REFERENCES public.processes(id) ON DELETE CASCADE,
  executed_by UUID,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de itens executados
CREATE TABLE public.process_execution_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  execution_id UUID NOT NULL REFERENCES public.process_executions(id) ON DELETE CASCADE,
  checklist_item_id UUID NOT NULL REFERENCES public.process_checklist_items(id) ON DELETE CASCADE,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  completed_by UUID
);

-- Índices para otimização
CREATE INDEX idx_processes_company_id ON public.processes(company_id);
CREATE INDEX idx_processes_area_id ON public.processes(area_id);
CREATE INDEX idx_processes_is_active ON public.processes(is_active);
CREATE INDEX idx_process_checklist_items_process_id ON public.process_checklist_items(process_id);
CREATE INDEX idx_process_responsibles_process_id ON public.process_responsibles(process_id);
CREATE INDEX idx_process_responsibles_user_id ON public.process_responsibles(user_id);
CREATE INDEX idx_process_executions_process_id ON public.process_executions(process_id);
CREATE INDEX idx_process_executions_status ON public.process_executions(status);
CREATE INDEX idx_process_execution_items_execution_id ON public.process_execution_items(execution_id);

-- Enable RLS
ALTER TABLE public.processes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.process_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.process_responsibles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.process_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.process_execution_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies para processes
CREATE POLICY "Users can view processes from their company"
  ON public.processes FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.profiles WHERE id = auth.uid()
      UNION
      SELECT company_id FROM public.user_companies WHERE user_id = auth.uid() AND can_view = true
      UNION
      SELECT id FROM public.companies WHERE EXISTS (
        SELECT 1 FROM public.user_companies WHERE user_id = auth.uid() AND all_companies = true
      )
    )
  );

CREATE POLICY "Users can create processes"
  ON public.processes FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update processes they created or are responsible for"
  ON public.processes FOR UPDATE
  USING (
    created_by = auth.uid() OR
    EXISTS (SELECT 1 FROM public.process_responsibles WHERE process_id = id AND user_id = auth.uid())
  );

CREATE POLICY "Users can delete processes they created"
  ON public.processes FOR DELETE
  USING (created_by = auth.uid());

-- RLS Policies para process_checklist_items
CREATE POLICY "Users can view checklist items of accessible processes"
  ON public.process_checklist_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.processes p
      WHERE p.id = process_id
      AND p.company_id IN (
        SELECT company_id FROM public.profiles WHERE id = auth.uid()
        UNION
        SELECT company_id FROM public.user_companies WHERE user_id = auth.uid() AND can_view = true
        UNION
        SELECT id FROM public.companies WHERE EXISTS (
          SELECT 1 FROM public.user_companies WHERE user_id = auth.uid() AND all_companies = true
        )
      )
    )
  );

CREATE POLICY "Users can manage checklist items"
  ON public.process_checklist_items FOR ALL
  USING (auth.uid() IS NOT NULL);

-- RLS Policies para process_responsibles
CREATE POLICY "Users can view responsibles of accessible processes"
  ON public.process_responsibles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.processes p
      WHERE p.id = process_id
      AND p.company_id IN (
        SELECT company_id FROM public.profiles WHERE id = auth.uid()
        UNION
        SELECT company_id FROM public.user_companies WHERE user_id = auth.uid() AND can_view = true
        UNION
        SELECT id FROM public.companies WHERE EXISTS (
          SELECT 1 FROM public.user_companies WHERE user_id = auth.uid() AND all_companies = true
        )
      )
    )
  );

CREATE POLICY "Users can manage responsibles"
  ON public.process_responsibles FOR ALL
  USING (auth.uid() IS NOT NULL);

-- RLS Policies para process_executions
CREATE POLICY "Users can view executions of accessible processes"
  ON public.process_executions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.processes p
      WHERE p.id = process_id
      AND p.company_id IN (
        SELECT company_id FROM public.profiles WHERE id = auth.uid()
        UNION
        SELECT company_id FROM public.user_companies WHERE user_id = auth.uid() AND can_view = true
        UNION
        SELECT id FROM public.companies WHERE EXISTS (
          SELECT 1 FROM public.user_companies WHERE user_id = auth.uid() AND all_companies = true
        )
      )
    )
  );

CREATE POLICY "Users can create executions"
  ON public.process_executions FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their own executions"
  ON public.process_executions FOR UPDATE
  USING (executed_by = auth.uid());

-- RLS Policies para process_execution_items
CREATE POLICY "Users can view execution items"
  ON public.process_execution_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.process_executions e
      JOIN public.processes p ON p.id = e.process_id
      WHERE e.id = execution_id
      AND p.company_id IN (
        SELECT company_id FROM public.profiles WHERE id = auth.uid()
        UNION
        SELECT company_id FROM public.user_companies WHERE user_id = auth.uid() AND can_view = true
        UNION
        SELECT id FROM public.companies WHERE EXISTS (
          SELECT 1 FROM public.user_companies WHERE user_id = auth.uid() AND all_companies = true
        )
      )
    )
  );

CREATE POLICY "Users can manage execution items"
  ON public.process_execution_items FOR ALL
  USING (auth.uid() IS NOT NULL);

-- Trigger para updated_at
CREATE TRIGGER update_processes_updated_at
  BEFORE UPDATE ON public.processes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();