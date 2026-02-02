

## Plano: Modificar sync-employees para Suportar Múltiplas Empresas

Este plano modifica a Edge Function `sync-employees` para aceitar funcionários de múltiplas empresas em uma única requisição, identificando a empresa através do campo `cnpj_empresa` de cada funcionário.

---

## Problema Atual

```text
ATUAL (Limitação):
┌─────────────────────────────────────────────────────────┐
│ POST /sync-employees                                     │
│                                                          │
│ {                                                        │
│   "company_external_id": "12513175000181", ← obrigatório│
│   "employees": [ ... todos vão para 1 empresa ]         │
│ }                                                        │
└─────────────────────────────────────────────────────────┘

RESULTADO: Todos os 272 funcionários foram para Broker J. Arantes
           Outras empresas: 0 funcionários
```

---

## Solução Proposta

```text
NOVO (Flexível):
┌─────────────────────────────────────────────────────────┐
│ POST /sync-employees                                     │
│                                                          │
│ {                                                        │
│   "employees": [                                         │
│     { "nome": "João", "cnpj_empresa": "12513175000181" },│
│     { "nome": "Maria", "cnpj_empresa": "09277498000160" }│
│   ]                                                      │
│ }                                                        │
└─────────────────────────────────────────────────────────┘

RESULTADO: João → Broker J. Arantes (CNPJ 12513175000181)
           Maria → Chok Distribuidora (CNPJ 09277498000160)
```

---

## Mapeamento Empresa → CNPJ

O sistema vai mapear automaticamente baseado no `cnpj_empresa` de cada funcionário:

| Empresa | CNPJ (external_id) |
|---------|-------------------|
| Broker J. Arantes | 12513175000181 |
| Chok Distribuidora | 09277498000160 |
| G4 Distribuidora | 10596272000107 |
| Chokdoce | 18780714000162 |
| Chokagro | 13460854000100 |
| Escritório Central | 26605418000196 |

---

## Modificações na Edge Function

### Novo Formato do Payload

O endpoint vai aceitar dois formatos (retrocompatível):

**Formato Antigo (ainda suportado):**
```json
{
  "company_external_id": "12513175000181",
  "employees": [...]
}
```

**Formato Novo (recomendado):**
```json
{
  "employees": [
    {
      "id": "uuid",
      "nome": "Nome do Funcionário",
      "cnpj_empresa": "12513175000181",
      ...demais campos
    }
  ]
}
```

### Lógica de Processamento

```text
PARA CADA funcionário:
  1. Extrair cnpj_empresa (ou usar company_external_id global como fallback)
  2. Buscar empresa pelo CNPJ no banco (com cache)
  3. Se empresa não encontrada → registrar erro e pular
  4. Inserir/atualizar funcionário na empresa correta
```

---

## Interface do EmployeeRecord Atualizada

Adicionar o campo `cnpj_empresa`:

```typescript
interface EmployeeRecord {
  // Campos existentes...
  id?: string;
  nome?: string;
  cpf?: string;
  
  // NOVO: Identificação da empresa
  cnpj_empresa?: string;  // CNPJ sem formatação
  
  // ... demais campos
}
```

---

## Resposta Aprimorada

A resposta incluirá estatísticas por empresa:

```json
{
  "success": true,
  "created": 500,
  "updated": 300,
  "failed": 5,
  "by_company": {
    "12513175000181": { "created": 200, "updated": 100 },
    "09277498000160": { "created": 150, "updated": 80 },
    "10596272000107": { "created": 80, "updated": 60 }
  },
  "errors": [...]
}
```

---

## Otimização: Cache de Empresas

Para evitar N+1 queries, buscar todas as empresas uma vez e usar um Map:

```typescript
// Buscar todas as empresas do grupo
const { data: companies } = await supabase
  .from('companies')
  .select('id, external_id');

// Criar mapa CNPJ → ID
const companyMap = new Map(
  companies.map(c => [c.external_id, c.id])
);

// Uso durante processamento
const companyId = companyMap.get(normalizedCnpj);
```

---

## Arquivo a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/sync-employees/index.ts` | Adicionar lógica multi-empresa |

---

## Seção Técnica

### Alterações no EmployeeRecord

```typescript
interface EmployeeRecord {
  // ... campos existentes ...
  
  // NOVO campo para identificação da empresa
  cnpj_empresa?: string;  // CNPJ da empresa (sem formatação)
}
```

### Alterações no SyncRequest

```typescript
interface SyncRequest {
  company_external_id?: string;  // Agora OPCIONAL (fallback)
  source_system?: string;
  employees: EmployeeRecord[];
}
```

### Nova Lógica de Processamento

1. Carregar mapa de empresas (CNPJ → UUID)
2. Para cada funcionário:
   - Normalizar `cnpj_empresa` (remover pontuação)
   - Buscar `company_id` no mapa
   - Se não encontrado e `company_external_id` global existe, usar ele
   - Se ainda não encontrado, registrar erro
3. Agrupar estatísticas por empresa
4. Retornar resposta detalhada

### Tratamento de Erros

- Funcionário sem `cnpj_empresa` e sem `company_external_id` global → erro
- CNPJ não encontrado no banco → erro (funcionário ignorado)
- Erro de inserção → registrado mas continua processando outros

### Logs Aprimorados

```typescript
console.log(`[sync-employees] Received ${employees.length} records from ${sourceSystem}`);
console.log(`[sync-employees] Identified ${uniqueCnpjs.size} unique companies`);
console.log(`[sync-employees] Company ${cnpj}: ${created} created, ${updated} updated`);
```

