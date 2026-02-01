-- 1. Adicionar campos na tabela companies
ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS razao_social TEXT,
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS email TEXT;

-- 2. Adicionar campos CNH na tabela external_employees
ALTER TABLE external_employees
ADD COLUMN IF NOT EXISTS cnh_numero TEXT,
ADD COLUMN IF NOT EXISTS cnh_categoria TEXT,
ADD COLUMN IF NOT EXISTS cnh_validade DATE;

-- 3. Atualizar external_id das empresas com CNPJs
UPDATE companies SET external_id = '12513175000181' 
WHERE name ILIKE '%jarantes%' OR name ILIKE '%j arantes%';

UPDATE companies SET external_id = '09277498000160' 
WHERE name ILIKE '%chok distribuidora%';

UPDATE companies SET external_id = '10596272000107' 
WHERE name ILIKE '%g4%';

UPDATE companies SET external_id = '18780714000162' 
WHERE name ILIKE '%chokdoce%';

UPDATE companies SET external_id = '26605418000196' 
WHERE name ILIKE '%escritorio%' OR name ILIKE '%central%';

UPDATE companies SET external_id = '13460854000100' 
WHERE name ILIKE '%chokagro%';