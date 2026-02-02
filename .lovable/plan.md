

## Plano: Corrigir Import do Cliente Supabase em AdminUsers.tsx

O problema é que a página de usuários está usando o cliente Supabase errado.

---

## Diagnóstico

| Arquivo | Cliente Usado | Projeto |
|---------|---------------|---------|
| `client.ts` | Lovable Cloud | `aqromdreppgztagafinr` |
| `external-client.ts` | Seu Supabase | `zveqhxaiwghexfobjaek` |

A página `AdminUsers.tsx` está importando `client.ts` (Lovable Cloud), mas deveria usar `external-client.ts` (seu banco externo).

---

## Correção Necessária

### Arquivo: `src/pages/AdminUsers.tsx`

**Linha 4 - Antes:**
```typescript
import { supabase } from '@/integrations/supabase/client';
```

**Linha 4 - Depois:**
```typescript
import { supabase } from '@/integrations/supabase/external-client';
```

---

## Resultado Esperado

Após a correção:
- A página buscará dados do banco externo (`zveqhxaiwghexfobjaek`)
- Apenas o seu usuário (William Cintra) será exibido
- Todas as operações (editar, criar usuário) funcionarão com o banco correto

---

## Seção Técnica

Esta é uma correção simples de import. O restante do código não precisa de alteração pois ambos os clientes exportam o mesmo objeto `supabase` com a mesma interface.

