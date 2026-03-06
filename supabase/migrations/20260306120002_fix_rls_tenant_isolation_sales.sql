-- Security fix: distributors, sales_daily, sales_sellers, sync_logs had "Service role" policies
-- with USING(true) WITHOUT checking auth.role() = 'service_role'.
-- In Supabase, permissive policies combine with OR — so USING(true) was overriding
-- all company_id tenant-isolation policies, exposing all tenant data to any authenticated user.

-- distributors
DROP POLICY IF EXISTS "Service role can manage distributors" ON distributors;
CREATE POLICY "Service role can manage distributors"
  ON distributors FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- sales_daily
DROP POLICY IF EXISTS "Service role can manage sales_daily" ON sales_daily;
CREATE POLICY "Service role can manage sales_daily"
  ON sales_daily FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- sales_sellers
DROP POLICY IF EXISTS "Service role can manage sales_sellers" ON sales_sellers;
CREATE POLICY "Service role can manage sales_sellers"
  ON sales_sellers FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- sync_logs
DROP POLICY IF EXISTS "Service role can manage sync_logs" ON sync_logs;
CREATE POLICY "Service role can manage sync_logs"
  ON sync_logs FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
