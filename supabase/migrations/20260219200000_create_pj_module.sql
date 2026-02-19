-- ============================================================
-- Módulo: Controle PJ (Pessoas & Cultura)
-- Descrição: Gestão de colaboradores PJ, fechamento mensal,
--            banco de folgas, holerite PDF e envio por e-mail.
-- ============================================================

-- ============================================================
-- 1. TABELAS
-- ============================================================

-- 1.1 Contratos PJ
CREATE TABLE IF NOT EXISTS public.pj_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  document TEXT NOT NULL,            -- CNPJ/CPF/MEI
  email TEXT NOT NULL,
  manager_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  cost_center_id UUID REFERENCES public.areas(id) ON DELETE SET NULL,
  monthly_value NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_day INT DEFAULT 10,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'suspended', 'ended')),
  -- Folgas
  vacation_enabled BOOLEAN NOT NULL DEFAULT true,
  vacation_entitlement_days INT NOT NULL DEFAULT 30,
  -- 13º
  thirteenth_enabled BOOLEAN NOT NULL DEFAULT true,
  thirteenth_payment_month INT NOT NULL DEFAULT 12,
  -- 14º
  fourteenth_enabled BOOLEAN NOT NULL DEFAULT false,
  fourteenth_mode TEXT DEFAULT 'manual_by_goal',
  -- Saúde
  health_enabled BOOLEAN NOT NULL DEFAULT true,
  health_dependent_unit_value NUMERIC(12,2) NOT NULL DEFAULT 0,
  health_dependents_count INT NOT NULL DEFAULT 0,
  -- Metadados
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pj_contracts_company ON public.pj_contracts(company_id);
CREATE INDEX idx_pj_contracts_status ON public.pj_contracts(status);
CREATE INDEX idx_pj_contracts_manager ON public.pj_contracts(manager_user_id);

-- 1.2 Eventos de folga
CREATE TABLE IF NOT EXISTS public.pj_vacation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES public.pj_contracts(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days INT NOT NULL CHECK (days >= 1 AND days <= 30),
  note TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pj_vacation_events_contract ON public.pj_vacation_events(contract_id);
CREATE INDEX idx_pj_vacation_events_year ON public.pj_vacation_events(EXTRACT(YEAR FROM start_date));

-- 1.3 Cache de saldo anual de folgas
CREATE TABLE IF NOT EXISTS public.pj_vacation_balance (
  contract_id UUID NOT NULL REFERENCES public.pj_contracts(id) ON DELETE CASCADE,
  year INT NOT NULL,
  entitlement_days INT NOT NULL DEFAULT 30,
  used_days INT NOT NULL DEFAULT 0,
  remaining_days INT NOT NULL DEFAULT 30,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (contract_id, year)
);

-- 1.4 Fechamentos mensais
CREATE TABLE IF NOT EXISTS public.pj_closings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES public.pj_contracts(id) ON DELETE CASCADE,
  competence TEXT NOT NULL,            -- formato YYYY-MM
  -- Valores
  base_value NUMERIC(12,2) NOT NULL DEFAULT 0,
  restaurant_discount_value NUMERIC(12,2) NOT NULL DEFAULT 0,
  health_dependents_discount_value NUMERIC(12,2) NOT NULL DEFAULT 0,
  health_coparticipation_discount_value NUMERIC(12,2) NOT NULL DEFAULT 0,
  other_items JSONB DEFAULT '[]'::jsonb,
  thirteenth_paid_value NUMERIC(12,2) NOT NULL DEFAULT 0,
  fourteenth_paid_value NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_value NUMERIC(12,2) NOT NULL DEFAULT 0,
  -- Status e evidências
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'closed', 'paid')),
  paid_at TIMESTAMPTZ,
  receipt_url TEXT,
  -- Holerite e e-mail
  payslip_pdf_url TEXT,
  payslip_generated_at TIMESTAMPTZ,
  email_status TEXT DEFAULT 'pending'
    CHECK (email_status IN ('pending', 'queued', 'sent', 'failed')),
  email_sent_at TIMESTAMPTZ,
  email_error TEXT,
  -- Metadados
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Unicidade: um fechamento por PJ por competência
  UNIQUE(contract_id, competence)
);

CREATE INDEX idx_pj_closings_contract ON public.pj_closings(contract_id);
CREATE INDEX idx_pj_closings_competence ON public.pj_closings(competence);
CREATE INDEX idx_pj_closings_status ON public.pj_closings(status);

-- 1.5 Logs de e-mail
CREATE TABLE IF NOT EXISTS public.pj_email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  closing_id UUID NOT NULL REFERENCES public.pj_closings(id) ON DELETE CASCADE,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'sent', 'failed')),
  provider_message_id TEXT,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pj_email_logs_closing ON public.pj_email_logs(closing_id);

-- ============================================================
-- 2. FUNÇÕES
-- ============================================================

-- 2.1 Recalcular saldo de folgas de um contrato/ano
CREATE OR REPLACE FUNCTION public.recalc_pj_vacation_balance(
  p_contract_id UUID,
  p_year INT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_entitlement INT;
  v_used INT;
BEGIN
  -- Obter dias de direito do contrato
  SELECT COALESCE(vacation_entitlement_days, 30)
    INTO v_entitlement
    FROM public.pj_contracts
   WHERE id = p_contract_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Somar dias utilizados nesse ano
  SELECT COALESCE(SUM(days), 0)
    INTO v_used
    FROM public.pj_vacation_events
   WHERE contract_id = p_contract_id
     AND EXTRACT(YEAR FROM start_date) = p_year;

  -- Upsert no cache
  INSERT INTO public.pj_vacation_balance (contract_id, year, entitlement_days, used_days, remaining_days, updated_at)
  VALUES (p_contract_id, p_year, v_entitlement, v_used, GREATEST(v_entitlement - v_used, 0), now())
  ON CONFLICT (contract_id, year) DO UPDATE SET
    entitlement_days = v_entitlement,
    used_days = v_used,
    remaining_days = GREATEST(v_entitlement - v_used, 0),
    updated_at = now();
END;
$$;

-- ============================================================
-- 3. TRIGGERS
-- ============================================================

-- 3.1 Trigger para recalcular saldo ao inserir/alterar/excluir evento de folga
CREATE OR REPLACE FUNCTION public.trg_pj_vacation_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_year INT;
  v_contract UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_contract := OLD.contract_id;
    v_year := EXTRACT(YEAR FROM OLD.start_date);
  ELSE
    v_contract := NEW.contract_id;
    v_year := EXTRACT(YEAR FROM NEW.start_date);
  END IF;

  PERFORM public.recalc_pj_vacation_balance(v_contract, v_year);

  -- Se update mudou o ano, recalcular o ano antigo também
  IF TG_OP = 'UPDATE' AND EXTRACT(YEAR FROM OLD.start_date) <> EXTRACT(YEAR FROM NEW.start_date) THEN
    PERFORM public.recalc_pj_vacation_balance(OLD.contract_id, EXTRACT(YEAR FROM OLD.start_date)::INT);
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pj_vacation_events_balance ON public.pj_vacation_events;
CREATE TRIGGER trg_pj_vacation_events_balance
  AFTER INSERT OR UPDATE OR DELETE ON public.pj_vacation_events
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_pj_vacation_balance();

-- 3.2 Trigger para updated_at automático
CREATE OR REPLACE FUNCTION public.trg_pj_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pj_contracts_updated ON public.pj_contracts;
CREATE TRIGGER trg_pj_contracts_updated
  BEFORE UPDATE ON public.pj_contracts
  FOR EACH ROW EXECUTE FUNCTION public.trg_pj_set_updated_at();

DROP TRIGGER IF EXISTS trg_pj_closings_updated ON public.pj_closings;
CREATE TRIGGER trg_pj_closings_updated
  BEFORE UPDATE ON public.pj_closings
  FOR EACH ROW EXECUTE FUNCTION public.trg_pj_set_updated_at();

-- ============================================================
-- 4. RLS (Row Level Security)
-- ============================================================

ALTER TABLE public.pj_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pj_vacation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pj_vacation_balance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pj_closings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pj_email_logs ENABLE ROW LEVEL SECURITY;

-- Helper: buscar o card_id do Controle PJ dinamicamente
CREATE OR REPLACE FUNCTION public.get_pj_card_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT id FROM public.ec_cards
  WHERE is_active = true
    AND (title ILIKE '%controle pj%' OR title ILIKE '%controle de pj%')
  LIMIT 1;
$$;

-- ---- pj_contracts ----

-- SELECT: can_view no card + acesso à empresa
CREATE POLICY "pj_contracts_select" ON public.pj_contracts
  FOR SELECT USING (
    has_role(auth.uid(), 'super_admin')
    OR (
      has_card_permission(auth.uid(), public.get_pj_card_id(), 'view')
      AND has_company_access(auth.uid(), company_id)
    )
  );

-- INSERT: can_fill no card + acesso à empresa
CREATE POLICY "pj_contracts_insert" ON public.pj_contracts
  FOR INSERT WITH CHECK (
    has_role(auth.uid(), 'super_admin')
    OR (
      has_card_permission(auth.uid(), public.get_pj_card_id(), 'fill')
      AND has_company_access(auth.uid(), company_id)
    )
  );

-- UPDATE: can_fill no card + acesso à empresa
CREATE POLICY "pj_contracts_update" ON public.pj_contracts
  FOR UPDATE USING (
    has_role(auth.uid(), 'super_admin')
    OR (
      has_card_permission(auth.uid(), public.get_pj_card_id(), 'fill')
      AND has_company_access(auth.uid(), company_id)
    )
  );

-- DELETE: can_manage no card
CREATE POLICY "pj_contracts_delete" ON public.pj_contracts
  FOR DELETE USING (
    has_role(auth.uid(), 'super_admin')
    OR has_card_permission(auth.uid(), public.get_pj_card_id(), 'manage')
  );

-- ---- pj_vacation_events ----

CREATE POLICY "pj_vacation_events_select" ON public.pj_vacation_events
  FOR SELECT USING (
    has_role(auth.uid(), 'super_admin')
    OR (
      has_card_permission(auth.uid(), public.get_pj_card_id(), 'view')
      AND EXISTS (
        SELECT 1 FROM public.pj_contracts c
        WHERE c.id = contract_id
          AND has_company_access(auth.uid(), c.company_id)
      )
    )
  );

CREATE POLICY "pj_vacation_events_insert" ON public.pj_vacation_events
  FOR INSERT WITH CHECK (
    has_role(auth.uid(), 'super_admin')
    OR (
      has_card_permission(auth.uid(), public.get_pj_card_id(), 'fill')
      AND EXISTS (
        SELECT 1 FROM public.pj_contracts c
        WHERE c.id = contract_id
          AND has_company_access(auth.uid(), c.company_id)
      )
    )
  );

CREATE POLICY "pj_vacation_events_update" ON public.pj_vacation_events
  FOR UPDATE USING (
    has_role(auth.uid(), 'super_admin')
    OR (
      has_card_permission(auth.uid(), public.get_pj_card_id(), 'fill')
      AND EXISTS (
        SELECT 1 FROM public.pj_contracts c
        WHERE c.id = contract_id
          AND has_company_access(auth.uid(), c.company_id)
      )
    )
  );

CREATE POLICY "pj_vacation_events_delete" ON public.pj_vacation_events
  FOR DELETE USING (
    has_role(auth.uid(), 'super_admin')
    OR has_card_permission(auth.uid(), public.get_pj_card_id(), 'manage')
  );

-- ---- pj_vacation_balance ----

CREATE POLICY "pj_vacation_balance_select" ON public.pj_vacation_balance
  FOR SELECT USING (
    has_role(auth.uid(), 'super_admin')
    OR (
      has_card_permission(auth.uid(), public.get_pj_card_id(), 'view')
      AND EXISTS (
        SELECT 1 FROM public.pj_contracts c
        WHERE c.id = contract_id
          AND has_company_access(auth.uid(), c.company_id)
      )
    )
  );

-- Balance é gerenciado via trigger, mas permitir write para service_role e super_admin
CREATE POLICY "pj_vacation_balance_write" ON public.pj_vacation_balance
  FOR ALL USING (
    has_role(auth.uid(), 'super_admin')
    OR auth.role() = 'service_role'
  );

-- ---- pj_closings ----

CREATE POLICY "pj_closings_select" ON public.pj_closings
  FOR SELECT USING (
    has_role(auth.uid(), 'super_admin')
    OR (
      has_card_permission(auth.uid(), public.get_pj_card_id(), 'view')
      AND EXISTS (
        SELECT 1 FROM public.pj_contracts c
        WHERE c.id = contract_id
          AND has_company_access(auth.uid(), c.company_id)
      )
    )
  );

CREATE POLICY "pj_closings_insert" ON public.pj_closings
  FOR INSERT WITH CHECK (
    has_role(auth.uid(), 'super_admin')
    OR (
      has_card_permission(auth.uid(), public.get_pj_card_id(), 'fill')
      AND EXISTS (
        SELECT 1 FROM public.pj_contracts c
        WHERE c.id = contract_id
          AND has_company_access(auth.uid(), c.company_id)
      )
    )
  );

CREATE POLICY "pj_closings_update" ON public.pj_closings
  FOR UPDATE USING (
    has_role(auth.uid(), 'super_admin')
    OR (
      has_card_permission(auth.uid(), public.get_pj_card_id(), 'fill')
      AND EXISTS (
        SELECT 1 FROM public.pj_contracts c
        WHERE c.id = contract_id
          AND has_company_access(auth.uid(), c.company_id)
      )
    )
  );

CREATE POLICY "pj_closings_delete" ON public.pj_closings
  FOR DELETE USING (
    has_role(auth.uid(), 'super_admin')
    OR (
      has_card_permission(auth.uid(), public.get_pj_card_id(), 'manage')
      AND status = 'draft'
    )
  );

-- ---- pj_email_logs ----

CREATE POLICY "pj_email_logs_select" ON public.pj_email_logs
  FOR SELECT USING (
    has_role(auth.uid(), 'super_admin')
    OR has_card_permission(auth.uid(), public.get_pj_card_id(), 'view')
  );

-- Inserts apenas via service_role (edge function)
CREATE POLICY "pj_email_logs_insert" ON public.pj_email_logs
  FOR INSERT WITH CHECK (
    has_role(auth.uid(), 'super_admin')
    OR auth.role() = 'service_role'
  );

-- ============================================================
-- 5. STORAGE BUCKET
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('holerites', 'holerites', false, 10485760)
ON CONFLICT (id) DO NOTHING;

-- Upload: apenas service_role (via Edge Function)
CREATE POLICY "holerites_upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'holerites'
    AND (
      auth.role() = 'service_role'
      OR has_role(auth.uid(), 'super_admin')
    )
  );

-- Download: quem tem acesso ao card
CREATE POLICY "holerites_download" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'holerites'
    AND (
      has_role(auth.uid(), 'super_admin')
      OR has_card_permission(auth.uid(), public.get_pj_card_id(), 'view')
    )
  );

-- Delete: apenas super_admin
CREATE POLICY "holerites_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'holerites'
    AND has_role(auth.uid(), 'super_admin')
  );

-- ============================================================
-- 6. SEED: Registrar o card "Controle PJ" na área Pessoas & Cultura
-- ============================================================
DO $$
DECLARE
  v_area_id UUID;
BEGIN
  -- Buscar área Pessoas & Cultura
  SELECT id INTO v_area_id
  FROM public.ec_areas
  WHERE slug = 'pessoas-cultura'
    AND is_active = true
  LIMIT 1;

  IF v_area_id IS NOT NULL THEN
    INSERT INTO public.ec_cards (
      area_id, title, description, periodicity_type,
      is_active, "order"
    ) VALUES (
      v_area_id,
      'Controle PJ',
      'Gestão de colaboradores PJ: contratos, banco de folgas, fechamento mensal, holerites e envio por e-mail.',
      'monthly',
      true,
      99
    )
    ON CONFLICT DO NOTHING;
  END IF;
END;
$$;
