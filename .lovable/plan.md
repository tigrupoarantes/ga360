

## Correção do External ID da Chok Distribuidora

### Resumo
Atualizar o campo `external_id` da empresa **Chok Distribuidora de Alimentos Ltda.** para usar o CNPJ correto sem formatação, permitindo que a sincronização do N8N funcione corretamente.

---

### Alteração no Banco de Dados

| Campo | Valor Atual | Novo Valor |
|-------|-------------|------------|
| `external_id` | `09277498000160` | `05383639000117` |

**Empresa afetada:**
- **ID:** `51e3b8e4-7c0f-4b00-a818-6e8708a92835`
- **Nome:** Chok Distribuidora de Alimentos Ltda.
- **CNPJ:** 05.383.639/0001-17

---

### Após a Correção

No seu nó **Code** do N8N, use:

```javascript
company_external_id: "05383639000117"
```

---

### Detalhes Técnicos

A migração executará o seguinte SQL:

```sql
UPDATE companies 
SET external_id = '05383639000117', 
    updated_at = now() 
WHERE id = '51e3b8e4-7c0f-4b00-a818-6e8708a92835';
```

Isso garante que a Edge Function `sync-sales-items` encontre a empresa corretamente quando receber dados do N8N.

