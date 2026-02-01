

## Plano: Preparar GA360 para Sincronização com Ativos Arantes

Este plano implementa as melhorias necessárias no GA360 para receber sincronização completa de empresas e funcionários do sistema Ativos Arantes.

---

## Visão Geral

```text
┌─────────────────────────────┐         ┌─────────────────────────────┐
│     ATIVOS ARANTES          │         │         GA360               │
│   (Origem - Master)         │         │    (Destino)                │
├─────────────────────────────┤         ├─────────────────────────────┤
│  empresas                   │ ──────► │  companies (atualizado)     │
│  funcionarios               │ ──────► │  external_employees (atual) │
│  equipes                    │ ──────► │  areas (futuro)             │
└─────────────────────────────┘         └─────────────────────────────┘
        │                                           │
        └─────────────── SYNC API ──────────────────┘
              POST /sync-companies (NOVO)
              POST /sync-employees (existente)
```

---

## Parte 1: Alterações no Schema

### 1.1 Tabela `companies` - Novos Campos

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `razao_social` | text | Razão social da empresa |
| `address` | text | Endereço completo |
| `phone` | text | Telefone de contato |
| `email` | text | Email corporativo |

### 1.2 Tabela `external_employees` - Campos CNH

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `cnh_numero` | text | Número da CNH |
| `cnh_categoria` | text | Categoria (A, B, AB, etc.) |
| `cnh_validade` | date | Data de validade |

### 1.3 Atualização de Dados Existentes

Atualizar o `external_id` das empresas existentes com seus respectivos CNPJs:

| Empresa | CNPJ (external_id) |
|---------|-------------------|
| JArantes Distribuição Nestlé | 12513175000181 |
| Chok Distribuidora | 09277498000160 |
| G4 Distribuidora | 10596272000107 |
| Chokdoce | 18780714000162 |
| Escritório Central | 26605418000196 |
| Chokagro | 13460854000100 |

---

## Parte 2: Nova Edge Function `sync-companies`

### Endpoint
```
POST /sync-companies
Header: x-api-key: {SYNC_API_KEY}
```

### Payload de Entrada
```json
{
  "companies": [
    {
      "cnpj": "12513175000181",
      "nome": "JArantes Distribuição Nestlé",
      "razao_social": "J Arantes Distribuição Ltda",
      "endereco": "Rua...",
      "telefone": "(16) 3333-3333",
      "email": "contato@jarantes.com.br",
      "active": true
    }
  ]
}
```

### Lógica
1. Validar API Key
2. Para cada empresa:
   - Buscar por `external_id` = CNPJ (sem formatação)
   - Se existir: UPDATE
   - Se não existir: INSERT
3. Retornar relatório de sincronização

### Resposta
```json
{
  "success": true,
  "created": 0,
  "updated": 6,
  "failed": 0
}
```

---

## Parte 3: Atualização do `sync-employees`

### Melhorias
- Adicionar suporte aos campos CNH (`cnh_numero`, `cnh_categoria`, `cnh_validade`)
- Mapear `empresa_cnpj` → `company_id` (buscar empresa pelo CNPJ)
- Suporte a `equipe_id` para vinculação futura

### Novo Payload Esperado
```json
{
  "company_external_id": "12513175000181",
  "source_system": "gestao_ativos",
  "employees": [
    {
      "id": "uuid-origem",
      "nome": "Nome Completo",
      "cpf": "12345678901",
      "email": "email@empresa.com.br",
      "cargo": "Motorista",
      "departamento": "Logística",
      "is_condutor": true,
      "cnh_numero": "12345678901",
      "cnh_categoria": "D",
      "cnh_validade": "2025-12-31"
    }
  ]
}
```

---

## Arquivos a Modificar/Criar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| Migration SQL | CRIAR | Adicionar campos nas tabelas |
| `supabase/functions/sync-companies/index.ts` | CRIAR | Nova Edge Function |
| `supabase/functions/sync-employees/index.ts` | EDITAR | Suporte a campos CNH |
| `supabase/config.toml` | EDITAR | Registrar sync-companies |

---

## SQL da Migration

```sql
-- 1. Adicionar campos na tabela companies
ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS razao_social TEXT,
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS email TEXT;

-- 2. Adicionar campos CNH na tabela external_employees
ALTER TABLE external_employees
ADD COLUMN IF NOT EXISTS cnh_numero TEXT,
ADD COLUMN IF NOT EXISTS cnh_categoria TEXT,
ADD COLUMN IF NOT EXISTS cnh_validade DATE;

-- 3. Atualizar external_id das empresas com CNPJs
UPDATE companies SET external_id = '12513175000181' 
WHERE name ILIKE '%jarantes%' OR name ILIKE '%j arantes%';

UPDATE companies SET external_id = '09277498000160' 
WHERE name ILIKE '%chok distribuidora%';

UPDATE companies SET external_id = '10596272000107' 
WHERE name ILIKE '%g4%';

UPDATE companies SET external_id = '18780714000162' 
WHERE name ILIKE '%chokdoce%';

UPDATE companies SET external_id = '26605418000196' 
WHERE name ILIKE '%escritorio%' OR name ILIKE '%central%';

UPDATE companies SET external_id = '13460854000100' 
WHERE name ILIKE '%chokagro%';
```

---

## Credenciais Necessárias (para Ativos Arantes)

O sistema Ativos Arantes precisará configurar estes secrets:

| Secret | Valor |
|--------|-------|
| `GA360_SUPABASE_URL` | `https://aqromdreppgztagafinr.supabase.co` |
| `GA360_SYNC_API_KEY` | *(mesmo valor do SYNC_API_KEY atual)* |

---

## Ordem de Execução

1. **Migration**: Executar alterações no schema
2. **sync-companies**: Criar e deployar Edge Function
3. **sync-employees**: Atualizar com campos CNH
4. **Validação**: Testar endpoints com dados de exemplo
5. **Documentação**: Atualizar EmployeeSyncDocs com novo endpoint

---

## Resultado Esperado

Após implementação, o Ativos Arantes poderá:
1. Sincronizar empresas → `POST /sync-companies`
2. Sincronizar funcionários → `POST /sync-employees`
3. Manter dados de CNH dos condutores
4. Vincular funcionários às empresas corretas via CNPJ

