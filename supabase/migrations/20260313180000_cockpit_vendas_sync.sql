-- ============================================================
-- Cockpit de Vendas — Sync Architecture
-- Tabelas para sincronização de dados DAB → Supabase
-- Substitui queries em tempo real por dados pré-sincronizados
-- ============================================================

-- ============================================================
-- 1. Tabela principal: cockpit_vendas_sync
--    Granularidade: 1 linha por (data_ref, numero_pedido, cod_vendedor)
--    Preenche o equivalente ao $apply groupby do DAB
-- ============================================================
CREATE TABLE IF NOT EXISTS public.cockpit_vendas_sync (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid          NOT NULL,
  data_ref        date          NOT NULL,           -- dia da venda
  numero_pedido   text          NOT NULL,
  cod_cliente     text          NOT NULL DEFAULT '',
  cod_vendedor    text          NOT NULL,
  nome_vendedor   text,
  cod_supervisor  text,
  nome_supervisor text,
  nome_da_equipe  text,
  cod_gerente     text,
  nome_gerente    text,
  acao_nao_venda  text,                             -- null = venda; não-nulo = não-venda
  faturamento     numeric(15,2) NOT NULL DEFAULT 0,
  synced_at       timestamptz   NOT NULL DEFAULT now(),

  CONSTRAINT cockpit_vendas_sync_unique
    UNIQUE (company_id, data_ref, numero_pedido, cod_vendedor)
);

-- Índices para padrões de consulta comuns
CREATE INDEX IF NOT EXISTS idx_cvs_company_data
  ON public.cockpit_vendas_sync (company_id, data_ref);

CREATE INDEX IF NOT EXISTS idx_cvs_vendedor
  ON public.cockpit_vendas_sync (company_id, data_ref, cod_vendedor);

CREATE INDEX IF NOT EXISTS idx_cvs_supervisor
  ON public.cockpit_vendas_sync (company_id, data_ref, cod_supervisor);

CREATE INDEX IF NOT EXISTS idx_cvs_gerente
  ON public.cockpit_vendas_sync (company_id, data_ref, cod_gerente);

-- RLS: apenas service_role (Edge Functions usam service key)
ALTER TABLE public.cockpit_vendas_sync ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cockpit_sync_service_only"
  ON public.cockpit_vendas_sync
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- ============================================================
-- 2. Tabela de status: cockpit_vendas_sync_status
--    Rastreia quais dias foram sincronizados por empresa
-- ============================================================
CREATE TABLE IF NOT EXISTS public.cockpit_vendas_sync_status (
  company_id  uuid        NOT NULL,
  data_ref    date        NOT NULL,
  row_count   integer     NOT NULL DEFAULT 0,
  synced_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, data_ref)
);

ALTER TABLE public.cockpit_vendas_sync_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cockpit_sync_status_service_only"
  ON public.cockpit_vendas_sync_status
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- ============================================================
-- Nota operacional:
-- Após o deploy, configure o pg_cron no Supabase Dashboard:
--
--   SELECT cron.schedule(
--     'cockpit-vendas-sync',
--     '*/30 * * * *',
--     $$
--       SELECT net.http_post(
--         url := 'https://zveqhxaiwghexfobjaek.supabase.co/functions/v1/cockpit-vendas-sync',
--         headers := '{"Content-Type":"application/json","Authorization":"Bearer <SERVICE_ROLE_KEY>"}'::jsonb,
--         body := '{"company_id":"<COMPANY_UUID>"}'::jsonb
--       );
--     $$
--   );
-- ============================================================
