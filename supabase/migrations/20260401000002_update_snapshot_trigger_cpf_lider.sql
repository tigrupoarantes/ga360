-- ============================================================
-- Atualiza o trigger de snapshot para rastrear cpf_lider e lider_direto_id
-- Mudança de líder direto agora gera entrada histórica no SCD2
-- ============================================================

CREATE OR REPLACE FUNCTION public.capture_external_employee_snapshot()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  changed TEXT[] := ARRAY[]::TEXT[];
  snapshot_time TIMESTAMPTZ := COALESCE(NEW.synced_at, now());
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.external_employee_snapshots (
      external_employee_id,
      company_id,
      source_system,
      external_id,
      cpf,
      full_name,
      email,
      department,
      position,
      unidade,
      cod_vendedor,
      is_condutor,
      is_active,
      accounting_group,
      contract_company_id,
      accounting_company_id,
      cpf_lider,
      valid_from,
      changed_fields,
      change_source
    ) VALUES (
      NEW.id,
      NEW.company_id,
      COALESCE(NEW.source_system, 'unknown'),
      NEW.external_id,
      NEW.cpf,
      NEW.full_name,
      NEW.email,
      NEW.department,
      NEW.position,
      NEW.unidade,
      NEW.cod_vendedor,
      NEW.is_condutor,
      NEW.is_active,
      NEW.accounting_group,
      NEW.contract_company_id,
      NEW.accounting_company_id,
      NEW.cpf_lider,
      snapshot_time,
      ARRAY['__created__'],
      'db-trigger'
    );
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- Atributos pessoais / funcionais
    IF (OLD.full_name         IS DISTINCT FROM NEW.full_name)         THEN changed := array_append(changed, 'full_name');         END IF;
    IF (OLD.email             IS DISTINCT FROM NEW.email)             THEN changed := array_append(changed, 'email');             END IF;
    IF (OLD.department        IS DISTINCT FROM NEW.department)        THEN changed := array_append(changed, 'department');        END IF;
    IF (OLD.position          IS DISTINCT FROM NEW.position)          THEN changed := array_append(changed, 'position');          END IF;
    IF (OLD.unidade           IS DISTINCT FROM NEW.unidade)           THEN changed := array_append(changed, 'unidade');           END IF;
    IF (OLD.cpf               IS DISTINCT FROM NEW.cpf)               THEN changed := array_append(changed, 'cpf');               END IF;
    IF (OLD.cod_vendedor      IS DISTINCT FROM NEW.cod_vendedor)      THEN changed := array_append(changed, 'cod_vendedor');      END IF;
    IF (OLD.is_condutor       IS DISTINCT FROM NEW.is_condutor)       THEN changed := array_append(changed, 'is_condutor');       END IF;
    IF (OLD.is_active         IS DISTINCT FROM NEW.is_active)         THEN changed := array_append(changed, 'is_active');         END IF;
    -- Contabilização
    IF (OLD.accounting_group      IS DISTINCT FROM NEW.accounting_group)      THEN changed := array_append(changed, 'accounting_group');      END IF;
    IF (OLD.contract_company_id   IS DISTINCT FROM NEW.contract_company_id)   THEN changed := array_append(changed, 'contract_company_id');   END IF;
    IF (OLD.accounting_company_id IS DISTINCT FROM NEW.accounting_company_id) THEN changed := array_append(changed, 'accounting_company_id'); END IF;
    IF (OLD.company_id            IS DISTINCT FROM NEW.company_id)            THEN changed := array_append(changed, 'company_id');            END IF;
    -- Hierarquia de liderança
    IF (OLD.cpf_lider         IS DISTINCT FROM NEW.cpf_lider)         THEN changed := array_append(changed, 'cpf_lider');         END IF;
    IF (OLD.lider_direto_id   IS DISTINCT FROM NEW.lider_direto_id)   THEN changed := array_append(changed, 'lider_direto_id');   END IF;

    IF array_length(changed, 1) IS NULL THEN
      RETURN NEW;
    END IF;

    -- Fechar snapshot anterior
    UPDATE public.external_employee_snapshots
      SET valid_to = snapshot_time
      WHERE external_employee_id = NEW.id
        AND valid_to IS NULL;

    -- Abrir novo snapshot com todos os valores atuais
    INSERT INTO public.external_employee_snapshots (
      external_employee_id,
      company_id,
      source_system,
      external_id,
      cpf,
      full_name,
      email,
      department,
      position,
      unidade,
      cod_vendedor,
      is_condutor,
      is_active,
      accounting_group,
      contract_company_id,
      accounting_company_id,
      cpf_lider,
      valid_from,
      changed_fields,
      change_source
    ) VALUES (
      NEW.id,
      NEW.company_id,
      COALESCE(NEW.source_system, 'unknown'),
      NEW.external_id,
      NEW.cpf,
      NEW.full_name,
      NEW.email,
      NEW.department,
      NEW.position,
      NEW.unidade,
      NEW.cod_vendedor,
      NEW.is_condutor,
      NEW.is_active,
      NEW.accounting_group,
      NEW.contract_company_id,
      NEW.accounting_company_id,
      NEW.cpf_lider,
      snapshot_time,
      changed,
      'db-trigger'
    );
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

-- Re-criar o trigger (DROP IF EXISTS + CREATE para garantir versão atualizada)
DROP TRIGGER IF EXISTS trigger_capture_external_employee_snapshot ON public.external_employees;

CREATE TRIGGER trigger_capture_external_employee_snapshot
AFTER INSERT OR UPDATE ON public.external_employees
FOR EACH ROW
EXECUTE FUNCTION public.capture_external_employee_snapshot();
