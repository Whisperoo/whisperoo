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
SELECT 'anon_on_support_requests', has_table_privilege('anon', 'public.support_requests', 'SELECT')::text;
