-- ============================================================
-- Fix: pj_contracts FK must point to profiles, not auth.users
-- ============================================================
-- PostgREST cannot traverse auth schema for joins.
-- The query uses profiles!pj_contracts_manager_user_id_fkey
-- but the FK pointed to auth.users → "relationship not found".
--
-- Also fix created_by FKs on all PJ tables for consistency.

-- 1. pj_contracts.manager_user_id → profiles
ALTER TABLE public.pj_contracts
  DROP CONSTRAINT IF EXISTS pj_contracts_manager_user_id_fkey;
ALTER TABLE public.pj_contracts
  ADD CONSTRAINT pj_contracts_manager_user_id_fkey
  FOREIGN KEY (manager_user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 2. pj_contracts.created_by → profiles
ALTER TABLE public.pj_contracts
  DROP CONSTRAINT IF EXISTS pj_contracts_created_by_fkey;
ALTER TABLE public.pj_contracts
  ADD CONSTRAINT pj_contracts_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 3. pj_vacation_events.created_by → profiles
ALTER TABLE public.pj_vacation_events
  DROP CONSTRAINT IF EXISTS pj_vacation_events_created_by_fkey;
ALTER TABLE public.pj_vacation_events
  ADD CONSTRAINT pj_vacation_events_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 4. pj_closings.created_by → profiles
ALTER TABLE public.pj_closings
  DROP CONSTRAINT IF EXISTS pj_closings_created_by_fkey;
ALTER TABLE public.pj_closings
  ADD CONSTRAINT pj_closings_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
