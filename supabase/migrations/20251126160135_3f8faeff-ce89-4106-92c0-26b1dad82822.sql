-- Add area_id column to meeting_rooms table
ALTER TABLE public.meeting_rooms 
ADD COLUMN area_id uuid REFERENCES public.areas(id) ON DELETE SET NULL;

-- Add index for better query performance
CREATE INDEX idx_meeting_rooms_area_id ON public.meeting_rooms(area_id);