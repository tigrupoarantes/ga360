-- Create meeting_rooms table
CREATE TABLE public.meeting_rooms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  company TEXT NOT NULL,
  team TEXT NOT NULL,
  teams_link TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create meetings table
CREATE TABLE public.meetings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('Estratégica', 'Tática', 'Operacional', 'Trade')),
  area_id UUID REFERENCES public.areas(id),
  meeting_room_id UUID REFERENCES public.meeting_rooms(id),
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  status TEXT NOT NULL DEFAULT 'Agendada' CHECK (status IN ('Agendada', 'Em Andamento', 'Concluída', 'Cancelada')),
  ai_mode TEXT NOT NULL DEFAULT 'Opcional' CHECK (ai_mode IN ('Obrigatória', 'Opcional', 'Desativada')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create meeting_participants table
CREATE TABLE public.meeting_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  attended BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create meeting_transcriptions table
CREATE TABLE public.meeting_transcriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  content TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create meeting_atas table
CREATE TABLE public.meeting_atas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  summary TEXT,
  decisions JSONB,
  action_items JSONB,
  content TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'archived')),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create meeting_tasks table
CREATE TABLE public.meeting_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  ata_id UUID REFERENCES public.meeting_atas(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  assignee_id UUID REFERENCES auth.users(id),
  due_date DATE,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.meeting_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_transcriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_atas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_tasks ENABLE ROW LEVEL SECURITY;

-- RLS Policies for meeting_rooms
CREATE POLICY "Authenticated users can view meeting rooms"
  ON public.meeting_rooms FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "CEO can manage meeting rooms"
  ON public.meeting_rooms FOR ALL
  USING (has_role(auth.uid(), 'ceo'));

-- RLS Policies for meetings
CREATE POLICY "Authenticated users can view meetings"
  ON public.meetings FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "CEO and Directors can create meetings"
  ON public.meetings FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'ceo') OR has_role(auth.uid(), 'diretor'));

CREATE POLICY "CEO and Directors can update meetings"
  ON public.meetings FOR UPDATE
  USING (has_role(auth.uid(), 'ceo') OR has_role(auth.uid(), 'diretor'));

CREATE POLICY "CEO can delete meetings"
  ON public.meetings FOR DELETE
  USING (has_role(auth.uid(), 'ceo'));

-- RLS Policies for meeting_participants
CREATE POLICY "Authenticated users can view participants"
  ON public.meeting_participants FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Meeting creators can manage participants"
  ON public.meeting_participants FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.meetings 
      WHERE meetings.id = meeting_participants.meeting_id 
      AND (meetings.created_by = auth.uid() OR has_role(auth.uid(), 'ceo'))
    )
  );

-- RLS Policies for meeting_transcriptions
CREATE POLICY "Authenticated users can view transcriptions"
  ON public.meeting_transcriptions FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "System can manage transcriptions"
  ON public.meeting_transcriptions FOR ALL
  USING (auth.uid() IS NOT NULL);

-- RLS Policies for meeting_atas
CREATE POLICY "Authenticated users can view atas"
  ON public.meeting_atas FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Directors and CEO can manage atas"
  ON public.meeting_atas FOR ALL
  USING (has_role(auth.uid(), 'ceo') OR has_role(auth.uid(), 'diretor'));

-- RLS Policies for meeting_tasks
CREATE POLICY "Authenticated users can view tasks"
  ON public.meeting_tasks FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their assigned tasks"
  ON public.meeting_tasks FOR UPDATE
  USING (assignee_id = auth.uid());

CREATE POLICY "Directors and CEO can manage tasks"
  ON public.meeting_tasks FOR ALL
  USING (has_role(auth.uid(), 'ceo') OR has_role(auth.uid(), 'diretor'));

-- Create indexes for better performance
CREATE INDEX idx_meetings_scheduled_at ON public.meetings(scheduled_at);
CREATE INDEX idx_meetings_status ON public.meetings(status);
CREATE INDEX idx_meeting_participants_meeting_id ON public.meeting_participants(meeting_id);
CREATE INDEX idx_meeting_participants_user_id ON public.meeting_participants(user_id);
CREATE INDEX idx_meeting_transcriptions_meeting_id ON public.meeting_transcriptions(meeting_id);
CREATE INDEX idx_meeting_atas_meeting_id ON public.meeting_atas(meeting_id);
CREATE INDEX idx_meeting_tasks_meeting_id ON public.meeting_tasks(meeting_id);
CREATE INDEX idx_meeting_tasks_assignee_id ON public.meeting_tasks(assignee_id);

-- Create updated_at trigger function if not exists
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
CREATE TRIGGER update_meeting_rooms_updated_at
  BEFORE UPDATE ON public.meeting_rooms
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_meetings_updated_at
  BEFORE UPDATE ON public.meetings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_meeting_transcriptions_updated_at
  BEFORE UPDATE ON public.meeting_transcriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_meeting_atas_updated_at
  BEFORE UPDATE ON public.meeting_atas
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_meeting_tasks_updated_at
  BEFORE UPDATE ON public.meeting_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();