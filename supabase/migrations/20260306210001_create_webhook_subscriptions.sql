-- Migration: webhook_subscriptions
-- Endpoints registrados para receber eventos do GA360 (n8n, Make, etc.)

CREATE TABLE public.webhook_subscriptions (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id     UUID        NOT NULL REFERENCES public.public_api_keys(id) ON DELETE CASCADE,
  company_id     UUID        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name           TEXT        NOT NULL DEFAULT '',
  url            TEXT        NOT NULL,
  events         TEXT[]      NOT NULL, -- ex: ARRAY['goal.created','meeting.updated']
  secret         TEXT        NOT NULL, -- HMAC-SHA256 signing secret (armazenado em plaintext p/ assinar)
  is_active      BOOLEAN     NOT NULL DEFAULT true,
  last_called_at TIMESTAMPTZ,
  last_status    INT,                  -- último HTTP status recebido do endpoint
  failure_count  INT         NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.webhook_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Api key owner manages webhooks"
  ON public.webhook_subscriptions
  FOR ALL
  USING (
    api_key_id IN (
      SELECT id FROM public.public_api_keys WHERE company_id IN (
        SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    api_key_id IN (
      SELECT id FROM public.public_api_keys WHERE company_id IN (
        SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid()
      )
    )
  );

CREATE INDEX idx_webhook_subscriptions_api_key ON public.webhook_subscriptions(api_key_id);
CREATE INDEX idx_webhook_subscriptions_company ON public.webhook_subscriptions(company_id);

-- Eventos válidos (documentação):
-- goal.created, goal.updated, goal.progress_added
-- meeting.created, meeting.updated, meeting.status_changed
