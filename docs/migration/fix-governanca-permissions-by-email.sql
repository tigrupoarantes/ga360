BEGIN;

DO $$
DECLARE
  v_user_email TEXT := 'aldana@SEU_DOMINIO.com';
  v_area_slug TEXT := 'pessoas-cultura';
  v_user_id UUID;
  v_area_id UUID;
  v_cards_total INT := 0;
  v_cards_granted INT := 0;
BEGIN
  SELECT au.id
    INTO v_user_id
  FROM auth.users au
  WHERE lower(au.email) = lower(v_user_email)
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário com email "%" não encontrado em auth.users', v_user_email;
  END IF;

  SELECT ea.id
    INTO v_area_id
  FROM public.ec_areas ea
  WHERE ea.slug = v_area_slug
    AND ea.is_active = true
  LIMIT 1;

  IF v_area_id IS NULL THEN
    RAISE EXCEPTION 'Área com slug "%" não encontrada/ativa em ec_areas', v_area_slug;
  END IF;

  INSERT INTO public.user_permissions (
    user_id,
    module,
    can_view,
    can_create,
    can_edit,
    can_delete
  )
  VALUES (
    v_user_id,
    'governanca',
    true,
    true,
    true,
    true
  )
  ON CONFLICT (user_id, module)
  DO UPDATE SET
    can_view = EXCLUDED.can_view,
    can_create = EXCLUDED.can_create,
    can_edit = EXCLUDED.can_edit,
    can_delete = EXCLUDED.can_delete,
    updated_at = now();

  CREATE TEMP TABLE tmp_active_cards ON COMMIT DROP AS
  SELECT c.id AS card_id
  FROM public.ec_cards c
  WHERE c.area_id = v_area_id
    AND c.is_active = true;

  SELECT COUNT(*) INTO v_cards_total FROM tmp_active_cards;

  IF v_cards_total = 0 THEN
    RAISE NOTICE 'Nenhum card ativo encontrado para a área "%"', v_area_slug;
    RETURN;
  END IF;

  INSERT INTO public.ec_card_permissions (
    user_id,
    card_id,
    can_view,
    can_fill,
    can_review,
    can_manage
  )
  SELECT
    v_user_id,
    t.card_id,
    true,
    true,
    true,
    true
  FROM tmp_active_cards t
  ON CONFLICT (user_id, card_id)
  DO UPDATE SET
    can_view = EXCLUDED.can_view,
    can_fill = EXCLUDED.can_fill,
    can_review = EXCLUDED.can_review,
    can_manage = EXCLUDED.can_manage,
    updated_at = now();

  GET DIAGNOSTICS v_cards_granted = ROW_COUNT;

  RAISE NOTICE 'Permissões aplicadas para user_id=% email=%', v_user_id, v_user_email;
  RAISE NOTICE 'Área alvo: % (id=%)', v_area_slug, v_area_id;
  RAISE NOTICE 'Cards ativos na área: %', v_cards_total;
  RAISE NOTICE 'Linhas inseridas/atualizadas em ec_card_permissions: %', v_cards_granted;
END $$;

COMMIT;
