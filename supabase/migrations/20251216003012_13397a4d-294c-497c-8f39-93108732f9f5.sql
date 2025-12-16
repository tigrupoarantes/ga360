-- Create meeting_agendas table for storing meeting agenda items
CREATE TABLE public.meeting_agendas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.meeting_agendas ENABLE ROW LEVEL SECURITY;

-- Create policies for meeting_agendas
CREATE POLICY "Authenticated users can view meeting agendas" 
ON public.meeting_agendas 
FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can create meeting agendas" 
ON public.meeting_agendas 
FOR INSERT 
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update meeting agendas" 
ON public.meeting_agendas 
FOR UPDATE 
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete meeting agendas" 
ON public.meeting_agendas 
FOR DELETE 
TO authenticated
USING (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_meeting_agendas_updated_at
BEFORE UPDATE ON public.meeting_agendas
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add description column to meetings table if not exists
ALTER TABLE public.meetings 
ADD COLUMN IF NOT EXISTS description TEXT;