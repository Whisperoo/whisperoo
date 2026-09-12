-- Admin user list, segment-aware.
--
-- Sprint 2 (QUO-2026-004) workstream 1: "User list view filterable by segment".
-- No user list existed in the admin portal at all; this is the data source for
-- the new Users tab.
--
-- HIPAA 6.1 shapes the column list. The grid shows NO direct identifiers: no
-- email (profiles.email was dropped in 20260504000001 anyway), no phone number,
-- no date of birth. First name is the minimum needed for a human to recognise a
-- row, and it is already shown elsewhere in the portal. Contact details stay
-- export-only, behind the audited path, never in a browsable table.
--
-- Segment semantics are the same helper the dashboard uses (fn_profile_in_segment
-- from 20260822000001), so the Users tab and the Metrics tab can never disagree
-- about who is "B2C".
--
-- Paginated: the platform has hundreds of profiles today and will have many
-- more; returning everything to the browser is not an option. total_count is
-- returned on every row (a window function) so the client gets page + total in
-- one round trip.

CREATE OR REPLACE FUNCTION public.fn_admin_list_users(
  p_tenant_id  uuid    DEFAULT NULL,
  p_segment    text    DEFAULT 'all',
  p_start_date date    DEFAULT NULL,
  p_end_date   date    DEFAULT NULL,
  p_search     text    DEFAULT NULL,
  p_limit      integer DEFAULT 50,
  p_offset     integer DEFAULT 0
)
RETURNS TABLE (
  id                     uuid,
  first_name             text,
  account_type           text,
  onboarded              boolean,
  tenant_id              uuid,
  tenant_name            text,
  segment                text,
  acquisition_source     text,
  acquisition_department text,
  hospital_affiliation   text,
  preferred_language     text,
  created_at             timestamptz,
  total_count            bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT p.account_type INTO v_caller_role
  FROM public.profiles p
  WHERE p.id = auth.uid();

  IF COALESCE(v_caller_role, '') NOT IN ('admin', 'super_admin', 'superadmin') THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF COALESCE(p_segment, 'all') NOT IN ('all', 'hospital', 'b2c') THEN
    RAISE EXCEPTION 'Invalid segment: %. Expected all, hospital, or b2c.', p_segment;
  END IF;

  -- Cap the page size server-side so a misbehaving client cannot pull the table.
  p_limit := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);
  p_offset := GREATEST(COALESCE(p_offset, 0), 0);

  RETURN QUERY
  SELECT
    p.id,
    p.first_name,
    p.account_type::text,
    COALESCE(p.onboarded, false),
    p.tenant_id,
    t.name,
    CASE WHEN p.tenant_id IS NULL THEN 'b2c' ELSE 'hospital' END,
    p.acquisition_source,
    p.acquisition_department,
    p.hospital_affiliation,
    COALESCE(p.preferred_language, p.language_preference),
    p.created_at,
    COUNT(*) OVER () AS total_count
  FROM public.profiles p
  LEFT JOIN public.tenants t ON t.id = p.tenant_id
  WHERE fn_profile_in_segment(p.tenant_id, p_segment, p_tenant_id)
    AND (p_start_date IS NULL OR p.created_at::date >= p_start_date)
    AND (p_end_date   IS NULL OR p.created_at::date <= p_end_date)
    AND (
      p_search IS NULL OR btrim(p_search) = ''
      OR p.first_name ILIKE '%' || btrim(p_search) || '%'
      OR t.name ILIKE '%' || btrim(p_search) || '%'
    )
  ORDER BY p.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;

COMMENT ON FUNCTION public.fn_admin_list_users(uuid, text, date, date, text, integer, integer) IS
  'Paginated, segment-aware admin user list. Staff admins only. Returns no direct identifiers (no email/phone) per HIPAA 6.1.';

GRANT EXECUTE ON FUNCTION public.fn_admin_list_users(uuid, text, date, date, text, integer, integer) TO authenticated;

-- ROLLBACK: DROP FUNCTION IF EXISTS public.fn_admin_list_users(uuid, text, date, date, text, integer, integer);
