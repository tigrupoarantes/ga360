-- Add confirmation fields to meeting_participants
ALTER TABLE meeting_participants
ADD COLUMN confirmation_status text DEFAULT 'pending',
ADD COLUMN confirmation_token uuid DEFAULT gen_random_uuid(),
ADD COLUMN confirmed_at timestamp with time zone,
ADD COLUMN confirmation_reminder_sent_at timestamp with time zone;

-- Add comment for clarity
COMMENT ON COLUMN meeting_participants.confirmation_status IS 'Values: pending, confirmed, declined';
COMMENT ON COLUMN meeting_participants.confirmation_token IS 'Unique token for confirmation link';

-- Create index for token lookups
CREATE INDEX idx_meeting_participants_confirmation_token ON meeting_participants(confirmation_token);