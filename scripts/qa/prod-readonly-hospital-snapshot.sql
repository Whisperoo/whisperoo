-- READ-ONLY snapshot of the metrics the client asked for, for one hospital tenant.
-- Mirrors fn_get_admin_funnel (20260914000002) and the restored concern_themes
-- (20260914000001) but runs as plain SELECTs so it works on prod BEFORE the push.
-- Usage: psql ... -v tenant_slug_like='%joseph%' -f scripts/qa/prod-readonly-hospital-snapshot.sql
BEGIN READ ONLY;

\echo === Tenant ===
SELECT id, slug, name FROM public.tenants WHERE slug ILIKE :'tenant_slug_like' OR name ILIKE :'tenant_slug_like';

\echo === Funnel (all-time, hospital users only) ===
WITH t AS (SELECT id FROM public.tenants WHERE slug ILIKE :'tenant_slug_like' OR name ILIKE :'tenant_slug_like' LIMIT 1),
c AS (SELECT p.id FROM public.profiles p, t WHERE p.tenant_id = t.id)
SELECT * FROM (VALUES
  ('1 signed_up',           (SELECT COUNT(*) FROM c)),
  ('2 onboarded',           (SELECT COUNT(*) FROM c JOIN public.profiles p ON p.id = c.id WHERE p.onboarded)),
  ('3 started_chat',        (SELECT COUNT(DISTINCT se.user_id) FROM public.sessions se JOIN c ON c.id = se.user_id)),
  ('4 viewed_content',      (SELECT COUNT(DISTINCT a.user_id) FROM public.product_analytics a JOIN c ON c.id = a.user_id WHERE a.event_type IN ('view','download'))),
  ('5 saved_or_bought',     (SELECT COUNT(DISTINCT u) FROM (
                               SELECT wl.user_id AS u FROM public.product_wishlists wl JOIN c ON c.id = wl.user_id
                               UNION SELECT pu.user_id FROM public.purchases pu JOIN c ON c.id = pu.user_id WHERE pu.status = 'completed') x)),
  ('6 booked_consultation', (SELECT COUNT(DISTINCT cb.user_id) FROM public.consultation_bookings cb JOIN c ON c.id = cb.user_id WHERE cb.status <> 'cancelled'))
) AS f(stage, users);

\echo === AI topics (hospital users, all-time) ===
WITH t AS (SELECT id FROM public.tenants WHERE slug ILIKE :'tenant_slug_like' OR name ILIKE :'tenant_slug_like' LIMIT 1)
SELECT m.metadata->>'category' AS topic, COUNT(*) AS messages
FROM public.messages m JOIN public.sessions s ON s.id = m.session_id JOIN public.profiles p ON p.id = s.user_id JOIN t ON p.tenant_id = t.id
WHERE m.role = 'user' AND m.metadata->>'category' IS NOT NULL
GROUP BY 1 ORDER BY 2 DESC LIMIT 15;

\echo === Sanity: how many chat messages carry a category at all (platform-wide) ===
SELECT COUNT(*) FILTER (WHERE metadata->>'category' IS NOT NULL) AS with_category, COUNT(*) AS user_messages
FROM public.messages WHERE role = 'user';

ROLLBACK;
