

## Correção: Adicionar Constraint UNIQUE na Tabela sales_items

### Diagnóstico

O upsert está falhando porque a tabela `sales_items` no Supabase externo (`zveqhxaiwghexfobjaek`) **não possui** a constraint UNIQUE necessária em `(company_id, external_id)`.

A prova está na resposta do N8N:
- Tabelas auxiliares funcionaram (têm a constraint)
- `sales_items` falhou completamente (não tem a constraint)

---

### Solução

Execute o seguinte SQL no **Supabase externo** (não no Lovable Cloud):

```sql
-- Adicionar constraint UNIQUE na tabela sales_items
ALTER TABLE sales_items 
ADD CONSTRAINT sales_items_company_external_unique 
UNIQUE (company_id, external_id);
```

---

### Como Executar

1. Acesse o **Dashboard do Supabase** externo: https://supabase.com/dashboard/project/zveqhxaiwghexfobjaek

2. Vá em **SQL Editor**

3. Execute o comando acima

4. **Teste novamente no N8N**

---

### Verificação Prévia (Opcional)

Antes de criar a constraint, verifique se não há duplicatas:

```sql
-- Verificar se existem duplicatas
SELECT company_id, external_id, COUNT(*) as count
FROM sales_items
GROUP BY company_id, external_id
HAVING COUNT(*) > 1;
```

Se houver duplicatas, remova-as primeiro:

```sql
-- Remover duplicatas mantendo o mais recente
DELETE FROM sales_items a
USING sales_items b
WHERE a.id < b.id 
  AND a.company_id = b.company_id 
  AND a.external_id = b.external_id;
```

---

### Por que isso acontece?

O método `upsert` do Supabase com a opção `onConflict: 'company_id,external_id'` **requer** que exista uma constraint UNIQUE ou PRIMARY KEY nas colunas especificadas. Sem ela, o Supabase não consegue determinar qual registro atualizar em caso de conflito.

---

### Após a Correção

A resposta do N8N deve mostrar:
```json
{
  "success": true,
  "received": 2180,
  "upserted": 2180,  // <-- Agora funciona!
  "errors": 0,
  "customers_synced": 303,
  "products_synced": 602,
  "sellers_synced": 63
}
```

