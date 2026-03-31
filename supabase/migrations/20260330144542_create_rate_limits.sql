-- Rate limiting table for Edge Functions (auth endpoints, webhooks, API)
-- Used by _shared/rate-limit.ts

CREATE TABLE IF NOT EXISTS public.rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL,
  request_count integer NOT NULL DEFAULT 0,
  window_start timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Unique constraint on key for upsert behavior
CREATE UNIQUE INDEX idx_rate_limits_key ON public.rate_limits (key);

-- Index for cleanup of expired windows
CREATE INDEX idx_rate_limits_window_start ON public.rate_limits (window_start);

-- RLS: only service_role can access (Edge Functions use service_role)
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_only_rate_limits"
  ON public.rate_limits FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Cleanup function: remove expired entries older than 24h
CREATE OR REPLACE FUNCTION clean_expired_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.rate_limits
  WHERE window_start < now() - interval '24 hours';
END;
$$;
