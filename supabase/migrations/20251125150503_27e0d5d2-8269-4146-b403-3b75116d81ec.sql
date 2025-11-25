-- Create table to track sent meeting reminders
CREATE TABLE public.meeting_reminders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  reminder_type TEXT NOT NULL CHECK (reminder_type IN ('1_day', '1_hour')),
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(meeting_id, reminder_type)
);

-- Enable RLS
ALTER TABLE public.meeting_reminders ENABLE ROW LEVEL SECURITY;

-- Create policy for system access
CREATE POLICY "System can manage reminders"
ON public.meeting_reminders
FOR ALL
USING (true);

-- Create index for performance
CREATE INDEX idx_meeting_reminders_meeting_id ON public.meeting_reminders(meeting_id);
CREATE INDEX idx_meeting_reminders_sent_at ON public.meeting_reminders(sent_at);