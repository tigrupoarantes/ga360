-- Add description column to meeting_rooms table
ALTER TABLE public.meeting_rooms
ADD COLUMN description TEXT;