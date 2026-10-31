-- Post-migration checks for the Get Support release (read-only). Run by 10-get-support-release.sh.
SELECT 'tracker' AS check, count(*)::text AS value FROM supabase_migrations.schema_migrations
UNION ALL
SELECT 'tables', count(*)::text FROM information_schema.tables
 WHERE table_schema = 'public' AND table_name IN ('support_requests', 'sms_consent_events')
UNION ALL
SELECT 'video_col', count(*)::text FROM information_schema.columns
 WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'expert_video_enabled'
UNION ALL
SELECT 'rpcs', count(*)::text FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public' AND p.proname IN (
   'fn_support_visible_items', 'fn_my_support_status', 'fn_admin_list_support_requests',
   'fn_admin_set_support_request_status', 'fn_admin_support_request_contact', 'fn_service_apply_sms_keyword')
UNION ALL
SELECT 'service_role_on_support_requests', has_table_privilege('service_role', 'public.support_requests', 'INSERT')::text
UNION ALL
SELECT 'anon_on_support_requests', has_table_privilege('anon', 'public.support_requests', 'SELECT')::text
UNION ALL
SELECT 'kpi_anon_can_execute', has_function_privilege('anon', 'public.fn_get_appointment_booking_engagement_pct(uuid, date, date, text)', 'EXECUTE')::text
UNION ALL
SELECT 'kpi_has_admin_guard', (pg_get_functiondef('public.fn_get_appointment_booking_engagement_pct'::regproc) LIKE '%fn_caller_is_staff_admin%')::text
UNION ALL
SELECT 'consent_prompt_col', count(*)::text FROM information_schema.columns
 WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'consent_prompted_at'
UNION ALL
SELECT 'consent_prompt_fn', count(*)::text FROM pg_proc WHERE proname = 'fn_mark_consent_prompted'
UNION ALL
SELECT 'support_admin_rpcs', count(*)::text FROM pg_proc
 WHERE proname IN ('fn_admin_support_request_counts', 'fn_admin_set_support_request_status_bulk');
