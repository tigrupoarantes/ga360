-- Histórico (snapshot) de atributos de funcionários ao longo do tempo.
-- Objetivo: permitir análises históricas corretas (ex.: VERBAS/QLP) mesmo com mudanças de cargo/departamento/unidade etc.

CREATE TABLE IF NOT EXISTS public.external_employee_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  external_employee_id UUID NOT NULL REFERENCES public.external_employees(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,

  -- Identificadores do sistema de origem (redundantes para facilitar queries históricas)
  source_system TEXT NOT NULL,
  external_id TEXT NOT NULL,
  cpf TEXT,

  -- Atributos que podem mudar ao longo do tempo
  full_name TEXT,
  email TEXT,
  department TEXT,
  position TEXT,
  unidade TEXT,
  cod_vendedor TEXT,
  is_condutor BOOLEAN,
  is_active BOOLEAN,

  -- Período de validade (SCD2)
  valid_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_to TIMESTAMPTZ,

  -- Metadados de mudança
  changed_fields TEXT[],
  change_source TEXT DEFAULT 'sync-employees',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Apenas 1 snapshot "aberto" por funcionário
CREATE UNIQUE INDEX IF NOT EXISTS external_employee_snapshots_one_open_per_employee
  ON public.external_employee_snapshots(external_employee_id)
  WHERE valid_to IS NULL;

CREATE INDEX IF NOT EXISTS idx_external_employee_snapshots_company_from
  ON public.external_employee_snapshots(company_id, valid_from DESC);

CREATE INDEX IF NOT EXISTS idx_external_employee_snapshots_employee_from
  ON public.external_employee_snapshots(external_employee_id, valid_from DESC);

CREATE INDEX IF NOT EXISTS idx_external_employee_snapshots_cpf
  ON public.external_employee_snapshots(company_id, cpf);

-- RLS
ALTER TABLE public.external_employee_snapshots ENABLE ROW LEVEL SECURITY;

-- Mesmo modelo de visibilidade do external_employees: usuários veem apenas sua empresa.
-- (Mantém consistência com o que já existe hoje; se multi-company via user_companies virar padrão,
--  podemos ajustar esta policy para o mesmo critério.)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'external_employee_snapshots'
      AND policyname = 'Users can view external employee snapshots of their company'
  ) THEN
    CREATE POLICY "Users can view external employee snapshots of their company"
      ON public.external_employee_snapshots FOR SELECT
      USING (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'external_employee_snapshots'
      AND policyname = 'Service role can manage external employee snapshots'
  ) THEN
    CREATE POLICY "Service role can manage external employee snapshots"
      ON public.external_employee_snapshots FOR ALL
      USING (auth.role() = 'service_role');
  END IF;
END
$$;
