

# Plano: Migração Completa para Supabase Externo

## Visão Geral

Migrar todo o backend do projeto GA 360 do Lovable Cloud para seu projeto Supabase próprio, incluindo:
- Schema completo do banco de dados
- Dados existentes
- 22 Edge Functions
- Configuração de secrets

---

## Passo a Passo da Migração

### Etapa 1: Exportar Schema do Banco de Dados

No seu Supabase externo, execute todo o SQL das migrations em sequência. As migrations estão em `supabase/migrations/` e devem ser executadas na ordem cronológica.

**Opção mais fácil:** Gerar um SQL consolidado com todo o schema atual.

### Etapa 2: Exportar os Dados

Usando o painel do Lovable Cloud ou SQL, exportar os dados das tabelas principais:
- `profiles`, `companies`, `areas`, `user_roles`, `user_permissions`, `user_companies`
- `meetings`, `meeting_participants`, `meeting_rooms`, `meeting_atas`, `meeting_tasks`, `meeting_transcriptions`
- `goals`, `goal_types`, `goal_entries`, `okr_objectives`, `okr_key_results`
- `processes`, `process_executions`, `process_execution_items`
- `external_employees`, `sellers`, `sales`, `sales_sync_logs`
- `ec_cards`, `ec_areas`, `ec_instances`, `ec_comments`, `ec_tasks`
- `stock_audits`, `stock_audit_items`, `stock_audit_samples`
- `gamification tables`, `invites`, `system_settings`, `two_factor_codes`

### Etapa 3: Configurar Secrets no Supabase Externo

No Dashboard do seu Supabase → Settings → Secrets, adicionar:

| Secret | Descrição |
|--------|-----------|
| `SMTP_PASSWORD` | Senha do email SMTP corporativo |
| `SYNC_API_KEY` | Chave para sincronização com ERPs |
| `RESEND_API_KEY` | Chave da API Resend (se continuar usando) |
| `LOVABLE_API_KEY` | Chave para Lovable AI (funcionalidades de IA) |

### Etapa 4: Deploy das Edge Functions

Usar Supabase CLI para fazer deploy das 22 funções:

```bash
# Instalar CLI
npm install -g supabase

# Login
supabase login

# Linkar ao projeto
supabase link --project-ref SEU_PROJECT_ID

# Deploy de todas as funções
supabase functions deploy
```

### Etapa 5: Atualizar Variáveis de Ambiente no Lovable

Atualizar o arquivo `.env` com as novas credenciais:

```
VITE_SUPABASE_PROJECT_ID="seu_project_id"
VITE_SUPABASE_PUBLISHABLE_KEY="sua_anon_key"
VITE_SUPABASE_URL="https://seu_project_id.supabase.co"
```

### Etapa 6: Configurar Storage Buckets

Criar os buckets no novo Supabase:
- `avatars` (público)
- `ec-evidences` (privado)
- `stock-audit-files` (privado)

---

## Arquivos Que Você Receberá

| Arquivo | Conteúdo |
|---------|----------|
| `schema.sql` | Script SQL consolidado com todas as tabelas, tipos, funções, triggers e RLS |
| `functions/` | Código de todas as 22 Edge Functions (já estão no repositório) |

---

## Edge Functions a Migrar (22 total)

| Função | JWT | Descrição |
|--------|-----|-----------|
| `confirm-attendance` | false | Confirma presença em reunião |
| `create-user` | true | Cria novo usuário |
| `create-users-from-employees` | true | Converte funcionários em usuários |
| `elevenlabs-scribe-token` | true | Token para transcrição ElevenLabs |
| `generate-ata` | true | Gera ata de reunião |
| `generate-report` | true | Gera relatórios personalizados |
| `generate-stock-audit-report` | true | Relatório de auditoria de estoque |
| `import-users` | true | Importa usuários via CSV |
| `recalculate-goals` | false | Recalcula metas |
| `send-2fa-code` | false | Envia código 2FA |
| `send-attendance-confirmation` | true | Envia convite de confirmação |
| `send-email-smtp` | true | Envia email via SMTP |
| `send-invite` | true | Envia convite de acesso |
| `send-meeting-notification` | true | Notifica sobre reunião |
| `send-meeting-reminders` | false | Lembretes de reunião (cron) |
| `send-whatsapp-reminder` | true | Lembrete via WhatsApp |
| `sync-employees` | false | Sincroniza funcionários do ERP |
| `sync-sales` | false | Sincroniza vendas do ERP |
| `sync-sellers` | false | Sincroniza vendedores do ERP |
| `test-smtp-connection` | true | Testa conexão SMTP |
| `transcribe-meeting` | true | Transcreve reunião |
| `verify-2fa-code` | false | Verifica código 2FA |

---

## Checklist Pós-Migração

- [ ] Schema criado no Supabase externo
- [ ] Dados importados para todas as tabelas
- [ ] Secrets configurados
- [ ] Edge Functions deployed via CLI
- [ ] Storage buckets criados
- [ ] `.env` atualizado com novas credenciais
- [ ] Teste de login funcionando
- [ ] Teste de criação de reunião
- [ ] Teste de envio de email

---

## Próximos Passos

1. **Gerar o SQL consolidado** do schema para você executar no Supabase externo
2. **Fornecer instruções detalhadas** para exportar os dados
3. **Atualizar as credenciais** no arquivo `.env`

Posso gerar o script SQL consolidado do schema agora?

