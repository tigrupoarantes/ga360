-- Security fix: two_factor_codes RLS was USING(true) — any authenticated user could read/write other users' 2FA codes
-- This migration restricts access to service_role only

ALTER POLICY "System can manage 2fa codes"
  ON public.two_factor_codes
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
