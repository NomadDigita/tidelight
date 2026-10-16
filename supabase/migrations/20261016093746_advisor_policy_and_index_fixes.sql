-- Supabase advisor remediation from live catalog findings (2026-10-16).
-- Preserve row access while hoisting auth.uid() out of per-row policy evaluation.
DROP POLICY IF EXISTS "Users manage own blocks" ON public."community_blocks";
CREATE POLICY "Users manage own blocks" ON public."community_blocks" FOR ALL TO authenticated USING ((blocker_id = (select auth.uid()))) WITH CHECK ((blocker_id = (select auth.uid())));
DROP POLICY IF EXISTS "Users read own saved community posts" ON public."community_bookmarks";
CREATE POLICY "Users read own saved community posts" ON public."community_bookmarks" FOR SELECT TO authenticated USING ((user_id = (select auth.uid())));
DROP POLICY IF EXISTS "Users save community posts" ON public."community_bookmarks";
CREATE POLICY "Users save community posts" ON public."community_bookmarks" FOR INSERT TO authenticated WITH CHECK ((user_id = (select auth.uid())));
DROP POLICY IF EXISTS "Users unsave community posts" ON public."community_bookmarks";
CREATE POLICY "Users unsave community posts" ON public."community_bookmarks" FOR DELETE TO authenticated USING ((user_id = (select auth.uid())));
DROP POLICY IF EXISTS "Participants read conversations" ON public."community_conversations";
CREATE POLICY "Participants read conversations" ON public."community_conversations" FOR SELECT TO authenticated USING ((((select auth.uid()) = user_a) OR ((select auth.uid()) = user_b)));
DROP POLICY IF EXISTS "Participants start conversations" ON public."community_conversations";
CREATE POLICY "Participants start conversations" ON public."community_conversations" FOR INSERT TO authenticated WITH CHECK ((((select auth.uid()) = user_a) OR ((select auth.uid()) = user_b)));
DROP POLICY IF EXISTS "Users manage own follows" ON public."community_follows";
CREATE POLICY "Users create own follows" ON public."community_follows" FOR INSERT TO authenticated WITH CHECK (follower_id = (select auth.uid()));
CREATE POLICY "Users update own follows" ON public."community_follows" FOR UPDATE TO authenticated USING (follower_id = (select auth.uid())) WITH CHECK (follower_id = (select auth.uid()));
CREATE POLICY "Users delete own follows" ON public."community_follows" FOR DELETE TO authenticated USING (follower_id = (select auth.uid()));
DROP POLICY IF EXISTS "Users manage own private message drafts" ON public."community_message_drafts";
CREATE POLICY "Users manage own private message drafts" ON public."community_message_drafts" FOR ALL TO authenticated USING ((user_id = (select auth.uid()))) WITH CHECK ((user_id = (select auth.uid())));
DROP POLICY IF EXISTS "Participants read messages" ON public."community_messages";
CREATE POLICY "Participants read messages" ON public."community_messages" FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM community_conversations c
  WHERE ((c.id = community_messages.conversation_id) AND (((select auth.uid()) = c.user_a) OR ((select auth.uid()) = c.user_b))))));
DROP POLICY IF EXISTS "Participants send messages as themselves" ON public."community_messages";
CREATE POLICY "Participants send messages as themselves" ON public."community_messages" FOR INSERT TO authenticated WITH CHECK (((sender_id = (select auth.uid())) AND (EXISTS ( SELECT 1
   FROM community_conversations c
  WHERE ((c.id = community_messages.conversation_id) AND (((select auth.uid()) = c.user_a) OR ((select auth.uid()) = c.user_b)))))));
DROP POLICY IF EXISTS "Senders delete their own messages" ON public."community_messages";
CREATE POLICY "Senders delete their own messages" ON public."community_messages" FOR DELETE TO authenticated USING ((sender_id = (select auth.uid())));
DROP POLICY IF EXISTS "Users manage own community post drafts" ON public."community_post_drafts";
CREATE POLICY "Users manage own community post drafts" ON public."community_post_drafts" FOR ALL TO authenticated USING ((user_id = (select auth.uid()))) WITH CHECK ((user_id = (select auth.uid())));
DROP POLICY IF EXISTS "Authors delete their own posts" ON public."community_posts";
CREATE POLICY "Authors delete their own posts" ON public."community_posts" FOR DELETE TO authenticated USING ((author_id = (select auth.uid())));
DROP POLICY IF EXISTS "Users create their own posts" ON public."community_posts";
CREATE POLICY "Users create their own posts" ON public."community_posts" FOR INSERT TO authenticated WITH CHECK ((author_id = (select auth.uid())));
DROP POLICY IF EXISTS "Users create their own community profile" ON public."community_profiles";
CREATE POLICY "Users create their own community profile" ON public."community_profiles" FOR INSERT TO authenticated WITH CHECK ((id = (select auth.uid())));
DROP POLICY IF EXISTS "Users update their own community profile" ON public."community_profiles";
CREATE POLICY "Users update their own community profile" ON public."community_profiles" FOR UPDATE TO authenticated USING ((id = (select auth.uid()))) WITH CHECK ((id = (select auth.uid())));
DROP POLICY IF EXISTS "Users manage own reactions" ON public."community_reactions";
CREATE POLICY "Users create own reactions" ON public."community_reactions" FOR INSERT TO authenticated WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY "Users update own reactions" ON public."community_reactions" FOR UPDATE TO authenticated USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY "Users delete own reactions" ON public."community_reactions" FOR DELETE TO authenticated USING (user_id = (select auth.uid()));
DROP POLICY IF EXISTS "Users create reports" ON public."community_reports";
CREATE POLICY "Users create reports" ON public."community_reports" FOR INSERT TO authenticated WITH CHECK ((reporter_id = (select auth.uid())));
DROP POLICY IF EXISTS "Users see own reports" ON public."community_reports";
CREATE POLICY "Users see own reports" ON public."community_reports" FOR SELECT TO authenticated USING ((reporter_id = (select auth.uid())));

-- Keep the quota APIs authenticated while moving elevated implementations to
-- the non-exposed schema. Both routines derive ownership from auth.uid().
CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated;

CREATE OR REPLACE FUNCTION private.reserve_ai_provider_check() RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_user uuid := (SELECT auth.uid()); v_id uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text, 11992));
  IF (SELECT count(*) FROM public.ai_provider_checks WHERE user_id = v_user AND created_at >= now() - interval '1 hour') >= 2 THEN
    RETURN NULL;
  END IF;
  INSERT INTO public.ai_provider_checks (user_id) VALUES (v_user) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION private.reserve_ai_provider_check() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.reserve_ai_provider_check() TO authenticated;
CREATE OR REPLACE FUNCTION public.reserve_ai_provider_check() RETURNS uuid
LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT private.reserve_ai_provider_check();
$$;
REVOKE ALL ON FUNCTION public.reserve_ai_provider_check() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reserve_ai_provider_check() TO authenticated;

CREATE OR REPLACE FUNCTION private.reserve_support_agent_request() RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_user uuid := (SELECT auth.uid());
BEGIN
  IF v_user IS NULL THEN RETURN false; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text, 12011));
  IF (SELECT count(*) FROM public.support_agent_requests
      WHERE user_id = v_user AND created_at >= now() - interval '1 hour') >= 12 THEN
    RETURN false;
  END IF;
  INSERT INTO public.support_agent_requests (user_id) VALUES (v_user);
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION private.reserve_support_agent_request() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.reserve_support_agent_request() TO authenticated;
CREATE OR REPLACE FUNCTION public.reserve_support_agent_request() RETURNS boolean
LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT private.reserve_support_agent_request();
$$;
REVOKE ALL ON FUNCTION public.reserve_support_agent_request() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reserve_support_agent_request() TO authenticated;

-- Cover existing foreign keys which have no advisor-recognized leading index.
CREATE INDEX IF NOT EXISTS "fki_community_blocks_blocked_id" ON public."community_blocks" ("blocked_id");
CREATE INDEX IF NOT EXISTS "fki_community_bookmarks_post_id" ON public."community_bookmarks" ("post_id");
CREATE INDEX IF NOT EXISTS "fki_community_conversations_user_b" ON public."community_conversations" ("user_b");
CREATE INDEX IF NOT EXISTS "fki_community_follows_following_id" ON public."community_follows" ("following_id");
CREATE INDEX IF NOT EXISTS "fki_community_message_drafts_peer_id" ON public."community_message_drafts" ("peer_id");
CREATE INDEX IF NOT EXISTS "fki_community_messages_sender_id" ON public."community_messages" ("sender_id");
CREATE INDEX IF NOT EXISTS "fki_community_posts_author_id" ON public."community_posts" ("author_id");
CREATE INDEX IF NOT EXISTS "fki_community_posts_quote_post_id" ON public."community_posts" ("quote_post_id");
CREATE INDEX IF NOT EXISTS "fki_community_posts_reply_to" ON public."community_posts" ("reply_to");
CREATE INDEX IF NOT EXISTS "fki_community_reactions_post_id" ON public."community_reactions" ("post_id");
CREATE INDEX IF NOT EXISTS "fki_community_reports_post_id" ON public."community_reports" ("post_id");
CREATE INDEX IF NOT EXISTS "fki_community_reports_reported_user_id" ON public."community_reports" ("reported_user_id");
CREATE INDEX IF NOT EXISTS "fki_community_reports_reporter_id" ON public."community_reports" ("reporter_id");
CREATE INDEX IF NOT EXISTS "fki_developer_api_key_audit_actor_id" ON public."developer_api_key_audit" ("actor_id");
CREATE INDEX IF NOT EXISTS "fki_developer_api_key_audit_key_id" ON public."developer_api_key_audit" ("key_id");
CREATE INDEX IF NOT EXISTS "fki_developer_api_key_audit_previous_key_id" ON public."developer_api_key_audit" ("previous_key_id");
CREATE INDEX IF NOT EXISTS "fki_developer_api_keys_project_id" ON public."developer_api_keys" ("project_id");
CREATE INDEX IF NOT EXISTS "fki_developer_api_requests_owner_id" ON public."developer_api_requests" ("owner_id");
CREATE INDEX IF NOT EXISTS "fki_developer_organization_audit_actor_id" ON public."developer_organization_audit" ("actor_id");
CREATE INDEX IF NOT EXISTS "fki_developer_organization_audit_target_user_id" ON public."developer_organization_audit" ("target_user_id");
CREATE INDEX IF NOT EXISTS "fki_developer_organization_members_added_by" ON public."developer_organization_members" ("added_by");
CREATE INDEX IF NOT EXISTS "fki_developer_organizations_created_by" ON public."developer_organizations" ("created_by");
CREATE INDEX IF NOT EXISTS "fki_developer_projects_owner_id" ON public."developer_projects" ("owner_id");
CREATE INDEX IF NOT EXISTS "fki_email_delivery_queue_user_id" ON public."email_delivery_queue" ("user_id");
CREATE INDEX IF NOT EXISTS "fki_futures_live_access_requests_reviewed_by" ON public."futures_live_access_requests" ("reviewed_by");
CREATE INDEX IF NOT EXISTS "fki_futures_paper_decisions_account_id" ON public."futures_paper_decisions" ("account_id");
CREATE INDEX IF NOT EXISTS "fki_futures_paper_fills_user_id" ON public."futures_paper_fills" ("user_id");
CREATE INDEX IF NOT EXISTS "fki_futures_paper_orders_fill_id" ON public."futures_paper_orders" ("fill_id");
CREATE INDEX IF NOT EXISTS "fki_futures_paper_positions_user_id" ON public."futures_paper_positions" ("user_id");
CREATE INDEX IF NOT EXISTS "fki_nightwatch_preferences_research_run_id" ON public."nightwatch_preferences" ("research_run_id");
CREATE INDEX IF NOT EXISTS "fki_nightwatch_schedule_executions_run_id" ON public."nightwatch_schedule_executions" ("run_id");
CREATE INDEX IF NOT EXISTS "fki_nightwatch_schedules_research_run_id" ON public."nightwatch_schedules" ("research_run_id");
CREATE INDEX IF NOT EXISTS "fki_tic_oauth_flows_client_id" ON public."tic_oauth_flows" ("client_id");
CREATE INDEX IF NOT EXISTS "fki_tic_oauth_refresh_history_client_id" ON public."tic_oauth_refresh_history" ("client_id");
CREATE INDEX IF NOT EXISTS "fki_tic_oauth_sessions_client_id" ON public."tic_oauth_sessions" ("client_id");
CREATE INDEX IF NOT EXISTS "fki_tic_oauth_sessions_project_id" ON public."tic_oauth_sessions" ("project_id");
CREATE INDEX IF NOT EXISTS "fki_tic_research_jobs_key_id" ON public."tic_research_jobs" ("key_id");
CREATE INDEX IF NOT EXISTS "fki_tic_research_jobs_request_id" ON public."tic_research_jobs" ("request_id");
CREATE INDEX IF NOT EXISTS "fki_tic_webhook_endpoints_created_by" ON public."tic_webhook_endpoints" ("created_by");
CREATE INDEX IF NOT EXISTS "fki_tic_webhook_endpoints_organization_id" ON public."tic_webhook_endpoints" ("organization_id");
CREATE INDEX IF NOT EXISTS "fki_tic_webhook_endpoints_project_id_organization_id" ON public."tic_webhook_endpoints" ("project_id", "organization_id");
