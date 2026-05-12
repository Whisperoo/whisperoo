-- 20260512000001_waitlist_signups.sql
-- Purpose: Capture pre-launch waitlist signups from tenant-specific coming-soon
-- landing pages (initially: St. Joseph Medical Center). Anonymous inserts are
-- allowed (users are not authenticated yet), but only admins can read.

CREATE TABLE IF NOT EXISTS public.waitlist_signups (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_slug   text NOT NULL,
  full_name     text NOT NULL,
  email         text NOT NULL,
  phone         text NOT NULL,
  journey_stage text CHECK (journey_stage IN ('pregnant','trying','postpartum')),
  source        text,
  department    text,
  qr_token      text,
  metadata      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_waitlist_signups_tenant_slug ON public.waitlist_signups(tenant_slug);
CREATE INDEX IF NOT EXISTS idx_waitlist_signups_created_at ON public.waitlist_signups(created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_waitlist_signups_tenant_email
  ON public.waitlist_signups (tenant_slug, lower(email));

ALTER TABLE public.waitlist_signups ENABLE ROW LEVEL SECURITY;

-- Public can insert (the page is reached pre-auth via QR scan)
DROP POLICY IF EXISTS "Anyone can join waitlist" ON public.waitlist_signups;
CREATE POLICY "Anyone can join waitlist"
  ON public.waitlist_signups FOR INSERT
  WITH CHECK (true);

-- Only admins / super_admins can read
DROP POLICY IF EXISTS "Admins can read waitlist" ON public.waitlist_signups;
CREATE POLICY "Admins can read waitlist"
  ON public.waitlist_signups FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.account_type IN ('admin','super_admin')
    )
  );
