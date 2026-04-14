-- 20260414000002_tenant_scoped_rls_enforcement.sql
-- SOW 2.3: Data Isolation — Tenant-scoped views and RLS enforcement

-- Tenant-scoped summary view for administrative data isolation queries.
-- Returns per-tenant user/session/message counts with zero B2C data leakage.
CREATE OR REPLACE VIEW public.tenant_user_summary AS
SELECT
  t.id AS tenant_id,
  t.name AS tenant_name,
  t.slug AS tenant_slug,
  COUNT(DISTINCT p.id) AS total_users,
  COUNT(DISTINCT s.id) AS total_sessions,
  COUNT(DISTINCT m.id) AS total_messages
FROM public.tenants t
LEFT JOIN public.profiles p ON p.tenant_id = t.id
LEFT JOIN public.sessions s ON s.user_id = p.id
LEFT JOIN public.messages m ON m.session_id = s.id
GROUP BY t.id, t.name, t.slug;

-- Tenant-scoped user detail view for compliance/data export.
-- Returns profile + acquisition info scoped to a specific tenant.
CREATE OR REPLACE VIEW public.tenant_user_details AS
SELECT
  p.id AS user_id,
  p.first_name,
  p.email,
  p.tenant_id,
  p.acquisition_source,
  p.acquisition_department,
  p.language_preference,
  p.role,
  p.onboarded,
  p.created_at,
  t.name AS tenant_name,
  t.slug AS tenant_slug
FROM public.profiles p
INNER JOIN public.tenants t ON p.tenant_id = t.id
WHERE p.tenant_id IS NOT NULL;

-- Ensure sessions RLS allows user-scoped access (already exists via auth.uid())
-- Add an explicit policy name for clarity if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'sessions' AND policyname = 'Users manage own sessions'
  ) THEN
    CREATE POLICY "Users manage own sessions"
      ON public.sessions FOR ALL TO authenticated
      USING (user_id = auth.uid());
  END IF;
END $$;

-- Ensure messages RLS allows session-scoped access through sessions ownership
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'messages' AND policyname = 'Users access own messages via session'
  ) THEN
    CREATE POLICY "Users access own messages via session"
      ON public.messages FOR ALL TO authenticated
      USING (
        session_id IN (SELECT id FROM public.sessions WHERE user_id = auth.uid())
      );
  END IF;
END $$;
