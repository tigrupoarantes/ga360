-- ============================================================================
-- GA 360 - DADOS INICIAIS (SEED)
-- Execute após todos os outros scripts de migração
-- ============================================================================

-- ============================================================================
-- 1. CONFIGURAÇÃO DE EMAIL
-- ============================================================================

INSERT INTO public.system_settings (key, value, description)
VALUES (
  'email_config',
  '{"enabled": true, "from_name": "GA 360", "from_email": "noreply@ga360.com", "reply_to": "", "notifications": {"meeting_created": true, "meeting_reminder": true, "task_assigned": true, "invite_sent": true}}'::jsonb,
  'Configurações de envio de e-mail'
)
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- 2. BADGES DE GAMIFICAÇÃO
-- ============================================================================

INSERT INTO public.badges (name, description, icon, color, category, condition_type, condition_value) VALUES
  ('Primeiro Passo', 'Complete sua primeira tarefa', 'footprints', 'primary', 'tasks', 'tasks_completed', 1),
  ('Produtivo', 'Complete 10 tarefas', 'zap', 'warning', 'tasks', 'tasks_completed', 10),
  ('Máquina de Tarefas', 'Complete 50 tarefas', 'rocket', 'success', 'tasks', 'tasks_completed', 50),
  ('Pontual', 'Participe de 5 reuniões', 'clock', 'info', 'meetings', 'meetings_attended', 5),
  ('Sempre Presente', 'Participe de 25 reuniões', 'users', 'primary', 'meetings', 'meetings_attended', 25),
  ('Organizador', 'Crie 5 reuniões', 'calendar-plus', 'accent', 'meetings', 'meetings_created', 5),
  ('Focado', 'Mantenha uma streak de 7 dias', 'flame', 'destructive', 'engagement', 'streak_days', 7),
  ('Dedicado', 'Mantenha uma streak de 30 dias', 'fire', 'warning', 'engagement', 'streak_days', 30),
  ('Meta Atingida', 'Alcance 100% em uma meta', 'target', 'success', 'goals', 'goals_achieved', 1),
  ('Campeão de Metas', 'Alcance 100% em 5 metas', 'trophy', 'warning', 'goals', 'goals_achieved', 5),
  ('Nível 5', 'Alcance o nível 5', 'star', 'primary', 'levels', 'level_reached', 5),
  ('Nível 10', 'Alcance o nível 10', 'crown', 'warning', 'levels', 'level_reached', 10),
  ('Colaborador do Mês', 'Seja o top 1 do ranking mensal', 'medal', 'warning', 'ranking', 'monthly_top', 1)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 3. ÁREAS DE GOVERNANÇA EC
-- ============================================================================

INSERT INTO public.ec_areas (name, slug, description, icon, "order") VALUES
  ('Governança', 'governanca', 'Gestão de governança corporativa', 'shield', 1),
  ('Financeiro', 'financeiro', 'Controles financeiros e contábeis', 'dollar-sign', 2),
  ('Pessoas & Cultura', 'pessoas-cultura', 'Gestão de pessoas e cultura organizacional', 'users', 3),
  ('Jurídico', 'juridico', 'Assuntos jurídicos e compliance', 'scale', 4),
  ('Auditoria', 'auditoria', 'Auditoria interna e controles', 'file-search', 5)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 4. COMENTÁRIOS NAS COLUNAS (DOCUMENTAÇÃO)
-- ============================================================================

COMMENT ON COLUMN public.profiles.phone IS 'Telefone em formato internacional: +5511999999999';
COMMENT ON COLUMN public.meetings.recurrence_type IS 'Values: none, daily, weekly, monthly';
COMMENT ON COLUMN public.meetings.recurrence_end_date IS 'End date for recurring meeting generation';
COMMENT ON COLUMN public.meetings.parent_meeting_id IS 'Reference to original meeting in recurring series';
COMMENT ON COLUMN public.meetings.recurrence_index IS 'Index in recurring series (0 = original)';
COMMENT ON COLUMN public.meeting_participants.confirmation_status IS 'Values: pending, confirmed, declined';
COMMENT ON COLUMN public.meeting_participants.confirmation_token IS 'Unique token for confirmation link';
COMMENT ON TABLE public.user_companies IS 'Granular company access permissions for users';
COMMENT ON COLUMN public.areas.cost_center IS 'Código do centro de custo conforme ERP';

-- ============================================================================
-- FIM DOS DADOS INICIAIS
-- ============================================================================
