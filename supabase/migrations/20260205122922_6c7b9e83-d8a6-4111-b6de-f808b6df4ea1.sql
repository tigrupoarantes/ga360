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