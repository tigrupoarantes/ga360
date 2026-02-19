-- ============================================================
-- Fix: has_card_permission must match client-side fallthrough logic
-- ============================================================
-- Problem: The DB function only checked the exact permission column.
--   e.g., 'view' only checked can_view.
--   But the client-side hook treats fill/review/manage as implying view,
--   and manage as implying fill/review. This mismatch caused INSERT to
--   succeed but SELECT to fail silently for users with can_fill=true
--   but can_view=false.
--
-- Fix: Apply the same fallthrough logic as useCardPermissions.ts:
--   - 'view'   → can_view OR can_fill OR can_review OR can_manage
--   - 'fill'   → can_fill OR can_manage
--   - 'review' → can_review OR can_manage
--   - 'manage' → can_manage

CREATE OR REPLACE FUNCTION public.has_card_permission(_user_id UUID, _card_id UUID, _permission TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN has_role(_user_id, 'super_admin') THEN true
    WHEN _card_id IS NULL THEN false
    WHEN _permission = 'view' THEN COALESCE((
      SELECT (can_view OR can_fill OR can_review OR can_manage)
      FROM ec_card_permissions
      WHERE user_id = _user_id AND card_id = _card_id
    ), false)
    WHEN _permission = 'fill' THEN COALESCE((
      SELECT (can_fill OR can_manage)
      FROM ec_card_permissions
      WHERE user_id = _user_id AND card_id = _card_id
    ), false)
    WHEN _permission = 'review' THEN COALESCE((
      SELECT (can_review OR can_manage)
      FROM ec_card_permissions
      WHERE user_id = _user_id AND card_id = _card_id
    ), false)
    WHEN _permission = 'manage' THEN COALESCE((
      SELECT can_manage
      FROM ec_card_permissions
      WHERE user_id = _user_id AND card_id = _card_id
    ), false)
    ELSE false
  END
$$;
