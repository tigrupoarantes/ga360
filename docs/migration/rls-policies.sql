-- ============================================================================
-- GA 360 - POLÍTICAS RLS COMPLETAS
-- Execute após o schema-completo.sql
-- ============================================================================

-- ============================================================================
-- 1. POLÍTICAS PARA COMPANIES
-- ============================================================================

CREATE POLICY "Authenticated users can view companies" 
ON public.companies FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Only CEO can insert companies" 
ON public.companies FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'ceo'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Only CEO can update companies" 
ON public.companies FOR UPDATE 
USING (has_role(auth.uid(), 'ceo'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Only CEO can delete companies" 
ON public.companies FOR DELETE 
USING (has_role(auth.uid(), 'ceo'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- ============================================================================
-- 2. POLÍTICAS PARA AREAS
-- ============================================================================

CREATE POLICY "Authenticated users can view areas" 
ON public.areas FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Only CEO can insert areas" 
ON public.areas FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'ceo'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Only CEO can update areas" 
ON public.areas FOR UPDATE 
USING (has_role(auth.uid(), 'ceo'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Only CEO can delete areas" 
ON public.areas FOR DELETE 
USING (has_role(auth.uid(), 'ceo'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- ============================================================================
-- 3. POLÍTICAS PARA PROFILES
-- ============================================================================

CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = id);

CREATE POLICY "CEO can view all profiles"
ON public.profiles FOR SELECT
USING (has_role(auth.uid(), 'ceo'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "CEO can update all profiles"
ON public.profiles FOR UPDATE
USING (has_role(auth.uid(), 'ceo'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- ============================================================================
-- 4. POLÍTICAS PARA USER_ROLES
-- ============================================================================

CREATE POLICY "Users can view own roles"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Only CEO can insert roles"
ON public.user_roles FOR INSERT
WITH CHECK (has_role(auth.uid(), 'ceo'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Only CEO can update roles"
ON public.user_roles FOR UPDATE
USING (has_role(auth.uid(), 'ceo'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Only CEO can delete roles"
ON public.user_roles FOR DELETE
USING (has_role(auth.uid(), 'ceo'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "CEO can view all roles"
ON public.user_roles FOR SELECT
USING (has_role(auth.uid(), 'ceo'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- ============================================================================
-- 5. POLÍTICAS PARA USER_PERMISSIONS
-- ============================================================================

CREATE POLICY "Super admin can view all permissions"
ON public.user_permissions FOR SELECT
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admin can manage all permissions"
ON public.user_permissions FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Users can view own permissions"
ON public.user_permissions FOR SELECT
USING (auth.uid() = user_id);

-- ============================================================================
-- 6. POLÍTICAS PARA USER_COMPANIES
-- ============================================================================

CREATE POLICY "Super admin and CEO can manage user_companies"
ON public.user_companies FOR ALL
USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'ceo'));

CREATE POLICY "Users can view their own company permissions"
ON public.user_companies FOR SELECT
USING (auth.uid() = user_id);

-- ============================================================================
-- 7. POLÍTICAS PARA SYSTEM_SETTINGS
-- ============================================================================

CREATE POLICY "Super admin and CEO can view settings"
ON public.system_settings FOR SELECT
USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'ceo'::app_role));

CREATE POLICY "Super admin and CEO can manage settings"
ON public.system_settings FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'ceo'::app_role));

-- ============================================================================
-- 8. POLÍTICAS PARA MEETING_ROOMS
-- ============================================================================

CREATE POLICY "Authenticated users can view meeting rooms"
ON public.meeting_rooms FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "CEO can manage meeting rooms"
ON public.meeting_rooms FOR ALL
USING (has_role(auth.uid(), 'ceo'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- ============================================================================
-- 9. POLÍTICAS PARA MEETINGS
-- ============================================================================

CREATE POLICY "Authenticated users can view meetings"
ON public.meetings FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "CEO Directors and Super Admin can create meetings" 
ON public.meetings FOR INSERT 
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'ceo'::app_role) OR 
  has_role(auth.uid(), 'diretor'::app_role) OR 
  has_role(auth.uid(), 'super_admin'::app_role)
);

CREATE POLICY "CEO Directors and Super Admin can update meetings" 
ON public.meetings FOR UPDATE 
TO authenticated
USING (
  has_role(auth.uid(), 'ceo'::app_role) OR 
  has_role(auth.uid(), 'diretor'::app_role) OR 
  has_role(auth.uid(), 'super_admin'::app_role)
);

CREATE POLICY "CEO and Super Admin can delete meetings" 
ON public.meetings FOR DELETE 
TO authenticated
USING (
  has_role(auth.uid(), 'ceo'::app_role) OR 
  has_role(auth.uid(), 'super_admin'::app_role)
);

-- ============================================================================
-- 10. POLÍTICAS PARA MEETING_PARTICIPANTS
-- ============================================================================

CREATE POLICY "Authenticated users can view participants"
ON public.meeting_participants FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Meeting creators can manage participants"
ON public.meeting_participants FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.meetings 
    WHERE meetings.id = meeting_participants.meeting_id 
    AND (meetings.created_by = auth.uid() OR has_role(auth.uid(), 'ceo'))
  )
);

-- ============================================================================
-- 11. POLÍTICAS PARA MEETING_TRANSCRIPTIONS
-- ============================================================================

CREATE POLICY "Only participants and admins can view transcriptions"
ON public.meeting_transcriptions FOR SELECT
USING (
  has_role(auth.uid(), 'ceo'::app_role) 
  OR has_role(auth.uid(), 'super_admin'::app_role)
  OR EXISTS (
    SELECT 1 
    FROM meeting_participants 
    WHERE meeting_participants.meeting_id = meeting_transcriptions.meeting_id 
    AND meeting_participants.user_id = auth.uid()
  )
);

CREATE POLICY "System can manage transcriptions"
ON public.meeting_transcriptions FOR ALL
USING (auth.uid() IS NOT NULL);

-- ============================================================================
-- 12. POLÍTICAS PARA MEETING_ATAS
-- ============================================================================

CREATE POLICY "Authenticated users can view atas"
ON public.meeting_atas FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Directors and CEO can manage atas"
ON public.meeting_atas FOR ALL
USING (has_role(auth.uid(), 'ceo') OR has_role(auth.uid(), 'diretor'));

-- ============================================================================
-- 13. POLÍTICAS PARA MEETING_TASKS
-- ============================================================================

CREATE POLICY "Authenticated users can view tasks"
ON public.meeting_tasks FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their assigned tasks"
ON public.meeting_tasks FOR UPDATE
USING (assignee_id = auth.uid());

CREATE POLICY "Directors and CEO can manage tasks"
ON public.meeting_tasks FOR ALL
USING (has_role(auth.uid(), 'ceo') OR has_role(auth.uid(), 'diretor'));

-- ============================================================================
-- 14. POLÍTICAS PARA MEETING_REMINDERS
-- ============================================================================

CREATE POLICY "System can manage reminders"
ON public.meeting_reminders FOR ALL
USING (true);

-- ============================================================================
-- 15. POLÍTICAS PARA MEETING_AGENDAS
-- ============================================================================

CREATE POLICY "Authenticated users can view meeting agendas" 
ON public.meeting_agendas FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can create meeting agendas" 
ON public.meeting_agendas FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update meeting agendas" 
ON public.meeting_agendas FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete meeting agendas" 
ON public.meeting_agendas FOR DELETE TO authenticated USING (true);

-- ============================================================================
-- 16. POLÍTICAS PARA GOAL_TYPES
-- ============================================================================

CREATE POLICY "Authenticated users can view goal types"
ON public.goal_types FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "CEO and Directors can manage goal types"
ON public.goal_types FOR ALL
USING (has_role(auth.uid(), 'ceo') OR has_role(auth.uid(), 'diretor') OR has_role(auth.uid(), 'super_admin'));

-- ============================================================================
-- 17. POLÍTICAS PARA GOALS
-- ============================================================================

CREATE POLICY "Authenticated users can view goals"
ON public.goals FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "CEO and Directors can manage goals"
ON public.goals FOR ALL
USING (has_role(auth.uid(), 'ceo') OR has_role(auth.uid(), 'diretor') OR has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Managers can create goals"
ON public.goals FOR INSERT
WITH CHECK (has_role(auth.uid(), 'gerente') OR has_role(auth.uid(), 'ceo') OR has_role(auth.uid(), 'diretor') OR has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Managers can update goals"
ON public.goals FOR UPDATE
USING (has_role(auth.uid(), 'gerente') OR has_role(auth.uid(), 'ceo') OR has_role(auth.uid(), 'diretor') OR has_role(auth.uid(), 'super_admin'));

-- ============================================================================
-- 18. POLÍTICAS PARA GOAL_ENTRIES
-- ============================================================================

CREATE POLICY "Authenticated users can view goal entries"
ON public.goal_entries FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Managers and above can create entries"
ON public.goal_entries FOR INSERT
WITH CHECK (has_role(auth.uid(), 'gerente') OR has_role(auth.uid(), 'ceo') OR has_role(auth.uid(), 'diretor') OR has_role(auth.uid(), 'super_admin'));

CREATE POLICY "CEO and Directors can manage entries"
ON public.goal_entries FOR ALL
USING (has_role(auth.uid(), 'ceo') OR has_role(auth.uid(), 'diretor') OR has_role(auth.uid(), 'super_admin'));

-- ============================================================================
-- 19. POLÍTICAS PARA CSV_IMPORT_TEMPLATES
-- ============================================================================

CREATE POLICY "Authenticated users can view templates"
ON public.csv_import_templates FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "CEO and Directors can manage templates"
ON public.csv_import_templates FOR ALL
USING (has_role(auth.uid(), 'ceo') OR has_role(auth.uid(), 'diretor') OR has_role(auth.uid(), 'super_admin'));

-- ============================================================================
-- 20. POLÍTICAS PARA OKR_OBJECTIVES
-- ============================================================================

CREATE POLICY "Authenticated users can view objectives"
ON public.okr_objectives FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "CEO and Directors can manage objectives"
ON public.okr_objectives FOR ALL
USING (has_role(auth.uid(), 'ceo'::app_role) OR has_role(auth.uid(), 'diretor'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Managers can create objectives"
ON public.okr_objectives FOR INSERT
WITH CHECK (has_role(auth.uid(), 'gerente'::app_role) OR has_role(auth.uid(), 'ceo'::app_role) OR has_role(auth.uid(), 'diretor'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Owners can update their objectives"
ON public.okr_objectives FOR UPDATE
USING (owner_id = auth.uid() OR has_role(auth.uid(), 'ceo'::app_role) OR has_role(auth.uid(), 'diretor'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- ============================================================================
-- 21. POLÍTICAS PARA OKR_KEY_RESULTS
-- ============================================================================

CREATE POLICY "Authenticated users can view key results"
ON public.okr_key_results FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "CEO and Directors can manage key results"
ON public.okr_key_results FOR ALL
USING (has_role(auth.uid(), 'ceo'::app_role) OR has_role(auth.uid(), 'diretor'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Managers can create key results"
ON public.okr_key_results FOR INSERT
WITH CHECK (has_role(auth.uid(), 'gerente'::app_role) OR has_role(auth.uid(), 'ceo'::app_role) OR has_role(auth.uid(), 'diretor'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Users can update key results they own"
ON public.okr_key_results FOR UPDATE
USING (auth.uid() IS NOT NULL);

-- ============================================================================
-- 22. POLÍTICAS PARA OKR_KEY_RESULT_UPDATES
-- ============================================================================

CREATE POLICY "Authenticated users can view updates"
ON public.okr_key_result_updates FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create updates"
ON public.okr_key_result_updates FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================================================
-- 23. POLÍTICAS PARA PROCESSES
-- ============================================================================

CREATE POLICY "Users can view processes from their company"
ON public.processes FOR SELECT
USING (
  company_id IN (
    SELECT company_id FROM public.profiles WHERE id = auth.uid()
    UNION
    SELECT company_id FROM public.user_companies WHERE user_id = auth.uid() AND can_view = true
    UNION
    SELECT id FROM public.companies WHERE EXISTS (
      SELECT 1 FROM public.user_companies WHERE user_id = auth.uid() AND all_companies = true
    )
  )
);

CREATE POLICY "Users can create processes"
ON public.processes FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update processes they created or are responsible for"
ON public.processes FOR UPDATE
USING (
  created_by = auth.uid() OR
  EXISTS (SELECT 1 FROM public.process_responsibles WHERE process_id = id AND user_id = auth.uid())
);

CREATE POLICY "Users can delete processes they created"
ON public.processes FOR DELETE
USING (created_by = auth.uid());

-- ============================================================================
-- 24. POLÍTICAS PARA PROCESS_CHECKLIST_ITEMS
-- ============================================================================

CREATE POLICY "Users can view checklist items of accessible processes"
ON public.process_checklist_items FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.processes p
    WHERE p.id = process_id
    AND p.company_id IN (
      SELECT company_id FROM public.profiles WHERE id = auth.uid()
      UNION
      SELECT company_id FROM public.user_companies WHERE user_id = auth.uid() AND can_view = true
      UNION
      SELECT id FROM public.companies WHERE EXISTS (
        SELECT 1 FROM public.user_companies WHERE user_id = auth.uid() AND all_companies = true
      )
    )
  )
);

CREATE POLICY "Users can manage checklist items"
ON public.process_checklist_items FOR ALL
USING (auth.uid() IS NOT NULL);

-- ============================================================================
-- 25. POLÍTICAS PARA PROCESS_RESPONSIBLES
-- ============================================================================

CREATE POLICY "Users can view responsibles of accessible processes"
ON public.process_responsibles FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.processes p
    WHERE p.id = process_id
    AND p.company_id IN (
      SELECT company_id FROM public.profiles WHERE id = auth.uid()
      UNION
      SELECT company_id FROM public.user_companies WHERE user_id = auth.uid() AND can_view = true
      UNION
      SELECT id FROM public.companies WHERE EXISTS (
        SELECT 1 FROM public.user_companies WHERE user_id = auth.uid() AND all_companies = true
      )
    )
  )
);

CREATE POLICY "Users can manage responsibles"
ON public.process_responsibles FOR ALL
USING (auth.uid() IS NOT NULL);

-- ============================================================================
-- 26. POLÍTICAS PARA PROCESS_EXECUTIONS
-- ============================================================================

CREATE POLICY "Users can view executions of accessible processes"
ON public.process_executions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.processes p
    WHERE p.id = process_id
    AND p.company_id IN (
      SELECT company_id FROM public.profiles WHERE id = auth.uid()
      UNION
      SELECT company_id FROM public.user_companies WHERE user_id = auth.uid() AND can_view = true
      UNION
      SELECT id FROM public.companies WHERE EXISTS (
        SELECT 1 FROM public.user_companies WHERE user_id = auth.uid() AND all_companies = true
      )
    )
  )
);

CREATE POLICY "Users can create executions"
ON public.process_executions FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their own executions"
ON public.process_executions FOR UPDATE
USING (executed_by = auth.uid());

-- ============================================================================
-- 27. POLÍTICAS PARA PROCESS_EXECUTION_ITEMS
-- ============================================================================

CREATE POLICY "Users can view execution items"
ON public.process_execution_items FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.process_executions e
    JOIN public.processes p ON p.id = e.process_id
    WHERE e.id = execution_id
    AND p.company_id IN (
      SELECT company_id FROM public.profiles WHERE id = auth.uid()
      UNION
      SELECT company_id FROM public.user_companies WHERE user_id = auth.uid() AND can_view = true
      UNION
      SELECT id FROM public.companies WHERE EXISTS (
        SELECT 1 FROM public.user_companies WHERE user_id = auth.uid() AND all_companies = true
      )
    )
  )
);

CREATE POLICY "Users can manage execution items"
ON public.process_execution_items FOR ALL
USING (auth.uid() IS NOT NULL);

-- ============================================================================
-- 28. POLÍTICAS PARA TRADE_INDUSTRIES
-- ============================================================================

CREATE POLICY "Authenticated users can view industries"
ON public.trade_industries FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "CEO and Directors can manage industries"
ON public.trade_industries FOR ALL
USING (has_role(auth.uid(), 'ceo'::app_role) OR has_role(auth.uid(), 'diretor'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- ============================================================================
-- 29. POLÍTICAS PARA TRADE_MATERIALS
-- ============================================================================

CREATE POLICY "Authenticated users can view materials"
ON public.trade_materials FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "CEO and Directors can manage materials"
ON public.trade_materials FOR ALL
USING (has_role(auth.uid(), 'ceo'::app_role) OR has_role(auth.uid(), 'diretor'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- ============================================================================
-- 30. POLÍTICAS PARA TRADE_INVENTORY_MOVEMENTS
-- ============================================================================

CREATE POLICY "Authenticated users can view movements"
ON public.trade_inventory_movements FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Managers and above can create movements"
ON public.trade_inventory_movements FOR INSERT
WITH CHECK (has_role(auth.uid(), 'ceo'::app_role) OR has_role(auth.uid(), 'diretor'::app_role) OR has_role(auth.uid(), 'gerente'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "CEO and Directors can manage movements"
ON public.trade_inventory_movements FOR ALL
USING (has_role(auth.uid(), 'ceo'::app_role) OR has_role(auth.uid(), 'diretor'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- ============================================================================
-- 31. POLÍTICAS PARA DISTRIBUTORS, SALES_DAILY, SALES_SELLERS, SYNC_LOGS
-- ============================================================================

-- Service role policies (para edge functions)
CREATE POLICY "Service role can manage distributors"
ON public.distributors FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role can manage sales_daily"
ON public.sales_daily FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role can manage sales_sellers"
ON public.sales_sellers FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role can manage sync_logs"
ON public.sync_logs FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- 32. POLÍTICAS PARA EXTERNAL_EMPLOYEES
-- ============================================================================

CREATE POLICY "Users can view external employees"
ON public.external_employees FOR SELECT
USING (
  public.has_role(auth.uid(), 'super_admin') OR
  public.has_role(auth.uid(), 'ceo') OR
  EXISTS (
    SELECT 1 FROM user_companies uc 
    WHERE uc.user_id = auth.uid() AND uc.all_companies = true
  ) OR
  company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  )
);

CREATE POLICY "Service role can manage external employees"
ON public.external_employees FOR ALL
USING (auth.role() = 'service_role');

-- ============================================================================
-- 33. POLÍTICAS PARA GAMIFICATION
-- ============================================================================

CREATE POLICY "Users can view all points" 
ON public.user_points FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "System can manage points" 
ON public.user_points FOR ALL 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Anyone can view badges" 
ON public.badges FOR SELECT 
USING (true);

CREATE POLICY "Super admin can manage badges" 
ON public.badges FOR ALL 
USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'ceo'::app_role));

CREATE POLICY "Users can view all earned badges" 
ON public.user_badges FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "System can award badges" 
ON public.user_badges FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can view own history" 
ON public.points_history FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "CEO can view all history" 
ON public.points_history FOR SELECT 
USING (has_role(auth.uid(), 'ceo'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "System can add history" 
ON public.points_history FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================================================
-- 34. POLÍTICAS PARA USER_INVITES
-- ============================================================================

CREATE POLICY "Super admin and CEO can view all invites"
ON public.user_invites FOR SELECT
USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'ceo'::app_role));

CREATE POLICY "Super admin and CEO can manage invites"
ON public.user_invites FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'ceo'::app_role));

CREATE POLICY "Anyone can validate invite tokens"
ON public.user_invites FOR SELECT
USING (token IS NOT NULL AND status = 'pending' AND expires_at > now());

-- ============================================================================
-- 35. POLÍTICAS PARA TWO_FACTOR_CODES
-- ============================================================================

CREATE POLICY "System can manage 2fa codes"
ON public.two_factor_codes FOR ALL
USING (true) WITH CHECK (true);

-- ============================================================================
-- 36. POLÍTICAS PARA AUDIT_LOGS
-- ============================================================================

CREATE POLICY "Super admin and CEO can view audit logs"
ON public.audit_logs FOR SELECT
USING (
  has_role(auth.uid(), 'super_admin'::app_role) OR 
  has_role(auth.uid(), 'ceo'::app_role)
);

CREATE POLICY "Authenticated users can insert audit logs"
ON public.audit_logs FOR INSERT
WITH CHECK (auth.uid() = actor_id);

-- ============================================================================
-- 37. POLÍTICAS PARA EC_AREAS
-- ============================================================================

CREATE POLICY "Authenticated users can view ec_areas"
ON public.ec_areas FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Super admin and CEO can manage ec_areas"
ON public.ec_areas FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'ceo'::app_role));

-- ============================================================================
-- 38. POLÍTICAS PARA EC_CARDS
-- ============================================================================

CREATE POLICY "Authenticated users can view ec_cards"
ON public.ec_cards FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Super admin and CEO can manage ec_cards"
ON public.ec_cards FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'ceo'::app_role));

CREATE POLICY "Directors can manage ec_cards"
ON public.ec_cards FOR ALL
USING (has_role(auth.uid(), 'diretor'::app_role));

-- ============================================================================
-- 39. POLÍTICAS PARA EC_CARD_RECORDS
-- ============================================================================

CREATE POLICY "Authenticated users can view ec_card_records"
ON public.ec_card_records FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can create ec_card_records"
ON public.ec_card_records FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Responsibles can update their card records"
ON public.ec_card_records FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.ec_cards c
    WHERE c.id = ec_card_records.card_id
    AND (c.responsible_id = auth.uid() OR c.backup_id = auth.uid())
  )
  OR has_role(auth.uid(), 'super_admin'::app_role)
  OR has_role(auth.uid(), 'ceo'::app_role)
  OR has_role(auth.uid(), 'diretor'::app_role)
);

CREATE POLICY "Super admin and CEO can delete ec_card_records"
ON public.ec_card_records FOR DELETE
USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'ceo'::app_role));

-- ============================================================================
-- 40. POLÍTICAS PARA EC_RECORD_EVIDENCES
-- ============================================================================

CREATE POLICY "Authenticated users can view ec_record_evidences"
ON public.ec_record_evidences FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create ec_record_evidences"
ON public.ec_record_evidences FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Creators can delete their evidences"
ON public.ec_record_evidences FOR DELETE
USING (
  created_by = auth.uid()
  OR has_role(auth.uid(), 'super_admin'::app_role)
  OR has_role(auth.uid(), 'ceo'::app_role)
);

-- ============================================================================
-- 41. POLÍTICAS PARA EC_RECORD_COMMENTS
-- ============================================================================

CREATE POLICY "Authenticated users can view ec_record_comments"
ON public.ec_record_comments FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create ec_record_comments"
ON public.ec_record_comments FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Creators can delete their comments"
ON public.ec_record_comments FOR DELETE
USING (
  created_by = auth.uid()
  OR has_role(auth.uid(), 'super_admin'::app_role)
  OR has_role(auth.uid(), 'ceo'::app_role)
);

-- ============================================================================
-- 42. POLÍTICAS PARA EC_CARD_TASKS
-- ============================================================================

CREATE POLICY "Authenticated users can view ec_card_tasks"
ON public.ec_card_tasks FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create ec_card_tasks"
ON public.ec_card_tasks FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update ec_card_tasks"
ON public.ec_card_tasks FOR UPDATE
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete ec_card_tasks"
ON public.ec_card_tasks FOR DELETE
USING (
  has_role(auth.uid(), 'super_admin'::app_role) OR
  has_role(auth.uid(), 'ceo'::app_role) OR
  created_by = auth.uid()
);

-- ============================================================================
-- 43. POLÍTICAS PARA DL_CONNECTIONS
-- ============================================================================

CREATE POLICY "Super admin and CEO can view dl_connections"
ON public.dl_connections FOR SELECT
USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'ceo'::app_role));

CREATE POLICY "Super admin and CEO can manage dl_connections"
ON public.dl_connections FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'ceo'::app_role));

-- ============================================================================
-- 44. POLÍTICAS PARA DL_QUERIES
-- ============================================================================

CREATE POLICY "Super admin and CEO can view dl_queries"
ON public.dl_queries FOR SELECT
USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'ceo'::app_role));

CREATE POLICY "Super admin and CEO can manage dl_queries"
ON public.dl_queries FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'ceo'::app_role));

-- ============================================================================
-- 45. POLÍTICAS PARA DL_CARD_BINDINGS
-- ============================================================================

CREATE POLICY "Super admin and CEO can view dl_card_bindings"
ON public.dl_card_bindings FOR SELECT
USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'ceo'::app_role));

CREATE POLICY "Super admin and CEO can manage dl_card_bindings"
ON public.dl_card_bindings FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'ceo'::app_role));

-- ============================================================================
-- 46. POLÍTICAS PARA DL_QUERY_RUNS
-- ============================================================================

CREATE POLICY "Super admin and CEO can view dl_query_runs"
ON public.dl_query_runs FOR SELECT
USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'ceo'::app_role));

CREATE POLICY "System can create dl_query_runs"
ON public.dl_query_runs FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================================================
-- 47. POLÍTICAS PARA STOCK_AUDIT_SETTINGS
-- ============================================================================

CREATE POLICY "Super admin and CEO can manage stock_audit_settings"
ON public.stock_audit_settings FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'ceo'::app_role));

CREATE POLICY "Authenticated users can view stock_audit_settings"
ON public.stock_audit_settings FOR SELECT
USING (auth.uid() IS NOT NULL);

-- ============================================================================
-- 48. POLÍTICAS PARA STOCK_AUDITS
-- ============================================================================

CREATE POLICY "Authenticated users can view stock_audits"
ON public.stock_audits FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can create stock_audits"
ON public.stock_audits FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Auditors and admins can update stock_audits"
ON public.stock_audits FOR UPDATE
USING (
  auditor_user_id = auth.uid() OR
  has_role(auth.uid(), 'super_admin'::app_role) OR 
  has_role(auth.uid(), 'ceo'::app_role) OR
  has_role(auth.uid(), 'diretor'::app_role)
);

CREATE POLICY "Super admin and CEO can delete stock_audits"
ON public.stock_audits FOR DELETE
USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'ceo'::app_role));

-- ============================================================================
-- 49. POLÍTICAS PARA STOCK_AUDIT_ITEMS
-- ============================================================================

CREATE POLICY "Authenticated users can view stock_audit_items"
ON public.stock_audit_items FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can create stock_audit_items"
ON public.stock_audit_items FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update stock_audit_items"
ON public.stock_audit_items FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.stock_audits sa 
    WHERE sa.id = stock_audit_items.stock_audit_id 
    AND (
      sa.auditor_user_id = auth.uid() OR
      has_role(auth.uid(), 'super_admin'::app_role) OR 
      has_role(auth.uid(), 'ceo'::app_role)
    )
  )
);

CREATE POLICY "Super admin and CEO can delete stock_audit_items"
ON public.stock_audit_items FOR DELETE
USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'ceo'::app_role));

-- ============================================================================
-- 50. POLÍTICAS PARA STOCK_AUDIT_ITEM_PHOTOS
-- ============================================================================

CREATE POLICY "Authenticated users can view stock_audit_item_photos"
ON public.stock_audit_item_photos FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can create stock_audit_item_photos"
ON public.stock_audit_item_photos FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete their own photos"
ON public.stock_audit_item_photos FOR DELETE
USING (
  has_role(auth.uid(), 'super_admin'::app_role) OR 
  has_role(auth.uid(), 'ceo'::app_role) OR
  EXISTS (
    SELECT 1 FROM public.stock_audit_items sai
    JOIN public.stock_audits sa ON sa.id = sai.stock_audit_id
    WHERE sai.id = stock_audit_item_photos.stock_audit_item_id
    AND sa.auditor_user_id = auth.uid()
  )
);

-- ============================================================================
-- FIM DAS POLÍTICAS RLS
-- ============================================================================
