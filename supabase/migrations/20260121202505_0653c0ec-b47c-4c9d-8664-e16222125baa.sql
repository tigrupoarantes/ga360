-- =====================================================
-- GOVERNANÇA EC - Estrutura de Dados Completa
-- =====================================================

-- 1. TABELA: ec_areas (Sub-áreas do Escritório Central)
CREATE TABLE public.ec_areas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT DEFAULT 'folder',
  "order" INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. TABELA: ec_cards (Templates de Cards)
CREATE TABLE public.ec_cards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  area_id UUID NOT NULL REFERENCES public.ec_areas(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  periodicity_type TEXT NOT NULL DEFAULT 'monthly',
  due_rule_json JSONB DEFAULT '{}',
  responsible_id UUID REFERENCES public.profiles(id),
  backup_id UUID REFERENCES public.profiles(id),
  scope_json JSONB DEFAULT '{}',
  checklist_template_json JSONB DEFAULT '[]',
  required_evidences_json JSONB DEFAULT '[]',
  manual_fields_schema_json JSONB DEFAULT '[]',
  risk_days_threshold INTEGER DEFAULT 3,
  "order" INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. TABELA: ec_card_records (Registros por Período/Competência)
CREATE TABLE public.ec_card_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  card_id UUID NOT NULL REFERENCES public.ec_cards(id) ON DELETE CASCADE,
  competence TEXT NOT NULL,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'pending',
  manual_payload_json JSONB DEFAULT '{}',
  datalake_snapshot_json JSONB DEFAULT '{}',
  checklist_json JSONB DEFAULT '[]',
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES public.profiles(id),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(card_id, competence)
);

-- 4. TABELA: ec_record_evidences (Evidências anexadas)
CREATE TABLE public.ec_record_evidences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  record_id UUID NOT NULL REFERENCES public.ec_card_records(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'file',
  file_path TEXT,
  url TEXT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id)
);

-- 5. TABELA: ec_record_comments (Comentários)
CREATE TABLE public.ec_record_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  record_id UUID NOT NULL REFERENCES public.ec_card_records(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id)
);

-- 6. TABELA: dl_connections (Conexões com API Proxy)
CREATE TABLE public.dl_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'api_proxy',
  base_url TEXT NOT NULL,
  auth_type TEXT DEFAULT 'bearer',
  auth_config_json JSONB DEFAULT '{}',
  headers_json JSONB DEFAULT '{}',
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id)
);

-- 7. TABELA: dl_queries (Queries/Endpoints configurados)
CREATE TABLE public.dl_queries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  connection_id UUID NOT NULL REFERENCES public.dl_connections(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  endpoint_path TEXT NOT NULL,
  method TEXT NOT NULL DEFAULT 'GET',
  params_schema_json JSONB DEFAULT '[]',
  body_template_json JSONB DEFAULT '{}',
  outputs_schema_json JSONB DEFAULT '[]',
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. TABELA: dl_card_bindings (Vínculos Card <-> Query)
CREATE TABLE public.dl_card_bindings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  card_id UUID NOT NULL REFERENCES public.ec_cards(id) ON DELETE CASCADE,
  query_id UUID NOT NULL REFERENCES public.dl_queries(id) ON DELETE CASCADE,
  mapping_json JSONB DEFAULT '[]',
  params_mapping_json JSONB DEFAULT '{}',
  refresh_policy TEXT NOT NULL DEFAULT 'manual',
  cache_ttl_minutes INTEGER DEFAULT 60,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. TABELA: dl_query_runs (Logs de execução)
CREATE TABLE public.dl_query_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  query_id UUID NOT NULL REFERENCES public.dl_queries(id) ON DELETE CASCADE,
  card_id UUID REFERENCES public.ec_cards(id) ON DELETE SET NULL,
  binding_id UUID REFERENCES public.dl_card_bindings(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  params_used_json JSONB DEFAULT '{}',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  duration_ms INTEGER,
  rows_returned INTEGER,
  error_message TEXT,
  response_snapshot_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- ÍNDICES
-- =====================================================

CREATE INDEX idx_ec_cards_area_id ON public.ec_cards(area_id);
CREATE INDEX idx_ec_cards_responsible_id ON public.ec_cards(responsible_id);
CREATE INDEX idx_ec_card_records_card_id ON public.ec_card_records(card_id);
CREATE INDEX idx_ec_card_records_status ON public.ec_card_records(status);
CREATE INDEX idx_ec_card_records_competence ON public.ec_card_records(competence);
CREATE INDEX idx_ec_card_records_due_date ON public.ec_card_records(due_date);
CREATE INDEX idx_ec_record_evidences_record_id ON public.ec_record_evidences(record_id);
CREATE INDEX idx_ec_record_comments_record_id ON public.ec_record_comments(record_id);
CREATE INDEX idx_dl_queries_connection_id ON public.dl_queries(connection_id);
CREATE INDEX idx_dl_card_bindings_card_id ON public.dl_card_bindings(card_id);
CREATE INDEX idx_dl_card_bindings_query_id ON public.dl_card_bindings(query_id);
CREATE INDEX idx_dl_query_runs_query_id ON public.dl_query_runs(query_id);
CREATE INDEX idx_dl_query_runs_status ON public.dl_query_runs(status);

-- =====================================================
-- TRIGGERS para updated_at
-- =====================================================

CREATE TRIGGER update_ec_areas_updated_at
  BEFORE UPDATE ON public.ec_areas
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ec_cards_updated_at
  BEFORE UPDATE ON public.ec_cards
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ec_card_records_updated_at
  BEFORE UPDATE ON public.ec_card_records
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_dl_connections_updated_at
  BEFORE UPDATE ON public.dl_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_dl_queries_updated_at
  BEFORE UPDATE ON public.dl_queries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_dl_card_bindings_updated_at
  BEFORE UPDATE ON public.dl_card_bindings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- RLS - Habilitar
-- =====================================================

ALTER TABLE public.ec_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ec_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ec_card_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ec_record_evidences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ec_record_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dl_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dl_queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dl_card_bindings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dl_query_runs ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- RLS POLICIES - ec_areas
-- =====================================================

CREATE POLICY "Authenticated users can view ec_areas"
  ON public.ec_areas FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Super admin and CEO can manage ec_areas"
  ON public.ec_areas FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'ceo'::app_role));

-- =====================================================
-- RLS POLICIES - ec_cards
-- =====================================================

CREATE POLICY "Authenticated users can view ec_cards"
  ON public.ec_cards FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Super admin and CEO can manage ec_cards"
  ON public.ec_cards FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'ceo'::app_role));

CREATE POLICY "Directors can manage ec_cards"
  ON public.ec_cards FOR ALL
  USING (has_role(auth.uid(), 'diretor'::app_role));

-- =====================================================
-- RLS POLICIES - ec_card_records
-- =====================================================

CREATE POLICY "Authenticated users can view ec_card_records"
  ON public.ec_card_records FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can create ec_card_records"
  ON public.ec_card_records FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Responsibles can update their card records"
  ON public.ec_card_records FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.ec_cards c
      WHERE c.id = ec_card_records.card_id
      AND (c.responsible_id = auth.uid() OR c.backup_id = auth.uid())
    )
    OR has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'ceo'::app_role)
    OR has_role(auth.uid(), 'diretor'::app_role)
  );

CREATE POLICY "Super admin and CEO can delete ec_card_records"
  ON public.ec_card_records FOR DELETE
  USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'ceo'::app_role));

-- =====================================================
-- RLS POLICIES - ec_record_evidences
-- =====================================================

CREATE POLICY "Authenticated users can view ec_record_evidences"
  ON public.ec_record_evidences FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create ec_record_evidences"
  ON public.ec_record_evidences FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Creators can delete their evidences"
  ON public.ec_record_evidences FOR DELETE
  USING (
    created_by = auth.uid()
    OR has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'ceo'::app_role)
  );

-- =====================================================
-- RLS POLICIES - ec_record_comments
-- =====================================================

CREATE POLICY "Authenticated users can view ec_record_comments"
  ON public.ec_record_comments FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create ec_record_comments"
  ON public.ec_record_comments FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Creators can delete their comments"
  ON public.ec_record_comments FOR DELETE
  USING (
    created_by = auth.uid()
    OR has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'ceo'::app_role)
  );

-- =====================================================
-- RLS POLICIES - dl_connections (Admin only)
-- =====================================================

CREATE POLICY "Super admin and CEO can view dl_connections"
  ON public.dl_connections FOR SELECT
  USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'ceo'::app_role));

CREATE POLICY "Super admin and CEO can manage dl_connections"
  ON public.dl_connections FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'ceo'::app_role));

-- =====================================================
-- RLS POLICIES - dl_queries (Admin only)
-- =====================================================

CREATE POLICY "Super admin and CEO can view dl_queries"
  ON public.dl_queries FOR SELECT
  USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'ceo'::app_role));

CREATE POLICY "Super admin and CEO can manage dl_queries"
  ON public.dl_queries FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'ceo'::app_role));

-- =====================================================
-- RLS POLICIES - dl_card_bindings (Admin only)
-- =====================================================

CREATE POLICY "Super admin and CEO can view dl_card_bindings"
  ON public.dl_card_bindings FOR SELECT
  USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'ceo'::app_role));

CREATE POLICY "Super admin and CEO can manage dl_card_bindings"
  ON public.dl_card_bindings FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'ceo'::app_role));

-- =====================================================
-- RLS POLICIES - dl_query_runs (Admin only)
-- =====================================================

CREATE POLICY "Super admin and CEO can view dl_query_runs"
  ON public.dl_query_runs FOR SELECT
  USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'ceo'::app_role));

CREATE POLICY "System can create dl_query_runs"
  ON public.dl_query_runs FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- =====================================================
-- STORAGE BUCKET para evidências
-- =====================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'ec-evidences',
  'ec-evidences',
  false,
  52428800,
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
);

-- Storage policies
CREATE POLICY "Authenticated users can view ec-evidences"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'ec-evidences' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can upload ec-evidences"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'ec-evidences' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete their own ec-evidences"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'ec-evidences' AND auth.uid()::text = (storage.foldername(name))[1]);

-- =====================================================
-- SEED: Áreas iniciais
-- =====================================================

INSERT INTO public.ec_areas (name, slug, description, icon, "order") VALUES
  ('Governança', 'governanca', 'Gestão de governança corporativa', 'shield', 1),
  ('Financeiro', 'financeiro', 'Controles financeiros e contábeis', 'dollar-sign', 2),
  ('Pessoas & Cultura', 'pessoas-cultura', 'Gestão de pessoas e cultura organizacional', 'users', 3),
  ('Jurídico', 'juridico', 'Assuntos jurídicos e compliance', 'scale', 4),
  ('Auditoria', 'auditoria', 'Auditoria interna e controles', 'file-search', 5);