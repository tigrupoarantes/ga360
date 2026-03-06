-- Security fix: SECURITY DEFINER functions without SET search_path are vulnerable to
-- search_path injection attacks (a user with CREATE privilege can create a schema
-- with higher search_path priority and redirect the function to malicious objects).
-- Adding SET search_path = public mitigates this.

CREATE OR REPLACE FUNCTION public.recalc_pj_vacation_balance(
  p_contract_id UUID,
  p_year INT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entitlement INT;
  v_used INT;
BEGIN
  SELECT COALESCE(vacation_entitlement_days, 30)
    INTO v_entitlement
    FROM public.pj_contracts
   WHERE id = p_contract_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT COALESCE(SUM(days), 0)
    INTO v_used
    FROM public.pj_vacation_events
   WHERE contract_id = p_contract_id
     AND EXTRACT(YEAR FROM start_date) = p_year;

  INSERT INTO public.pj_vacation_balance (contract_id, year, entitlement_days, used_days, remaining_days, updated_at)
  VALUES (p_contract_id, p_year, v_entitlement, v_used, GREATEST(v_entitlement - v_used, 0), now())
  ON CONFLICT (contract_id, year) DO UPDATE SET
    entitlement_days = v_entitlement,
    used_days = v_used,
    remaining_days = GREATEST(v_entitlement - v_used, 0),
    updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_pj_vacation_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  IF TG_OP = 'UPDATE' AND EXTRACT(YEAR FROM OLD.start_date) <> EXTRACT(YEAR FROM NEW.start_date) THEN
    PERFORM public.recalc_pj_vacation_balance(OLD.contract_id, EXTRACT(YEAR FROM OLD.start_date)::INT);
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;
