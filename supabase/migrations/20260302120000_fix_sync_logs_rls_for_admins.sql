-- Fix: Allow super_admins and admins to view all sync_logs regardless of company_id.
-- Previously, users without entries in user_companies (e.g. super_admins assigned via
-- user_roles only) could not see any sync_logs because the SELECT policy required
-- company_id to be in the user's user_companies set.

-- Drop only the old SELECT policy, keep INSERT/UPDATE policies as-is
DROP POLICY IF EXISTS "Users can view sync logs of their company" ON sync_logs;

-- Recreate SELECT policy: regular users see their company's logs,
-- super_admins and admins see all logs (including those with company_id = null)
CREATE POLICY "Users can view sync logs of their company"
ON sync_logs FOR SELECT
USING (
  -- Regular users: company match via user_companies
  company_id IN (
    SELECT company_id FROM user_companies WHERE user_id = auth.uid()
    UNION
    SELECT id FROM companies WHERE EXISTS (
      SELECT 1 FROM user_companies WHERE user_id = auth.uid() AND all_companies = true
    )
  )
  OR
  -- Super admins and CEOs see all sync_logs regardless of company
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('super_admin', 'ceo', 'diretor')
  )
);
