-- Migration: global API keys for MCP (super_admin access to all companies)
-- Torna company_id nullable e adiciona flag is_global para chaves cross-company

-- 1. Make company_id nullable (idempotent: ok to run if already nullable)
DO $$ BEGIN
  ALTER TABLE public.public_api_keys ALTER COLUMN company_id DROP NOT NULL;
EXCEPTION WHEN others THEN NULL; END $$;

-- 2. Add is_global flag
ALTER TABLE public.public_api_keys
  ADD COLUMN IF NOT EXISTS is_global BOOLEAN NOT NULL DEFAULT false;

-- 3. Constraint: every key must have company_id OR is_global = true
DO $$ BEGIN
  ALTER TABLE public.public_api_keys
    ADD CONSTRAINT check_company_or_global
    CHECK (company_id IS NOT NULL OR is_global = true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 4. Rebuild RLS policy to include global-key management by super_admin
DROP POLICY IF EXISTS "Managers can manage their company api keys" ON public.public_api_keys;

CREATE POLICY "Managers can manage their company api keys"
  ON public.public_api_keys
  FOR ALL
  USING (
    (
      -- Chaves de empresa: mesmo comportamento anterior
      company_id IS NOT NULL
      AND company_id IN (
        SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid()
      )
      AND EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.role IN ('super_admin', 'ceo', 'diretor')
      )
    )
    OR
    (
      -- Chaves globais: apenas super_admin pode ver/criar
      is_global = true
      AND EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.role = 'super_admin'
      )
    )
  )
  WITH CHECK (
    (
      company_id IS NOT NULL
      AND company_id IN (
        SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid()
      )
      AND EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.role IN ('super_admin', 'ceo', 'diretor')
      )
    )
    OR
    (
      is_global = true
      AND EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.role = 'super_admin'
      )
    )
  );

-- 5. Index for global key lookup
CREATE INDEX IF NOT EXISTS idx_public_api_keys_global ON public.public_api_keys(is_global) WHERE is_global = true AND is_active = true;
