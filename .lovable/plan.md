

# Plano: Adicionar Campo "Auditável" no Cadastro de Empresas

## Objetivo

Simplificar a tela de seleção de unidades para auditoria, exibindo apenas as empresas marcadas como "auditáveis".

---

## Mudanças Necessárias

### 1. Migração SQL

Adicionar coluna `is_auditable` na tabela `companies`:

```sql
ALTER TABLE companies 
ADD COLUMN is_auditable BOOLEAN DEFAULT false;

-- Atualizar empresas existentes que devem ser auditáveis
-- (pode ser feito manualmente depois via Admin)
```

---

### 2. Formulário de Empresa (CompanyFormDialog.tsx)

**Adicionar novo campo Switch:**

| Campo | Tipo | Default |
|-------|------|---------|
| `is_auditable` | Boolean | `false` |

Interface atualizada:
```typescript
interface Company {
  id?: string;
  name: string;
  cnpj?: string;
  is_active: boolean;
  is_auditable: boolean;  // NOVO
  logo_url?: string;
  color?: string;
}
```

UI - Adicionar abaixo do Switch "Empresa Ativa":
```text
┌─────────────────────────────────────┐
│ Empresa Ativa               [ON]    │
│ Habilitada para Auditoria   [OFF]   │ ← NOVO
└─────────────────────────────────────┘
```

---

### 3. Seletor de Unidades (UnitSelector.tsx)

**Atualizar query para filtrar empresas auditáveis:**

```typescript
// ANTES
.eq("is_active", true)

// DEPOIS
.eq("is_active", true)
.eq("is_auditable", true)
```

**Atualizar mensagem de estado vazio:**
```text
"Nenhuma empresa habilitada para auditoria.
Configure as empresas auditáveis em Admin > Estrutura Organizacional."
```

---

## Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| Migração SQL | Adicionar coluna `is_auditable` |
| `src/components/admin/CompanyFormDialog.tsx` | Adicionar campo Switch |
| `src/components/stock-audit/steps/UnitSelector.tsx` | Filtrar por `is_auditable = true` |

---

## Fluxo Resultante

```text
1. Admin acessa Estrutura Organizacional
2. Edita empresa → Liga "Habilitada para Auditoria"
3. Auditor acessa Auditoria de Estoque
4. Vê apenas empresas auditáveis
```

---

## Benefícios

- **Tela mais limpa**: Apenas unidades relevantes aparecem
- **Controle centralizado**: Admin define quem é auditável
- **Flexibilidade**: Fácil adicionar/remover unidades do processo

