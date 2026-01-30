# Migração GA 360 - Lovable Cloud → Supabase Externo

## ✅ Status: Scripts Gerados

Os scripts de migração foram gerados com sucesso e estão disponíveis em `docs/migration/`.

---

## 📁 Arquivos Gerados

| Arquivo | Descrição | Linhas |
|---------|-----------|--------|
| `docs/migration/schema-completo.sql` | Schema consolidado (tabelas, tipos, funções, triggers) | ~1500 |
| `docs/migration/rls-policies.sql` | Todas as políticas RLS | ~600 |
| `docs/migration/storage-buckets.sql` | Buckets de storage e políticas | ~80 |
| `docs/migration/seed-data.sql` | Dados iniciais (badges, config, áreas) | ~70 |
| `docs/migration/README.md` | Instruções completas | - |

---

## 🚀 Próximos Passos

### Etapa 1: Executar Scripts no Supabase Externo

1. Acesse o **SQL Editor** do seu Supabase
2. Execute os scripts **nesta ordem**:
   - `schema-completo.sql`
   - `rls-policies.sql`
   - `storage-buckets.sql`
   - `seed-data.sql`

### Etapa 2: Configurar Secrets

No Dashboard do Supabase → **Settings → Edge Functions → Secrets**:

| Secret | Valor |
|--------|-------|
| `SMTP_PASSWORD` | Sua senha SMTP |
| `SYNC_API_KEY` | Chave da API de sincronização |
| `RESEND_API_KEY` | Chave do Resend (se usar) |
| `LOVABLE_API_KEY` | Chave do Lovable AI |

### Etapa 3: Deploy das Edge Functions

```bash
# No terminal, na pasta do projeto
npm install -g supabase
supabase login
supabase link --project-ref SEU_PROJECT_ID
supabase functions deploy
```

### Etapa 4: Atualizar Credenciais no Lovable

Depois de configurar o Supabase externo, me informe:
- **Project ID**: `xxx`
- **Anon Key**: `xxx`
- **URL**: `https://xxx.supabase.co`

E eu atualizarei o arquivo `.env` para apontar para seu novo backend.

### Etapa 5: Atribuir Role Super Admin

Após criar seu usuário no novo Supabase, execute:

```sql
INSERT INTO public.user_roles (user_id, role)
VALUES ('SEU_USER_ID', 'super_admin')
ON CONFLICT (user_id, role) DO NOTHING;
```

---

## ✅ Checklist Pós-Migração

- [ ] Scripts SQL executados no Supabase externo
- [ ] Secrets configurados
- [ ] Edge Functions deployed via CLI
- [ ] `.env` atualizado com novas credenciais
- [ ] Role `super_admin` atribuída
- [ ] Teste de login OK
- [ ] Teste de criação de reunião OK
- [ ] Teste de envio de email OK

---

## 📊 Exportar Dados do Lovable Cloud

Se precisar exportar os dados existentes, posso gerar queries de exportação para cada tabela.

---

## 🔧 Suporte

Se encontrar erros durante a migração, me informe a mensagem de erro e ajudarei a resolver.

