

## Plano: Queries SQL para Migração de Dados Completa

Este documento contém todas as queries necessárias para exportar dados do projeto Lovable Cloud antigo e importar no Supabase externo.

---

## Ordem de Execução (Respeitando Foreign Keys)

A migração deve seguir esta ordem para evitar erros de referência:

```text
NÍVEL 1 (Base - sem dependências)
├── companies
├── badges
├── ec_areas
└── system_settings

NÍVEL 2 (Dependem do Nível 1)
├── areas
├── profiles*
├── distributors
├── goal_types
├── meeting_rooms
├── trade_industries
└── dl_connections

NÍVEL 3 (Dependem do Nível 2)
├── external_employees
├── user_roles*
├── user_permissions
├── user_companies
├── trade_materials
├── dl_queries
├── ec_cards
├── processes
├── okr_objectives
├── goals
└── meetings

NÍVEL 4 (Dependem do Nível 3)
├── meeting_participants
├── meeting_agendas
├── meeting_transcriptions
├── meeting_atas
├── goal_entries
├── okr_key_results
├── process_checklist_items
├── process_responsibles
├── dl_card_bindings
└── ec_card_records

NÍVEL 5 (Dependem do Nível 4)
├── meeting_tasks
├── meeting_reminders
├── okr_key_result_updates
├── process_executions
├── trade_inventory_movements
├── ec_record_evidences
├── ec_record_comments
├── ec_card_tasks
└── dl_query_runs

NÍVEL 6 (Final)
└── process_execution_items

* profiles e user_roles dependem de auth.users (não migráveis via SQL)
```

---

## Seção Técnica - Queries de Exportação

### Como Usar

1. Execute cada query abaixo no **SQL Editor do projeto ANTIGO** (Lovable Cloud)
2. Copie o resultado (texto das linhas retornadas)
3. Execute esse resultado no **SQL Editor do projeto NOVO** (Supabase externo)

---

### NÍVEL 1 - Tabelas Base

**1.1 Companies**
```sql
SELECT 'INSERT INTO public.companies (id, name, cnpj, is_active, logo_url, color, external_id, is_auditable, created_at, updated_at) VALUES (' ||
  quote_literal(id) || ', ' ||
  quote_literal(name) || ', ' ||
  COALESCE(quote_literal(cnpj), 'NULL') || ', ' ||
  is_active || ', ' ||
  COALESCE(quote_literal(logo_url), 'NULL') || ', ' ||
  COALESCE(quote_literal(color), 'NULL') || ', ' ||
  COALESCE(quote_literal(external_id), 'NULL') || ', ' ||
  COALESCE(is_auditable::text, 'NULL') || ', ' ||
  quote_literal(created_at) || ', ' ||
  quote_literal(updated_at) || ') ON CONFLICT (id) DO NOTHING;'
FROM public.companies;
```

**1.2 Badges**
```sql
SELECT 'INSERT INTO public.badges (id, name, description, icon, color, category, points_required, condition_type, condition_value, is_active, created_at) VALUES (' ||
  quote_literal(id) || ', ' ||
  quote_literal(name) || ', ' ||
  COALESCE(quote_literal(description), 'NULL') || ', ' ||
  quote_literal(icon) || ', ' ||
  quote_literal(color) || ', ' ||
  quote_literal(category) || ', ' ||
  COALESCE(points_required::text, 'NULL') || ', ' ||
  quote_literal(condition_type) || ', ' ||
  condition_value || ', ' ||
  COALESCE(is_active::text, 'true') || ', ' ||
  COALESCE(quote_literal(created_at), 'NOW()') || ') ON CONFLICT (id) DO NOTHING;'
FROM public.badges;
```

**1.3 EC Areas (Governança)**
```sql
SELECT 'INSERT INTO public.ec_areas (id, name, slug, description, icon, "order", is_active, created_at, updated_at) VALUES (' ||
  quote_literal(id) || ', ' ||
  quote_literal(name) || ', ' ||
  quote_literal(slug) || ', ' ||
  COALESCE(quote_literal(description), 'NULL') || ', ' ||
  COALESCE(quote_literal(icon), '''folder''') || ', ' ||
  "order" || ', ' ||
  is_active || ', ' ||
  quote_literal(created_at) || ', ' ||
  quote_literal(updated_at) || ') ON CONFLICT (id) DO NOTHING;'
FROM public.ec_areas;
```

**1.4 System Settings**
```sql
SELECT 'INSERT INTO public.system_settings (id, key, value, description, created_at, updated_at) VALUES (' ||
  quote_literal(id) || ', ' ||
  quote_literal(key) || ', ' ||
  quote_literal(value::text) || '::jsonb, ' ||
  COALESCE(quote_literal(description), 'NULL') || ', ' ||
  COALESCE(quote_literal(created_at), 'NOW()') || ', ' ||
  COALESCE(quote_literal(updated_at), 'NOW()') || ') ON CONFLICT (key) DO NOTHING;'
FROM public.system_settings;
```

---

### NÍVEL 2 - Dependências de Nível 1

**2.1 Areas**
```sql
SELECT 'INSERT INTO public.areas (id, name, parent_id, company_id, cost_center, created_at, updated_at) VALUES (' ||
  quote_literal(id) || ', ' ||
  quote_literal(name) || ', ' ||
  COALESCE(quote_literal(parent_id), 'NULL') || ', ' ||
  COALESCE(quote_literal(company_id), 'NULL') || ', ' ||
  COALESCE(quote_literal(cost_center), 'NULL') || ', ' ||
  COALESCE(quote_literal(created_at), 'NOW()') || ', ' ||
  COALESCE(quote_literal(updated_at), 'NOW()') || ') ON CONFLICT (id) DO NOTHING;'
FROM public.areas
WHERE parent_id IS NULL;

-- Depois execute para subáreas (com parent_id)
SELECT 'INSERT INTO public.areas (id, name, parent_id, company_id, cost_center, created_at, updated_at) VALUES (' ||
  quote_literal(id) || ', ' ||
  quote_literal(name) || ', ' ||
  quote_literal(parent_id) || ', ' ||
  COALESCE(quote_literal(company_id), 'NULL') || ', ' ||
  COALESCE(quote_literal(cost_center), 'NULL') || ', ' ||
  COALESCE(quote_literal(created_at), 'NOW()') || ', ' ||
  COALESCE(quote_literal(updated_at), 'NOW()') || ') ON CONFLICT (id) DO NOTHING;'
FROM public.areas
WHERE parent_id IS NOT NULL;
```

**2.2 Distributors**
```sql
SELECT 'INSERT INTO public.distributors (id, company_id, external_id, name, code, region, is_active, created_at, updated_at) VALUES (' ||
  quote_literal(id) || ', ' ||
  COALESCE(quote_literal(company_id), 'NULL') || ', ' ||
  quote_literal(external_id) || ', ' ||
  quote_literal(name) || ', ' ||
  COALESCE(quote_literal(code), 'NULL') || ', ' ||
  COALESCE(quote_literal(region), 'NULL') || ', ' ||
  COALESCE(is_active::text, 'true') || ', ' ||
  COALESCE(quote_literal(created_at), 'NOW()') || ', ' ||
  COALESCE(quote_literal(updated_at), 'NOW()') || ') ON CONFLICT (id) DO NOTHING;'
FROM public.distributors;
```

**2.3 Goal Types**
```sql
SELECT 'INSERT INTO public.goal_types (id, company_id, name, description, unit, calculation_type, is_active, created_by, created_at, updated_at) VALUES (' ||
  quote_literal(id) || ', ' ||
  COALESCE(quote_literal(company_id), 'NULL') || ', ' ||
  quote_literal(name) || ', ' ||
  COALESCE(quote_literal(description), 'NULL') || ', ' ||
  COALESCE(quote_literal(unit), 'NULL') || ', ' ||
  COALESCE(quote_literal(calculation_type), '''sum''') || ', ' ||
  COALESCE(is_active::text, 'true') || ', ' ||
  COALESCE(quote_literal(created_by), 'NULL') || ', ' ||
  COALESCE(quote_literal(created_at), 'NOW()') || ', ' ||
  COALESCE(quote_literal(updated_at), 'NOW()') || ') ON CONFLICT (id) DO NOTHING;'
FROM public.goal_types;
```

**2.4 Meeting Rooms**
```sql
SELECT 'INSERT INTO public.meeting_rooms (id, name, company, team, teams_link, description, platform, is_active, company_id, area_id, created_by, created_at, updated_at) VALUES (' ||
  quote_literal(id) || ', ' ||
  quote_literal(name) || ', ' ||
  quote_literal(company) || ', ' ||
  quote_literal(team) || ', ' ||
  quote_literal(teams_link) || ', ' ||
  COALESCE(quote_literal(description), 'NULL') || ', ' ||
  COALESCE(quote_literal(platform), '''teams''') || ', ' ||
  is_active || ', ' ||
  COALESCE(quote_literal(company_id), 'NULL') || ', ' ||
  COALESCE(quote_literal(area_id), 'NULL') || ', ' ||
  COALESCE(quote_literal(created_by), 'NULL') || ', ' ||
  quote_literal(created_at) || ', ' ||
  quote_literal(updated_at) || ') ON CONFLICT (id) DO NOTHING;'
FROM public.meeting_rooms;
```

**2.5 Trade Industries**
```sql
SELECT 'INSERT INTO public.trade_industries (id, name, cnpj, contact_name, contact_email, contact_phone, logo_url, is_active, company_id, created_by, created_at, updated_at) VALUES (' ||
  quote_literal(id) || ', ' ||
  quote_literal(name) || ', ' ||
  COALESCE(quote_literal(cnpj), 'NULL') || ', ' ||
  COALESCE(quote_literal(contact_name), 'NULL') || ', ' ||
  COALESCE(quote_literal(contact_email), 'NULL') || ', ' ||
  COALESCE(quote_literal(contact_phone), 'NULL') || ', ' ||
  COALESCE(quote_literal(logo_url), 'NULL') || ', ' ||
  COALESCE(is_active::text, 'true') || ', ' ||
  COALESCE(quote_literal(company_id), 'NULL') || ', ' ||
  COALESCE(quote_literal(created_by), 'NULL') || ', ' ||
  COALESCE(quote_literal(created_at), 'NOW()') || ', ' ||
  COALESCE(quote_literal(updated_at), 'NOW()') || ') ON CONFLICT (id) DO NOTHING;'
FROM public.trade_industries;
```

**2.6 DL Connections (Datalake)**
```sql
SELECT 'INSERT INTO public.dl_connections (id, name, type, base_url, auth_type, auth_config_json, headers_json, is_enabled, created_at, updated_at, created_by) VALUES (' ||
  quote_literal(id) || ', ' ||
  quote_literal(name) || ', ' ||
  quote_literal(type) || ', ' ||
  quote_literal(base_url) || ', ' ||
  COALESCE(quote_literal(auth_type), '''bearer''') || ', ' ||
  quote_literal(COALESCE(auth_config_json::text, '{}')) || '::jsonb, ' ||
  quote_literal(COALESCE(headers_json::text, '{}')) || '::jsonb, ' ||
  is_enabled || ', ' ||
  quote_literal(created_at) || ', ' ||
  quote_literal(updated_at) || ', ' ||
  COALESCE(quote_literal(created_by), 'NULL') || ') ON CONFLICT (id) DO NOTHING;'
FROM public.dl_connections;
```

---

### NÍVEL 3 - Dependências de Nível 2

**3.1 External Employees**
```sql
SELECT 'INSERT INTO public.external_employees (id, company_id, external_id, source_system, registration_number, full_name, email, phone, department, position, hire_date, is_active, cpf, unidade, is_condutor, cod_vendedor, lider_direto_id, linked_profile_id, metadata, synced_at, created_at, updated_at) VALUES (' ||
  quote_literal(id) || ', ' ||
  COALESCE(quote_literal(company_id), 'NULL') || ', ' ||
  quote_literal(external_id) || ', ' ||
  COALESCE(quote_literal(source_system), '''gestao_ativos''') || ', ' ||
  COALESCE(quote_literal(registration_number), 'NULL') || ', ' ||
  quote_literal(full_name) || ', ' ||
  COALESCE(quote_literal(email), 'NULL') || ', ' ||
  COALESCE(quote_literal(phone), 'NULL') || ', ' ||
  COALESCE(quote_literal(department), 'NULL') || ', ' ||
  COALESCE(quote_literal(position), 'NULL') || ', ' ||
  COALESCE(quote_literal(hire_date), 'NULL') || ', ' ||
  COALESCE(is_active::text, 'true') || ', ' ||
  COALESCE(quote_literal(cpf), 'NULL') || ', ' ||
  COALESCE(quote_literal(unidade), 'NULL') || ', ' ||
  COALESCE(is_condutor::text, 'false') || ', ' ||
  COALESCE(quote_literal(cod_vendedor), 'NULL') || ', ' ||
  'NULL, ' || -- lider_direto_id será atualizado depois
  'NULL, ' || -- linked_profile_id não existe no novo projeto
  quote_literal(COALESCE(metadata::text, '{}')) || '::jsonb, ' ||
  COALESCE(quote_literal(synced_at), 'NOW()') || ', ' ||
  COALESCE(quote_literal(created_at), 'NOW()') || ', ' ||
  COALESCE(quote_literal(updated_at), 'NOW()') || ') ON CONFLICT (id) DO NOTHING;'
FROM public.external_employees
WHERE lider_direto_id IS NULL;

-- Depois atualize os líderes diretos
SELECT 'UPDATE public.external_employees SET lider_direto_id = ' || quote_literal(lider_direto_id) || ' WHERE id = ' || quote_literal(id) || ';'
FROM public.external_employees
WHERE lider_direto_id IS NOT NULL;
```

**3.2 Trade Materials**
```sql
SELECT 'INSERT INTO public.trade_materials (id, name, description, category, industry_id, unit, image_url, is_active, created_at, updated_at) VALUES (' ||
  quote_literal(id) || ', ' ||
  quote_literal(name) || ', ' ||
  COALESCE(quote_literal(description), 'NULL') || ', ' ||
  quote_literal(category) || ', ' ||
  COALESCE(quote_literal(industry_id), 'NULL') || ', ' ||
  COALESCE(quote_literal(unit), '''unidade''') || ', ' ||
  COALESCE(quote_literal(image_url), 'NULL') || ', ' ||
  COALESCE(is_active::text, 'true') || ', ' ||
  COALESCE(quote_literal(created_at), 'NOW()') || ', ' ||
  COALESCE(quote_literal(updated_at), 'NOW()') || ') ON CONFLICT (id) DO NOTHING;'
FROM public.trade_materials;
```

**3.3 DL Queries**
```sql
SELECT 'INSERT INTO public.dl_queries (id, connection_id, name, description, endpoint_path, method, params_schema_json, body_template_json, outputs_schema_json, is_enabled, created_at, updated_at) VALUES (' ||
  quote_literal(id) || ', ' ||
  quote_literal(connection_id) || ', ' ||
  quote_literal(name) || ', ' ||
  COALESCE(quote_literal(description), 'NULL') || ', ' ||
  quote_literal(endpoint_path) || ', ' ||
  quote_literal(method) || ', ' ||
  quote_literal(COALESCE(params_schema_json::text, '[]')) || '::jsonb, ' ||
  quote_literal(COALESCE(body_template_json::text, '{}')) || '::jsonb, ' ||
  quote_literal(COALESCE(outputs_schema_json::text, '[]')) || '::jsonb, ' ||
  is_enabled || ', ' ||
  quote_literal(created_at) || ', ' ||
  quote_literal(updated_at) || ') ON CONFLICT (id) DO NOTHING;'
FROM public.dl_queries;
```

**3.4 EC Cards (Governança)**
```sql
SELECT 'INSERT INTO public.ec_cards (id, area_id, title, description, periodicity_type, due_rule_json, responsible_id, backup_id, scope_json, checklist_template_json, required_evidences_json, manual_fields_schema_json, risk_days_threshold, "order", is_active, created_at, updated_at) VALUES (' ||
  quote_literal(id) || ', ' ||
  quote_literal(area_id) || ', ' ||
  quote_literal(title) || ', ' ||
  COALESCE(quote_literal(description), 'NULL') || ', ' ||
  quote_literal(periodicity_type) || ', ' ||
  quote_literal(COALESCE(due_rule_json::text, '{}')) || '::jsonb, ' ||
  COALESCE(quote_literal(responsible_id), 'NULL') || ', ' ||
  COALESCE(quote_literal(backup_id), 'NULL') || ', ' ||
  quote_literal(COALESCE(scope_json::text, '{}')) || '::jsonb, ' ||
  quote_literal(COALESCE(checklist_template_json::text, '[]')) || '::jsonb, ' ||
  quote_literal(COALESCE(required_evidences_json::text, '[]')) || '::jsonb, ' ||
  quote_literal(COALESCE(manual_fields_schema_json::text, '[]')) || '::jsonb, ' ||
  COALESCE(risk_days_threshold::text, '3') || ', ' ||
  "order" || ', ' ||
  is_active || ', ' ||
  quote_literal(created_at) || ', ' ||
  quote_literal(updated_at) || ') ON CONFLICT (id) DO NOTHING;'
FROM public.ec_cards;
```

**3.5 Processes**
```sql
SELECT 'INSERT INTO public.processes (id, company_id, area_id, name, description, frequency, is_active, created_by, created_at, updated_at) VALUES (' ||
  quote_literal(id) || ', ' ||
  COALESCE(quote_literal(company_id), 'NULL') || ', ' ||
  COALESCE(quote_literal(area_id), 'NULL') || ', ' ||
  quote_literal(name) || ', ' ||
  COALESCE(quote_literal(description), 'NULL') || ', ' ||
  quote_literal(frequency) || ', ' ||
  is_active || ', ' ||
  COALESCE(quote_literal(created_by), 'NULL') || ', ' ||
  quote_literal(created_at) || ', ' ||
  quote_literal(updated_at) || ') ON CONFLICT (id) DO NOTHING;'
FROM public.processes;
```

**3.6 OKR Objectives**
```sql
SELECT 'INSERT INTO public.okr_objectives (id, company_id, area_id, owner_id, parent_id, title, description, start_date, end_date, status, progress, level, created_by, created_at, updated_at) VALUES (' ||
  quote_literal(id) || ', ' ||
  COALESCE(quote_literal(company_id), 'NULL') || ', ' ||
  COALESCE(quote_literal(area_id), 'NULL') || ', ' ||
  COALESCE(quote_literal(owner_id), 'NULL') || ', ' ||
  COALESCE(quote_literal(parent_id), 'NULL') || ', ' ||
  quote_literal(title) || ', ' ||
  COALESCE(quote_literal(description), 'NULL') || ', ' ||
  quote_literal(start_date) || ', ' ||
  quote_literal(end_date) || ', ' ||
  quote_literal(status) || ', ' ||
  COALESCE(progress::text, '0') || ', ' ||
  quote_literal(level) || ', ' ||
  COALESCE(quote_literal(created_by), 'NULL') || ', ' ||
  COALESCE(quote_literal(created_at), 'NOW()') || ', ' ||
  COALESCE(quote_literal(updated_at), 'NOW()') || ') ON CONFLICT (id) DO NOTHING;'
FROM public.okr_objectives
WHERE parent_id IS NULL;

-- Depois os objetivos filhos
SELECT 'INSERT INTO public.okr_objectives (id, company_id, area_id, owner_id, parent_id, title, description, start_date, end_date, status, progress, level, created_by, created_at, updated_at) VALUES (' ||
  quote_literal(id) || ', ' ||
  COALESCE(quote_literal(company_id), 'NULL') || ', ' ||
  COALESCE(quote_literal(area_id), 'NULL') || ', ' ||
  COALESCE(quote_literal(owner_id), 'NULL') || ', ' ||
  quote_literal(parent_id) || ', ' ||
  quote_literal(title) || ', ' ||
  COALESCE(quote_literal(description), 'NULL') || ', ' ||
  quote_literal(start_date) || ', ' ||
  quote_literal(end_date) || ', ' ||
  quote_literal(status) || ', ' ||
  COALESCE(progress::text, '0') || ', ' ||
  quote_literal(level) || ', ' ||
  COALESCE(quote_literal(created_by), 'NULL') || ', ' ||
  COALESCE(quote_literal(created_at), 'NOW()') || ', ' ||
  COALESCE(quote_literal(updated_at), 'NOW()') || ') ON CONFLICT (id) DO NOTHING;'
FROM public.okr_objectives
WHERE parent_id IS NOT NULL;
```

**3.7 Goals**
```sql
SELECT 'INSERT INTO public.goals (id, company_id, goal_type_id, distributor_id, name, target_value, current_value, start_date, end_date, period_type, metric_type, product_filter, auto_calculate, last_calculated_at, area_id, responsible_id, status, notes, created_by, created_at, updated_at) VALUES (' ||
  quote_literal(id) || ', ' ||
  COALESCE(quote_literal(company_id), 'NULL') || ', ' ||
  COALESCE(quote_literal(goal_type_id), 'NULL') || ', ' ||
  COALESCE(quote_literal(distributor_id), 'NULL') || ', ' ||
  quote_literal(name) || ', ' ||
  target_value || ', ' ||
  COALESCE(current_value::text, '0') || ', ' ||
  quote_literal(start_date) || ', ' ||
  quote_literal(end_date) || ', ' ||
  COALESCE(quote_literal(period_type), '''monthly''') || ', ' ||
  COALESCE(quote_literal(metric_type), '''value''') || ', ' ||
  COALESCE(quote_literal(product_filter), 'NULL') || ', ' ||
  COALESCE(auto_calculate::text, 'false') || ', ' ||
  COALESCE(quote_literal(last_calculated_at), 'NULL') || ', ' ||
  COALESCE(quote_literal(area_id), 'NULL') || ', ' ||
  COALESCE(quote_literal(responsible_id), 'NULL') || ', ' ||
  COALESCE(quote_literal(status), '''active''') || ', ' ||
  COALESCE(quote_literal(notes), 'NULL') || ', ' ||
  COALESCE(quote_literal(created_by), 'NULL') || ', ' ||
  COALESCE(quote_literal(created_at), 'NOW()') || ', ' ||
  COALESCE(quote_literal(updated_at), 'NOW()') || ') ON CONFLICT (id) DO NOTHING;'
FROM public.goals;
```

**3.8 Meetings**
```sql
SELECT 'INSERT INTO public.meetings (id, title, description, type, area_id, meeting_room_id, scheduled_at, duration_minutes, status, ai_mode, recurrence_type, recurrence_end_date, parent_meeting_id, recurrence_index, created_by, created_at, updated_at) VALUES (' ||
  quote_literal(id) || ', ' ||
  quote_literal(title) || ', ' ||
  COALESCE(quote_literal(description), 'NULL') || ', ' ||
  quote_literal(type) || ', ' ||
  COALESCE(quote_literal(area_id), 'NULL') || ', ' ||
  COALESCE(quote_literal(meeting_room_id), 'NULL') || ', ' ||
  quote_literal(scheduled_at) || ', ' ||
  duration_minutes || ', ' ||
  quote_literal(status) || ', ' ||
  quote_literal(ai_mode) || ', ' ||
  COALESCE(quote_literal(recurrence_type), '''none''') || ', ' ||
  COALESCE(quote_literal(recurrence_end_date), 'NULL') || ', ' ||
  COALESCE(quote_literal(parent_meeting_id), 'NULL') || ', ' ||
  COALESCE(recurrence_index::text, '0') || ', ' ||
  COALESCE(quote_literal(created_by), 'NULL') || ', ' ||
  quote_literal(created_at) || ', ' ||
  quote_literal(updated_at) || ') ON CONFLICT (id) DO NOTHING;'
FROM public.meetings
WHERE parent_meeting_id IS NULL;

-- Reuniões recorrentes (com parent)
SELECT 'INSERT INTO public.meetings (id, title, description, type, area_id, meeting_room_id, scheduled_at, duration_minutes, status, ai_mode, recurrence_type, recurrence_end_date, parent_meeting_id, recurrence_index, created_by, created_at, updated_at) VALUES (' ||
  quote_literal(id) || ', ' ||
  quote_literal(title) || ', ' ||
  COALESCE(quote_literal(description), 'NULL') || ', ' ||
  quote_literal(type) || ', ' ||
  COALESCE(quote_literal(area_id), 'NULL') || ', ' ||
  COALESCE(quote_literal(meeting_room_id), 'NULL') || ', ' ||
  quote_literal(scheduled_at) || ', ' ||
  duration_minutes || ', ' ||
  quote_literal(status) || ', ' ||
  quote_literal(ai_mode) || ', ' ||
  COALESCE(quote_literal(recurrence_type), '''none''') || ', ' ||
  COALESCE(quote_literal(recurrence_end_date), 'NULL') || ' , ' ||
  quote_literal(parent_meeting_id) || ', ' ||
  COALESCE(recurrence_index::text, '0') || ', ' ||
  COALESCE(quote_literal(created_by), 'NULL') || ', ' ||
  quote_literal(created_at) || ', ' ||
  quote_literal(updated_at) || ') ON CONFLICT (id) DO NOTHING;'
FROM public.meetings
WHERE parent_meeting_id IS NOT NULL;
```

---

### NÍVEL 4 - Dependências de Nível 3

**4.1 OKR Key Results**
```sql
SELECT 'INSERT INTO public.okr_key_results (id, objective_id, title, description, target_value, current_value, start_value, unit, weight, status, created_by, created_at, updated_at) VALUES (' ||
  quote_literal(id) || ', ' ||
  quote_literal(objective_id) || ', ' ||
  quote_literal(title) || ', ' ||
  COALESCE(quote_literal(description), 'NULL') || ', ' ||
  target_value || ', ' ||
  COALESCE(current_value::text, '0') || ', ' ||
  COALESCE(start_value::text, '0') || ', ' ||
  COALESCE(quote_literal(unit), '''%''') || ', ' ||
  COALESCE(weight::text, '1') || ', ' ||
  quote_literal(status) || ', ' ||
  COALESCE(quote_literal(created_by), 'NULL') || ', ' ||
  COALESCE(quote_literal(created_at), 'NOW()') || ', ' ||
  COALESCE(quote_literal(updated_at), 'NOW()') || ') ON CONFLICT (id) DO NOTHING;'
FROM public.okr_key_results;
```

**4.2 Goal Entries**
```sql
SELECT 'INSERT INTO public.goal_entries (id, goal_id, entry_date, value, notes, created_by, created_at) VALUES (' ||
  quote_literal(id) || ', ' ||
  quote_literal(goal_id) || ', ' ||
  quote_literal(entry_date) || ', ' ||
  value || ', ' ||
  COALESCE(quote_literal(notes), 'NULL') || ', ' ||
  COALESCE(quote_literal(created_by), 'NULL') || ', ' ||
  COALESCE(quote_literal(created_at), 'NOW()') || ') ON CONFLICT (id) DO NOTHING;'
FROM public.goal_entries;
```

**4.3 Process Checklist Items**
```sql
SELECT 'INSERT INTO public.process_checklist_items (id, process_id, text, is_required, order_index, created_at) VALUES (' ||
  quote_literal(id) || ', ' ||
  quote_literal(process_id) || ', ' ||
  quote_literal(text) || ', ' ||
  is_required || ', ' ||
  order_index || ', ' ||
  quote_literal(created_at) || ') ON CONFLICT (id) DO NOTHING;'
FROM public.process_checklist_items;
```

**4.4 Process Responsibles**
```sql
SELECT 'INSERT INTO public.process_responsibles (id, process_id, user_id, created_at) VALUES (' ||
  quote_literal(id) || ', ' ||
  quote_literal(process_id) || ', ' ||
  quote_literal(user_id) || ', ' ||
  quote_literal(created_at) || ') ON CONFLICT (id) DO NOTHING;'
FROM public.process_responsibles;
```

**4.5 EC Card Records**
```sql
SELECT 'INSERT INTO public.ec_card_records (id, card_id, competence, due_date, status, manual_payload_json, datalake_snapshot_json, checklist_json, completed_at, completed_by, reviewed_at, reviewed_by, created_at, updated_at) VALUES (' ||
  quote_literal(id) || ', ' ||
  quote_literal(card_id) || ', ' ||
  quote_literal(competence) || ', ' ||
  COALESCE(quote_literal(due_date), 'NULL') || ', ' ||
  quote_literal(status) || ', ' ||
  quote_literal(COALESCE(manual_payload_json::text, '{}')) || '::jsonb, ' ||
  quote_literal(COALESCE(datalake_snapshot_json::text, '{}')) || '::jsonb, ' ||
  quote_literal(COALESCE(checklist_json::text, '[]')) || '::jsonb, ' ||
  COALESCE(quote_literal(completed_at), 'NULL') || ', ' ||
  COALESCE(quote_literal(completed_by), 'NULL') || ', ' ||
  COALESCE(quote_literal(reviewed_at), 'NULL') || ', ' ||
  COALESCE(quote_literal(reviewed_by), 'NULL') || ', ' ||
  quote_literal(created_at) || ', ' ||
  quote_literal(updated_at) || ') ON CONFLICT (card_id, competence) DO NOTHING;'
FROM public.ec_card_records;
```

**4.6 DL Card Bindings**
```sql
SELECT 'INSERT INTO public.dl_card_bindings (id, card_id, query_id, refresh_policy, cache_ttl_minutes, mapping_json, params_mapping_json, is_enabled, created_at, updated_at) VALUES (' ||
  quote_literal(id) || ', ' ||
  quote_literal(card_id) || ', ' ||
  quote_literal(query_id) || ', ' ||
  quote_literal(refresh_policy) || ', ' ||
  COALESCE(cache_ttl_minutes::text, 'NULL') || ', ' ||
  quote_literal(COALESCE(mapping_json::text, '{}')) || '::jsonb, ' ||
  quote_literal(COALESCE(params_mapping_json::text, '{}')) || '::jsonb, ' ||
  is_enabled || ', ' ||
  quote_literal(created_at) || ', ' ||
  quote_literal(updated_at) || ') ON CONFLICT (id) DO NOTHING;'
FROM public.dl_card_bindings;
```

---

### NÍVEL 5 - Dependências Finais

**5.1 OKR Key Result Updates**
```sql
SELECT 'INSERT INTO public.okr_key_result_updates (id, key_result_id, previous_value, new_value, notes, created_by, created_at) VALUES (' ||
  quote_literal(id) || ', ' ||
  quote_literal(key_result_id) || ', ' ||
  previous_value || ', ' ||
  new_value || ', ' ||
  COALESCE(quote_literal(notes), 'NULL') || ', ' ||
  COALESCE(quote_literal(created_by), 'NULL') || ', ' ||
  COALESCE(quote_literal(created_at), 'NOW()') || ') ON CONFLICT (id) DO NOTHING;'
FROM public.okr_key_result_updates;
```

**5.2 Process Executions**
```sql
SELECT 'INSERT INTO public.process_executions (id, process_id, executed_by, started_at, completed_at, status, notes, created_at) VALUES (' ||
  quote_literal(id) || ', ' ||
  quote_literal(process_id) || ', ' ||
  COALESCE(quote_literal(executed_by), 'NULL') || ', ' ||
  quote_literal(started_at) || ', ' ||
  COALESCE(quote_literal(completed_at), 'NULL') || ', ' ||
  quote_literal(status) || ', ' ||
  COALESCE(quote_literal(notes), 'NULL') || ', ' ||
  quote_literal(created_at) || ') ON CONFLICT (id) DO NOTHING;'
FROM public.process_executions;
```

**5.3 Trade Inventory Movements**
```sql
SELECT 'INSERT INTO public.trade_inventory_movements (id, material_id, movement_type, quantity, unit_cost, reference_number, notes, client_name, movement_date, received_by, company_id, created_by, created_at) VALUES (' ||
  quote_literal(id) || ', ' ||
  quote_literal(material_id) || ', ' ||
  quote_literal(movement_type) || ', ' ||
  quantity || ', ' ||
  COALESCE(unit_cost::text, 'NULL') || ', ' ||
  COALESCE(quote_literal(reference_number), 'NULL') || ', ' ||
  COALESCE(quote_literal(notes), 'NULL') || ', ' ||
  COALESCE(quote_literal(client_name), 'NULL') || ', ' ||
  quote_literal(movement_date) || ', ' ||
  COALESCE(quote_literal(received_by), 'NULL') || ', ' ||
  COALESCE(quote_literal(company_id), 'NULL') || ', ' ||
  COALESCE(quote_literal(created_by), 'NULL') || ', ' ||
  COALESCE(quote_literal(created_at), 'NOW()') || ') ON CONFLICT (id) DO NOTHING;'
FROM public.trade_inventory_movements;
```

**5.4 EC Record Evidences**
```sql
SELECT 'INSERT INTO public.ec_record_evidences (id, record_id, type, file_path, url, description, created_at, created_by) VALUES (' ||
  quote_literal(id) || ', ' ||
  quote_literal(record_id) || ', ' ||
  quote_literal(type) || ', ' ||
  COALESCE(quote_literal(file_path), 'NULL') || ', ' ||
  COALESCE(quote_literal(url), 'NULL') || ', ' ||
  COALESCE(quote_literal(description), 'NULL') || ', ' ||
  quote_literal(created_at) || ', ' ||
  COALESCE(quote_literal(created_by), 'NULL') || ') ON CONFLICT (id) DO NOTHING;'
FROM public.ec_record_evidences;
```

**5.5 EC Record Comments**
```sql
SELECT 'INSERT INTO public.ec_record_comments (id, record_id, text, created_at, created_by) VALUES (' ||
  quote_literal(id) || ', ' ||
  quote_literal(record_id) || ', ' ||
  quote_literal(text) || ', ' ||
  quote_literal(created_at) || ', ' ||
  COALESCE(quote_literal(created_by), 'NULL') || ') ON CONFLICT (id) DO NOTHING;'
FROM public.ec_record_comments;
```

**5.6 EC Card Tasks**
```sql
SELECT 'INSERT INTO public.ec_card_tasks (id, card_id, record_id, title, description, assignee_id, due_date, priority, status, created_by, created_at, updated_at) VALUES (' ||
  quote_literal(id) || ', ' ||
  quote_literal(card_id) || ', ' ||
  COALESCE(quote_literal(record_id), 'NULL') || ', ' ||
  quote_literal(title) || ', ' ||
  COALESCE(quote_literal(description), 'NULL') || ', ' ||
  COALESCE(quote_literal(assignee_id), 'NULL') || ', ' ||
  COALESCE(quote_literal(due_date), 'NULL') || ', ' ||
  quote_literal(priority) || ', ' ||
  quote_literal(status) || ', ' ||
  COALESCE(quote_literal(created_by), 'NULL') || ', ' ||
  quote_literal(created_at) || ', ' ||
  quote_literal(updated_at) || ') ON CONFLICT (id) DO NOTHING;'
FROM public.ec_card_tasks;
```

---

### NÍVEL 6 - Tabela Final

**6.1 Process Execution Items**
```sql
SELECT 'INSERT INTO public.process_execution_items (id, execution_id, checklist_item_id, is_completed, completed_at, completed_by) VALUES (' ||
  quote_literal(id) || ', ' ||
  quote_literal(execution_id) || ', ' ||
  quote_literal(checklist_item_id) || ', ' ||
  is_completed || ', ' ||
  COALESCE(quote_literal(completed_at), 'NULL') || ', ' ||
  COALESCE(quote_literal(completed_by), 'NULL') || ') ON CONFLICT (id) DO NOTHING;'
FROM public.process_execution_items;
```

---

## Notas Importantes

1. **Tabelas que dependem de `auth.users`**: 
   - `profiles`, `user_roles`, `user_permissions`, `user_companies` não podem ser migradas automaticamente
   - Os usuários precisam se cadastrar novamente no novo projeto
   - Depois você pode recriar suas roles e permissões manualmente

2. **Arquivos de Storage**: 
   - Os arquivos nos buckets (avatars, evidências) precisam ser migrados separadamente
   - Exporte via Dashboard do Supabase antigo e importe no novo

3. **Ordem de Execução**: 
   - Siga rigorosamente a ordem dos níveis para evitar erros de foreign key

4. **ON CONFLICT**: 
   - Todas as queries usam `ON CONFLICT DO NOTHING` para permitir re-execução segura

