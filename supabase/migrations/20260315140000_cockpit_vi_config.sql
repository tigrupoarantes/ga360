-- Tabela de configuração: quais grupos contábeis do DAB são vendedores/promotores
-- usada pelo VIGenerateDialog para filtrar funcionários no card de Verbas Indenizatórias
CREATE TABLE IF NOT EXISTS public.cockpit_vi_config (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id            uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  vi_accounting_groups  text[] NOT NULL DEFAULT '{}',
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id)
);

ALTER TABLE public.cockpit_vi_config ENABLE ROW LEVEL SECURITY;

-- super_admin: acesso total (leitura e escrita)
CREATE POLICY "cockpit_vi_config_super_admin"
  ON public.cockpit_vi_config
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'super_admin'
    )
  );

-- usuários autenticados: somente leitura (VIGenerateDialog lê a config)
CREATE POLICY "cockpit_vi_config_read"
  ON public.cockpit_vi_config
  FOR SELECT
  USING (auth.uid() IS NOT NULL);
