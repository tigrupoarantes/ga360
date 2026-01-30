

## Plano: Atualizar Credenciais do Supabase Externo

### Objetivo
Atualizar o frontend do GA 360 para apontar para o novo projeto Supabase externo, completando a migração.

---

### Mudanças Necessárias

#### Arquivo: `.env`

Atualizar as variáveis de ambiente com as novas credenciais:

| Variável | Valor Atual (Lovable Cloud) | Novo Valor (Supabase Externo) |
|----------|----------------------------|-------------------------------|
| `VITE_SUPABASE_URL` | `https://aqromdreppgztagafinr.supabase.co` | `https://zveqhxaiwghexfobjaek.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `eyJhbG...9q9k` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp2ZXFoeGFpd2doZXhmb2JqYWVrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3OTM0ODAsImV4cCI6MjA4NTM2OTQ4MH0.N2EEwDUfWlZTWlHMJAC777eELMxmpyOyrJ087kPex3Y` |
| `VITE_SUPABASE_PROJECT_ID` | `aqromdreppgztagafinr` | `zveqhxaiwghexfobjaek` |

---

### Validação Pós-Atualização

Após a atualização, você deve testar:

1. **Login/Logout** - Verificar se a autenticação funciona
2. **Carregamento de dados** - Dashboard deve exibir dados do novo banco
3. **Criação de registros** - Testar criação de reunião ou tarefa
4. **Edge Functions** - Testar envio de email ou notificação

---

### Seção Técnica

O cliente Supabase em `src/integrations/supabase/client.ts` já lê as variáveis de ambiente dinamicamente:

```typescript
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
```

Portanto, apenas atualizar o `.env` é suficiente - não há necessidade de modificar código.

---

### Lembrete Importante

Certifique-se de que no Supabase externo você já:
- Executou o script para atribuir `super_admin` ao seu usuário
- Configurou todos os Secrets necessários nas Edge Functions
- Verificou que o schema e RLS policies estão aplicados

