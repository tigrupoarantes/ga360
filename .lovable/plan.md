

## Plano: Migrar GA360 para Supabase Externo

Este plano atualiza todas as referências do projeto para apontar para o Supabase externo `zveqhxaiwghexfobjaek.supabase.co`.

---

## Diagnóstico do Problema

O projeto ainda está configurado para o Lovable Cloud (`aqromdreppgztagafinr`), mas deveria estar usando o Supabase externo (`zveqhxaiwghexfobjaek`).

**Erro reportado pelo Gestão de Ativos:**
```
Erro ao verificar empresa: Could not find the table 'public.empresas' in the schema cache
```

Este erro ocorre porque:
1. O Gestão de Ativos está tentando acessar o projeto errado
2. Ou está usando uma service key de um projeto diferente

---

## Arquivos que Precisam ser Atualizados

| Arquivo | Valor Atual | Valor Correto |
|---------|-------------|---------------|
| `.env` | `aqromdreppgztagafinr` | `zveqhxaiwghexfobjaek` |
| `supabase/config.toml` | `project_id = "aqromdreppgztagafinr"` | `project_id = "zveqhxaiwghexfobjaek"` |
| `src/components/employees/EmployeeSyncDocs.tsx` | URL hardcoded antiga | URL dinâmica ou nova |
| `src/components/goals/SyncStatus.tsx` | URL hardcoded antiga | URL dinâmica ou nova |

---

## Parte 1: Atualizar Variáveis de Ambiente

**Arquivo:** `.env`

```env
VITE_SUPABASE_PROJECT_ID="zveqhxaiwghexfobjaek"
VITE_SUPABASE_PUBLISHABLE_KEY="[ANON_KEY_DO_PROJETO_EXTERNO]"
VITE_SUPABASE_URL="https://zveqhxaiwghexfobjaek.supabase.co"
```

**Nota:** Preciso que você forneça a `anon key` do projeto externo.

---

## Parte 2: Atualizar Config do Supabase

**Arquivo:** `supabase/config.toml`

```toml
project_id = "zveqhxaiwghexfobjaek"
```

---

## Parte 3: Corrigir URLs Hardcoded

### 3.1 EmployeeSyncDocs.tsx

Atualizar para usar variável de ambiente:

```typescript
// Antes
const apiEndpoint = `https://aqromdreppgztagafinr.supabase.co/functions/v1/sync-employees`;

// Depois
const apiEndpoint = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-employees`;
```

### 3.2 SyncStatus.tsx

```typescript
// Antes
const apiEndpoint = `https://aqromdreppgztagafinr.supabase.co/functions/v1/sync-sales`;

// Depois
const apiEndpoint = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-sales`;
```

---

## Parte 4: Credenciais Necessárias

Preciso que você confirme/forneça:

| Credencial | Onde Obter |
|------------|------------|
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Dashboard Supabase → Settings → API → anon public |
| `SUPABASE_SERVICE_ROLE_KEY` | Dashboard Supabase → Settings → API → service_role (para secrets) |
| `SYNC_API_KEY` | Secret customizado para autenticação das APIs de sync |

---

## Parte 5: Deploy das Edge Functions

Após atualizar as configurações, será necessário fazer o deploy de todas as 22 Edge Functions no projeto externo:

```text
confirm-attendance, create-user, create-users-from-employees, 
elevenlabs-scribe-token, generate-ata, generate-report, 
generate-stock-audit-report, import-users, recalculate-goals, 
send-2fa-code, send-attendance-confirmation, send-email-smtp, 
send-invite, send-meeting-notification, send-meeting-reminders, 
send-whatsapp-reminder, sync-companies, sync-employees, 
sync-sales, sync-sellers, test-openai-connection, 
test-smtp-connection, transcribe-meeting, verify-2fa-code
```

---

## Configuração para Gestão de Ativos

Após a migração, o Gestão de Ativos deve usar:

| Configuração | Valor |
|--------------|-------|
| `GA360_SUPABASE_URL` | `https://zveqhxaiwghexfobjaek.supabase.co` |
| `GA360_SERVICE_ROLE_KEY` | Service Role Key do projeto externo |
| `GA360_SYNC_API_KEY` | Valor do secret SYNC_API_KEY |

**Endpoints de sincronização:**
- `POST https://zveqhxaiwghexfobjaek.supabase.co/functions/v1/sync-companies`
- `POST https://zveqhxaiwghexfobjaek.supabase.co/functions/v1/sync-employees`

---

## Ordem de Execução

1. Você fornece a `anon key` do projeto externo
2. Atualizo `.env` com as novas credenciais
3. Atualizo `supabase/config.toml` com o novo project_id
4. Corrijo as URLs hardcoded nos componentes
5. Deploy das Edge Functions no projeto externo
6. Configuração dos secrets no projeto externo
7. Teste de conectividade

---

## Próximo Passo Imediato

Por favor, forneça a **anon key** (chave pública) do projeto Supabase externo `zveqhxaiwghexfobjaek`. 

Você pode encontrá-la em:
**Dashboard Supabase → Settings → API → Project API keys → anon public**

