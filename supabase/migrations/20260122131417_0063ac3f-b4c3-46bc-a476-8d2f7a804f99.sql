-- Create table for EC Card Tasks
CREATE TABLE public.ec_card_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES public.ec_cards(id) ON DELETE CASCADE,
  record_id UUID REFERENCES public.ec_card_records(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  assignee_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  due_date DATE,
  priority TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'pending',
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_ec_card_tasks_card_id ON public.ec_card_tasks(card_id);
CREATE INDEX idx_ec_card_tasks_assignee_id ON public.ec_card_tasks(assignee_id);
CREATE INDEX idx_ec_card_tasks_status ON public.ec_card_tasks(status);

-- Enable RLS
ALTER TABLE public.ec_card_tasks ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can view ec_card_tasks"
  ON public.ec_card_tasks FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create ec_card_tasks"
  ON public.ec_card_tasks FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update ec_card_tasks"
  ON public.ec_card_tasks FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete ec_card_tasks"
  ON public.ec_card_tasks FOR DELETE
  USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR
    has_role(auth.uid(), 'ceo'::app_role) OR
    created_by = auth.uid()
  );

-- Trigger to update updated_at
CREATE TRIGGER update_ec_card_tasks_updated_at
  BEFORE UPDATE ON public.ec_card_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();