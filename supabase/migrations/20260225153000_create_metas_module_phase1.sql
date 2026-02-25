-- ============================================================
-- FASE 1 — Portal de Metas
-- Schema + Segurança (RLS) + Histórico de progresso
-- ============================================================

-- Dependência: executar antes a migration
-- 20260225152900_add_metas_system_module.sql

-- 2) Enums do módulo
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'goal_type') THEN
    CREATE TYPE public.goal_type AS ENUM ('numeric', 'activity', 'hybrid');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'goal_cadence') THEN
    CREATE TYPE public.goal_cadence AS ENUM ('monthly', 'activity', 'quarterly', 'annual');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'goal_status') THEN
    CREATE TYPE public.goal_status AS ENUM ('active', 'completed', 'paused', 'cancelled');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'goal_pillar') THEN
    CREATE TYPE public.goal_pillar AS ENUM ('FAT', 'RT', 'MS', 'SC', 'DN', 'CO', 'ESG');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'goal_activity_status') THEN
    CREATE TYPE public.goal_activity_status AS ENUM ('pending', 'in_progress', 'completed', 'cancelled');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'agent_message_role') THEN
    CREATE TYPE public.agent_message_role AS ENUM ('user', 'assistant', 'tool');
  END IF;
END $$;

-- 3) Tabelas principais
CREATE TABLE IF NOT EXISTS public.goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  area_id UUID REFERENCES public.areas(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  type public.goal_type NOT NULL DEFAULT 'numeric',
  pillar public.goal_pillar,
  unit TEXT,
  target_value NUMERIC,
  current_value NUMERIC NOT NULL DEFAULT 0,
  start_date DATE,
  end_date DATE,
  cadence public.goal_cadence NOT NULL DEFAULT 'monthly',
  status public.goal_status NOT NULL DEFAULT 'active',
  responsible_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT goals_target_value_positive CHECK (target_value IS NULL OR target_value >= 0),
  CONSTRAINT goals_current_value_non_negative CHECK (current_value >= 0)
);

CREATE TABLE IF NOT EXISTS public.goal_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status public.goal_activity_status NOT NULL DEFAULT 'pending',
  weight NUMERIC NOT NULL DEFAULT 1,
  due_date DATE,
  responsible_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  task_id UUID REFERENCES public.meeting_tasks(id) ON DELETE SET NULL,
  process_id UUID REFERENCES public.processes(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT goal_activities_weight_positive CHECK (weight > 0)
);

CREATE TABLE IF NOT EXISTS public.goal_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  value NUMERIC NOT NULL,
  notes TEXT,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.goal_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.goal_agent_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  role public.agent_message_role NOT NULL,
  content TEXT NOT NULL,
  tool_calls JSONB,
  tool_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4) Índices
CREATE INDEX IF NOT EXISTS idx_goals_company_id ON public.goals(company_id);
CREATE INDEX IF NOT EXISTS idx_goals_area_id ON public.goals(area_id);
CREATE INDEX IF NOT EXISTS idx_goals_status ON public.goals(status);
CREATE INDEX IF NOT EXISTS idx_goals_pillar ON public.goals(pillar);
CREATE INDEX IF NOT EXISTS idx_goals_responsible_id ON public.goals(responsible_id);

CREATE INDEX IF NOT EXISTS idx_goal_activities_goal_id ON public.goal_activities(goal_id);
CREATE INDEX IF NOT EXISTS idx_goal_activities_status ON public.goal_activities(status);
CREATE INDEX IF NOT EXISTS idx_goal_activities_due_date ON public.goal_activities(due_date);

CREATE INDEX IF NOT EXISTS idx_goal_updates_goal_id ON public.goal_updates(goal_id);
CREATE INDEX IF NOT EXISTS idx_goal_updates_created_at ON public.goal_updates(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_goal_comments_goal_id ON public.goal_comments(goal_id);
CREATE INDEX IF NOT EXISTS idx_goal_comments_created_at ON public.goal_comments(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_goal_agent_messages_user_company
  ON public.goal_agent_messages(user_id, company_id, created_at DESC);

-- 5) Triggers de updated_at
DROP TRIGGER IF EXISTS trg_goals_updated_at ON public.goals;
CREATE TRIGGER trg_goals_updated_at
  BEFORE UPDATE ON public.goals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_goal_activities_updated_at ON public.goal_activities;
CREATE TRIGGER trg_goal_activities_updated_at
  BEFORE UPDATE ON public.goal_activities
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 6) Trigger de histórico automático de progresso
CREATE OR REPLACE FUNCTION public.trg_goals_log_progress_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.current_value IS DISTINCT FROM OLD.current_value THEN
    INSERT INTO public.goal_updates (goal_id, value, notes, updated_by)
    VALUES (
      NEW.id,
      NEW.current_value,
      'Atualização automática via alteração de current_value em goals',
      auth.uid()
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_goals_log_progress_change ON public.goals;
CREATE TRIGGER trg_goals_log_progress_change
  AFTER UPDATE OF current_value ON public.goals
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_goals_log_progress_change();

-- 7) RLS
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goal_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goal_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goal_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goal_agent_messages ENABLE ROW LEVEL SECURITY;

-- GOALS
DROP POLICY IF EXISTS goals_select ON public.goals;
CREATE POLICY goals_select ON public.goals
  FOR SELECT
  USING (public.has_company_access(auth.uid(), company_id));

DROP POLICY IF EXISTS goals_insert ON public.goals;
CREATE POLICY goals_insert ON public.goals
  FOR INSERT
  WITH CHECK (
    public.has_company_access(auth.uid(), company_id)
    AND public.has_permission(auth.uid(), 'metas'::public.system_module, 'create')
  );

DROP POLICY IF EXISTS goals_update ON public.goals;
CREATE POLICY goals_update ON public.goals
  FOR UPDATE
  USING (public.has_company_access(auth.uid(), company_id))
  WITH CHECK (
    public.has_company_access(auth.uid(), company_id)
    AND public.has_permission(auth.uid(), 'metas'::public.system_module, 'edit')
  );

DROP POLICY IF EXISTS goals_delete ON public.goals;
CREATE POLICY goals_delete ON public.goals
  FOR DELETE
  USING (
    public.has_company_access(auth.uid(), company_id)
    AND (
      public.has_role(auth.uid(), 'ceo')
      OR public.has_role(auth.uid(), 'super_admin')
      OR public.has_role(auth.uid(), 'diretor')
      OR public.has_permission(auth.uid(), 'metas'::public.system_module, 'delete')
    )
  );

-- GOAL_ACTIVITIES
DROP POLICY IF EXISTS goal_activities_select ON public.goal_activities;
CREATE POLICY goal_activities_select ON public.goal_activities
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.goals g
      WHERE g.id = goal_activities.goal_id
        AND public.has_company_access(auth.uid(), g.company_id)
    )
  );

DROP POLICY IF EXISTS goal_activities_insert ON public.goal_activities;
CREATE POLICY goal_activities_insert ON public.goal_activities
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.goals g
      WHERE g.id = goal_activities.goal_id
        AND public.has_company_access(auth.uid(), g.company_id)
        AND public.has_permission(auth.uid(), 'metas'::public.system_module, 'create')
    )
  );

DROP POLICY IF EXISTS goal_activities_update ON public.goal_activities;
CREATE POLICY goal_activities_update ON public.goal_activities
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.goals g
      WHERE g.id = goal_activities.goal_id
        AND public.has_company_access(auth.uid(), g.company_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.goals g
      WHERE g.id = goal_activities.goal_id
        AND public.has_company_access(auth.uid(), g.company_id)
        AND public.has_permission(auth.uid(), 'metas'::public.system_module, 'edit')
    )
  );

DROP POLICY IF EXISTS goal_activities_delete ON public.goal_activities;
CREATE POLICY goal_activities_delete ON public.goal_activities
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.goals g
      WHERE g.id = goal_activities.goal_id
        AND public.has_company_access(auth.uid(), g.company_id)
        AND public.has_permission(auth.uid(), 'metas'::public.system_module, 'delete')
    )
  );

-- GOAL_UPDATES (imutável para usuários: SELECT + INSERT)
DROP POLICY IF EXISTS goal_updates_select ON public.goal_updates;
CREATE POLICY goal_updates_select ON public.goal_updates
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.goals g
      WHERE g.id = goal_updates.goal_id
        AND public.has_company_access(auth.uid(), g.company_id)
    )
  );

DROP POLICY IF EXISTS goal_updates_insert ON public.goal_updates;
CREATE POLICY goal_updates_insert ON public.goal_updates
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.goals g
      WHERE g.id = goal_updates.goal_id
        AND public.has_company_access(auth.uid(), g.company_id)
        AND public.has_permission(auth.uid(), 'metas'::public.system_module, 'edit')
    )
  );

-- GOAL_COMMENTS
DROP POLICY IF EXISTS goal_comments_select ON public.goal_comments;
CREATE POLICY goal_comments_select ON public.goal_comments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.goals g
      WHERE g.id = goal_comments.goal_id
        AND public.has_company_access(auth.uid(), g.company_id)
    )
  );

DROP POLICY IF EXISTS goal_comments_insert ON public.goal_comments;
CREATE POLICY goal_comments_insert ON public.goal_comments
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.goals g
      WHERE g.id = goal_comments.goal_id
        AND public.has_company_access(auth.uid(), g.company_id)
    )
  );

DROP POLICY IF EXISTS goal_comments_update ON public.goal_comments;
CREATE POLICY goal_comments_update ON public.goal_comments
  FOR UPDATE
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'super_admin')
    OR public.has_role(auth.uid(), 'ceo')
  )
  WITH CHECK (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'super_admin')
    OR public.has_role(auth.uid(), 'ceo')
  );

DROP POLICY IF EXISTS goal_comments_delete ON public.goal_comments;
CREATE POLICY goal_comments_delete ON public.goal_comments
  FOR DELETE
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'super_admin')
    OR public.has_role(auth.uid(), 'ceo')
  );

-- GOAL_AGENT_MESSAGES
DROP POLICY IF EXISTS goal_agent_messages_select ON public.goal_agent_messages;
CREATE POLICY goal_agent_messages_select ON public.goal_agent_messages
  FOR SELECT
  USING (
    user_id = auth.uid()
    AND public.has_company_access(auth.uid(), company_id)
  );

DROP POLICY IF EXISTS goal_agent_messages_insert ON public.goal_agent_messages;
CREATE POLICY goal_agent_messages_insert ON public.goal_agent_messages
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND public.has_company_access(auth.uid(), company_id)
  );

DROP POLICY IF EXISTS goal_agent_messages_delete ON public.goal_agent_messages;
CREATE POLICY goal_agent_messages_delete ON public.goal_agent_messages
  FOR DELETE
  USING (
    user_id = auth.uid()
    AND public.has_company_access(auth.uid(), company_id)
  );

-- 8) Backfill de permissão do novo módulo para perfis administrativos
INSERT INTO public.user_permissions (user_id, module, can_view, can_create, can_edit, can_delete)
SELECT ur.user_id, 'metas'::public.system_module, true, true, true, true
FROM public.user_roles ur
WHERE ur.role IN ('super_admin', 'ceo', 'diretor')
ON CONFLICT (user_id, module) DO NOTHING;
