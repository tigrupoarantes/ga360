-- ============================================================================
-- COCKPIT GA → GA360 - SCHEMA DE MIGRAÇÃO
-- Gerado em: 2026-03-06
-- Execute APÓS schema-completo.sql
-- ============================================================================
-- INSTRUÇÕES:
-- 1. Execute no SQL Editor do Supabase do GA360
-- 2. Ordem obrigatória: extensões → dimensões → fatos → índices → RLS
-- 3. Este script é idempotente (IF NOT EXISTS / IF EXISTS em todos os comandos)
-- ============================================================================


-- ============================================================================
-- 1. EXTENSÕES AO SCHEMA EXISTENTE DO GA360
-- ============================================================================

-- 1.1 Adicionar módulos do Cockpit ao ENUM system_module
--     Necessário para o sistema de permissões granulares do GA360 cobrir o Cockpit
ALTER TYPE public.system_module ADD VALUE IF NOT EXISTS 'cockpit_comercial';
ALTER TYPE public.system_module ADD VALUE IF NOT EXISTS 'cockpit_mapa';
ALTER TYPE public.system_module ADD VALUE IF NOT EXISTS 'cockpit_logistica';
ALTER TYPE public.system_module ADD VALUE IF NOT EXISTS 'cockpit_admin';


-- 1.2 Estender tabela companies com campos do Cockpit (segmentação por empresa)
--     external_id já existe no GA360 e equivale ao "code" do DAB — nenhuma coluna nova para isso
--     Adicionamos business_type e segment_mode para a lógica de filtros do Cockpit
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS business_type TEXT
    CHECK (business_type IN ('distributor', 'retail', 'hybrid')),
  ADD COLUMN IF NOT EXISTS segment_mode  TEXT
    CHECK (segment_mode  IN ('bu', 'industry', 'store', 'category'));

COMMENT ON COLUMN public.companies.external_id   IS 'Código da empresa no DAB/ERP (equivalente ao "code" do Cockpit)';
COMMENT ON COLUMN public.companies.business_type IS 'Tipo de empresa para o Cockpit: distributor, retail ou hybrid';
COMMENT ON COLUMN public.companies.segment_mode  IS 'Modo de segmentação do Cockpit: bu, industry, store ou category';


-- 1.3 Estender dl_connections para suportar conexões DAB por empresa
--     O cockpit precisa de uma conexão DAB por empresa (api_key diferente por CNPJ/unidade)
ALTER TABLE public.dl_connections
  ADD COLUMN IF NOT EXISTS company_id       UUID
    REFERENCES public.companies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS last_sync_at     TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS last_sync_status TEXT
    CHECK (last_sync_status IN ('success', 'error', 'running', 'pending'));

COMMENT ON COLUMN public.dl_connections.company_id       IS 'Empresa dona desta conexão DAB. NULL = conexão global do sistema';
COMMENT ON COLUMN public.dl_connections.last_sync_at     IS 'Timestamp da última sincronização via esta conexão';
COMMENT ON COLUMN public.dl_connections.last_sync_status IS 'Status da última sincronização: success, error, running, pending';


-- ============================================================================
-- 2. NOVAS TABELAS DO COCKPIT
-- Ordem: dimensões independentes → dimensões com FK → fatos → snapshots
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 2.1 Dimensão Geográfica
--     Fonte: cidade/UF extraídos das vendas do DAB (campo CIDADE_CLIENTE/UF_CLIENTE)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.city_dim (
  id   UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT    NOT NULL,
  uf   CHAR(2) NOT NULL,
  lat  NUMERIC(9,6),
  lng  NUMERIC(9,6),
  UNIQUE (name, uf)
);

COMMENT ON TABLE  public.city_dim      IS 'Dimensão geográfica de cidades para o Cockpit (heatmap, ranking por cidade)';
COMMENT ON COLUMN public.city_dim.lat  IS 'Latitude para renderização no heatmap';
COMMENT ON COLUMN public.city_dim.lng  IS 'Longitude para renderização no heatmap';


-- ----------------------------------------------------------------------------
-- 2.2 Dimensão de Unidades de Negócio (BUs do DAB/ERP)
--     Prefixo "cockpit_" para não conflitar semanticamente com areas do GA360
--     Ex: Sorvetes (Unilever), Linha Seca, Gatorade, Kibon
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cockpit_business_units (
  id         UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID    REFERENCES public.companies(id) ON DELETE CASCADE,
  code       TEXT,
  name       TEXT    NOT NULL,
  is_active  BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (company_id, code)
);

COMMENT ON TABLE  public.cockpit_business_units          IS 'Unidades de Negócio do DAB/ERP para o Cockpit (ex: Sorvetes, Linha Seca, Gatorade). Diferente de "areas" do GA360 que são estrutura organizacional';
COMMENT ON COLUMN public.cockpit_business_units.code     IS 'Código da BU no DAB/ERP';


-- ----------------------------------------------------------------------------
-- 2.3 Dimensão de Indústrias / Fabricantes
--     Nome "industry_dim" para não conflitar com trade_industries do GA360
--     (trade_industries = fornecedores do Trade Marketing; industry_dim = fabricantes do DAB)
--     Ex: Nestlé, Mondelez, PepsiCo
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.industry_dim (
  id         UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID    REFERENCES public.companies(id) ON DELETE CASCADE,
  code       TEXT,
  name       TEXT    NOT NULL,
  is_active  BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (company_id, code)
);

COMMENT ON TABLE  public.industry_dim      IS 'Fabricantes/indústrias do DAB para o Cockpit (Nestlé, Mondelez, PepsiCo). NÃO confundir com trade_industries que é gestão de fornecedores do Trade Marketing';
COMMENT ON COLUMN public.industry_dim.code IS 'Código do fabricante no DAB/ERP';


-- ----------------------------------------------------------------------------
-- 2.4 Dimensão de Clientes (base do ERP)
--     Usada para: positivação, lista de ataque, score de potencial
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.client_dim (
  id                 UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id         UUID    NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code               TEXT    NOT NULL,             -- código ERP / CPF_CNPJ
  name               TEXT,
  channel_code       TEXT,                         -- KA | AS | TRAD
  seller_name        TEXT,
  city_id            UUID    REFERENCES public.city_dim(id) ON DELETE SET NULL,
  potential_score    NUMERIC(5,2),
  last_purchase_date DATE,
  is_active          BOOLEAN NOT NULL DEFAULT true,
  synced_at          TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (company_id, code)
);

COMMENT ON TABLE  public.client_dim                    IS 'Dimensão de clientes do ERP/DAB para o Cockpit (positivação, lista de ataque, score de potencial)';
COMMENT ON COLUMN public.client_dim.code               IS 'Código do cliente no ERP (CPF/CNPJ ou código interno)';
COMMENT ON COLUMN public.client_dim.channel_code       IS 'Canal de atendimento: KA (Key Account), AS (Auto-Serviço), TRAD (Tradicional)';
COMMENT ON COLUMN public.client_dim.potential_score    IS 'Score de potencial de compra calculado pelo DAB (0-100)';
COMMENT ON COLUMN public.client_dim.synced_at          IS 'Timestamp da última sincronização deste cliente com o DAB';


-- ----------------------------------------------------------------------------
-- 2.5 Fato Diário de Vendas — modelo Cockpit (cliente / canal / geo)
--     ATENÇÃO: diferente de sales_daily do GA360 (que é produto/SKU/distribuidor)
--     Fonte: tabela venda_prod do DAB, agregada por cliente+data
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sales_fact_daily (
  id           UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   UUID     NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  sale_date    DATE     NOT NULL,
  client_id    UUID     REFERENCES public.client_dim(id) ON DELETE SET NULL,
  net_value    NUMERIC(15,2) NOT NULL DEFAULT 0,
  order_count  INTEGER  NOT NULL DEFAULT 0,
  channel_code TEXT,                               -- KA | AS | TRAD
  bu_id        UUID     REFERENCES public.cockpit_business_units(id) ON DELETE SET NULL,
  industry_id  UUID     REFERENCES public.industry_dim(id) ON DELETE SET NULL,
  city_id      UUID     REFERENCES public.city_dim(id) ON DELETE SET NULL,
  synced_at    TIMESTAMP WITH TIME ZONE DEFAULT now()
);

COMMENT ON TABLE  public.sales_fact_daily             IS 'Fato de vendas diárias por cliente/canal/geo para o Cockpit. DIFERENTE de sales_daily (que agrega por produto/SKU/distribuidor para o módulo de Metas/OKR)';
COMMENT ON COLUMN public.sales_fact_daily.net_value   IS 'Valor líquido de venda (VL_UNIT_VENDA × QTDE_VENDIDA do DAB)';
COMMENT ON COLUMN public.sales_fact_daily.order_count IS 'Número de pedidos/notas fiscais no dia para este cliente';
COMMENT ON COLUMN public.sales_fact_daily.synced_at   IS 'Timestamp da última carga deste registro via Edge Function';


-- ----------------------------------------------------------------------------
-- 2.6 Snapshot da Base Ativa de Clientes
--     Foto periódica da base ativa por cidade, usada para calcular % de positivação
--     Ex: cidade X tinha 200 clientes ativos → 120 compraram = 60% positivação
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customer_base_snapshot (
  id            UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID    NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  snapshot_date DATE    NOT NULL,
  city_id       UUID    REFERENCES public.city_dim(id) ON DELETE SET NULL,
  client_count  INTEGER NOT NULL DEFAULT 0,
  synced_at     TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (company_id, snapshot_date, city_id)
);

COMMENT ON TABLE  public.customer_base_snapshot              IS 'Snapshot periódico da base ativa de clientes por cidade/empresa. Denominador do cálculo de positivação (% clientes que compraram / base ativa)';
COMMENT ON COLUMN public.customer_base_snapshot.client_count IS 'Total de clientes ativos na cidade na data do snapshot';
COMMENT ON COLUMN public.customer_base_snapshot.snapshot_date IS 'Data de referência do snapshot (normalmente primeiro dia do mês)';


-- ============================================================================
-- 3. ÍNDICES DE PERFORMANCE
-- ============================================================================

-- sales_fact_daily: queries mais frequentes são por empresa+data (KPIs MTD/WTD/DTD)
CREATE INDEX IF NOT EXISTS idx_sfd_company_date
  ON public.sales_fact_daily (company_id, sale_date DESC);

CREATE INDEX IF NOT EXISTS idx_sfd_city
  ON public.sales_fact_daily (city_id);

CREATE INDEX IF NOT EXISTS idx_sfd_channel
  ON public.sales_fact_daily (company_id, channel_code, sale_date DESC);

CREATE INDEX IF NOT EXISTS idx_sfd_bu
  ON public.sales_fact_daily (bu_id);

CREATE INDEX IF NOT EXISTS idx_sfd_industry
  ON public.sales_fact_daily (industry_id);

-- client_dim
CREATE INDEX IF NOT EXISTS idx_client_dim_company
  ON public.client_dim (company_id);

CREATE INDEX IF NOT EXISTS idx_client_dim_city
  ON public.client_dim (city_id);

CREATE INDEX IF NOT EXISTS idx_client_dim_channel
  ON public.client_dim (company_id, channel_code);

CREATE INDEX IF NOT EXISTS idx_client_dim_active
  ON public.client_dim (company_id, is_active);

-- customer_base_snapshot: acesso por empresa + data recente
CREATE INDEX IF NOT EXISTS idx_cbs_company_date
  ON public.customer_base_snapshot (company_id, snapshot_date DESC);

-- city_dim: filtro por UF (filtro global do Cockpit)
CREATE INDEX IF NOT EXISTS idx_city_dim_uf
  ON public.city_dim (uf);

-- cockpit_business_units e industry_dim: lookup por empresa
CREATE INDEX IF NOT EXISTS idx_cockpit_bu_company
  ON public.cockpit_business_units (company_id);

CREATE INDEX IF NOT EXISTS idx_industry_dim_company
  ON public.industry_dim (company_id);

-- dl_connections: lookup de conexão por empresa
CREATE INDEX IF NOT EXISTS idx_dl_connections_company
  ON public.dl_connections (company_id);


-- ============================================================================
-- 4. ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.city_dim               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cockpit_business_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.industry_dim           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_dim             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_fact_daily       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_base_snapshot ENABLE ROW LEVEL SECURITY;


-- city_dim: leitura para todos autenticados / escrita apenas para super_admin e ceo
CREATE POLICY "Authenticated users can view city_dim"
  ON public.city_dim FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Only admins can manage city_dim"
  ON public.city_dim FOR ALL
  USING (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'ceo'::app_role)
  );


-- cockpit_business_units: leitura para todos autenticados
CREATE POLICY "Authenticated users can view cockpit_business_units"
  ON public.cockpit_business_units FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Only admins can manage cockpit_business_units"
  ON public.cockpit_business_units FOR ALL
  USING (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'ceo'::app_role)
  );


-- industry_dim: leitura para todos autenticados
CREATE POLICY "Authenticated users can view industry_dim"
  ON public.industry_dim FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Only admins can manage industry_dim"
  ON public.industry_dim FOR ALL
  USING (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'ceo'::app_role)
  );


-- client_dim: usuário vê apenas clientes das empresas às quais tem acesso (user_companies)
CREATE POLICY "Users can view clients of their companies"
  ON public.client_dim FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_companies uc
      WHERE uc.user_id = auth.uid()
        AND uc.can_view = true
        AND (uc.all_companies = true OR uc.company_id = client_dim.company_id)
    )
    OR has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'ceo'::app_role)
  );

CREATE POLICY "Only admins can manage client_dim"
  ON public.client_dim FOR ALL
  USING (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'ceo'::app_role)
  );


-- sales_fact_daily: usuário vê apenas vendas das suas empresas
CREATE POLICY "Users can view sales of their companies"
  ON public.sales_fact_daily FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_companies uc
      WHERE uc.user_id = auth.uid()
        AND uc.can_view = true
        AND (uc.all_companies = true OR uc.company_id = sales_fact_daily.company_id)
    )
    OR has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'ceo'::app_role)
  );

CREATE POLICY "Only admins can manage sales_fact_daily"
  ON public.sales_fact_daily FOR ALL
  USING (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'ceo'::app_role)
  );


-- customer_base_snapshot: escopo por empresa via user_companies
CREATE POLICY "Users can view snapshots of their companies"
  ON public.customer_base_snapshot FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_companies uc
      WHERE uc.user_id = auth.uid()
        AND uc.can_view = true
        AND (uc.all_companies = true OR uc.company_id = customer_base_snapshot.company_id)
    )
    OR has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'ceo'::app_role)
  );

CREATE POLICY "Only admins can manage customer_base_snapshot"
  ON public.customer_base_snapshot FOR ALL
  USING (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'ceo'::app_role)
  );


-- ============================================================================
-- 5. DADOS DE REFERÊNCIA (seed mínimo)
--    As empresas reais devem ser inseridas/sincronizadas via get-companies Edge Function
--    Inserimos aqui os valores de business_type/segment_mode conhecidos
-- ============================================================================

-- Atualizar empresas existentes com os atributos do Cockpit
-- (ajuste os external_id conforme os códigos reais no DAB)
UPDATE public.companies SET business_type = 'distributor', segment_mode = 'industry'
  WHERE external_id = '2';  -- Chok Distribuidora

UPDATE public.companies SET business_type = 'distributor', segment_mode = 'bu'
  WHERE external_id = '3';  -- Broker Jarantes

UPDATE public.companies SET business_type = 'distributor', segment_mode = 'bu'
  WHERE external_id = '4';  -- G4 Distribuição

UPDATE public.companies SET business_type = 'retail', segment_mode = 'store'
  WHERE external_id = '5';  -- Chokdoce


-- ============================================================================
-- FIM DO SCRIPT
-- ============================================================================
-- Próximos passos:
-- 1. Migrar as 7 Edge Functions do Supabase do cockpit para o Supabase do GA360
--    (dab-proxy, get-companies, kpi-summary, geo-heatmap, city-detail,
--     attack-list, test-api-connection)
-- 2. Copiar src/lib/dab.ts, src/hooks/cockpit/, src/components/cockpit/ para o GA360
-- 3. Adicionar rota /cockpit/* no App.tsx do GA360
-- 4. Adicionar "Cockpit" ao AppleNav do GA360
-- 5. Configurar VITE_DAB_* env vars no GA360 (.env + Vercel)
-- ============================================================================
