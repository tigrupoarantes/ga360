
# Plano de Remoção: Portal de Metas e Performance Comercial do GA360

## Resumo Executivo

Este plano remove completamente a funcionalidade de **Gestão de Metas e Performance Comercial** do GA360, preparando o aplicativo para focar exclusivamente na gestão do Grupo Arantes.

### O que será removido:
- 14 arquivos de componentes (9 goals + 5 sales)
- 1 página (Goals.tsx)
- 1 componente de analytics (GoalsAnalytics.tsx)
- 3 Edge Functions
- Referências no Dashboard, Analytics e Sidebar
- 7 tabelas do banco de dados

---

## Fase 1: Remoção das Edge Functions

### Pastas a deletar:
```text
supabase/functions/recalculate-goals/
supabase/functions/sync-sales/
supabase/functions/sync-sellers/
```

---

## Fase 2: Remoção de Componentes e Páginas

### Pastas completas a deletar:
- `src/components/goals/` (9 arquivos)
- `src/components/sales/` (5 arquivos)

### Arquivos individuais a deletar:
- `src/pages/Goals.tsx`
- `src/components/analytics/GoalsAnalytics.tsx`

---

## Fase 3: Atualização de Arquivos Existentes

### 3.1 src/App.tsx
**Remover:**
- Import da página Goals (linha 18)
- Rota `/metas` (linhas 125-131)

### 3.2 src/components/layout/Sidebar.tsx
**Remover:**
- Item de navegação "Portal de Metas" (linha 52)
- Import do ícone `Target` (linha 13)

### 3.3 src/pages/Dashboard.tsx
**Modificações:**
- Remover estados `goalsAchieved` e `goalsTotal` do DashboardStats
- Remover fetch da tabela `goals` (linhas 100-114)
- Remover card "Metas Atingidas" (linhas 198-205)
- Remover cálculo `goalCompletionRate` e referências no MCI Radar
- Remover import do ícone `Target`

### 3.4 src/pages/Analytics.tsx
**Modificações:**
- Remover import `GoalsAnalytics` (linha 7)
- Remover import do ícone `Target` (linha 10)
- Alterar grid de 5 para 4 colunas nas tabs
- Remover aba "Metas" (linhas 63-66)
- Remover `GoalsAnalytics` do overview (linhas 88-94)
- Remover TabsContent de goals (linhas 120-126)

---

## Fase 4: Limpeza do Banco de Dados (Lovable Cloud)

Executar migration SQL para remover tabelas e triggers:

```sql
-- Remover triggers de gamificação
DROP TRIGGER IF EXISTS on_goal_achieved ON public.goals;
DROP TRIGGER IF EXISTS on_goal_entry ON public.goal_entries;
DROP FUNCTION IF EXISTS public.trigger_points_on_goal_achieved();
DROP FUNCTION IF EXISTS public.trigger_points_on_goal_entry();

-- Remover tabelas (ordem de dependências)
DROP TABLE IF EXISTS public.goal_entries CASCADE;
DROP TABLE IF EXISTS public.goals CASCADE;
DROP TABLE IF EXISTS public.goal_types CASCADE;
DROP TABLE IF EXISTS public.distributors CASCADE;
DROP TABLE IF EXISTS public.csv_import_templates CASCADE;
DROP TABLE IF EXISTS public.sales_daily CASCADE;
DROP TABLE IF EXISTS public.sales_sellers CASCADE;

NOTIFY pgrst, 'reload schema';
```

---

## Ordem de Execução

1. Deletar pastas das Edge Functions
2. Deletar pastas de componentes (goals + sales)
3. Deletar arquivos individuais (Goals.tsx, GoalsAnalytics.tsx)
4. Atualizar App.tsx (remover rota e import)
5. Atualizar Sidebar.tsx (remover menu e import)
6. Atualizar Dashboard.tsx (remover stats de metas e card)
7. Atualizar Analytics.tsx (remover aba e componente de metas)
8. Executar migration SQL para limpar tabelas

---

## Resultado Esperado

Após a implementação:
- Menu lateral não terá mais "Portal de Metas"
- Dashboard mostrará apenas KPIs de reuniões e tarefas
- Analytics terá 4 abas: Visão Geral, Reuniões, Tarefas, Participação
- Banco de dados estará limpo das tabelas de metas/vendas
- GA360 focará em: Reuniões, Processos, Tarefas, Trade Marketing, Governança EC, Gamificação e Relatórios
