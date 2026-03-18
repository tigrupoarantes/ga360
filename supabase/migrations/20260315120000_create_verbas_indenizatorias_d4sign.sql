-- ============================================================
-- Verbas Indenizatórias + D4Sign
-- Módulo: Governança EC > Pessoas & Cultura
-- ============================================================

-- ============================================================
-- 1. d4sign_config
-- Credenciais D4Sign por company (chaves sensíveis)
-- ============================================================
CREATE TABLE public.d4sign_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  token_api TEXT NOT NULL,
  crypt_key TEXT NOT NULL,
  safe_id TEXT,
  environment TEXT NOT NULL DEFAULT 'sandbox',
  base_url TEXT NOT NULL DEFAULT 'https://sandbox.d4sign.com.br/api/v1',
  webhook_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id)
);

-- ============================================================
-- 2. d4sign_document_templates
-- Templates de documentos com placeholders do DP
-- ============================================================
CREATE TABLE public.d4sign_document_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  template_type TEXT NOT NULL DEFAULT 'verba_indenizatoria',
  template_html TEXT,
  template_file_path TEXT,
  fields_schema JSONB NOT NULL DEFAULT '[]',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 3. verba_indenizatoria_documents
-- Documentos gerados e seus status de assinatura D4Sign
-- ============================================================
CREATE TABLE public.verba_indenizatoria_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  template_id UUID REFERENCES public.d4sign_document_templates(id),

  -- Snapshot do funcionário no momento da geração
  employee_name TEXT NOT NULL,
  employee_cpf TEXT NOT NULL,
  employee_email TEXT,
  employee_department TEXT,
  employee_position TEXT,
  employee_unit TEXT,
  employee_accounting_group TEXT,

  -- Dados financeiros (snapshot do Datalake)
  competencia TEXT NOT NULL,
  ano INTEGER NOT NULL,
  mes INTEGER NOT NULL,
  valor_verba NUMERIC(14,2) NOT NULL DEFAULT 0,
  valor_adiantamento NUMERIC(14,2) NOT NULL DEFAULT 0,
  payload_json JSONB,

  -- D4Sign
  d4sign_document_uuid TEXT,
  d4sign_safe_uuid TEXT,
  d4sign_status TEXT NOT NULL DEFAULT 'draft',
  -- Status: draft | uploaded | signers_added | sent_to_sign |
  --         waiting_signature | signed | cancelled | expired | error
  d4sign_signer_key TEXT,
  d4sign_signer_email TEXT,
  d4sign_sent_at TIMESTAMPTZ,
  d4sign_signed_at TIMESTAMPTZ,
  d4sign_cancelled_at TIMESTAMPTZ,
  d4sign_error_message TEXT,

  -- Arquivos no Storage
  generated_file_path TEXT,
  signed_file_path TEXT,

  -- Notificações
  email_sent_at TIMESTAMPTZ,
  email_reminder_count INTEGER NOT NULL DEFAULT 0,
  last_reminder_at TIMESTAMPTZ,

  -- Controle
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_vi_docs_company_competencia
  ON public.verba_indenizatoria_documents (company_id, competencia);
CREATE INDEX idx_vi_docs_company_cpf
  ON public.verba_indenizatoria_documents (company_id, employee_cpf);
CREATE INDEX idx_vi_docs_d4sign_uuid
  ON public.verba_indenizatoria_documents (d4sign_document_uuid);
CREATE INDEX idx_vi_docs_status
  ON public.verba_indenizatoria_documents (d4sign_status);

-- ============================================================
-- 4. verba_indenizatoria_logs
-- Audit log de todas as ações por documento
-- ============================================================
CREATE TABLE public.verba_indenizatoria_logs (
  id BIGSERIAL PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES public.verba_indenizatoria_documents(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  -- Ações: created | uploaded_to_d4sign | signer_added | sent_to_sign |
  --        webhook_received | signed | downloaded | email_sent |
  --        reminder_sent | cancelled | error
  details JSONB,
  performed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_vi_logs_document ON public.verba_indenizatoria_logs (document_id);

-- ============================================================
-- 5. RLS
-- ============================================================

-- d4sign_config: apenas service_role (chaves sensíveis)
ALTER TABLE public.d4sign_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only_d4sign_config"
  ON public.d4sign_config FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- d4sign_document_templates: autenticados podem ler, service_role pode escrever
ALTER TABLE public.d4sign_document_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_read_d4sign_templates"
  ON public.d4sign_document_templates FOR SELECT
  USING (auth.role() = 'authenticated');
CREATE POLICY "service_role_write_d4sign_templates"
  ON public.d4sign_document_templates FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- verba_indenizatoria_documents: service_role apenas (dados financeiros sensíveis)
ALTER TABLE public.verba_indenizatoria_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only_vi_documents"
  ON public.verba_indenizatoria_documents FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- verba_indenizatoria_logs: service_role apenas
ALTER TABLE public.verba_indenizatoria_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only_vi_logs"
  ON public.verba_indenizatoria_logs FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- 6. Storage Bucket
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'verbas-indenizatorias',
  'verbas-indenizatorias',
  false,
  10485760, -- 10MB
  ARRAY['application/pdf']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- RLS do bucket: apenas service_role acessa
CREATE POLICY "service_role_only_vi_storage"
  ON storage.objects FOR ALL
  USING (bucket_id = 'verbas-indenizatorias' AND auth.role() = 'service_role')
  WITH CHECK (bucket_id = 'verbas-indenizatorias' AND auth.role() = 'service_role');

-- ============================================================
-- 7. SEED: Card EC "Verbas Indenizatórias" em Pessoas & Cultura
-- O trigger auto_seed_governanca_card_permissions cuida do seeding
-- de permissões automaticamente para todos os usuários com acesso
-- ============================================================
DO $$
DECLARE
  v_area_id UUID;
BEGIN
  SELECT id INTO v_area_id
  FROM public.ec_areas
  WHERE slug = 'pessoas-cultura'
    AND is_active = true
  LIMIT 1;

  IF v_area_id IS NOT NULL THEN
    INSERT INTO public.ec_cards (
      area_id,
      title,
      description,
      periodicity_type,
      is_active,
      "order"
    ) VALUES (
      v_area_id,
      'Verbas Indenizatórias',
      'Geração de documentos de verbas indenizatórias com assinatura digital via D4Sign. Acompanhe status de assinatura, envie notificações e arquive documentos assinados.',
      'monthly',
      true,
      101
    )
    ON CONFLICT DO NOTHING;
  END IF;
END;
$$;
