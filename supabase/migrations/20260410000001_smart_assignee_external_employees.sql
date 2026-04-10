-- ============================================================
-- Descrição: Alterar FKs de assignee_id e owner_id para
--            referenciar external_employees em vez de auth.users/profiles.
--            Permite atribuir tarefas a funcionários sem acesso ao sistema.
-- Afeta: módulo SMART (Planos de Ação)
-- ============================================================

-- 1. okr_action_tasks.assignee_id: auth.users → external_employees
ALTER TABLE okr_action_tasks
  DROP CONSTRAINT IF EXISTS okr_action_tasks_assignee_id_fkey;

ALTER TABLE okr_action_tasks
  ALTER COLUMN assignee_id DROP NOT NULL;

ALTER TABLE okr_action_tasks
  ADD CONSTRAINT okr_action_tasks_assignee_id_fkey
    FOREIGN KEY (assignee_id) REFERENCES external_employees(id) ON DELETE SET NULL;

-- 2. okr_objectives.owner_id: profiles → external_employees
ALTER TABLE okr_objectives
  DROP CONSTRAINT IF EXISTS okr_objectives_owner_id_fkey;

ALTER TABLE okr_objectives
  ADD CONSTRAINT okr_objectives_owner_id_fkey
    FOREIGN KEY (owner_id) REFERENCES external_employees(id) ON DELETE SET NULL;

-- 3. Atualizar RLS de okr_action_tasks UPDATE — remover "assignee_id = auth.uid()"
--    pois assignee_id agora é external_employee, não auth.users
DROP POLICY IF EXISTS "okr_action_tasks_update" ON okr_action_tasks;

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
