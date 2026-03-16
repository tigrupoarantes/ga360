-- Migration: cria tabela verbas_sync_jobs para rastreamento assíncrono de syncs
-- Permite polling de status no frontend sem depender do timeout da Edge Function

CREATE TABLE IF NOT EXISTS public.verbas_sync_jobs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ano              integer NOT NULL,
  mes              integer,                            -- null = todos os meses
  status           text NOT NULL DEFAULT 'queued',    -- queued|running|done|error
  pages_fetched    integer NOT NULL DEFAULT 0,
  records_received integer NOT NULL DEFAULT 0,
  records_upserted integer NOT NULL DEFAULT 0,
  records_failed   integer NOT NULL DEFAULT 0,
  started_at       timestamptz NOT NULL DEFAULT now(),
  completed_at     timestamptz,
  error_message    text,
  metadata         jsonb NOT NULL DEFAULT '{}'::jsonb, -- all_pages, max_pages, company_id, etc.
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_verbas_sync_jobs_status  ON public.verbas_sync_jobs(status);
CREATE INDEX idx_verbas_sync_jobs_created ON public.verbas_sync_jobs(created_at DESC);

ALTER TABLE public.verbas_sync_jobs ENABLE ROW LEVEL SECURITY;

-- Usuários autenticados podem ler todos os jobs (tabela diagnóstica global)
CREATE POLICY "Authenticated users read sync jobs"
  ON public.verbas_sync_jobs FOR SELECT
  TO authenticated
  USING (true);

-- INSERT e UPDATE apenas via service_role (Edge Functions com SERVICE_ROLE_KEY)
