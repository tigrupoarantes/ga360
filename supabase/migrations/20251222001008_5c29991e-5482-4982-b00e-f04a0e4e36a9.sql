-- Restaurar a role super_admin para o usuário william.cintra@grupoarantes.emp.br
INSERT INTO public.user_roles (user_id, role)
VALUES ('969bfa20-bdaf-41f4-9707-7a5d201913f3', 'super_admin')
ON CONFLICT (user_id, role) DO NOTHING;