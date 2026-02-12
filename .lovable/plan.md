

# QLP - Quadro de Lotacao de Pessoal (Drill-Down)

## Resumo
Criar uma pagina dedicada com visualizacao drill-down dos dados de `external_employees` do Supabase externo, acessivel ao clicar no card QLP dentro de Pessoas e Cultura.

## Niveis de navegacao

```text
Nivel 0: Visao Geral
  KPIs: Total Geral | Empresas | Departamentos | Cargos unicos
  Cards clicaveis por empresa com quantidade de funcionarios

Nivel 1: Empresa selecionada
  KPIs: Total da empresa | Departamentos | Cargos
  Cards por departamento com quantidade

Nivel 2: Departamento selecionado
  Lista de funcionarios: Nome, Cargo, Email, Unidade
```

Breadcrumb de navegacao em todos os niveis (ex: Total > Chok Distribuidora > Financeiro).

## O que sera feito

### 1. Novo componente: `src/components/governanca-ec/QLPDrillDown.tsx`
- Estado interno: `drillLevel` (0, 1, 2), `selectedCompany`, `selectedDepartment`
- Query na tabela `external_employees` com join em `companies` (ambos do Supabase externo via `supabaseExternal`)
- Filtro fixo: `is_active = true`
- Agrupamento feito no frontend (por `company_id`/`companies.name` e `department`)
- KPIs no topo atualizados conforme o nivel
- Cards clicaveis com contagem e seta indicando navegacao
- Nivel 2 exibe tabela com nome, cargo, email, unidade
- Breadcrumb usando componente `Breadcrumb` ja existente

### 2. Nova rota em `src/App.tsx`
- `/governanca-ec/pessoas-cultura/qlp` apontando para uma pagina wrapper com `MainLayout`, `BackButton` e `QLPDrillDown`

### 3. Redirecionamento no `src/components/governanca-ec/ECCard.tsx`
- Detectar card QLP pelo titulo (contendo "QLP" ou "Quadro de Lotacao" ou "Quadro de Lotação")
- Redirecionar para `/governanca-ec/pessoas-cultura/qlp` ao clicar, igual ao padrao do card de Auditoria de Estoque

### Fonte de dados
- Tabela `external_employees` do Supabase externo (`src/integrations/supabase/external-client.ts`)
- Join com `companies` para nome da empresa
- Nenhuma alteracao de banco necessaria

### Arquivos modificados
- **Criar**: `src/components/governanca-ec/QLPDrillDown.tsx`
- **Criar**: `src/pages/QLPPage.tsx` (wrapper com MainLayout)
- **Editar**: `src/App.tsx` (nova rota)
- **Editar**: `src/components/governanca-ec/ECCard.tsx` (redirecionamento do card QLP)

