-- Add policy for hosts to view all signals in their external meetings
-- This ensures the host can see guest-joined signals even though from_user is 'guest-xxx'

CREATE POLICY "Hosts view signals in their external meetings" 
ON public.meeting_signals
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM meetings m
    WHERE m.id = meeting_signals.meeting_id
      AND m.created_by = auth.uid()
      AND m.meeting_type = 'external'
  )
);