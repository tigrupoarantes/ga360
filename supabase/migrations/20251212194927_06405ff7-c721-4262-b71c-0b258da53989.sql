-- Fix companies RLS policy (change from RESTRICTIVE to PERMISSIVE)
DROP POLICY IF EXISTS "Authenticated users can view companies" ON companies;
CREATE POLICY "Authenticated users can view companies" 
ON companies FOR SELECT 
TO authenticated 
USING (true);

-- Fix areas RLS policy (change from RESTRICTIVE to PERMISSIVE)
DROP POLICY IF EXISTS "Authenticated users can view areas" ON areas;
CREATE POLICY "Authenticated users can view areas" 
ON areas FOR SELECT 
TO authenticated 
USING (true);