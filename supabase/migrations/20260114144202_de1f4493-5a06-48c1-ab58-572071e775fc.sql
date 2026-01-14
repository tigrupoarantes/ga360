-- Adicionar novos campos à tabela external_employees
ALTER TABLE external_employees 
  ADD COLUMN IF NOT EXISTS cpf TEXT,
  ADD COLUMN IF NOT EXISTS unidade TEXT,
  ADD COLUMN IF NOT EXISTS is_condutor BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS cod_vendedor TEXT,
  ADD COLUMN IF NOT EXISTS lider_direto_id UUID REFERENCES external_employees(id) ON DELETE SET NULL;

-- Migrar dados de registration_number para cpf (se aplicável)
UPDATE external_employees SET cpf = registration_number WHERE cpf IS NULL AND registration_number IS NOT NULL;

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_external_employees_cpf ON external_employees(cpf);
CREATE INDEX IF NOT EXISTS idx_external_employees_unidade ON external_employees(unidade);
CREATE INDEX IF NOT EXISTS idx_external_employees_lider ON external_employees(lider_direto_id);
CREATE INDEX IF NOT EXISTS idx_external_employees_cod_vendedor ON external_employees(cod_vendedor);
CREATE INDEX IF NOT EXISTS idx_external_employees_is_condutor ON external_employees(is_condutor);

-- Constraint de unicidade por CPF por empresa (apenas se CPF não for nulo)
CREATE UNIQUE INDEX IF NOT EXISTS idx_external_employees_cpf_company_unique 
  ON external_employees(company_id, cpf) WHERE cpf IS NOT NULL;