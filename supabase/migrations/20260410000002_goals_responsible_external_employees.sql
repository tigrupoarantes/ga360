-- ============================================================
-- Descrição: Alterar FK responsible_id em goals e goal_activities
--            para referenciar external_employees em vez de profiles.
--            Alinhamento com PE 2026: responsável deve ser qualquer
--            funcionário do grupo, não apenas usuários do sistema.
-- Afeta: módulo Metas
-- ============================================================

-- 0. Migrar dados existentes: mapear profiles → external_employees via linked_profile_id
--    Se o employee tem linked_profile_id = goals.responsible_id, atualizar para employee.id
UPDATE goals g
SET responsible_id = ee.id
FROM external_employees ee
WHERE ee.linked_profile_id = g.responsible_id
  AND g.responsible_id IS NOT NULL;

UPDATE goal_activities ga
SET responsible_id = ee.id
FROM external_employees ee
WHERE ee.linked_profile_id = ga.responsible_id
  AND ga.responsible_id IS NOT NULL;

-- Limpar responsible_id que não foram mapeados (evitar violação de FK)
UPDATE goals
SET responsible_id = NULL
WHERE responsible_id IS NOT NULL
  AND responsible_id NOT IN (SELECT id FROM external_employees);

UPDATE goal_activities
SET responsible_id = NULL
WHERE responsible_id IS NOT NULL
  AND responsible_id NOT IN (SELECT id FROM external_employees);

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
