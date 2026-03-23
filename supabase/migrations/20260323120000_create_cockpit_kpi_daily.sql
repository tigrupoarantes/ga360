-- Tabela de KPIs diários agregados por empresa (multi-tenant, ~5K linhas/ano)
-- Alimentada por cockpit-sales-sync 1x/dia a partir do DAB (sales_daily)
-- NOTA: não confundir com sales_fact_daily (fato cliente/canal/geo — outra granularidade)
CREATE TABLE IF NOT EXISTS public.cockpit_kpi_daily (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  tenant_id       text NOT NULL,           -- código DAB (ex: "5", "CHOK_DISTRIBUIDORA_...")
  dt_ref          date NOT NULL,
  faturamento     numeric(15,2) DEFAULT 0,
  pedidos         integer DEFAULT 0,
  ticket_medio    numeric(15,2) DEFAULT 0,
  positivacao     integer DEFAULT 0,       -- clientes com pedido
  nao_vendas      integer DEFAULT 0,       -- clientes sem pedido
  synced_at       timestamptz DEFAULT now(),
  UNIQUE (company_id, dt_ref)
);

ALTER TABLE public.cockpit_kpi_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Empresa só vê seus próprios KPIs diários"
  ON public.cockpit_kpi_daily
  FOR ALL
  USING (
    company_id IN (
      SELECT company_id FROM user_companies
      WHERE user_id = auth.uid()
    )
  );

-- Índice principal: queries de período por empresa
CREATE INDEX IF NOT EXISTS idx_cockpit_kpi_daily_company_date
  ON public.cockpit_kpi_daily (company_id, dt_ref DESC);

-- Índice por tenant_id para lookups durante sync
CREATE INDEX IF NOT EXISTS idx_cockpit_kpi_daily_tenant
  ON public.cockpit_kpi_daily (tenant_id);
