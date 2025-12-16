-- Create gamification tables

-- User points table
CREATE TABLE public.user_points (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  points INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 1,
  streak_days INTEGER NOT NULL DEFAULT 0,
  last_activity_date DATE,
  total_points_earned INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id)
);

-- Badge definitions
CREATE TABLE public.badges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT NOT NULL DEFAULT 'award',
  color TEXT NOT NULL DEFAULT 'primary',
  category TEXT NOT NULL DEFAULT 'general',
  points_required INTEGER,
  condition_type TEXT NOT NULL,
  condition_value INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- User badges (earned achievements)
CREATE TABLE public.user_badges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  badge_id UUID NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
  earned_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, badge_id)
);

-- Points history/transactions
CREATE TABLE public.points_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  points INTEGER NOT NULL,
  action_type TEXT NOT NULL,
  description TEXT,
  reference_id UUID,
  reference_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.points_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_points
CREATE POLICY "Users can view all points" ON public.user_points
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "System can manage points" ON public.user_points
  FOR ALL USING (auth.uid() IS NOT NULL);

-- RLS Policies for badges
CREATE POLICY "Anyone can view badges" ON public.badges
  FOR SELECT USING (true);

CREATE POLICY "Super admin can manage badges" ON public.badges
  FOR ALL USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'ceo'::app_role));

-- RLS Policies for user_badges
CREATE POLICY "Users can view all earned badges" ON public.user_badges
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "System can award badges" ON public.user_badges
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- RLS Policies for points_history
CREATE POLICY "Users can view own history" ON public.points_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "CEO can view all history" ON public.points_history
  FOR SELECT USING (has_role(auth.uid(), 'ceo'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "System can add history" ON public.points_history
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Insert default badges
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
  ('Colaborador do Mês', 'Seja o top 1 do ranking mensal', 'medal', 'warning', 'ranking', 'monthly_top', 1);

-- Function to calculate level from points
CREATE OR REPLACE FUNCTION public.calculate_level(total_points INTEGER)
RETURNS INTEGER AS $$
BEGIN
  -- Level formula: level = floor(sqrt(points / 100)) + 1
  -- Level 1: 0-99 points, Level 2: 100-399, Level 3: 400-899, etc.
  RETURN GREATEST(1, FLOOR(SQRT(total_points / 100.0)) + 1);
END;
$$ LANGUAGE plpgsql;

-- Function to add points
CREATE OR REPLACE FUNCTION public.add_user_points(
  p_user_id UUID,
  p_points INTEGER,
  p_action_type TEXT,
  p_description TEXT DEFAULT NULL,
  p_reference_id UUID DEFAULT NULL,
  p_reference_type TEXT DEFAULT NULL
)
RETURNS void AS $$
DECLARE
  v_new_total INTEGER;
  v_new_level INTEGER;
  v_today DATE := CURRENT_DATE;
  v_last_activity DATE;
  v_current_streak INTEGER;
BEGIN
  -- Get current streak info
  SELECT last_activity_date, streak_days INTO v_last_activity, v_current_streak
  FROM public.user_points WHERE user_id = p_user_id;

  -- Calculate new streak
  IF v_last_activity IS NULL THEN
    v_current_streak := 1;
  ELSIF v_last_activity = v_today - INTERVAL '1 day' THEN
    v_current_streak := COALESCE(v_current_streak, 0) + 1;
  ELSIF v_last_activity < v_today - INTERVAL '1 day' THEN
    v_current_streak := 1;
  END IF;

  -- Insert or update user points
  INSERT INTO public.user_points (user_id, points, total_points_earned, last_activity_date, streak_days)
  VALUES (p_user_id, p_points, p_points, v_today, v_current_streak)
  ON CONFLICT (user_id) DO UPDATE SET
    points = user_points.points + p_points,
    total_points_earned = user_points.total_points_earned + p_points,
    last_activity_date = v_today,
    streak_days = v_current_streak,
    level = calculate_level(user_points.total_points_earned + p_points),
    updated_at = now();

  -- Record in history
  INSERT INTO public.points_history (user_id, points, action_type, description, reference_id, reference_type)
  VALUES (p_user_id, p_points, p_action_type, p_description, p_reference_id, p_reference_type);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;