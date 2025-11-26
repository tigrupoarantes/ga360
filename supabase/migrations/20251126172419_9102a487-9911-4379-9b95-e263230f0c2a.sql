-- Add recurrence fields to meetings table
ALTER TABLE meetings 
ADD COLUMN recurrence_type text DEFAULT 'none',
ADD COLUMN recurrence_end_date date,
ADD COLUMN parent_meeting_id uuid REFERENCES meetings(id) ON DELETE CASCADE,
ADD COLUMN recurrence_index integer DEFAULT 0;

-- Add comment for clarity
COMMENT ON COLUMN meetings.recurrence_type IS 'Values: none, daily, weekly, monthly';
COMMENT ON COLUMN meetings.recurrence_end_date IS 'End date for recurring meeting generation';
COMMENT ON COLUMN meetings.parent_meeting_id IS 'Reference to original meeting in recurring series';
COMMENT ON COLUMN meetings.recurrence_index IS 'Index in recurring series (0 = original)';