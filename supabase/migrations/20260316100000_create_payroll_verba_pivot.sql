-- Migration: cria tabela payroll_verba_pivot
-- Formato pivot (1 linha por cpf × tipo_verba × ano) em vez de long format
-- Reduz de ~52.000 para ~4.350 linhas/ano, eliminando timeout no sync

CREATE TABLE IF NOT EXISTS public.payroll_verba_pivot (
  id                              BIGSERIAL     PRIMARY KEY,
  company_id                      UUID          NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  razao_social                    TEXT          NOT NULL,
  cpf                             TEXT          NOT NULL,
  nome_funcionario                TEXT          NOT NULL,
  tipo_verba                      TEXT          NOT NULL,
  ano                             INTEGER       NOT NULL CHECK (ano >= 2000),
  janeiro                         NUMERIC(14,2) NOT NULL DEFAULT 0,
  fevereiro                       NUMERIC(14,2) NOT NULL DEFAULT 0,
  marco                           NUMERIC(14,2) NOT NULL DEFAULT 0,
  abril                           NUMERIC(14,2) NOT NULL DEFAULT 0,
  maio                            NUMERIC(14,2) NOT NULL DEFAULT 0,
  junho                           NUMERIC(14,2) NOT NULL DEFAULT 0,
  julho                           NUMERIC(14,2) NOT NULL DEFAULT 0,
  agosto                          NUMERIC(14,2) NOT NULL DEFAULT 0,
  setembro                        NUMERIC(14,2) NOT NULL DEFAULT 0,
  outubro                         NUMERIC(14,2) NOT NULL DEFAULT 0,
  novembro                        NUMERIC(14,2) NOT NULL DEFAULT 0,
  dezembro                        NUMERIC(14,2) NOT NULL DEFAULT 0,
  employee_department             TEXT,
  employee_position               TEXT,
  employee_unidade                TEXT,
  employee_accounting_group       TEXT,
  employee_contract_company_id    UUID          REFERENCES public.companies(id),
  employee_accounting_company_id  UUID          REFERENCES public.companies(id),
  employee_snapshot_at            TIMESTAMPTZ,
  created_at                      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at                      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CONSTRAINT ux_payroll_verba_pivot_natural_key
    UNIQUE (company_id, cpf, tipo_verba, ano)
);

-- Índices para os filtros mais comuns no verbas-secure-query
CREATE INDEX idx_pvp_company_ano   ON public.payroll_verba_pivot (company_id, ano);
CREATE INDEX idx_pvp_company_cpf   ON public.payroll_verba_pivot (company_id, cpf);
CREATE INDEX idx_pvp_company_nome  ON public.payroll_verba_pivot (company_id, nome_funcionario);
CREATE INDEX idx_pvp_company_group ON public.payroll_verba_pivot (company_id, employee_accounting_group, ano);
CREATE INDEX idx_pvp_company_dept  ON public.payroll_verba_pivot (company_id, employee_department, ano);

-- RLS — apenas service_role (mesma política do payroll_verba_events)
ALTER TABLE public.payroll_verba_pivot ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_only_payroll_verba_pivot"
  ON public.payroll_verba_pivot
  USING (auth.role() = 'service_role');

-- Trigger para updated_at automático
CREATE TRIGGER update_payroll_verba_pivot_updated_at
  BEFORE UPDATE ON public.payroll_verba_pivot
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
