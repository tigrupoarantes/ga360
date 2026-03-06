-- Security fix: meeting_reminders and meeting_agendas had permissive USING(true) policies
-- allowing any authenticated user to create/read/edit/delete records of other users

-- meeting_reminders: restrict to owner
DROP POLICY IF EXISTS "System can manage meeting reminders" ON public.meeting_reminders;
CREATE POLICY "Users manage own meeting reminders"
  ON public.meeting_reminders FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- meeting_agendas: restrict to owner (created_by field) or meeting participants
-- Using created_by for now; adjust if a meeting_participants relationship exists
DROP POLICY IF EXISTS "Authenticated users can view meeting agendas" ON public.meeting_agendas;
DROP POLICY IF EXISTS "Authenticated users can create meeting agendas" ON public.meeting_agendas;
DROP POLICY IF EXISTS "Authenticated users can update meeting agendas" ON public.meeting_agendas;
DROP POLICY IF EXISTS "Authenticated users can delete meeting agendas" ON public.meeting_agendas;

CREATE POLICY "Users view own meeting agendas"
  ON public.meeting_agendas FOR SELECT
  USING (created_by = auth.uid());

CREATE POLICY "Users create meeting agendas"
  ON public.meeting_agendas FOR INSERT
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users update own meeting agendas"
  ON public.meeting_agendas FOR UPDATE
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users delete own meeting agendas"
  ON public.meeting_agendas FOR DELETE
  USING (created_by = auth.uid());
