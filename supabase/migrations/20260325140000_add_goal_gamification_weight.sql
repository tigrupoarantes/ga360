ALTER TABLE public.goals
  ADD COLUMN IF NOT EXISTS gamification_weight NUMERIC NOT NULL DEFAULT 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'goals_gamification_weight_positive'
      AND conrelid = 'public.goals'::regclass
  ) THEN
    ALTER TABLE public.goals
      ADD CONSTRAINT goals_gamification_weight_positive
      CHECK (gamification_weight > 0);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.trigger_points_on_goal_achieved()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_weight NUMERIC := COALESCE(NEW.gamification_weight, 1);
  v_responsible_points INTEGER := ROUND(50 * v_weight)::INTEGER;
  v_creator_points INTEGER := ROUND(20 * v_weight)::INTEGER;
  v_weight_label TEXT := trim(to_char(v_weight, 'FM999999990.##'));
BEGIN
  IF NEW.target_value IS NOT NULL
     AND NEW.current_value >= NEW.target_value
     AND (OLD.current_value IS NULL OR OLD.current_value < OLD.target_value) THEN
    IF NEW.responsible_id IS NOT NULL THEN
      PERFORM public.add_user_points(
        NEW.responsible_id,
        v_responsible_points,
        'goal_achieved',
        'Meta alcançada: ' || NEW.title || ' - Peso ' || v_weight_label,
        NEW.id,
        'goal'
      );
    END IF;

    IF NEW.created_by IS NOT NULL AND NEW.created_by != NEW.responsible_id THEN
      PERFORM public.add_user_points(
        NEW.created_by,
        v_creator_points,
        'goal_achieved_team',
        'Meta da equipe alcançada: ' || NEW.title || ' - Peso ' || v_weight_label,
        NEW.id,
        'goal'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_goal_achieved ON public.goals;
CREATE TRIGGER on_goal_achieved
  AFTER UPDATE ON public.goals
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_points_on_goal_achieved();
