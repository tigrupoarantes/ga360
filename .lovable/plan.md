

## Plano: Atualizar Credenciais do Supabase Externo

Vou atualizar o arquivo `.env` para apontar para o Supabase externo.

---

## Alteração Necessária

Atualizar o arquivo `.env` com as novas credenciais:

| Variável | Valor Atual (Lovable Cloud) | Novo Valor (Supabase Externo) |
|----------|----------------------------|-------------------------------|
| `VITE_SUPABASE_PROJECT_ID` | `aqromdreppgztagafinr` | `zveqhxaiwghexfobjaek` |
| `VITE_SUPABASE_URL` | `https://aqromdreppgztagafinr.supabase.co` | `https://zveqhxaiwghexfobjaek.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `eyJ...q9k` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp2ZXFoeGFpd2doZXhmb2JqYWVrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3OTM0ODAsImV4cCI6MjA4NTM2OTQ4MH0.N2EEwDUfWlHMJAC777eELMxmpyOyrJ087kPex3Y` |

---

## Resultado Esperado

Após a alteração:
- A aplicação passará a se conectar exclusivamente ao Supabase externo
- Todos os dados migrados estarão acessíveis
- Login e funcionalidades usarão o novo backend

---

## Seção Técnica

O arquivo `.env` será atualizado com:

```env
VITE_SUPABASE_PROJECT_ID="zveqhxaiwghexfobjaek"
VITE_SUPABASE_PUBLISHABLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp2ZXFoeGFpd2doZXhmb2JqYWVrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3OTM0ODAsImV4cCI6MjA4NTM2OTQ4MH0.N2EEwDUfWlHMJAC777eELMxmpyOyrJ087kPex3Y"
VITE_SUPABASE_URL="https://zveqhxaiwghexfobjaek.supabase.co"
```

O cliente Supabase em `src/integrations/supabase/client.ts` já lê essas variáveis automaticamente, então nenhuma alteração adicional é necessária no código.

