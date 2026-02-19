-- Fix: Criar tabela ec_card_permissions (caso não exista) + corrigir RLS policies
-- para permitir que usuários com permissão 'admin' possam gerenciar permissões

-- =====================================================
-- 1. Criar tabela ec_card_permissions (se não existe)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.ec_card_permissions (
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

ALTER TABLE public.ec_card_permissions ENABLE ROW LEVEL SECURITY;

-- Função has_card_permission
CREATE OR REPLACE FUNCTION public.has_card_permission(_user_id UUID, _card_id UUID, _permission TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN has_role(_user_id, 'super_admin') THEN true
    WHEN _permission = 'view' THEN COALESCE((SELECT can_view FROM ec_card_permissions WHERE user_id = _user_id AND card_id = _card_id), false)
    WHEN _permission = 'fill' THEN COALESCE((SELECT can_fill FROM ec_card_permissions WHERE user_id = _user_id AND card_id = _card_id), false)
    WHEN _permission = 'review' THEN COALESCE((SELECT can_review FROM ec_card_permissions WHERE user_id = _user_id AND card_id = _card_id), false)
    WHEN _permission = 'manage' THEN COALESCE((SELECT can_manage FROM ec_card_permissions WHERE user_id = _user_id AND card_id = _card_id), false)
    ELSE false
  END
$$;

-- Trigger updated_at
CREATE OR REPLACE TRIGGER update_ec_card_permissions_updated_at
  BEFORE UPDATE ON public.ec_card_permissions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- 2. Policies ec_card_permissions
-- =====================================================
DROP POLICY IF EXISTS "Super admin can manage card permissions" ON public.ec_card_permissions;
DROP POLICY IF EXISTS "Admins can manage card permissions" ON public.ec_card_permissions;
DROP POLICY IF EXISTS "Users can read own card permissions" ON public.ec_card_permissions;

CREATE POLICY "Admins can manage card permissions"
  ON public.ec_card_permissions
  FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR public.has_permission(auth.uid(), 'admin', 'edit')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin')
    OR public.has_permission(auth.uid(), 'admin', 'edit')
  );

CREATE POLICY "Users can read own card permissions"
  ON public.ec_card_permissions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- =====================================================
-- 3. Policies user_permissions
-- =====================================================
DROP POLICY IF EXISTS "Super admin can manage all permissions" ON public.user_permissions;
DROP POLICY IF EXISTS "Admins can manage all permissions" ON public.user_permissions;

CREATE POLICY "Admins can manage all permissions"
  ON public.user_permissions
  FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR public.has_permission(auth.uid(), 'admin', 'edit')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin')
    OR public.has_permission(auth.uid(), 'admin', 'edit')
  );

DROP POLICY IF EXISTS "Super admin can view all permissions" ON public.user_permissions;
DROP POLICY IF EXISTS "Admins can view all permissions" ON public.user_permissions;

CREATE POLICY "Admins can view all permissions"
  ON public.user_permissions
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR public.has_permission(auth.uid(), 'admin', 'view')
  );

-- =====================================================
-- 4. Policies user_companies
-- =====================================================
DROP POLICY IF EXISTS "Super admin and CEO can manage user_companies" ON public.user_companies;
DROP POLICY IF EXISTS "Admins can manage user_companies" ON public.user_companies;

CREATE POLICY "Admins can manage user_companies"
  ON public.user_companies
  FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR public.has_permission(auth.uid(), 'admin', 'edit')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin')
    OR public.has_permission(auth.uid(), 'admin', 'edit')
  );
