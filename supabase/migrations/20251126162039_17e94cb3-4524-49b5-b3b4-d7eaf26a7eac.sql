-- Criar usuário super_admin manualmente
-- Email: willim.cintra@grupoarantes.emp.br
-- Senha: Ti@chd50

-- Este script cria o usuário diretamente no auth.users
-- NOTA: A senha precisa ser hash bcrypt. A senha fornecida será definida via Admin API

-- Inserir dados na tabela profiles para o novo usuário
-- O ID será definido quando o usuário for criado via Admin API
-- Este script apenas prepara o sistema para aceitar o novo usuário

-- Por segurança, este usuário deve ser criado via Supabase Dashboard ou Admin API
-- Instruções:
-- 1. Acessar o Lovable Cloud Backend
-- 2. Ir em Authentication -> Users
-- 3. Clicar em "Add user"
-- 4. Preencher:
--    - Email: willim.cintra@grupoarantes.emp.br
--    - Password: Ti@chd50
--    - Confirm email: Yes
-- 5. Após criar, execute o seguinte SQL substituindo {USER_ID} pelo ID gerado:

-- UPDATE profiles SET first_name = 'Willim', last_name = 'Cintra' WHERE id = '{USER_ID}';
-- INSERT INTO user_roles (user_id, role) VALUES ('{USER_ID}', 'super_admin');

-- Comentário: A criação manual via backend é mais segura do que via SQL
SELECT 'Usuário super_admin deve ser criado via Backend Console' as instrucao;