-- ============================================================
-- Descrição: Alterar FK responsible_id em goals e goal_activities
--            para referenciar external_employees em vez de profiles.
--            Alinhamento com PE 2026: responsável deve ser qualquer
--            funcionário do grupo, não apenas usuários do sistema.
-- Afeta: módulo Metas
-- ============================================================

-- 1. goals.responsible_id: profiles → external_employees
ALTER TABLE goals
  DROP CONSTRAINT IF EXISTS goals_responsible_id_fkey;

ALTER TABLE goals
  ADD CONSTRAINT goals_responsible_id_fkey
    FOREIGN KEY (responsible_id) REFERENCES external_employees(id) ON DELETE SET NULL;

-- 2. goal_activities.responsible_id: profiles → external_employees
ALTER TABLE goal_activities
  DROP CONSTRAINT IF EXISTS goal_activities_responsible_id_fkey;

ALTER TABLE goal_activities
  ADD CONSTRAINT goal_activities_responsible_id_fkey
    FOREIGN KEY (responsible_id) REFERENCES external_employees(id) ON DELETE SET NULL;
