-- Drop existing overly permissive policy
DROP POLICY IF EXISTS "Authenticated users can view transcriptions" ON public.meeting_transcriptions;

-- Create restrictive policy: only participants and CEO/super_admin can view transcriptions
CREATE POLICY "Only participants and admins can view transcriptions"
ON public.meeting_transcriptions
FOR SELECT
USING (
  -- CEO and super_admin can view all transcriptions
  has_role(auth.uid(), 'ceo'::app_role) 
  OR has_role(auth.uid(), 'super_admin'::app_role)
  OR
  -- User is a participant of the meeting
  EXISTS (
    SELECT 1 
    FROM meeting_participants 
    WHERE meeting_participants.meeting_id = meeting_transcriptions.meeting_id 
    AND meeting_participants.user_id = auth.uid()
  )
);

-- Keep the system management policy for internal operations
-- (already exists: "System can manage transcriptions")