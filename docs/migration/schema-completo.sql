-- ============================================================================
-- GA 360 - SCHEMA COMPLETO PARA MIGRAÇÃO
-- Gerado em: 2026-01-30
-- ============================================================================
-- INSTRUÇÕES:
-- 1. Execute este script no SQL Editor do seu Supabase externo
-- 2. Certifique-se de executar na ordem correta (types → tables → functions → triggers → policies)
-- 3. Após executar, configure os secrets no painel do Supabase
-- ============================================================================

-- ============================================================================
-- 1. TIPOS ENUMERADOS (ENUMS)
-- ============================================================================

CREATE TYPE public.app_role AS ENUM ('super_admin', 'ceo', 'diretor', 'gerente', 'colaborador');

CREATE TYPE public.system_module AS ENUM (
  'dashboard_executivo',
  'dashboard_pessoal', 
  'meetings',
  'calendar',
  'tasks',
  'processes',
  'trade',
  'reports',
  'admin'
);

-- ============================================================================
-- 2. TABELAS PRINCIPAIS (CRIADAS PRIMEIRO)
-- ============================================================================

-- Tabela de Empresas
CREATE TABLE public.companies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  cnpj TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  logo_url TEXT,
  color TEXT,
  external_id TEXT,
  is_auditable BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de Áreas
CREATE TABLE public.areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  parent_id UUID REFERENCES public.areas(id) ON DELETE SET NULL,
  company_id UUID REFERENCES public.companies(id),
  cost_center TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de Perfis
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT,
  last_name TEXT,
  area_id UUID REFERENCES public.areas(id) ON DELETE SET NULL,
  company_id UUID REFERENCES public.companies(id),
  avatar_url TEXT,
  phone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de Roles (CRIADA ANTES DAS FUNÇÕES QUE A REFERENCIAM)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (user_id, role),
  CONSTRAINT user_roles_user_id_unique UNIQUE (user_id)
);

-- Tabela de Permissões por Módulo
CREATE TABLE public.user_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module system_module NOT NULL,
  can_view BOOLEAN NOT NULL DEFAULT false,
  can_create BOOLEAN NOT NULL DEFAULT false,
  can_edit BOOLEAN NOT NULL DEFAULT false,
  can_delete BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, module)
);

-- Tabela de Acesso a Empresas
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

-- Tabela de Configurações do Sistema
CREATE TABLE public.system_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value jsonb NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================================================
-- 3. FUNÇÕES UTILITÁRIAS (APÓS AS TABELAS)
-- ============================================================================

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Função para verificar role do usuário
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- ============================================================================
-- 4. SALAS E REUNIÕES
-- ============================================================================

CREATE TABLE public.meeting_rooms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  company TEXT NOT NULL,
  team TEXT NOT NULL,
  teams_link TEXT NOT NULL,
  description TEXT,
  platform TEXT DEFAULT 'teams' CHECK (platform IN ('teams', 'zoom', 'google_meet')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  company_id UUID REFERENCES public.companies(id),
  area_id UUID REFERENCES public.areas(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.meetings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('Estratégica', 'Tática', 'Operacional', 'Trade')),
  area_id UUID REFERENCES public.areas(id),
  meeting_room_id UUID REFERENCES public.meeting_rooms(id),
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  status TEXT NOT NULL DEFAULT 'Agendada' CHECK (status IN ('Agendada', 'Em Andamento', 'Concluída', 'Cancelada')),
  ai_mode TEXT NOT NULL DEFAULT 'Opcional' CHECK (ai_mode IN ('Obrigatória', 'Opcional', 'Desativada')),
  recurrence_type TEXT DEFAULT 'none',
  recurrence_end_date DATE,
  parent_meeting_id UUID REFERENCES public.meetings(id) ON DELETE CASCADE,
  recurrence_index INTEGER DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.meeting_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  attended BOOLEAN NOT NULL DEFAULT false,
  confirmation_status TEXT DEFAULT 'pending',
  confirmation_token UUID DEFAULT gen_random_uuid(),
  confirmed_at TIMESTAMPTZ,
  confirmation_reminder_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.meeting_transcriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  content TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.meeting_atas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  summary TEXT,
  decisions JSONB,
  action_items JSONB,
  content TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'archived')),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.meeting_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  ata_id UUID REFERENCES public.meeting_atas(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  assignee_id UUID REFERENCES auth.users(id),
  due_date DATE,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.meeting_reminders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  reminder_type TEXT NOT NULL CHECK (reminder_type IN ('1_day', '1_hour')),
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(meeting_id, reminder_type)
);

CREATE TABLE public.meeting_agendas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ============================================================================
-- 5. METAS E OBJETIVOS
-- ============================================================================

CREATE TABLE public.distributors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL,
  name TEXT NOT NULL,
  code TEXT,
  region TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id, external_id)
);

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

CREATE TABLE public.goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  goal_type_id UUID REFERENCES public.goal_types(id) ON DELETE SET NULL,
  distributor_id UUID REFERENCES public.distributors(id),
  name TEXT NOT NULL,
  target_value NUMERIC NOT NULL,
  current_value NUMERIC DEFAULT 0,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  period_type TEXT DEFAULT 'monthly',
  metric_type TEXT DEFAULT 'value',
  product_filter TEXT,
  auto_calculate BOOLEAN DEFAULT false,
  last_calculated_at TIMESTAMPTZ,
  area_id UUID REFERENCES public.areas(id) ON DELETE SET NULL,
  responsible_id UUID REFERENCES auth.users(id),
  status TEXT DEFAULT 'active',
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.goal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID REFERENCES public.goals(id) ON DELETE CASCADE NOT NULL,
  entry_date DATE NOT NULL,
  value NUMERIC NOT NULL,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

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

-- ============================================================================
-- 6. OKRs
-- ============================================================================

CREATE TABLE public.okr_objectives (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id),
  area_id UUID REFERENCES public.areas(id),
  owner_id UUID REFERENCES auth.users(id),
  parent_id UUID REFERENCES public.okr_objectives(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'completed', 'cancelled')),
  progress NUMERIC DEFAULT 0,
  level TEXT NOT NULL DEFAULT 'company' CHECK (level IN ('company', 'area', 'team', 'individual')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE public.okr_key_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  objective_id UUID NOT NULL REFERENCES public.okr_objectives(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  target_value NUMERIC NOT NULL,
  current_value NUMERIC DEFAULT 0,
  start_value NUMERIC DEFAULT 0,
  unit TEXT DEFAULT '%',
  weight NUMERIC DEFAULT 1 CHECK (weight >= 0 AND weight <= 1),
  status TEXT NOT NULL DEFAULT 'on_track' CHECK (status IN ('on_track', 'at_risk', 'behind', 'completed')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE public.okr_key_result_updates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key_result_id UUID NOT NULL REFERENCES public.okr_key_results(id) ON DELETE CASCADE,
  previous_value NUMERIC NOT NULL,
  new_value NUMERIC NOT NULL,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ============================================================================
-- 7. PROCESSOS
-- ============================================================================

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

CREATE TABLE public.process_checklist_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  process_id UUID NOT NULL REFERENCES public.processes(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  is_required BOOLEAN NOT NULL DEFAULT false,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.process_responsibles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  process_id UUID NOT NULL REFERENCES public.processes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(process_id, user_id)
);

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

CREATE TABLE public.process_execution_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  execution_id UUID NOT NULL REFERENCES public.process_executions(id) ON DELETE CASCADE,
  checklist_item_id UUID NOT NULL REFERENCES public.process_checklist_items(id) ON DELETE CASCADE,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  completed_by UUID
);

-- ============================================================================
-- 8. TRADE / MATERIAIS
-- ============================================================================

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

CREATE TABLE public.trade_inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id uuid REFERENCES public.trade_materials(id) ON DELETE CASCADE NOT NULL,
  movement_type text NOT NULL CHECK (movement_type IN ('entrada', 'saida', 'ajuste')),
  quantity integer NOT NULL,
  unit_cost decimal(10,2),
  reference_number text,
  notes text,
  client_name text,
  movement_date date NOT NULL DEFAULT CURRENT_DATE,
  received_by uuid,
  company_id uuid REFERENCES public.companies(id),
  created_by uuid,
  created_at timestamptz DEFAULT now()
);

-- View de saldo de inventário
CREATE VIEW public.trade_inventory_balance
WITH (security_invoker = true)
AS
SELECT 
  m.id as material_id,
  m.name as material_name,
  m.category,
  m.unit,
  m.image_url as material_image,
  i.id as industry_id,
  i.name as industry_name,
  i.logo_url as industry_logo,
  mov.company_id,
  COALESCE(SUM(
    CASE 
      WHEN mov.movement_type = 'entrada' THEN mov.quantity
      WHEN mov.movement_type = 'saida' THEN -mov.quantity
      ELSE mov.quantity
    END
  ), 0)::integer as current_stock,
  MAX(mov.movement_date) as last_movement
FROM trade_materials m
LEFT JOIN trade_industries i ON m.industry_id = i.id
LEFT JOIN trade_inventory_movements mov ON mov.material_id = m.id
GROUP BY m.id, m.name, m.category, m.unit, m.image_url, i.id, i.name, i.logo_url, mov.company_id;

GRANT SELECT ON public.trade_inventory_balance TO authenticated;

-- ============================================================================
-- 9. VENDAS E SINCRONIZAÇÃO
-- ============================================================================

CREATE TABLE public.sales_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  distributor_id UUID REFERENCES public.distributors(id) ON DELETE CASCADE,
  sale_date DATE NOT NULL,
  product_code TEXT,
  product_name TEXT,
  product_category TEXT,
  quantity NUMERIC DEFAULT 0,
  total_value NUMERIC DEFAULT 0,
  customers_served INTEGER DEFAULT 0,
  external_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id, external_id)
);

CREATE TABLE public.sales_sellers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  distributor_id UUID REFERENCES public.distributors(id) ON DELETE CASCADE,
  sale_date DATE NOT NULL,
  seller_code TEXT NOT NULL,
  seller_name TEXT,
  total_customers INTEGER DEFAULT 0,
  active_customers INTEGER DEFAULT 0,
  total_value NUMERIC DEFAULT 0,
  synced_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id, distributor_id, sale_date, seller_code)
);

CREATE TABLE public.sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  sync_type TEXT NOT NULL,
  records_received INTEGER DEFAULT 0,
  records_created INTEGER DEFAULT 0,
  records_updated INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,
  errors JSONB,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'running'
);

-- ============================================================================
-- 10. FUNCIONÁRIOS EXTERNOS
-- ============================================================================

CREATE TABLE public.external_employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL,
  source_system TEXT DEFAULT 'gestao_ativos',
  registration_number TEXT,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  department TEXT,
  position TEXT,
  hire_date DATE,
  is_active BOOLEAN DEFAULT true,
  cpf TEXT,
  unidade TEXT,
  is_condutor BOOLEAN DEFAULT false,
  cod_vendedor TEXT,
  lider_direto_id UUID REFERENCES public.external_employees(id) ON DELETE SET NULL,
  linked_profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  metadata JSONB,
  synced_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id, external_id, source_system)
);

-- ============================================================================
-- 11. GAMIFICAÇÃO
-- ============================================================================

CREATE TABLE public.user_points (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  points INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 1,
  streak_days INTEGER NOT NULL DEFAULT 0,
  last_activity_date DATE,
  total_points_earned INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id)
);

CREATE TABLE public.badges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT NOT NULL DEFAULT 'award',
  color TEXT NOT NULL DEFAULT 'primary',
  category TEXT NOT NULL DEFAULT 'general',
  points_required INTEGER,
  condition_type TEXT NOT NULL,
  condition_value INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE public.user_badges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  badge_id UUID NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
  earned_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, badge_id)
);

CREATE TABLE public.points_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  points INTEGER NOT NULL,
  action_type TEXT NOT NULL,
  description TEXT,
  reference_id UUID,
  reference_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ============================================================================
-- 12. CONVITES E AUTENTICAÇÃO
-- ============================================================================

CREATE TABLE public.user_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  company_id UUID REFERENCES public.companies(id),
  area_id UUID REFERENCES public.areas(id),
  roles TEXT[] NOT NULL DEFAULT '{"colaborador"}',
  status TEXT NOT NULL DEFAULT 'pending',
  invited_by UUID REFERENCES auth.users(id),
  token UUID DEFAULT gen_random_uuid() UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.two_factor_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  code text NOT NULL,
  method text NOT NULL CHECK (method IN ('email', 'whatsapp')),
  expires_at timestamp with time zone NOT NULL,
  verified boolean DEFAULT false,
  attempts integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL,
  target_user_id uuid,
  action_type text NOT NULL,
  details jsonb,
  ip_address text,
  created_at timestamp with time zone DEFAULT now()
);

-- ============================================================================
-- 13. GOVERNANÇA EC
-- ============================================================================

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

CREATE TABLE public.ec_record_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  record_id UUID NOT NULL REFERENCES public.ec_card_records(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id)
);

CREATE TABLE public.ec_card_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES public.ec_cards(id) ON DELETE CASCADE,
  record_id UUID REFERENCES public.ec_card_records(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  assignee_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  due_date DATE,
  priority TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'pending',
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 14. DATALAKE / INTEGRAÇÕES
-- ============================================================================

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

-- ============================================================================
-- 15. AUDITORIA DE ESTOQUE
-- ============================================================================

CREATE TABLE public.stock_audit_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  governance_email TEXT,
  cc_emails JSONB DEFAULT '[]',
  default_sample_size INTEGER DEFAULT 30,
  default_tolerance_abs NUMERIC DEFAULT 1,
  default_tolerance_pct NUMERIC DEFAULT 5,
  default_blind_count_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.stock_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  unit_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  auditor_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  card_id UUID REFERENCES public.ec_cards(id) ON DELETE SET NULL,
  planned_date DATE,
  executed_date DATE,
  cutoff_datetime TIMESTAMPTZ,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'in_progress', 'completed', 'reviewed')),
  blind_count_enabled BOOLEAN DEFAULT true,
  sample_size INTEGER,
  sampling_method TEXT DEFAULT 'random',
  base_file_url TEXT,
  base_file_type TEXT,
  base_file_meta JSONB,
  total_items_loaded INTEGER DEFAULT 0,
  movement_during_audit BOOLEAN DEFAULT false,
  movement_notes TEXT,
  witness_name TEXT,
  witness_cpf TEXT,
  witness_term_accepted BOOLEAN DEFAULT false,
  report_html TEXT,
  report_sent_at TIMESTAMPTZ,
  report_sent_to TEXT[],
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.stock_audit_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_audit_id UUID NOT NULL REFERENCES public.stock_audits(id) ON DELETE CASCADE,
  sku_code TEXT NOT NULL,
  sku_description TEXT,
  uom TEXT,
  location TEXT,
  system_qty NUMERIC NOT NULL,
  physical_qty NUMERIC,
  recount_qty NUMERIC,
  final_physical_qty NUMERIC,
  final_diff_qty NUMERIC,
  result TEXT DEFAULT 'pending' CHECK (result IN ('pending', 'ok', 'divergent', 'recount_required', 'divergent_confirmed')),
  is_in_sample BOOLEAN DEFAULT false,
  root_cause_code TEXT,
  root_cause_notes TEXT,
  item_notes TEXT,
  audited_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.stock_audit_item_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_audit_item_id UUID NOT NULL REFERENCES public.stock_audit_items(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 16. ÍNDICES PARA PERFORMANCE
-- ============================================================================

CREATE INDEX idx_profiles_is_active ON public.profiles(is_active);
CREATE INDEX idx_profiles_area_id ON public.profiles(area_id);
CREATE INDEX idx_meetings_scheduled_at ON public.meetings(scheduled_at);
CREATE INDEX idx_meetings_status ON public.meetings(status);
CREATE INDEX idx_meeting_participants_meeting_id ON public.meeting_participants(meeting_id);
CREATE INDEX idx_meeting_participants_user_id ON public.meeting_participants(user_id);
CREATE INDEX idx_meeting_participants_confirmation_token ON public.meeting_participants(confirmation_token);
CREATE INDEX idx_meeting_transcriptions_meeting_id ON public.meeting_transcriptions(meeting_id);
CREATE INDEX idx_meeting_atas_meeting_id ON public.meeting_atas(meeting_id);
CREATE INDEX idx_meeting_tasks_meeting_id ON public.meeting_tasks(meeting_id);
CREATE INDEX idx_meeting_tasks_assignee_id ON public.meeting_tasks(assignee_id);
CREATE INDEX idx_meeting_reminders_meeting_id ON public.meeting_reminders(meeting_id);
CREATE INDEX idx_meeting_reminders_sent_at ON public.meeting_reminders(sent_at);
CREATE INDEX idx_meeting_rooms_area_id ON public.meeting_rooms(area_id);
CREATE INDEX idx_audit_logs_actor_id ON public.audit_logs(actor_id);
CREATE INDEX idx_audit_logs_target_user_id ON public.audit_logs(target_user_id);
CREATE INDEX idx_audit_logs_action_type ON public.audit_logs(action_type);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX idx_two_factor_codes_user_id ON public.two_factor_codes(user_id);
CREATE INDEX idx_two_factor_codes_expires_at ON public.two_factor_codes(expires_at);
CREATE INDEX idx_two_factor_codes_code ON public.two_factor_codes(code);
CREATE INDEX idx_sales_daily_date ON public.sales_daily(sale_date);
CREATE INDEX idx_sales_daily_company ON public.sales_daily(company_id, sale_date);
CREATE INDEX idx_sales_daily_distributor ON public.sales_daily(distributor_id, sale_date);
CREATE INDEX idx_sales_sellers_date ON public.sales_sellers(sale_date);
CREATE INDEX idx_sales_sellers_company ON public.sales_sellers(company_id, sale_date);
CREATE INDEX idx_distributors_company ON public.distributors(company_id);
CREATE INDEX idx_sync_logs_company ON public.sync_logs(company_id);
CREATE INDEX idx_goals_distributor ON public.goals(distributor_id);
CREATE INDEX idx_external_employees_company ON public.external_employees(company_id);
CREATE INDEX idx_external_employees_external_id ON public.external_employees(external_id);
CREATE INDEX idx_external_employees_active ON public.external_employees(is_active);
CREATE INDEX idx_external_employees_department ON public.external_employees(department);
CREATE INDEX idx_external_employees_source ON public.external_employees(source_system);
CREATE INDEX idx_external_employees_linked_profile ON public.external_employees(linked_profile_id);
CREATE INDEX idx_external_employees_cpf ON public.external_employees(cpf);
CREATE INDEX idx_external_employees_unidade ON public.external_employees(unidade);
CREATE INDEX idx_external_employees_lider ON public.external_employees(lider_direto_id);
CREATE INDEX idx_external_employees_cod_vendedor ON public.external_employees(cod_vendedor);
CREATE INDEX idx_external_employees_is_condutor ON public.external_employees(is_condutor);
CREATE UNIQUE INDEX idx_external_employees_cpf_company_unique ON public.external_employees(company_id, cpf) WHERE cpf IS NOT NULL;
CREATE INDEX idx_processes_company_id ON public.processes(company_id);
CREATE INDEX idx_processes_area_id ON public.processes(area_id);
CREATE INDEX idx_processes_is_active ON public.processes(is_active);
CREATE INDEX idx_process_checklist_items_process_id ON public.process_checklist_items(process_id);
CREATE INDEX idx_process_responsibles_process_id ON public.process_responsibles(process_id);
CREATE INDEX idx_process_responsibles_user_id ON public.process_responsibles(user_id);
CREATE INDEX idx_process_executions_process_id ON public.process_executions(process_id);
CREATE INDEX idx_process_executions_status ON public.process_executions(status);
CREATE INDEX idx_process_execution_items_execution_id ON public.process_execution_items(execution_id);
CREATE INDEX idx_ec_cards_area_id ON public.ec_cards(area_id);
CREATE INDEX idx_ec_cards_responsible_id ON public.ec_cards(responsible_id);
CREATE INDEX idx_ec_card_records_card_id ON public.ec_card_records(card_id);
CREATE INDEX idx_ec_card_records_status ON public.ec_card_records(status);
CREATE INDEX idx_ec_card_records_competence ON public.ec_card_records(competence);
CREATE INDEX idx_ec_card_records_due_date ON public.ec_card_records(due_date);
CREATE INDEX idx_ec_record_evidences_record_id ON public.ec_record_evidences(record_id);
CREATE INDEX idx_ec_record_comments_record_id ON public.ec_record_comments(record_id);
CREATE INDEX idx_ec_card_tasks_card_id ON public.ec_card_tasks(card_id);
CREATE INDEX idx_ec_card_tasks_assignee_id ON public.ec_card_tasks(assignee_id);
CREATE INDEX idx_ec_card_tasks_status ON public.ec_card_tasks(status);
CREATE INDEX idx_dl_queries_connection_id ON public.dl_queries(connection_id);
CREATE INDEX idx_dl_card_bindings_card_id ON public.dl_card_bindings(card_id);
CREATE INDEX idx_dl_card_bindings_query_id ON public.dl_card_bindings(query_id);
CREATE INDEX idx_dl_query_runs_query_id ON public.dl_query_runs(query_id);
CREATE INDEX idx_dl_query_runs_status ON public.dl_query_runs(status);
CREATE INDEX idx_stock_audits_company ON public.stock_audits(company_id);
CREATE INDEX idx_stock_audits_unit ON public.stock_audits(unit_id);
CREATE INDEX idx_stock_audits_status ON public.stock_audits(status);
CREATE INDEX idx_stock_audits_auditor ON public.stock_audits(auditor_user_id);
CREATE INDEX idx_stock_audit_items_audit ON public.stock_audit_items(stock_audit_id);
CREATE INDEX idx_stock_audit_items_sample ON public.stock_audit_items(stock_audit_id, is_in_sample);
CREATE INDEX idx_stock_audit_item_photos_item ON public.stock_audit_item_photos(stock_audit_item_id);
CREATE INDEX idx_areas_cost_center ON public.areas(cost_center) WHERE cost_center IS NOT NULL;

-- ============================================================================
-- 17. FUNÇÕES AUXILIARES
-- ============================================================================

-- Função para verificar permissão
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
  SELECT CASE
    WHEN _action = 'view' THEN COALESCE(can_view, false)
    WHEN _action = 'create' THEN COALESCE(can_create, false)
    WHEN _action = 'edit' THEN COALESCE(can_edit, false)
    WHEN _action = 'delete' THEN COALESCE(can_delete, false)
    ELSE false
  END
  FROM public.user_permissions
  WHERE user_id = _user_id AND module = _module
  LIMIT 1
$$;

-- Função para verificar acesso a empresa
CREATE OR REPLACE FUNCTION public.has_company_access(_user_id uuid, _company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    has_role(_user_id, 'super_admin') OR has_role(_user_id, 'ceo')
    OR EXISTS (SELECT 1 FROM profiles WHERE id = _user_id AND company_id = _company_id)
    OR EXISTS (
      SELECT 1 FROM user_companies
      WHERE user_id = _user_id 
        AND all_companies = true
        AND can_view = true
    )
    OR EXISTS (
      SELECT 1 FROM user_companies
      WHERE user_id = _user_id 
        AND company_id = _company_id
        AND can_view = true
    )
$$;

-- Função para calcular nível
CREATE OR REPLACE FUNCTION public.calculate_level(total_points INTEGER)
RETURNS INTEGER AS $$
BEGIN
  RETURN GREATEST(1, FLOOR(SQRT(total_points / 100.0)) + 1);
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Função para adicionar pontos
CREATE OR REPLACE FUNCTION public.add_user_points(
  p_user_id UUID,
  p_points INTEGER,
  p_action_type TEXT,
  p_description TEXT DEFAULT NULL,
  p_reference_id UUID DEFAULT NULL,
  p_reference_type TEXT DEFAULT NULL
)
RETURNS void AS $$
DECLARE
  v_new_total INTEGER;
  v_new_level INTEGER;
  v_today DATE := CURRENT_DATE;
  v_last_activity DATE;
  v_current_streak INTEGER;
BEGIN
  SELECT last_activity_date, streak_days INTO v_last_activity, v_current_streak
  FROM public.user_points WHERE user_id = p_user_id;

  IF v_last_activity IS NULL THEN
    v_current_streak := 1;
  ELSIF v_last_activity = v_today - INTERVAL '1 day' THEN
    v_current_streak := COALESCE(v_current_streak, 0) + 1;
  ELSIF v_last_activity < v_today - INTERVAL '1 day' THEN
    v_current_streak := 1;
  END IF;

  INSERT INTO public.user_points (user_id, points, total_points_earned, last_activity_date, streak_days)
  VALUES (p_user_id, p_points, p_points, v_today, v_current_streak)
  ON CONFLICT (user_id) DO UPDATE SET
    points = user_points.points + p_points,
    total_points_earned = user_points.total_points_earned + p_points,
    last_activity_date = v_today,
    streak_days = v_current_streak,
    level = calculate_level(user_points.total_points_earned + p_points),
    updated_at = now();

  INSERT INTO public.points_history (user_id, points, action_type, description, reference_id, reference_type)
  VALUES (p_user_id, p_points, p_action_type, p_description, p_reference_id, p_reference_type);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Função para calcular progresso de objetivo OKR
CREATE OR REPLACE FUNCTION public.calculate_objective_progress()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_objective_id UUID;
  v_total_progress NUMERIC;
  v_total_weight NUMERIC;
BEGIN
  v_objective_id := COALESCE(NEW.objective_id, OLD.objective_id);
  
  SELECT 
    COALESCE(SUM(
      CASE 
        WHEN target_value > start_value THEN 
          LEAST(100, ((current_value - start_value) / NULLIF(target_value - start_value, 0)) * 100 * weight)
        ELSE 0
      END
    ), 0),
    COALESCE(SUM(weight), 1)
  INTO v_total_progress, v_total_weight
  FROM public.okr_key_results
  WHERE objective_id = v_objective_id;
  
  UPDATE public.okr_objectives
  SET progress = ROUND(v_total_progress / NULLIF(v_total_weight, 0), 1),
      updated_at = now()
  WHERE id = v_objective_id;
  
  RETURN NEW;
END;
$$;

-- Função para vincular funcionário por email
CREATE OR REPLACE FUNCTION public.link_external_employee_by_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  matched_profile_id UUID;
BEGIN
  IF NEW.email IS NOT NULL AND NEW.email != '' AND NEW.linked_profile_id IS NULL THEN
    SELECT p.id INTO matched_profile_id
    FROM profiles p
    JOIN auth.users u ON u.id = p.id
    WHERE LOWER(u.email) = LOWER(NEW.email)
    LIMIT 1;
    
    IF matched_profile_id IS NOT NULL THEN
      NEW.linked_profile_id := matched_profile_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Função para vincular todos os funcionários
CREATE OR REPLACE FUNCTION public.link_all_external_employees()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  WITH matched AS (
    SELECT ee.id, p.id as profile_id
    FROM external_employees ee
    JOIN auth.users u ON LOWER(u.email) = LOWER(ee.email)
    JOIN profiles p ON p.id = u.id
    WHERE ee.linked_profile_id IS NULL
      AND ee.email IS NOT NULL
      AND ee.email != ''
  )
  UPDATE external_employees ee
  SET linked_profile_id = matched.profile_id,
      updated_at = now()
  FROM matched
  WHERE ee.id = matched.id;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

-- Função para contar funcionários convertíveis
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

-- Função para limpar códigos 2FA expirados
CREATE OR REPLACE FUNCTION public.cleanup_expired_2fa_codes()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.two_factor_codes
  WHERE expires_at < now() OR verified = true;
END;
$$;

-- Função para atualizar stock_audit updated_at
CREATE OR REPLACE FUNCTION public.update_stock_audit_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ============================================================================
-- 18. TRIGGERS DE GAMIFICAÇÃO
-- ============================================================================

CREATE OR REPLACE FUNCTION public.trigger_points_on_task_complete()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    IF NEW.assignee_id IS NOT NULL THEN
      PERFORM add_user_points(
        NEW.assignee_id,
        15,
        'task_completed',
        'Tarefa concluída: ' || NEW.title,
        NEW.id,
        'meeting_task'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.trigger_points_on_meeting_create()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.created_by IS NOT NULL THEN
    PERFORM add_user_points(
      NEW.created_by,
      10,
      'meeting_created',
      'Reunião criada: ' || NEW.title,
      NEW.id,
      'meeting'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.trigger_points_on_meeting_attend()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.attended = true AND (OLD.attended IS NULL OR OLD.attended = false) THEN
    PERFORM add_user_points(
      NEW.user_id,
      5,
      'meeting_attended',
      'Presença confirmada em reunião',
      NEW.meeting_id,
      'meeting_participant'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.trigger_points_on_goal_achieved()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.current_value >= NEW.target_value AND 
     (OLD.current_value IS NULL OR OLD.current_value < OLD.target_value) THEN
    IF NEW.responsible_id IS NOT NULL THEN
      PERFORM add_user_points(
        NEW.responsible_id,
        50,
        'goal_achieved',
        'Meta alcançada: ' || NEW.name,
        NEW.id,
        'goal'
      );
    END IF;
    IF NEW.created_by IS NOT NULL AND NEW.created_by != NEW.responsible_id THEN
      PERFORM add_user_points(
        NEW.created_by,
        20,
        'goal_achieved_team',
        'Meta da equipe alcançada: ' || NEW.name,
        NEW.id,
        'goal'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.trigger_points_on_goal_entry()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.created_by IS NOT NULL THEN
    PERFORM add_user_points(
      NEW.created_by,
      5,
      'goal_entry',
      'Progresso de meta registrado',
      NEW.id,
      'goal_entry'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.trigger_points_on_ata_approved()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    IF NEW.approved_by IS NOT NULL THEN
      PERFORM add_user_points(
        NEW.approved_by,
        20,
        'ata_approved',
        'ATA aprovada',
        NEW.id,
        'meeting_ata'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.trigger_points_on_kr_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.current_value >= NEW.target_value AND (OLD.current_value IS NULL OR OLD.current_value < OLD.target_value) THEN
    IF NEW.created_by IS NOT NULL THEN
      PERFORM add_user_points(
        NEW.created_by,
        25,
        'kr_completed',
        'Key Result concluído: ' || NEW.title,
        NEW.id,
        'okr_key_result'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- ============================================================================
-- 19. TRIGGER para criar perfil no signup
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name)
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data->>'first_name', ''),
    COALESCE(new.raw_user_meta_data->>'last_name', '')
  );
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, 'colaborador');
  
  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ============================================================================
-- 20. TRIGGERS DE UPDATED_AT
-- ============================================================================

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_areas_updated_at
  BEFORE UPDATE ON public.areas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_companies_updated_at
  BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_meeting_rooms_updated_at
  BEFORE UPDATE ON public.meeting_rooms
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_meetings_updated_at
  BEFORE UPDATE ON public.meetings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_meeting_transcriptions_updated_at
  BEFORE UPDATE ON public.meeting_transcriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_meeting_atas_updated_at
  BEFORE UPDATE ON public.meeting_atas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_meeting_tasks_updated_at
  BEFORE UPDATE ON public.meeting_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_meeting_agendas_updated_at
  BEFORE UPDATE ON public.meeting_agendas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_permissions_updated_at
  BEFORE UPDATE ON public.user_permissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_companies_updated_at
  BEFORE UPDATE ON public.user_companies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_system_settings_updated_at
  BEFORE UPDATE ON public.system_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_invites_updated_at
  BEFORE UPDATE ON public.user_invites
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_goal_types_updated_at
  BEFORE UPDATE ON public.goal_types
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_goals_updated_at
  BEFORE UPDATE ON public.goals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_csv_import_templates_updated_at
  BEFORE UPDATE ON public.csv_import_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_okr_objectives_updated_at
  BEFORE UPDATE ON public.okr_objectives
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_okr_key_results_updated_at
  BEFORE UPDATE ON public.okr_key_results
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_processes_updated_at
  BEFORE UPDATE ON public.processes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_trade_industries_updated_at
  BEFORE UPDATE ON public.trade_industries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_trade_materials_updated_at
  BEFORE UPDATE ON public.trade_materials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_external_employees_updated_at
  BEFORE UPDATE ON public.external_employees
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ec_areas_updated_at
  BEFORE UPDATE ON public.ec_areas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ec_cards_updated_at
  BEFORE UPDATE ON public.ec_cards
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ec_card_records_updated_at
  BEFORE UPDATE ON public.ec_card_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ec_card_tasks_updated_at
  BEFORE UPDATE ON public.ec_card_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_dl_connections_updated_at
  BEFORE UPDATE ON public.dl_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_dl_queries_updated_at
  BEFORE UPDATE ON public.dl_queries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_dl_card_bindings_updated_at
  BEFORE UPDATE ON public.dl_card_bindings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_stock_audit_settings_updated_at
  BEFORE UPDATE ON public.stock_audit_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_stock_audit_updated_at();

CREATE TRIGGER update_stock_audits_updated_at
  BEFORE UPDATE ON public.stock_audits
  FOR EACH ROW EXECUTE FUNCTION public.update_stock_audit_updated_at();

-- ============================================================================
-- 21. TRIGGERS DE GAMIFICAÇÃO
-- ============================================================================

CREATE TRIGGER on_task_complete
  AFTER UPDATE ON public.meeting_tasks
  FOR EACH ROW EXECUTE FUNCTION public.trigger_points_on_task_complete();

CREATE TRIGGER on_meeting_create
  AFTER INSERT ON public.meetings
  FOR EACH ROW EXECUTE FUNCTION public.trigger_points_on_meeting_create();

CREATE TRIGGER on_meeting_attend
  AFTER UPDATE ON public.meeting_participants
  FOR EACH ROW EXECUTE FUNCTION public.trigger_points_on_meeting_attend();

CREATE TRIGGER on_goal_achieved
  AFTER UPDATE ON public.goals
  FOR EACH ROW EXECUTE FUNCTION public.trigger_points_on_goal_achieved();

CREATE TRIGGER on_goal_entry
  AFTER INSERT ON public.goal_entries
  FOR EACH ROW EXECUTE FUNCTION public.trigger_points_on_goal_entry();

CREATE TRIGGER on_ata_approved
  AFTER UPDATE ON public.meeting_atas
  FOR EACH ROW EXECUTE FUNCTION public.trigger_points_on_ata_approved();

CREATE TRIGGER update_objective_progress
  AFTER INSERT OR UPDATE OR DELETE ON public.okr_key_results
  FOR EACH ROW EXECUTE FUNCTION public.calculate_objective_progress();

CREATE TRIGGER gamification_on_kr_complete
  AFTER UPDATE ON public.okr_key_results
  FOR EACH ROW EXECUTE FUNCTION public.trigger_points_on_kr_update();

CREATE TRIGGER trigger_link_external_employee_by_email
  BEFORE INSERT OR UPDATE OF email ON public.external_employees
  FOR EACH ROW EXECUTE FUNCTION public.link_external_employee_by_email();

-- ============================================================================
-- 22. HABILITAR RLS EM TODAS AS TABELAS
-- ============================================================================

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_transcriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_atas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_agendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.distributors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goal_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.csv_import_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.okr_objectives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.okr_key_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.okr_key_result_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.process_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.process_responsibles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.process_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.process_execution_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_industries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_sellers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.points_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.two_factor_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ec_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ec_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ec_card_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ec_record_evidences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ec_record_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ec_card_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dl_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dl_queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dl_card_bindings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dl_query_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_audit_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_audit_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_audit_item_photos ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- FIM DO SCHEMA - EXECUTE SEPARADAMENTE:
-- - docs/migration/rls-policies.sql (políticas RLS)
-- - docs/migration/storage-buckets.sql (buckets de storage)
-- - docs/migration/seed-data.sql (dados iniciais)
-- ============================================================================
