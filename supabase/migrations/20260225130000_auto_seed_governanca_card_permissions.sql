-- ============================================================
-- Auto-seed de permissões granulares da Governança EC
-- Objetivo: evitar usuários com módulo governança ativo sem cards visíveis
-- ============================================================

-- 1) Função: quando módulo governança é habilitado para um usuário,
--    garante permissões mínimas de visualização em todos os cards ativos.
CREATE OR REPLACE FUNCTION public.seed_governanca_card_permissions_for_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.module = 'governanca'::public.system_module
     AND COALESCE(NEW.can_view, false) = true THEN
    INSERT INTO public.ec_card_permissions (
      user_id,
      card_id,
      can_view,
      can_fill,
      can_review,
      can_manage
    )
    SELECT
      NEW.user_id,
      c.id,
      true,
      false,
      false,
      false
    FROM public.ec_cards c
    WHERE c.is_active = true
    ON CONFLICT (user_id, card_id)
    DO UPDATE SET
      can_view = (public.ec_card_permissions.can_view OR EXCLUDED.can_view),
      updated_at = now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_governanca_card_permissions_for_user ON public.user_permissions;
CREATE TRIGGER trg_seed_governanca_card_permissions_for_user
  AFTER INSERT OR UPDATE OF can_view, module ON public.user_permissions
  FOR EACH ROW
  EXECUTE FUNCTION public.seed_governanca_card_permissions_for_user();

-- 2) Função: quando um novo card ativo é criado,
--    garante can_view para todos os usuários com módulo governança ativo.
CREATE OR REPLACE FUNCTION public.seed_governanca_card_permissions_for_card()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(NEW.is_active, false) = true THEN
    INSERT INTO public.ec_card_permissions (
      user_id,
      card_id,
      can_view,
      can_fill,
      can_review,
      can_manage
    )
    SELECT
      up.user_id,
      NEW.id,
      true,
      false,
      false,
      false
    FROM public.user_permissions up
    WHERE up.module = 'governanca'::public.system_module
      AND COALESCE(up.can_view, false) = true
    ON CONFLICT (user_id, card_id)
    DO UPDATE SET
      can_view = (public.ec_card_permissions.can_view OR EXCLUDED.can_view),
      updated_at = now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_governanca_card_permissions_for_card ON public.ec_cards;
CREATE TRIGGER trg_seed_governanca_card_permissions_for_card
  AFTER INSERT OR UPDATE OF is_active ON public.ec_cards
  FOR EACH ROW
  EXECUTE FUNCTION public.seed_governanca_card_permissions_for_card();

-- 3) Backfill para usuários existentes com governança ativa
INSERT INTO public.ec_card_permissions (
  user_id,
  card_id,
  can_view,
  can_fill,
  can_review,
  can_manage
)
SELECT
  up.user_id,
  c.id,
  true,
  false,
  false,
  false
FROM public.user_permissions up
JOIN public.ec_cards c
  ON c.is_active = true
WHERE up.module = 'governanca'::public.system_module
  AND COALESCE(up.can_view, false) = true
ON CONFLICT (user_id, card_id)
DO UPDATE SET
  can_view = (public.ec_card_permissions.can_view OR EXCLUDED.can_view),
  updated_at = now();
