-- Migration: OKR Action Plans (Planos de Ação SMART)
-- Módulo de tarefas SMART dentro dos OKRs
-- Uma ação pode ser desmembrada em múltiplas tarefas
-- Cada tarefa exige: responsável, data início, data fim e status

-- ===================================================
-- Tabela: okr_action_plans (Ações SMART)
-- ===================================================
CREATE TABLE IF NOT EXISTS okr_action_plans (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id  UUID        REFERENCES companies(id) ON DELETE CASCADE,
  objective_id UUID       NOT NULL REFERENCES okr_objectives(id) ON DELETE CASCADE,
  title       TEXT        NOT NULL,
  description TEXT,
  created_by  UUID        REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ===================================================
-- Tabela: okr_action_tasks (Tarefas dentro da Ação)
-- ===================================================
CREATE TABLE IF NOT EXISTS okr_action_tasks (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  action_plan_id  UUID        NOT NULL REFERENCES okr_action_plans(id) ON DELETE CASCADE,
  title           TEXT        NOT NULL,
  description     TEXT,
  assignee_id     UUID        NOT NULL REFERENCES auth.users(id),
  start_date      DATE        NOT NULL,
  end_date        DATE        NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'nao_iniciado'
                              CHECK (status IN (
                                'nao_iniciado',
                                'em_andamento',
                                'concluido',
                                'atrasado',
                                'cancelado'
                              )),
  created_by      UUID        REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT end_after_start CHECK (end_date >= start_date)
);

-- ===================================================
-- Triggers updated_at
-- ===================================================
CREATE OR REPLACE TRIGGER update_okr_action_plans_updated_at
  BEFORE UPDATE ON okr_action_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_okr_action_tasks_updated_at
  BEFORE UPDATE ON okr_action_tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===================================================
-- Índices
-- ===================================================
CREATE INDEX IF NOT EXISTS idx_okr_action_plans_objective_id
  ON okr_action_plans(objective_id);

CREATE INDEX IF NOT EXISTS idx_okr_action_plans_company_id
  ON okr_action_plans(company_id);

CREATE INDEX IF NOT EXISTS idx_okr_action_tasks_action_plan_id
  ON okr_action_tasks(action_plan_id);

CREATE INDEX IF NOT EXISTS idx_okr_action_tasks_assignee_id
  ON okr_action_tasks(assignee_id);

CREATE INDEX IF NOT EXISTS idx_okr_action_tasks_status
  ON okr_action_tasks(status);

-- ===================================================
-- RLS — Row Level Security
-- ===================================================
ALTER TABLE okr_action_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE okr_action_tasks ENABLE ROW LEVEL SECURITY;

-- Drop policies existentes para idempotência
DROP POLICY IF EXISTS "okr_action_plans_select" ON okr_action_plans;
DROP POLICY IF EXISTS "okr_action_plans_insert" ON okr_action_plans;
DROP POLICY IF EXISTS "okr_action_plans_update" ON okr_action_plans;
DROP POLICY IF EXISTS "okr_action_plans_delete" ON okr_action_plans;
DROP POLICY IF EXISTS "okr_action_tasks_select" ON okr_action_tasks;
DROP POLICY IF EXISTS "okr_action_tasks_insert" ON okr_action_tasks;
DROP POLICY IF EXISTS "okr_action_tasks_update" ON okr_action_tasks;
DROP POLICY IF EXISTS "okr_action_tasks_delete" ON okr_action_tasks;

-- okr_action_plans: SELECT — apenas empresas que o usuário tem acesso
CREATE POLICY "okr_action_plans_select"
  ON okr_action_plans FOR SELECT
  TO authenticated
  USING (public.has_company_access(auth.uid(), company_id));

-- okr_action_plans: INSERT — gerente+ E company_id deve pertencer ao usuário
CREATE POLICY "okr_action_plans_insert"
  ON okr_action_plans FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_company_access(auth.uid(), company_id)
    AND (
      has_role(auth.uid(), 'gerente') OR
      has_role(auth.uid(), 'diretor') OR
      has_role(auth.uid(), 'ceo') OR
      has_role(auth.uid(), 'super_admin')
    )
  );

-- okr_action_plans: UPDATE — criador OU liderança, sempre dentro da empresa do usuário
CREATE POLICY "okr_action_plans_update"
  ON okr_action_plans FOR UPDATE
  TO authenticated
  USING (
    public.has_company_access(auth.uid(), company_id)
    AND (
      created_by = auth.uid() OR
      has_role(auth.uid(), 'diretor') OR
      has_role(auth.uid(), 'ceo') OR
      has_role(auth.uid(), 'super_admin')
    )
  )
  WITH CHECK (public.has_company_access(auth.uid(), company_id));

-- okr_action_plans: DELETE — criador OU liderança, sempre dentro da empresa do usuário
CREATE POLICY "okr_action_plans_delete"
  ON okr_action_plans FOR DELETE
  TO authenticated
  USING (
    public.has_company_access(auth.uid(), company_id)
    AND (
      created_by = auth.uid() OR
      has_role(auth.uid(), 'diretor') OR
      has_role(auth.uid(), 'ceo') OR
      has_role(auth.uid(), 'super_admin')
    )
  );

-- okr_action_tasks: SELECT — via join com action_plan filtrado por empresa
CREATE POLICY "okr_action_tasks_select"
  ON okr_action_tasks FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM okr_action_plans ap
      WHERE ap.id = okr_action_tasks.action_plan_id
        AND public.has_company_access(auth.uid(), ap.company_id)
    )
  );

-- okr_action_tasks: INSERT — gerente+ E action_plan deve pertencer a empresa do usuário
CREATE POLICY "okr_action_tasks_insert"
  ON okr_action_tasks FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM okr_action_plans ap
      WHERE ap.id = okr_action_tasks.action_plan_id
        AND public.has_company_access(auth.uid(), ap.company_id)
    )
    AND (
      has_role(auth.uid(), 'gerente') OR
      has_role(auth.uid(), 'diretor') OR
      has_role(auth.uid(), 'ceo') OR
      has_role(auth.uid(), 'super_admin')
    )
  );

-- okr_action_tasks: UPDATE — criador, responsável ou liderança, sempre dentro da empresa
CREATE POLICY "okr_action_tasks_update"
  ON okr_action_tasks FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM okr_action_plans ap
      WHERE ap.id = okr_action_tasks.action_plan_id
        AND public.has_company_access(auth.uid(), ap.company_id)
    )
    AND (
      created_by = auth.uid() OR
      assignee_id = auth.uid() OR
      has_role(auth.uid(), 'diretor') OR
      has_role(auth.uid(), 'ceo') OR
      has_role(auth.uid(), 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM okr_action_plans ap
      WHERE ap.id = okr_action_tasks.action_plan_id
        AND public.has_company_access(auth.uid(), ap.company_id)
    )
  );

-- okr_action_tasks: DELETE — criador ou liderança, sempre dentro da empresa
CREATE POLICY "okr_action_tasks_delete"
  ON okr_action_tasks FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM okr_action_plans ap
      WHERE ap.id = okr_action_tasks.action_plan_id
        AND public.has_company_access(auth.uid(), ap.company_id)
    )
    AND (
      created_by = auth.uid() OR
      has_role(auth.uid(), 'diretor') OR
      has_role(auth.uid(), 'ceo') OR
      has_role(auth.uid(), 'super_admin')
    )
  );
