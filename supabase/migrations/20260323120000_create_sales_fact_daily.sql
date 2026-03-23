-- Tabela de KPIs diários agregados por empresa (multi-tenant, ~5K linhas/ano)
-- Alimentada por cockpit-sales-sync 1x/dia a partir do DAB (sales_daily)
CREATE TABLE IF NOT EXISTS public.sales_fact_daily (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  tenant_id       text NOT NULL,           -- código DAB (ex: "5")
  dt_ref          date NOT NULL,
  faturamento     numeric(15,2) DEFAULT 0,
  pedidos         integer DEFAULT 0,
  ticket_medio    numeric(15,2) DEFAULT 0,
  positivacao     integer DEFAULT 0,       -- clientes com pedido
  nao_vendas      integer DEFAULT 0,       -- clientes sem pedido
  synced_at       timestamptz DEFAULT now(),
  UNIQUE (company_id, dt_ref)
);

ALTER TABLE public.sales_fact_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Empresa só vê seus próprios dados de vendas"
  ON public.sales_fact_daily
  FOR ALL
  USING (
    company_id IN (
      SELECT company_id FROM user_companies
      WHERE user_id = auth.uid()
    )
  );

-- Índice principal: queries de período por empresa
CREATE INDEX IF NOT EXISTS idx_sales_fact_daily_company_date
  ON public.sales_fact_daily (company_id, dt_ref DESC);

-- Índice por tenant_id para lookups durante sync
CREATE INDEX IF NOT EXISTS idx_sales_fact_daily_tenant
  ON public.sales_fact_daily (tenant_id);
