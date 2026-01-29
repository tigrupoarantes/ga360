-- =============================================
-- STOCK AUDIT MODULE - PHASE 1
-- =============================================

-- 1. Create stock_audit_settings table (global configurations)
CREATE TABLE public.stock_audit_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  governance_email TEXT,
  cc_emails JSONB DEFAULT '[]',
  default_sample_size INTEGER DEFAULT 30,
  default_tolerance_abs NUMERIC DEFAULT 1,
  default_tolerance_pct NUMERIC DEFAULT 5,
  default_blind_count_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create stock_audits table (main audit records)
CREATE TABLE public.stock_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  unit_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  auditor_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  card_id UUID REFERENCES public.ec_cards(id) ON DELETE SET NULL,
  
  -- Dates
  planned_date DATE,
  executed_date DATE,
  cutoff_datetime TIMESTAMPTZ,
  
  -- Status
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'in_progress', 'completed', 'reviewed')),
  
  -- Audit configurations
  blind_count_enabled BOOLEAN DEFAULT true,
  sample_size INTEGER,
  sampling_method TEXT DEFAULT 'random',
  
  -- Base file
  base_file_url TEXT,
  base_file_type TEXT,
  base_file_meta JSONB,
  total_items_loaded INTEGER DEFAULT 0,
  
  -- Movement during audit
  movement_during_audit BOOLEAN DEFAULT false,
  movement_notes TEXT,
  
  -- Witness
  witness_name TEXT,
  witness_cpf TEXT,
  witness_term_accepted BOOLEAN DEFAULT false,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Create stock_audit_items table (individual items to audit)
CREATE TABLE public.stock_audit_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_audit_id UUID NOT NULL REFERENCES public.stock_audits(id) ON DELETE CASCADE,
  
  -- SKU data
  sku_code TEXT NOT NULL,
  sku_description TEXT,
  uom TEXT,
  location TEXT,
  
  -- Quantities
  system_qty NUMERIC NOT NULL,
  physical_qty NUMERIC,
  recount_qty NUMERIC,
  final_physical_qty NUMERIC,
  final_diff_qty NUMERIC,
  
  -- Status
  result TEXT DEFAULT 'pending' CHECK (result IN ('pending', 'ok', 'divergent', 'recount_required', 'divergent_confirmed')),
  is_in_sample BOOLEAN DEFAULT false,
  
  -- Root cause
  root_cause_code TEXT,
  root_cause_notes TEXT,
  item_notes TEXT,
  
  -- Timestamps
  audited_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Create stock_audit_item_photos table
CREATE TABLE public.stock_audit_item_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_audit_item_id UUID NOT NULL REFERENCES public.stock_audit_items(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Create indexes for performance
CREATE INDEX idx_stock_audits_company ON public.stock_audits(company_id);
CREATE INDEX idx_stock_audits_unit ON public.stock_audits(unit_id);
CREATE INDEX idx_stock_audits_status ON public.stock_audits(status);
CREATE INDEX idx_stock_audits_auditor ON public.stock_audits(auditor_user_id);
CREATE INDEX idx_stock_audit_items_audit ON public.stock_audit_items(stock_audit_id);
CREATE INDEX idx_stock_audit_items_sample ON public.stock_audit_items(stock_audit_id, is_in_sample);
CREATE INDEX idx_stock_audit_item_photos_item ON public.stock_audit_item_photos(stock_audit_item_id);

-- 6. Create updated_at trigger function (reuse if exists)
CREATE OR REPLACE FUNCTION public.update_stock_audit_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 7. Create triggers for updated_at
CREATE TRIGGER update_stock_audit_settings_updated_at
  BEFORE UPDATE ON public.stock_audit_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_stock_audit_updated_at();

CREATE TRIGGER update_stock_audits_updated_at
  BEFORE UPDATE ON public.stock_audits
  FOR EACH ROW EXECUTE FUNCTION public.update_stock_audit_updated_at();

-- =============================================
-- RLS POLICIES
-- =============================================

-- Enable RLS on all tables
ALTER TABLE public.stock_audit_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_audit_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_audit_item_photos ENABLE ROW LEVEL SECURITY;

-- stock_audit_settings policies
CREATE POLICY "Super admin and CEO can manage stock_audit_settings"
  ON public.stock_audit_settings FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'ceo'::app_role));

CREATE POLICY "Authenticated users can view stock_audit_settings"
  ON public.stock_audit_settings FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- stock_audits policies
CREATE POLICY "Authenticated users can view stock_audits"
  ON public.stock_audits FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can create stock_audits"
  ON public.stock_audits FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Auditors and admins can update stock_audits"
  ON public.stock_audits FOR UPDATE
  USING (
    auditor_user_id = auth.uid() OR
    has_role(auth.uid(), 'super_admin'::app_role) OR 
    has_role(auth.uid(), 'ceo'::app_role) OR
    has_role(auth.uid(), 'diretor'::app_role)
  );

CREATE POLICY "Super admin and CEO can delete stock_audits"
  ON public.stock_audits FOR DELETE
  USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'ceo'::app_role));

-- stock_audit_items policies
CREATE POLICY "Authenticated users can view stock_audit_items"
  ON public.stock_audit_items FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can create stock_audit_items"
  ON public.stock_audit_items FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update stock_audit_items"
  ON public.stock_audit_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.stock_audits sa 
      WHERE sa.id = stock_audit_items.stock_audit_id 
      AND (
        sa.auditor_user_id = auth.uid() OR
        has_role(auth.uid(), 'super_admin'::app_role) OR 
        has_role(auth.uid(), 'ceo'::app_role)
      )
    )
  );

CREATE POLICY "Super admin and CEO can delete stock_audit_items"
  ON public.stock_audit_items FOR DELETE
  USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'ceo'::app_role));

-- stock_audit_item_photos policies
CREATE POLICY "Authenticated users can view stock_audit_item_photos"
  ON public.stock_audit_item_photos FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can create stock_audit_item_photos"
  ON public.stock_audit_item_photos FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete their own photos"
  ON public.stock_audit_item_photos FOR DELETE
  USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR 
    has_role(auth.uid(), 'ceo'::app_role) OR
    EXISTS (
      SELECT 1 FROM public.stock_audit_items sai
      JOIN public.stock_audits sa ON sa.id = sai.stock_audit_id
      WHERE sai.id = stock_audit_item_photos.stock_audit_item_id
      AND sa.auditor_user_id = auth.uid()
    )
  );

-- =============================================
-- STORAGE BUCKET
-- =============================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('stock-audit-files', 'stock-audit-files', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for stock-audit-files bucket
CREATE POLICY "Authenticated users can upload stock audit files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'stock-audit-files' AND
    auth.uid() IS NOT NULL
  );

CREATE POLICY "Authenticated users can view stock audit files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'stock-audit-files' AND
    auth.uid() IS NOT NULL
  );

CREATE POLICY "Authenticated users can update stock audit files"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'stock-audit-files' AND
    auth.uid() IS NOT NULL
  );

CREATE POLICY "Super admin and CEO can delete stock audit files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'stock-audit-files' AND
    (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'ceo'::app_role))
  );