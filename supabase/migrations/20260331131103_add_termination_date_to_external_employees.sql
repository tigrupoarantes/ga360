-- Adiciona coluna termination_date para calculo de turnover e filtros de desligados
-- Backfill a partir do metadata JSONB onde dismissal_date ja estava armazenado

-- 1. Nova coluna
ALTER TABLE external_employees ADD COLUMN IF NOT EXISTS termination_date DATE;

-- 2. Indices parciais para queries de turnover
CREATE INDEX IF NOT EXISTS idx_ee_termination_date
  ON external_employees (termination_date) WHERE termination_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ee_company_termination
  ON external_employees (company_id, termination_date) WHERE termination_date IS NOT NULL;

-- 3. Desabilitar trigger de snapshot para evitar criar snapshots durante backfill
ALTER TABLE external_employees DISABLE TRIGGER trigger_capture_external_employee_snapshot;

-- 4. Backfill a partir do metadata JSONB
UPDATE external_employees
SET termination_date = (metadata->>'dismissal_date')::date
WHERE metadata->>'dismissal_date' IS NOT NULL
  AND metadata->>'dismissal_date' != ''
  AND termination_date IS NULL;

-- 5. Corrigir inconsistencia: demitidos marcados como ativos
UPDATE external_employees
SET is_active = false
WHERE termination_date IS NOT NULL AND is_active = true;

-- 6. Reabilitar trigger de snapshot
ALTER TABLE external_employees ENABLE TRIGGER trigger_capture_external_employee_snapshot;
