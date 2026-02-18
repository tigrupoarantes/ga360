-- Migração para remover bypass de CEO/Diretor e reforçar Permissões Granulares

-- 1. Atualizar função has_permission (Remover CEO)
CREATE OR REPLACE FUNCTION public.has_permission(
  _user_id UUID,
  _module system_module,
  _action TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH user_role_check AS (
    SELECT role FROM public.user_roles WHERE user_id = _user_id LIMIT 1
  )
  SELECT 
    CASE 
      -- Apenas Super Admin tem acesso total implícito
      WHEN EXISTS (
        SELECT 1 FROM user_role_check 
        WHERE role = 'super_admin'::app_role
      ) THEN true
      
      -- Para todos os outros, verificar user_permissions
      ELSE (
        SELECT 
          CASE
            WHEN _action = 'view' THEN COALESCE(can_view, false)
            WHEN _action = 'create' THEN COALESCE(can_create, false)
            WHEN _action = 'edit' THEN COALESCE(can_edit, false)
            WHEN _action = 'delete' THEN COALESCE(can_delete, false)
            ELSE false
          END
        FROM public.user_permissions
        WHERE user_id = _user_id AND module = _module
        LIMIT 1
      )
    END
$$;

-- 2. Atualizar função has_card_permission (Garantir apenas Super Admin)
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
    -- Check granular card permissions
    WHEN _permission = 'view' THEN COALESCE((SELECT can_view FROM ec_card_permissions WHERE user_id = _user_id AND card_id = _card_id), false)
    WHEN _permission = 'fill' THEN COALESCE((SELECT can_fill FROM ec_card_permissions WHERE user_id = _user_id AND card_id = _card_id), false)
    WHEN _permission = 'review' THEN COALESCE((SELECT can_review FROM ec_card_permissions WHERE user_id = _user_id AND card_id = _card_id), false)
    WHEN _permission = 'manage' THEN COALESCE((SELECT can_manage FROM ec_card_permissions WHERE user_id = _user_id AND card_id = _card_id), false)
    ELSE false
  END
$$;

-- 3. Atualizar Policies de ec_areas (Usar has_permission em vez de role)
DROP POLICY IF EXISTS "Super admin and CEO can manage ec_areas" ON public.ec_areas;
CREATE POLICY "Admins can manage ec_areas"
  ON public.ec_areas FOR ALL
  USING (has_permission(auth.uid(), 'governanca', 'edit')); 
  -- Nota: Usando 'edit' ou 'delete' do módulo governança para gerenciar áreas

-- 4. Atualizar Policies de ec_cards
DROP POLICY IF EXISTS "Super admin and CEO can manage ec_cards" ON public.ec_cards;
DROP POLICY IF EXISTS "Directors can manage ec_cards" ON public.ec_cards;

CREATE POLICY "Admins can manage ec_cards"
  ON public.ec_cards FOR ALL
  USING (has_permission(auth.uid(), 'governanca', 'edit'));

-- 5. Atualizar Policies de ec_card_records
DROP POLICY IF EXISTS "Super admin and CEO can delete ec_card_records" ON public.ec_card_records;

CREATE POLICY "Admins can delete ec_card_records"
  ON public.ec_card_records FOR DELETE
  USING (has_permission(auth.uid(), 'governanca', 'delete'));

-- Atualizar policy de update para usar has_card_permission para users comuns
DROP POLICY IF EXISTS "Responsibles can update their card records" ON public.ec_card_records;

CREATE POLICY "Users with permission can update card records"
  ON public.ec_card_records FOR UPDATE
  USING (
    has_card_permission(auth.uid(), card_id, 'fill') OR
    has_card_permission(auth.uid(), card_id, 'manage') OR
    has_permission(auth.uid(), 'governanca', 'edit')
  );

-- 6. Atualizar Policies de dl_connections e outros (Admin apenas)
-- Simplificando para exigir permissão de admin no módulo governança
DROP POLICY IF EXISTS "Super admin and CEO can view dl_connections" ON public.dl_connections;
DROP POLICY IF EXISTS "Super admin and CEO can manage dl_connections" ON public.dl_connections;

CREATE POLICY "Admins can view dl_connections"
  ON public.dl_connections FOR SELECT
  USING (has_permission(auth.uid(), 'governanca', 'view'));

CREATE POLICY "Admins can manage dl_connections"
  ON public.dl_connections FOR ALL
  USING (has_permission(auth.uid(), 'governanca', 'edit'));

-- Repetir padrão para dl_queries, dl_card_bindings, etc se necessário, 
-- ou assumir que quem tem 'edit' em governança pode configurar isso.
