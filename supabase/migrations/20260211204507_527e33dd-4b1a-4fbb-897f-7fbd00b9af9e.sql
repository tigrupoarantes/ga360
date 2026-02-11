
-- Add 'governanca' to system_module enum
ALTER TYPE public.system_module ADD VALUE IF NOT EXISTS 'governanca';

-- Create card-level permissions table for Governance
CREATE TABLE public.ec_card_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  card_id UUID NOT NULL REFERENCES public.ec_cards(id) ON DELETE CASCADE,
  can_view BOOLEAN NOT NULL DEFAULT false,
  can_fill BOOLEAN NOT NULL DEFAULT false,
  can_review BOOLEAN NOT NULL DEFAULT false,
  can_manage BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, card_id)
);

-- Enable RLS
ALTER TABLE public.ec_card_permissions ENABLE ROW LEVEL SECURITY;

-- Only super_admin can manage card permissions
CREATE POLICY "Super admin can manage card permissions"
  ON public.ec_card_permissions
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- Users can read their own permissions
CREATE POLICY "Users can read own card permissions"
  ON public.ec_card_permissions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Security definer function to check card-level permissions
CREATE OR REPLACE FUNCTION public.has_card_permission(_user_id UUID, _card_id UUID, _permission TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    -- Super admin always has full access
    WHEN has_role(_user_id, 'super_admin') THEN true
    WHEN _permission = 'view' THEN COALESCE((SELECT can_view FROM ec_card_permissions WHERE user_id = _user_id AND card_id = _card_id), false)
    WHEN _permission = 'fill' THEN COALESCE((SELECT can_fill FROM ec_card_permissions WHERE user_id = _user_id AND card_id = _card_id), false)
    WHEN _permission = 'review' THEN COALESCE((SELECT can_review FROM ec_card_permissions WHERE user_id = _user_id AND card_id = _card_id), false)
    WHEN _permission = 'manage' THEN COALESCE((SELECT can_manage FROM ec_card_permissions WHERE user_id = _user_id AND card_id = _card_id), false)
    ELSE false
  END
$$;

-- Update trigger for updated_at
CREATE TRIGGER update_ec_card_permissions_updated_at
  BEFORE UPDATE ON public.ec_card_permissions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
