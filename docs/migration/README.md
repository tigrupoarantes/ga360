# Migração GA 360 - Backend Anterior → Supabase Externo

Este diretório contém todos os arquivos necessários para migrar o backend do GA 360 de um backend gerenciado para seu próprio projeto Supabase.

## 📁 Arquivos

| Arquivo | Descrição |
|---------|-----------|
| `schema-completo.sql` | Schema consolidado com todas as tabelas, tipos, funções e triggers |
| `rls-policies.sql` | Todas as políticas RLS (Row Level Security) |
| `storage-buckets.sql` | Criação dos buckets de storage e suas políticas |
| `seed-data.sql` | Dados iniciais (badges, configurações, áreas EC) |
| `reset-pj-data-by-company.sql` | Limpa dados do módulo Controle PJ por empresa (inclui holerites) |
| `reset-verbas-and-employees-temporarily.sql` | Runbook SQL para limpeza temporária e controlada de funcionários e verbas durante alterações do DBA |
| `sync-pj-contracts-from-company.sql` | Sincroniza funcionários (external_employees) para contratos no módulo Controle PJ |
| `fix-governanca-permissions-by-email.sql` | Reaplica permissões de Governança EC e cards por email do usuário |

## 🚀 Ordem de Execução

Execute os scripts na seguinte ordem no **SQL Editor** do seu Supabase:

1. `schema-completo.sql`
2. `rls-policies.sql`
3. `storage-buckets.sql`
4. `seed-data.sql`

## ⚙️ Configuração de Secrets

Após executar os scripts SQL, configure os seguintes secrets no Dashboard do Supabase:

**Settings → Edge Functions → Secrets**

| Secret | Descrição |
|--------|-----------|
| `SMTP_PASSWORD` | Senha do servidor SMTP para envio de emails |
| `SYNC_API_KEY` | Chave para autenticação na API de sincronização do ERP |
| `RESEND_API_KEY` | Chave da API Resend (opcional) |

## 📦 Deploy das Edge Functions

As Edge Functions estão no diretório `supabase/functions/` do projeto.

```bash
# Instalar Supabase CLI
npm install -g supabase

# Login no Supabase
supabase login

# Linkar ao seu projeto
supabase link --project-ref SEU_PROJECT_ID

# Deploy de todas as funções
supabase functions deploy
```

### Edge Functions (22 total)

| Função | JWT Verificado |
|--------|----------------|
| `confirm-attendance` | ❌ |
| `create-user` | ✅ |
| `create-users-from-employees` | ✅ |
| `elevenlabs-scribe-token` | ✅ |
| `generate-ata` | ✅ |
| `generate-report` | ✅ |
| `generate-stock-audit-report` | ✅ |
| `import-users` | ✅ |
| `recalculate-goals` | ❌ |
| `send-2fa-code` | ❌ |
| `send-attendance-confirmation` | ✅ |
| `send-email-smtp` | ✅ |
| `send-invite` | ✅ |
| `send-meeting-notification` | ✅ |
| `send-meeting-reminders` | ❌ |
| `send-whatsapp-reminder` | ✅ |
| `sync-employees` | ❌ |
| `sync-sales` | ❌ |
| `sync-sellers` | ❌ |
| `test-smtp-connection` | ✅ |
| `transcribe-meeting` | ✅ |
| `verify-2fa-code` | ❌ |

## 🔄 Atualizar Credenciais no Frontend

Após a migração, atualize o arquivo `.env` do projeto:

```env
VITE_SUPABASE_PROJECT_ID="seu_project_id"
VITE_SUPABASE_PUBLISHABLE_KEY="sua_anon_key"
VITE_SUPABASE_URL="https://seu_project_id.supabase.co"
```

## 📊 Exportar Dados

Para exportar os dados do ambiente anterior, você pode usar queries SELECT no SQL Editor:

```sql
-- Exemplo: Exportar empresas
SELECT * FROM companies;

-- Exemplo: Exportar usuários
SELECT p.*, u.email 
FROM profiles p 
JOIN auth.users u ON u.id = p.id;

-- Exemplo: Exportar reuniões
SELECT * FROM meetings;
```

## ✅ Checklist Pós-Migração

- [ ] Schema criado no Supabase externo
- [ ] RLS policies aplicadas
- [ ] Storage buckets criados
- [ ] Dados seed inseridos
- [ ] Secrets configurados
- [ ] Edge Functions deployed
- [ ] `.env` atualizado com novas credenciais
- [ ] Teste de login funcionando
- [ ] Teste de criação de reunião
- [ ] Teste de envio de email
- [ ] Atribuir role `super_admin` ao usuário administrador

## 🔐 Atribuir Role Super Admin

Após criar seu usuário no novo Supabase, execute:

```sql
-- Substitua {USER_ID} pelo ID do usuário
INSERT INTO public.user_roles (user_id, role)
VALUES ('{USER_ID}', 'super_admin')
ON CONFLICT (user_id, role) DO NOTHING;
```

## ⚠️ Notas Importantes

1. O trigger `on_auth_user_created` cria automaticamente um perfil e atribui a role `colaborador` para novos usuários
2. As funções de gamificação (triggers de pontos) já estão configuradas
3. O sistema de 2FA está configurado para funcionar via email ou WhatsApp
4. Os buckets de storage têm limites de tamanho específicos:
   - `avatars`: 2MB
   - `ec-evidences`: 50MB
   - `stock-audit-files`: sem limite definido
