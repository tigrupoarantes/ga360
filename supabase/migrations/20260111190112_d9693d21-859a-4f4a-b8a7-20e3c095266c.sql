-- Adicionar external_id na tabela companies
ALTER TABLE companies ADD COLUMN IF NOT EXISTS external_id TEXT;

-- Criar tabela de distribuidoras
CREATE TABLE distributors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL,
  name TEXT NOT NULL,
  code TEXT,
  region TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id, external_id)
);

-- Criar tabela de vendas diárias por produto
CREATE TABLE sales_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  distributor_id UUID REFERENCES distributors(id) ON DELETE CASCADE,
  sale_date DATE NOT NULL,
  product_code TEXT,
  product_name TEXT,
  product_category TEXT,
  quantity NUMERIC DEFAULT 0,
  total_value NUMERIC DEFAULT 0,
  customers_served INTEGER DEFAULT 0,
  external_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id, external_id)
);

-- Criar tabela de vendas por vendedor (para cobertura)
CREATE TABLE sales_sellers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  distributor_id UUID REFERENCES distributors(id) ON DELETE CASCADE,
  sale_date DATE NOT NULL,
  seller_code TEXT NOT NULL,
  seller_name TEXT,
  total_customers INTEGER DEFAULT 0,
  active_customers INTEGER DEFAULT 0,
  total_value NUMERIC DEFAULT 0,
  synced_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id, distributor_id, sale_date, seller_code)
);

-- Criar tabela de logs de sincronização
CREATE TABLE sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  sync_type TEXT NOT NULL,
  records_received INTEGER DEFAULT 0,
  records_created INTEGER DEFAULT 0,
  records_updated INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,
  errors JSONB,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'running'
);

-- Adicionar novos campos na tabela goals
ALTER TABLE goals ADD COLUMN IF NOT EXISTS distributor_id UUID REFERENCES distributors(id);
ALTER TABLE goals ADD COLUMN IF NOT EXISTS metric_type TEXT DEFAULT 'value';
ALTER TABLE goals ADD COLUMN IF NOT EXISTS product_filter TEXT;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS auto_calculate BOOLEAN DEFAULT false;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS last_calculated_at TIMESTAMPTZ;

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_sales_daily_date ON sales_daily(sale_date);
CREATE INDEX IF NOT EXISTS idx_sales_daily_company ON sales_daily(company_id, sale_date);
CREATE INDEX IF NOT EXISTS idx_sales_daily_distributor ON sales_daily(distributor_id, sale_date);
CREATE INDEX IF NOT EXISTS idx_sales_sellers_date ON sales_sellers(sale_date);
CREATE INDEX IF NOT EXISTS idx_sales_sellers_company ON sales_sellers(company_id, sale_date);
CREATE INDEX IF NOT EXISTS idx_distributors_company ON distributors(company_id);
CREATE INDEX IF NOT EXISTS idx_sync_logs_company ON sync_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_goals_distributor ON goals(distributor_id);

-- Enable RLS on new tables
ALTER TABLE distributors ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_sellers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for distributors
CREATE POLICY "Users can view distributors of their company"
ON distributors FOR SELECT
USING (
  company_id IN (
    SELECT company_id FROM user_companies WHERE user_id = auth.uid()
    UNION
    SELECT company_id FROM user_companies WHERE user_id = auth.uid() AND all_companies = true
    UNION
    SELECT id FROM companies WHERE EXISTS (SELECT 1 FROM user_companies WHERE user_id = auth.uid() AND all_companies = true)
  )
);

CREATE POLICY "Users can insert distributors for their company"
ON distributors FOR INSERT
WITH CHECK (
  company_id IN (
    SELECT company_id FROM user_companies WHERE user_id = auth.uid()
    UNION
    SELECT id FROM companies WHERE EXISTS (SELECT 1 FROM user_companies WHERE user_id = auth.uid() AND all_companies = true)
  )
);

CREATE POLICY "Users can update distributors of their company"
ON distributors FOR UPDATE
USING (
  company_id IN (
    SELECT company_id FROM user_companies WHERE user_id = auth.uid()
    UNION
    SELECT id FROM companies WHERE EXISTS (SELECT 1 FROM user_companies WHERE user_id = auth.uid() AND all_companies = true)
  )
);

-- RLS Policies for sales_daily
CREATE POLICY "Users can view sales of their company"
ON sales_daily FOR SELECT
USING (
  company_id IN (
    SELECT company_id FROM user_companies WHERE user_id = auth.uid()
    UNION
    SELECT id FROM companies WHERE EXISTS (SELECT 1 FROM user_companies WHERE user_id = auth.uid() AND all_companies = true)
  )
);

CREATE POLICY "Users can insert sales for their company"
ON sales_daily FOR INSERT
WITH CHECK (
  company_id IN (
    SELECT company_id FROM user_companies WHERE user_id = auth.uid()
    UNION
    SELECT id FROM companies WHERE EXISTS (SELECT 1 FROM user_companies WHERE user_id = auth.uid() AND all_companies = true)
  )
);

CREATE POLICY "Users can update sales of their company"
ON sales_daily FOR UPDATE
USING (
  company_id IN (
    SELECT company_id FROM user_companies WHERE user_id = auth.uid()
    UNION
    SELECT id FROM companies WHERE EXISTS (SELECT 1 FROM user_companies WHERE user_id = auth.uid() AND all_companies = true)
  )
);

-- RLS Policies for sales_sellers
CREATE POLICY "Users can view seller data of their company"
ON sales_sellers FOR SELECT
USING (
  company_id IN (
    SELECT company_id FROM user_companies WHERE user_id = auth.uid()
    UNION
    SELECT id FROM companies WHERE EXISTS (SELECT 1 FROM user_companies WHERE user_id = auth.uid() AND all_companies = true)
  )
);

CREATE POLICY "Users can insert seller data for their company"
ON sales_sellers FOR INSERT
WITH CHECK (
  company_id IN (
    SELECT company_id FROM user_companies WHERE user_id = auth.uid()
    UNION
    SELECT id FROM companies WHERE EXISTS (SELECT 1 FROM user_companies WHERE user_id = auth.uid() AND all_companies = true)
  )
);

CREATE POLICY "Users can update seller data of their company"
ON sales_sellers FOR UPDATE
USING (
  company_id IN (
    SELECT company_id FROM user_companies WHERE user_id = auth.uid()
    UNION
    SELECT id FROM companies WHERE EXISTS (SELECT 1 FROM user_companies WHERE user_id = auth.uid() AND all_companies = true)
  )
);

-- RLS Policies for sync_logs
CREATE POLICY "Users can view sync logs of their company"
ON sync_logs FOR SELECT
USING (
  company_id IN (
    SELECT company_id FROM user_companies WHERE user_id = auth.uid()
    UNION
    SELECT id FROM companies WHERE EXISTS (SELECT 1 FROM user_companies WHERE user_id = auth.uid() AND all_companies = true)
  )
);

CREATE POLICY "Users can insert sync logs for their company"
ON sync_logs FOR INSERT
WITH CHECK (
  company_id IN (
    SELECT company_id FROM user_companies WHERE user_id = auth.uid()
    UNION
    SELECT id FROM companies WHERE EXISTS (SELECT 1 FROM user_companies WHERE user_id = auth.uid() AND all_companies = true)
  )
);

CREATE POLICY "Users can update sync logs of their company"
ON sync_logs FOR UPDATE
USING (
  company_id IN (
    SELECT company_id FROM user_companies WHERE user_id = auth.uid()
    UNION
    SELECT id FROM companies WHERE EXISTS (SELECT 1 FROM user_companies WHERE user_id = auth.uid() AND all_companies = true)
  )
);

-- Create service role policy for edge functions (using API key auth)
CREATE POLICY "Service role can manage distributors"
ON distributors FOR ALL
USING (true)
WITH CHECK (true);

CREATE POLICY "Service role can manage sales_daily"
ON sales_daily FOR ALL
USING (true)
WITH CHECK (true);

CREATE POLICY "Service role can manage sales_sellers"
ON sales_sellers FOR ALL
USING (true)
WITH CHECK (true);

CREATE POLICY "Service role can manage sync_logs"
ON sync_logs FOR ALL
USING (true)
WITH CHECK (true);