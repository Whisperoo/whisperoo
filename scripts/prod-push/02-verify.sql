-- Post-push verification (read-only). Run by 02-migrate.sh.
SELECT 'tracker' AS check, count(*)::text AS value FROM supabase_migrations.schema_migrations
UNION ALL
SELECT 'new_rpcs', count(*)::text FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public' AND p.proname IN (
   'fn_get_admin_funnel','fn_admin_list_users','fn_admin_user_activity_summary',
   'fn_admin_user_timeline','fn_record_activity','fn_record_messaging_consent')
UNION ALL
SELECT 'segment_rpcs', count(*)::text FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public'
   AND p.proname IN ('fn_get_admin_dashboard','fn_get_appointment_booking_engagement_pct',
                     'fn_get_resource_utilization','fn_admin_qr_signup_metrics')
   AND pg_get_function_arguments(p.oid) LIKE '%p_segment%'
UNION ALL
SELECT 'new_tables', count(*)::text FROM information_schema.tables
 WHERE table_schema = 'public' AND table_name IN ('expert_testimonials','consent_versions','user_activity_log')
UNION ALL
SELECT 'profile_cols', count(*)::text FROM information_schema.columns
 WHERE table_schema = 'public' AND table_name = 'profiles'
   AND column_name IN ('hospital_affiliation','email_opt_in','sms_opt_in')
UNION ALL
SELECT 'idx', count(*)::text FROM pg_indexes WHERE indexname = 'idx_purchases_payment_intent_id'
UNION ALL
SELECT 'backfilled', status FROM public.purchases WHERE payment_intent_id = 'pi_3Smc5pGoPqMhq4zM1xKwhurM'
UNION ALL
SELECT 'themes_restored',
       (pg_get_functiondef('public.fn_get_admin_dashboard'::regproc) NOT LIKE '%''concern_themes'',    ''[]''::jsonb%')::text;
