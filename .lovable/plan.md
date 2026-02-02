

## Plano: Simplificar Tela de Funcionários Externos

Este plano atualiza a lista de funcionários externos para mostrar apenas funcionários **ativos** e remove as referências a **condutores**, que não são relevantes para este portal.

---

## Resumo das Mudanças

| Aspecto | Antes | Depois |
|---------|-------|--------|
| Funcionários exibidos | Todos (ativos + inativos) | Apenas ativos |
| Filtro de status | Dropdown (Ativos/Inativos) | Removido |
| Filtro de condutor | Dropdown (Sim/Não) | Removido |
| Coluna "Status" na tabela | Sim (badge Ativo/Inativo) | Removida |
| Badge de condutor na célula Nome | Sim (ícone de carro) | Removido |
| Estatística "Ativos" | Sim | Removida (redundante) |
| Estatística "Inativos" | Sim | Removida |
| Estatística "Condutores" | Sim | Removida |
| Query padrão | Sem filtro de status | `.eq('is_active', true)` |

---

## Nova Arquitetura

```text
DEPOIS:
┌─────────────────────────────────────────────────────────┐
│ fetchEmployees()                                         │
│   → SELECT * FROM external_employees WHERE is_active=true│
│   → Retorna apenas ativos                               │
├─────────────────────────────────────────────────────────┤
│ Filtros: [Empresa] [Departamento] [Unidade] [Vínculo]   │
├─────────────────────────────────────────────────────────┤
│ Tabela: CPF | Nome | Email | Dept | Cargo | Unid | ...  │
│         (sem coluna Status, sem badge de condutor)      │
└─────────────────────────────────────────────────────────┘
```

---

## Novo Layout de Estatísticas (4 cards)

De 6 cards para 4 cards:

```text
┌──────────┬──────────┬────────────┬────────────┐
│  Total   │ Empresas │  Unidades  │ Vinculados │
│   800    │    6     │     12     │    180     │
└──────────┴──────────┴────────────┴────────────┘
```

---

## Mudanças Detalhadas

### 1. Query de Busca (fetchEmployees)

Adicionar filtro `is_active = true` na query:

```typescript
let query = supabase
  .from('external_employees')
  .select(`...`)
  .eq('is_active', true)  // NOVO: apenas ativos
  .order('full_name', { ascending: true });
```

### 2. Remover Estados de Filtro

- Remover: `statusFilter`
- Remover: `condutorFilter`

### 3. Remover do useEffect

Remover referências a `statusFilter` e `condutorFilter` nas dependências.

### 4. Remover Lógica de filterEmployees

Remover blocos de filtro por status e por condutor.

### 5. Remover Dropdowns de Filtro

- Remover dropdown "Status" (Todos/Ativos/Inativos)
- Remover dropdown "Condutor" (Todos/Sim/Não)

### 6. Simplificar Estatísticas

Remover cards:
- "Ativos" (redundante pois todos são ativos)
- "Inativos" (não aplicável)
- "Condutores" (não relevante)

Adicionar card:
- "Empresas" (quantidade de empresas únicas nos dados)

### 7. Remover da Tabela

- Remover coluna "Status" e seu header
- Remover badge de condutor (ícone Car) da célula Nome

### 8. Atualizar Exportação CSV

Remover colunas:
- "Status"
- "Condutor"

### 9. Remover Import Não Usado

Remover `Car` da importação de lucide-react.

---

## Arquivo a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/employees/ExternalEmployeesList.tsx` | Aplicar todas as mudanças |

---

## Seção Técnica

### Estados a Remover

```typescript
// REMOVER:
const [statusFilter, setStatusFilter] = useState<string>("all");
const [condutorFilter, setCondutorFilter] = useState<string>("all");
```

### useEffect - Atualizar Dependências

```typescript
// DE:
useEffect(() => {
  filterEmployees();
}, [employees, searchTerm, departmentFilter, unidadeFilter, statusFilter, linkFilter, condutorFilter, companyFilter]);

// PARA:
useEffect(() => {
  filterEmployees();
}, [employees, searchTerm, departmentFilter, unidadeFilter, linkFilter, companyFilter]);
```

### Query Atualizada

```typescript
let query = supabase
  .from('external_employees')
  .select(`
    *,
    profiles:linked_profile_id (...),
    lider_direto:lider_direto_id (...),
    companies:company_id (...)
  `)
  .eq('is_active', true)  // NOVO
  .order('full_name', { ascending: true });
```

### filterEmployees - Blocos a Remover

```typescript
// REMOVER este bloco:
if (statusFilter !== "all") {
  filtered = filtered.filter(e => 
    statusFilter === "active" ? e.is_active : !e.is_active
  );
}

// REMOVER este bloco:
if (condutorFilter !== "all") {
  filtered = filtered.filter(e => 
    condutorFilter === "yes" ? e.is_condutor : !e.is_condutor
  );
}
```

### Import - Remover Car

```typescript
// DE:
import { Users, Search, Download, RefreshCw, Building2, Briefcase, Link2, Link2Off, Loader2, Car, MapPin, UserCircle, UserPlus } from "lucide-react";

// PARA:
import { Users, Search, Download, RefreshCw, Building2, Briefcase, Link2, Link2Off, Loader2, MapPin, UserCircle, UserPlus } from "lucide-react";
```

### Novo Layout de Estatísticas

```tsx
<div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
  <div className="bg-muted/50 rounded-lg p-3 text-center">
    <div className="text-2xl font-bold text-foreground">{employees.length}</div>
    <div className="text-xs text-muted-foreground">Total</div>
  </div>
  <div className="bg-muted/50 rounded-lg p-3 text-center">
    <div className="text-2xl font-bold text-purple-600">
      {new Set(employees.map(e => e.company_id).filter(Boolean)).size}
    </div>
    <div className="text-xs text-muted-foreground">Empresas</div>
  </div>
  <div className="bg-muted/50 rounded-lg p-3 text-center">
    <div className="text-2xl font-bold text-primary">{unidades.length}</div>
    <div className="text-xs text-muted-foreground">Unidades</div>
  </div>
  <div className="bg-muted/50 rounded-lg p-3 text-center">
    <div className="text-2xl font-bold text-blue-600">{employees.filter(e => e.linked_profile_id).length}</div>
    <div className="text-xs text-muted-foreground">Vinculados</div>
  </div>
</div>
```

### CSV - Atualizar Exportação

```typescript
// DE:
const headers = ['CPF', ..., 'Status', 'Condutor', 'Cód. Vendedor', ...];
const rows = filteredEmployees.map(e => [
  ...,
  e.is_active ? 'Ativo' : 'Inativo',
  e.is_condutor ? 'Sim' : 'Não',
  ...
]);

// PARA:
const headers = ['CPF', 'Matrícula', 'Nome', 'Email', 'Telefone', 'Departamento', 'Cargo', 'Unidade', 'Data Admissão', 'Cód. Vendedor', 'Líder Direto', 'Vinculado'];
const rows = filteredEmployees.map(e => [
  e.cpf || '',
  e.registration_number || '',
  e.full_name,
  e.email || '',
  e.phone || '',
  e.department || '',
  e.position || '',
  e.unidade || '',
  e.hire_date ? format(new Date(e.hire_date), 'dd/MM/yyyy') : '',
  e.cod_vendedor || '',
  e.lider_direto?.full_name || '',
  e.linked_profile_id ? 'Sim' : 'Não'
]);
```

### Tabela - Remover Badge de Condutor

Na célula do Nome, remover o bloco que exibe o badge de condutor (linhas 494-507).

### Tabela - Remover Coluna Status

Remover o header "Status" e a célula correspondente que exibe o badge Ativo/Inativo.

