

## Plano: Remover Aba de Configuração de Sincronização

Este plano remove a aba "Configuração" da seção de Funcionários Externos, mantendo a visualização da lista e a funcionalidade de converter funcionários em usuários.

---

## Resumo da Mudança

A sincronização de funcionários agora é gerenciada exclusivamente pelo app "Gestão de Ativos", portanto a documentação de configuração no GA360 não é mais necessária e pode confundir os usuários.

**O que será removido:**
- Aba "Configuração" com documentação de endpoint/scripts
- Componente `EmployeeSyncDocs.tsx`

**O que será mantido:**
- Lista de funcionários externos sincronizados
- Botão "Criar Usuários" para conversão em massa
- Filtros, busca, exportação CSV
- Estatísticas de funcionários

---

## Arquitetura Atual vs. Nova

```text
ANTES (2 abas):
┌─────────────────────────────────────────────┐
│ Funcionários Externos                       │
├─────────────────────────────────────────────┤
│ [Funcionários] [Configuração]               │
├─────────────────────────────────────────────┤
│ • Lista de funcionários                     │
│ • Documentação de API (será removida)       │
└─────────────────────────────────────────────┘

DEPOIS (sem abas):
┌─────────────────────────────────────────────┐
│ Funcionários Externos                       │
├─────────────────────────────────────────────┤
│ • Lista de funcionários                     │
│ • Filtros e estatísticas                    │
│ • Botão "Criar Usuários"                    │
└─────────────────────────────────────────────┘
```

---

## Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| `src/pages/AdminEmployees.tsx` | Simplificar removendo Tabs |
| `src/components/employees/EmployeeSyncDocs.tsx` | Deletar arquivo |

---

## Parte 1: Simplificar AdminEmployees.tsx

Remover a estrutura de Tabs e renderizar diretamente o componente `ExternalEmployeesList`:

```tsx
import { MainLayout } from "@/components/layout/MainLayout";
import { BackButton } from "@/components/ui/back-button";
import { ExternalEmployeesList } from "@/components/employees/ExternalEmployeesList";

export default function AdminEmployees() {
  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4 animate-fade-in">
          <BackButton />
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Funcionários Externos
            </h1>
            <p className="text-muted-foreground mt-1">
              Funcionários sincronizados do sistema Gestão de Ativos
            </p>
          </div>
        </div>

        <ExternalEmployeesList />
      </div>
    </MainLayout>
  );
}
```

**Remoções:**
- Import de `Tabs`, `TabsContent`, `TabsList`, `TabsTrigger`
- Import de `EmployeeSyncDocs`
- Import de ícones `Users`, `Settings`
- Toda estrutura de Tabs

---

## Parte 2: Deletar EmployeeSyncDocs.tsx

O arquivo `src/components/employees/EmployeeSyncDocs.tsx` será completamente removido, pois:

1. A documentação de endpoint API não é mais necessária no GA360
2. Os scripts PowerShell e SQL são gerenciados pelo time de TI no Gestão de Ativos
3. Remover elimina confusão sobre onde configurar a sincronização

---

## Funcionalidades Mantidas

| Funcionalidade | Status |
|----------------|--------|
| Visualizar lista de funcionários | Mantida |
| Filtrar por empresa, departamento, unidade | Mantida |
| Buscar por nome, CPF, email, cód. vendedor | Mantida |
| Exportar CSV | Mantida |
| Revincular funcionários (link_all_external_employees) | Mantida |
| Converter em usuários (create-users-from-employees) | Mantida |
| Estatísticas (total, ativos, condutores, etc.) | Mantida |

---

## Edge Functions

Nenhuma Edge Function será removida. As seguintes funções continuam ativas:

- `sync-employees` - Recebe dados do Gestão de Ativos
- `sync-companies` - Sincroniza empresas
- `create-users-from-employees` - Converte funcionários em usuários

---

## Seção Técnica

### Dependências Removidas
- `@/components/employees/EmployeeSyncDocs` (import)
- `lucide-react/Users` e `lucide-react/Settings` (não mais usados)

### Componentes UI Removidos do AdminEmployees
- `Tabs`, `TabsContent`, `TabsList`, `TabsTrigger` de `@radix-ui/react-tabs`

### Verificações
- Nenhuma outra parte do código importa `EmployeeSyncDocs`
- O componente `ExternalEmployeesList` é independente

