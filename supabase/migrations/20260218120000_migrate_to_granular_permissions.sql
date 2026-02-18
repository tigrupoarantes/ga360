-- Migração para popular user_permissions baseado nas roles atuais
-- Objetivo: Garantir transição suave para modelo onde apenas Super Admin tem bypass.

DO $$
DECLARE
  r RECORD;
BEGIN
  -- Iterar sobre todos os usuários que têm roles definidas
  FOR r IN SELECT user_id, role FROM public.user_roles LOOP
    
    -- Se for CEO, dar permissão total em todos os módulos
    IF r.role = 'ceo' THEN
      INSERT INTO public.user_permissions (user_id, module, can_view, can_create, can_edit, can_delete)
      SELECT r.user_id, m.enumlabel::public.system_module, true, true, true, true
      FROM pg_enum m
      JOIN pg_type t ON m.enumtypid = t.oid
      WHERE t.typname = 'system_module'
      ON CONFLICT (user_id, module) DO UPDATE
      SET can_view = EXCLUDED.can_view,
          can_create = EXCLUDED.can_create,
          can_edit = EXCLUDED.can_edit,
          can_delete = EXCLUDED.can_delete;

    -- Se for DIRETOR, dar permissão de visualização/edição em módulos relevantes (Exemplo: Dashboard, Governança)
    ELSIF r.role = 'diretor' THEN
      -- Dar permissão total em Governança por padrão para Diretores
      INSERT INTO public.user_permissions (user_id, module, can_view, can_create, can_edit, can_delete)
      VALUES (r.user_id, 'governanca', true, true, true, true)
      ON CONFLICT (user_id, module) DO NOTHING;

      -- Dar permissão de view em Dashboards
      INSERT INTO public.user_permissions (user_id, module, can_view, can_create, can_edit, can_delete)
      VALUES 
        (r.user_id, 'dashboard_executivo', true, false, false, false),
        (r.user_id, 'dashboard_pessoal', true, false, false, false)
      ON CONFLICT (user_id, module) DO NOTHING;

    -- Se for GERENTE
    ELSIF r.role = 'gerente' THEN
      -- Permissão de view em Dashboards e Governança
      INSERT INTO public.user_permissions (user_id, module, can_view, can_create, can_edit, can_delete)
      VALUES 
        (r.user_id, 'governanca', true, false, false, false),
        (r.user_id, 'dashboard_executivo', true, false, false, false),
        (r.user_id, 'dashboard_pessoal', true, false, false, false)
      ON CONFLICT (user_id, module) DO NOTHING;
      
    END IF;
  END LOOP;
END $$;
