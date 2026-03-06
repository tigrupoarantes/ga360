-- Migration: public_api_keys
-- Chaves de API para integrações externas (n8n, MCP, automações)
-- A chave completa NUNCA é armazenada — apenas o SHA-256 hash

CREATE TABLE public.public_api_keys (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   UUID        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name         TEXT        NOT NULL,
  key_hash     TEXT        NOT NULL UNIQUE, -- SHA-256 hex da chave completa
  key_prefix   TEXT        NOT NULL,        -- primeiros 20 chars para exibição (ex: ga360_AbCd1234...)
  permissions  TEXT[]      NOT NULL DEFAULT ARRAY[
    'goals:read','goals:write',
    'meetings:read','meetings:write',
    'kpis:read',
    'companies:read',
    'webhooks:read','webhooks:write'
  ],
  is_active    BOOLEAN     NOT NULL DEFAULT true,
  last_used_at TIMESTAMPTZ,
  created_by   UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.public_api_keys ENABLE ROW LEVEL SECURITY;

-- Apenas roles de gestão da mesma company podem ver/criar/revogar
CREATE POLICY "Managers can manage their company api keys"
  ON public.public_api_keys
  FOR ALL
  USING (
    company_id IN (
      SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('super_admin', 'ceo', 'diretor')
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('super_admin', 'ceo', 'diretor')
    )
  );

-- Index para lookup rápido por hash (chamado em cada request da API)
CREATE INDEX idx_public_api_keys_hash ON public.public_api_keys(key_hash) WHERE is_active = true;
CREATE INDEX idx_public_api_keys_company ON public.public_api_keys(company_id);
