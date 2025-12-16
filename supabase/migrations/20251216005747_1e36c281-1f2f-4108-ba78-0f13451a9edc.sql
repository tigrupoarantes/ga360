
-- Trigger function for task completion
CREATE OR REPLACE FUNCTION public.trigger_points_on_task_complete()
RETURNS TRIGGER AS $$
BEGIN
  -- Only award points when status changes to 'completed'
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    -- Award points to the assignee
    IF NEW.assignee_id IS NOT NULL THEN
      PERFORM add_user_points(
        NEW.assignee_id,
        15,
        'task_completed',
        'Tarefa concluída: ' || NEW.title,
        NEW.id,
        'meeting_task'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger for task completion
DROP TRIGGER IF EXISTS on_task_complete ON public.meeting_tasks;
CREATE TRIGGER on_task_complete
  AFTER UPDATE ON public.meeting_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_points_on_task_complete();

-- Trigger function for meeting creation
CREATE OR REPLACE FUNCTION public.trigger_points_on_meeting_create()
RETURNS TRIGGER AS $$
BEGIN
  -- Award points to meeting creator
  IF NEW.created_by IS NOT NULL THEN
    PERFORM add_user_points(
      NEW.created_by,
      10,
      'meeting_created',
      'Reunião criada: ' || NEW.title,
      NEW.id,
      'meeting'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger for meeting creation
DROP TRIGGER IF EXISTS on_meeting_create ON public.meetings;
CREATE TRIGGER on_meeting_create
  AFTER INSERT ON public.meetings
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_points_on_meeting_create();

-- Trigger function for meeting attendance
CREATE OR REPLACE FUNCTION public.trigger_points_on_meeting_attend()
RETURNS TRIGGER AS $$
BEGIN
  -- Award points when user confirms attendance
  IF NEW.attended = true AND (OLD.attended IS NULL OR OLD.attended = false) THEN
    PERFORM add_user_points(
      NEW.user_id,
      5,
      'meeting_attended',
      'Presença confirmada em reunião',
      NEW.meeting_id,
      'meeting_participant'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger for meeting attendance
DROP TRIGGER IF EXISTS on_meeting_attend ON public.meeting_participants;
CREATE TRIGGER on_meeting_attend
  AFTER UPDATE ON public.meeting_participants
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_points_on_meeting_attend();

-- Trigger function for goal achievement
CREATE OR REPLACE FUNCTION public.trigger_points_on_goal_achieved()
RETURNS TRIGGER AS $$
BEGIN
  -- Award points when goal is achieved (current_value >= target_value)
  IF NEW.current_value >= NEW.target_value AND 
     (OLD.current_value IS NULL OR OLD.current_value < OLD.target_value) THEN
    -- Award to responsible user
    IF NEW.responsible_id IS NOT NULL THEN
      PERFORM add_user_points(
        NEW.responsible_id,
        50,
        'goal_achieved',
        'Meta alcançada: ' || NEW.name,
        NEW.id,
        'goal'
      );
    END IF;
    -- Also award to creator if different
    IF NEW.created_by IS NOT NULL AND NEW.created_by != NEW.responsible_id THEN
      PERFORM add_user_points(
        NEW.created_by,
        20,
        'goal_achieved_team',
        'Meta da equipe alcançada: ' || NEW.name,
        NEW.id,
        'goal'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger for goal achievement
DROP TRIGGER IF EXISTS on_goal_achieved ON public.goals;
CREATE TRIGGER on_goal_achieved
  AFTER UPDATE ON public.goals
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_points_on_goal_achieved();

-- Trigger function for goal entry creation
CREATE OR REPLACE FUNCTION public.trigger_points_on_goal_entry()
RETURNS TRIGGER AS $$
BEGIN
  -- Award points for registering goal progress
  IF NEW.created_by IS NOT NULL THEN
    PERFORM add_user_points(
      NEW.created_by,
      5,
      'goal_entry',
      'Progresso de meta registrado',
      NEW.id,
      'goal_entry'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger for goal entry
DROP TRIGGER IF EXISTS on_goal_entry ON public.goal_entries;
CREATE TRIGGER on_goal_entry
  AFTER INSERT ON public.goal_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_points_on_goal_entry();

-- Trigger function for ATA approval
CREATE OR REPLACE FUNCTION public.trigger_points_on_ata_approved()
RETURNS TRIGGER AS $$
BEGIN
  -- Award points when ATA is approved
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    IF NEW.approved_by IS NOT NULL THEN
      PERFORM add_user_points(
        NEW.approved_by,
        20,
        'ata_approved',
        'ATA aprovada',
        NEW.id,
        'meeting_ata'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger for ATA approval
DROP TRIGGER IF EXISTS on_ata_approved ON public.meeting_atas;
CREATE TRIGGER on_ata_approved
  AFTER UPDATE ON public.meeting_atas
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_points_on_ata_approved();
