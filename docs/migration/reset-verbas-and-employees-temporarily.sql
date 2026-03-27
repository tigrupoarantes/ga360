-- =============================================================================
-- Limpeza controlada de funcionários + verbas durante alterações do DBA
-- =============================================================================
-- Objetivo:
--   Esvaziar temporariamente as tabelas de funcionários e verbas, incluindo a
--   trilha legada, sem depender de TRUNCATE ... CASCADE isolado.
--
-- Tabelas alvo:
--   - public.external_employees
--   - public.external_employee_snapshots
--   - public.payroll_verba_staging
--   - public.payroll_verba_pivot
--   - public.payroll_verba_events
--
-- Quando usar:
--   - Janela operacional controlada
--   - sync-employees e sync-verbas pausados
--   - Alinhamento prévio com o DBA sobre locks/ALTER TABLE em andamento
--
-- Observações:
--   - Preferimos DELETE em vez de TRUNCATE como procedimento principal.
--   - TRUNCATE está incluído ao final como alternativa controlada, apenas
--     depois do pré-check confirmar que não existem novas FKs surpresa.
--   - Este script NÃO pausa jobs automaticamente; isso deve ser feito antes.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0) Checklist manual antes de executar
-- -----------------------------------------------------------------------------
-- [ ] Pausar sync-employees
-- [ ] Pausar sync-verbas
-- [ ] Garantir que não há carga automática escrevendo em external_employees
-- [ ] Confirmar com o DBA que não há ALTER TABLE concorrente nessas tabelas
-- [ ] Rodar os pré-checks abaixo no banco real

-- -----------------------------------------------------------------------------
-- 1) Pré-check: FKs atuais que apontam para as tabelas alvo
-- -----------------------------------------------------------------------------
SELECT
  conrelid::regclass AS tabela_filha,
  confrelid::regclass AS tabela_pai,
  conname AS constraint_name
FROM pg_constraint
WHERE contype = 'f'
  AND confrelid IN (
    'public.external_employees'::regclass,
    'public.external_employee_snapshots'::regclass,
    'public.payroll_verba_staging'::regclass,
    'public.payroll_verba_pivot'::regclass,
    'public.payroll_verba_events'::regclass
  )
ORDER BY confrelid::regclass::text, conrelid::regclass::text;

-- -----------------------------------------------------------------------------
-- 2) Pré-check: sessões/locks que podem competir com a limpeza
-- -----------------------------------------------------------------------------
SELECT
  a.pid,
  a.usename,
  a.application_name,
  a.state,
  a.wait_event_type,
  a.wait_event,
  left(a.query, 200) AS query_excerpt
FROM pg_stat_activity a
WHERE a.state <> 'idle'
  AND (
    a.query ILIKE '%external_employees%'
    OR a.query ILIKE '%external_employee_snapshots%'
    OR a.query ILIKE '%payroll_verba_staging%'
    OR a.query ILIKE '%payroll_verba_pivot%'
    OR a.query ILIKE '%payroll_verba_events%'
    OR a.query ILIKE '%sync-employees%'
    OR a.query ILIKE '%sync-verbas%'
  )
ORDER BY a.query_start NULLS LAST;

-- -----------------------------------------------------------------------------
-- 3) Pré-check: contagem atual antes da limpeza
-- -----------------------------------------------------------------------------
SELECT 'public.payroll_verba_pivot' AS tabela, COUNT(*) AS total
FROM public.payroll_verba_pivot
UNION ALL
SELECT 'public.payroll_verba_staging', COUNT(*)
FROM public.payroll_verba_staging
UNION ALL
SELECT 'public.payroll_verba_events', COUNT(*)
FROM public.payroll_verba_events
UNION ALL
SELECT 'public.external_employee_snapshots', COUNT(*)
FROM public.external_employee_snapshots
UNION ALL
SELECT 'public.external_employees', COUNT(*)
FROM public.external_employees;

-- -----------------------------------------------------------------------------
-- 4) Limpeza principal (recomendada): DELETE em ordem segura
-- -----------------------------------------------------------------------------
BEGIN;

-- Evita ficar preso indefinidamente se o DBA estiver segurando lock forte.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '10min';

DELETE FROM public.payroll_verba_pivot;
DELETE FROM public.payroll_verba_staging;
DELETE FROM public.payroll_verba_events;
DELETE FROM public.external_employee_snapshots;
DELETE FROM public.external_employees;

COMMIT;

-- -----------------------------------------------------------------------------
-- 5) Validação pós-limpeza
-- -----------------------------------------------------------------------------
SELECT 'public.payroll_verba_pivot' AS tabela, COUNT(*) AS total
FROM public.payroll_verba_pivot
UNION ALL
SELECT 'public.payroll_verba_staging', COUNT(*)
FROM public.payroll_verba_staging
UNION ALL
SELECT 'public.payroll_verba_events', COUNT(*)
FROM public.payroll_verba_events
UNION ALL
SELECT 'public.external_employee_snapshots', COUNT(*)
FROM public.external_employee_snapshots
UNION ALL
SELECT 'public.external_employees', COUNT(*)
FROM public.external_employees;

-- -----------------------------------------------------------------------------
-- 6) Alternativa controlada: TRUNCATE explícito
-- -----------------------------------------------------------------------------
-- Use apenas se o pré-check de pg_constraint confirmar que não existem novas
-- dependências além das já conhecidas.
--
-- BEGIN;
-- SET LOCAL lock_timeout = '5s';
-- SET LOCAL statement_timeout = '10min';
--
-- TRUNCATE TABLE
--   public.external_employee_snapshots,
--   public.external_employees,
--   public.payroll_verba_staging,
--   public.payroll_verba_pivot,
--   public.payroll_verba_events
-- RESTART IDENTITY;
--
-- COMMIT;
