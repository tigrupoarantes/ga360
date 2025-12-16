-- Create OKR objectives table with cascading support
CREATE TABLE public.okr_objectives (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id),
  area_id UUID REFERENCES public.areas(id),
  owner_id UUID REFERENCES auth.users(id),
  parent_id UUID REFERENCES public.okr_objectives(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'completed', 'cancelled')),
  progress NUMERIC DEFAULT 0,
  level TEXT NOT NULL DEFAULT 'company' CHECK (level IN ('company', 'area', 'team', 'individual')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create Key Results table
CREATE TABLE public.okr_key_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  objective_id UUID NOT NULL REFERENCES public.okr_objectives(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  target_value NUMERIC NOT NULL,
  current_value NUMERIC DEFAULT 0,
  start_value NUMERIC DEFAULT 0,
  unit TEXT DEFAULT '%',
  weight NUMERIC DEFAULT 1 CHECK (weight >= 0 AND weight <= 1),
  status TEXT NOT NULL DEFAULT 'on_track' CHECK (status IN ('on_track', 'at_risk', 'behind', 'completed')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create Key Result updates/check-ins table
CREATE TABLE public.okr_key_result_updates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key_result_id UUID NOT NULL REFERENCES public.okr_key_results(id) ON DELETE CASCADE,
  previous_value NUMERIC NOT NULL,
  new_value NUMERIC NOT NULL,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.okr_objectives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.okr_key_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.okr_key_result_updates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for objectives
CREATE POLICY "Authenticated users can view objectives"
ON public.okr_objectives FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "CEO and Directors can manage objectives"
ON public.okr_objectives FOR ALL
USING (has_role(auth.uid(), 'ceo'::app_role) OR has_role(auth.uid(), 'diretor'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Managers can create objectives"
ON public.okr_objectives FOR INSERT
WITH CHECK (has_role(auth.uid(), 'gerente'::app_role) OR has_role(auth.uid(), 'ceo'::app_role) OR has_role(auth.uid(), 'diretor'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Owners can update their objectives"
ON public.okr_objectives FOR UPDATE
USING (owner_id = auth.uid() OR has_role(auth.uid(), 'ceo'::app_role) OR has_role(auth.uid(), 'diretor'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- RLS Policies for key results
CREATE POLICY "Authenticated users can view key results"
ON public.okr_key_results FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "CEO and Directors can manage key results"
ON public.okr_key_results FOR ALL
USING (has_role(auth.uid(), 'ceo'::app_role) OR has_role(auth.uid(), 'diretor'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Managers can create key results"
ON public.okr_key_results FOR INSERT
WITH CHECK (has_role(auth.uid(), 'gerente'::app_role) OR has_role(auth.uid(), 'ceo'::app_role) OR has_role(auth.uid(), 'diretor'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Users can update key results they own"
ON public.okr_key_results FOR UPDATE
USING (auth.uid() IS NOT NULL);

-- RLS Policies for updates
CREATE POLICY "Authenticated users can view updates"
ON public.okr_key_result_updates FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create updates"
ON public.okr_key_result_updates FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Function to calculate objective progress based on key results
CREATE OR REPLACE FUNCTION public.calculate_objective_progress()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_objective_id UUID;
  v_total_progress NUMERIC;
  v_total_weight NUMERIC;
BEGIN
  v_objective_id := COALESCE(NEW.objective_id, OLD.objective_id);
  
  -- Calculate weighted average progress
  SELECT 
    COALESCE(SUM(
      CASE 
        WHEN target_value > start_value THEN 
          LEAST(100, ((current_value - start_value) / NULLIF(target_value - start_value, 0)) * 100 * weight)
        ELSE 0
      END
    ), 0),
    COALESCE(SUM(weight), 1)
  INTO v_total_progress, v_total_weight
  FROM public.okr_key_results
  WHERE objective_id = v_objective_id;
  
  -- Update objective progress
  UPDATE public.okr_objectives
  SET progress = ROUND(v_total_progress / NULLIF(v_total_weight, 0), 1),
      updated_at = now()
  WHERE id = v_objective_id;
  
  RETURN NEW;
END;
$$;

-- Trigger to update objective progress when key result changes
CREATE TRIGGER update_objective_progress
AFTER INSERT OR UPDATE OR DELETE ON public.okr_key_results
FOR EACH ROW
EXECUTE FUNCTION public.calculate_objective_progress();

-- Trigger for gamification points when KR is completed
CREATE OR REPLACE FUNCTION public.trigger_points_on_kr_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Award points when KR reaches 100%
  IF NEW.current_value >= NEW.target_value AND (OLD.current_value IS NULL OR OLD.current_value < OLD.target_value) THEN
    IF NEW.created_by IS NOT NULL THEN
      PERFORM add_user_points(
        NEW.created_by,
        25,
        'kr_completed',
        'Key Result concluído: ' || NEW.title,
        NEW.id,
        'okr_key_result'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER gamification_on_kr_complete
AFTER UPDATE ON public.okr_key_results
FOR EACH ROW
EXECUTE FUNCTION public.trigger_points_on_kr_update();

-- Updated_at triggers
CREATE TRIGGER update_okr_objectives_updated_at
BEFORE UPDATE ON public.okr_objectives
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_okr_key_results_updated_at
BEFORE UPDATE ON public.okr_key_results
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();