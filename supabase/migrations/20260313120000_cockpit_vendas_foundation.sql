-- ============================================================
-- Cockpit de Vendas — Fundação (F1)
-- Módulo: cockpit_vendas
-- Empresa alvo inicial: Chok Distribuidora
-- ============================================================

-- 1. Adicionar cockpit_vendas ao enum system_module
ALTER TYPE public.system_module ADD VALUE IF NOT EXISTS 'cockpit_vendas';

-- ============================================================
-- 2. Tabela: cockpit_user_vendor_link
--    Vínculo entre usuário GA 360 e código de vendedor no DAB
-- ============================================================
CREATE TABLE IF NOT EXISTS public.cockpit_user_vendor_link (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id    uuid        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  cod_vendedor  text        NOT NULL,
  nivel_acesso  text        NOT NULL CHECK (nivel_acesso IN ('vendedor', 'supervisor', 'gerente', 'diretoria')),
  ativo         boolean     NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, company_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_cockpit_vendor_link_user    ON public.cockpit_user_vendor_link (user_id);
CREATE INDEX IF NOT EXISTS idx_cockpit_vendor_link_company ON public.cockpit_user_vendor_link (company_id);
CREATE INDEX IF NOT EXISTS idx_cockpit_vendor_link_cod     ON public.cockpit_user_vendor_link (cod_vendedor);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.set_cockpit_vendor_link_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER cockpit_vendor_link_updated_at
  BEFORE UPDATE ON public.cockpit_user_vendor_link
  FOR EACH ROW EXECUTE FUNCTION public.set_cockpit_vendor_link_updated_at();

-- RLS
ALTER TABLE public.cockpit_user_vendor_link ENABLE ROW LEVEL SECURITY;

-- super_admin e ceo gerenciam todos os vínculos
CREATE POLICY "cockpit_vendor_link_admin_all"
  ON public.cockpit_user_vendor_link
  FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'ceo'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'ceo'));

-- Usuário lê apenas o próprio vínculo
CREATE POLICY "cockpit_vendor_link_self_read"
  ON public.cockpit_user_vendor_link
  FOR SELECT
  USING (auth.uid() = user_id);

-- ============================================================
-- 3. Tabela: cockpit_cache_daily
--    Cache de resultados do DAB para reduzir latência e custos
--    TTL: 15 min para KPIs, 5 min para listagens
-- ============================================================
CREATE TABLE IF NOT EXISTS public.cockpit_cache_daily (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key   text        NOT NULL UNIQUE,
  payload     jsonb       NOT NULL,
  ttl_minutes integer     NOT NULL DEFAULT 15,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL
);

-- Trigger: calcula expires_at automaticamente no INSERT/UPDATE
CREATE OR REPLACE FUNCTION public.set_cockpit_cache_expires_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.expires_at := NEW.created_at + (NEW.ttl_minutes * interval '1 minute');
  RETURN NEW;
END; $$;

CREATE TRIGGER cockpit_cache_expires_at
  BEFORE INSERT OR UPDATE ON public.cockpit_cache_daily
  FOR EACH ROW EXECUTE FUNCTION public.set_cockpit_cache_expires_at();

CREATE INDEX IF NOT EXISTS idx_cockpit_cache_key        ON public.cockpit_cache_daily (cache_key);
CREATE INDEX IF NOT EXISTS idx_cockpit_cache_expires_at ON public.cockpit_cache_daily (expires_at);

-- RLS: apenas service_role acessa (Edge Function usa service key)
ALTER TABLE public.cockpit_cache_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cockpit_cache_service_only"
  ON public.cockpit_cache_daily
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- ============================================================
-- Nota: configurar pg_cron job no Supabase Dashboard:
--   SELECT cron.schedule(
--     'clean-cockpit-cache',
--     '*/30 * * * *',
--     $$DELETE FROM public.cockpit_cache_daily WHERE expires_at < now()$$
--   );
-- ============================================================
