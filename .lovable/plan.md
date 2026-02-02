

## Plano: Configurar Cliente Supabase Externo no GA360

Este plano replica a estrutura do projeto "Gestão de Ativos" para que o GA360 use o Supabase externo (`zveqhxaiwghexfobjaek`) de forma independente do arquivo `.env` gerenciado pelo Lovable Cloud.

---

## Problema Atual

```text
SITUAÇÃO ATUAL:
┌─────────────────────────────────────────────────────────┐
│ .env (gerenciado pelo Lovable Cloud - sobrescrito)      │
│   VITE_SUPABASE_URL = aqromdreppgztagafinr (Cloud)      │
├─────────────────────────────────────────────────────────┤
│ src/integrations/supabase/client.ts                      │
│   → Lê do .env                                          │
│   → Conecta ao Lovable Cloud                            │
├─────────────────────────────────────────────────────────┤
│ 86 arquivos importam de:                                │
│   "@/integrations/supabase/client"                      │
└─────────────────────────────────────────────────────────┘
```

---

## Solução Proposta

```text
NOVA ESTRUTURA:
┌─────────────────────────────────────────────────────────┐
│ src/config/supabase.config.ts (NOVO)                     │
│   → Credenciais hardcoded do Supabase externo           │
│   → URL: zveqhxaiwghexfobjaek.supabase.co               │
├─────────────────────────────────────────────────────────┤
│ src/integrations/supabase/external-client.ts (NOVO)      │
│   → Cria cliente usando config externo                  │
│   → Exporta supabase e supabaseExternal                 │
├─────────────────────────────────────────────────────────┤
│ 86 arquivos alterados para importar de:                 │
│   "@/integrations/supabase/external-client"             │
└─────────────────────────────────────────────────────────┘
```

---

## Arquivos a Criar

### 1. Arquivo de Configuração

**Caminho:** `src/config/supabase.config.ts`

```typescript
export const EXTERNAL_SUPABASE_CONFIG = {
  url: "https://zveqhxaiwghexfobjaek.supabase.co",
  anonKey: "SUA_ANON_KEY_AQUI",
  projectId: "zveqhxaiwghexfobjaek"
};
```

### 2. Cliente Externo

**Caminho:** `src/integrations/supabase/external-client.ts`

```typescript
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { EXTERNAL_SUPABASE_CONFIG } from '@/config/supabase.config';

export const supabaseExternal = createClient<Database>(
  EXTERNAL_SUPABASE_CONFIG.url,
  EXTERNAL_SUPABASE_CONFIG.anonKey,
  {
    auth: {
      storage: localStorage,
      persistSession: true,
      autoRefreshToken: true,
    }
  }
);

export const supabase = supabaseExternal;
```

---

## Arquivos a Modificar (86 arquivos)

Todos os arquivos que importam do cliente atual precisam ter o import atualizado:

```typescript
// DE:
import { supabase } from "@/integrations/supabase/client";

// PARA:
import { supabase } from "@/integrations/supabase/external-client";
```

### Lista Completa de Arquivos

| # | Arquivo |
|---|---------|
| 1 | src/hooks/useStockAudit.ts |
| 2 | src/hooks/useAvatarUpload.ts |
| 3 | src/contexts/AuthContext.tsx |
| 4 | src/contexts/CompanyContext.tsx |
| 5 | src/pages/Admin.tsx |
| 6 | src/pages/AdminAreas.tsx |
| 7 | src/pages/AdminCompanies.tsx |
| 8 | src/pages/AdminDatalake.tsx |
| 9 | src/pages/AdminEmployees.tsx |
| 10 | src/pages/AdminGovernancaEC.tsx |
| 11 | src/pages/AdminOrganization.tsx |
| 12 | src/pages/AdminPermissions.tsx |
| 13 | src/pages/AdminSettings.tsx |
| 14 | src/pages/AdminUsers.tsx |
| 15 | src/pages/Analytics.tsx |
| 16 | src/pages/Auth.tsx |
| 17 | src/pages/Calendar.tsx |
| 18 | src/pages/ChangePassword.tsx |
| 19 | src/pages/ConfirmAttendance.tsx |
| 20 | src/pages/Dashboard.tsx |
| 21 | src/pages/DashboardMe.tsx |
| 22 | src/pages/Goals.tsx |
| 23 | src/pages/GovernancaEC.tsx |
| 24 | src/pages/GovernancaECArea.tsx |
| 25 | src/pages/GovernancaECCardDetail.tsx |
| 26 | src/pages/MeetingExecution.tsx |
| 27 | src/pages/Meetings.tsx |
| 28 | src/pages/Profile.tsx |
| 29 | src/pages/ResetPassword.tsx |
| 30 | src/pages/StockAuditExecution.tsx |
| 31 | src/pages/StockAuditStart.tsx |
| 32 | src/pages/Tasks.tsx |
| 33 | src/pages/Trade.tsx |
| 34 | ... e mais 52 componentes |

---

## Edge Functions

As Edge Functions continuarão funcionando normalmente pois usam variáveis de ambiente do Supabase (secrets), não o cliente do frontend.

---

## Resumo da Implementação

| Ação | Quantidade |
|------|------------|
| Criar arquivos | 2 |
| Modificar imports | 86 |
| Edge Functions | Sem alteração |

---

## Seção Técnica

### Credenciais Necessárias

Para criar o arquivo de configuração, preciso confirmar a **anon key** do projeto externo:

- **Project ID:** `zveqhxaiwghexfobjaek`
- **URL:** `https://zveqhxaiwghexfobjaek.supabase.co`
- **Anon Key:** (você precisa fornecer)

### Vantagens desta Abordagem

1. **Independência do .env**: O Lovable Cloud pode sobrescrever o `.env` sem afetar a conexão
2. **Padrão consistente**: Mesma estrutura do projeto "Gestão de Ativos"
3. **Fácil manutenção**: Credenciais centralizadas em um único arquivo
4. **Sem impacto em Edge Functions**: Continuam usando secrets do Supabase

### Script de Busca/Substituição

A modificação dos 86 arquivos será feita com substituição simples:

```
Buscar:  from "@/integrations/supabase/client"
Trocar:  from "@/integrations/supabase/external-client"
```

