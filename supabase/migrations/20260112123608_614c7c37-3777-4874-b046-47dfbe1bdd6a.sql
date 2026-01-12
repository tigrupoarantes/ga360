-- Adicionar coluna para vincular external_employees a profiles
ALTER TABLE external_employees 
ADD COLUMN linked_profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- Índice para a coluna de vinculação
CREATE INDEX idx_external_employees_linked_profile ON external_employees(linked_profile_id);

-- Função para vincular automaticamente por email
CREATE OR REPLACE FUNCTION link_external_employee_by_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  matched_profile_id UUID;
  profile_email TEXT;
BEGIN
  -- Só tenta vincular se o email foi fornecido e não há vínculo ainda
  IF NEW.email IS NOT NULL AND NEW.email != '' AND NEW.linked_profile_id IS NULL THEN
    -- Busca o profile pelo email (via auth.users)
    SELECT p.id INTO matched_profile_id
    FROM profiles p
    JOIN auth.users u ON u.id = p.id
    WHERE LOWER(u.email) = LOWER(NEW.email)
    LIMIT 1;
    
    IF matched_profile_id IS NOT NULL THEN
      NEW.linked_profile_id := matched_profile_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger para vincular automaticamente no INSERT ou UPDATE
CREATE TRIGGER trigger_link_external_employee_by_email
  BEFORE INSERT OR UPDATE OF email ON external_employees
  FOR EACH ROW
  EXECUTE FUNCTION link_external_employee_by_email();

-- Função para vincular todos os funcionários existentes
CREATE OR REPLACE FUNCTION link_all_external_employees()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  WITH matched AS (
    SELECT ee.id, p.id as profile_id
    FROM external_employees ee
    JOIN auth.users u ON LOWER(u.email) = LOWER(ee.email)
    JOIN profiles p ON p.id = u.id
    WHERE ee.linked_profile_id IS NULL
      AND ee.email IS NOT NULL
      AND ee.email != ''
  )
  UPDATE external_employees ee
  SET linked_profile_id = matched.profile_id,
      updated_at = now()
  FROM matched
  WHERE ee.id = matched.id;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

-- Executar vinculação inicial para registros existentes
SELECT link_all_external_employees();