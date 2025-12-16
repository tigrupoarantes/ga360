-- Add platform column to meeting_rooms table
ALTER TABLE public.meeting_rooms 
ADD COLUMN platform text DEFAULT 'teams' CHECK (platform IN ('teams', 'zoom', 'google_meet'));

-- Update existing rooms to have teams platform
UPDATE public.meeting_rooms SET platform = 'teams' WHERE platform IS NULL;