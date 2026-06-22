-- Nurse referral tracking for hospital onboarding
--
-- referred_by_nurse : name the patient typed ("Jane Smith")
-- referral_hint     : free-text description when patient doesn't know the name
--                     ("tall nurse on morning shift in OB/GYN")

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referred_by_nurse TEXT,
  ADD COLUMN IF NOT EXISTS referral_hint     TEXT;

-- ── fn_save_nurse_referral ────────────────────────────────────────────────────
-- SECURITY DEFINER so it bypasses the RLS recursion on profiles (same pattern
-- as fn_link_user_to_hospital). Called from the Referred onboarding step.

CREATE OR REPLACE FUNCTION public.fn_save_nurse_referral(
  p_nurse_name   TEXT DEFAULT NULL,
  p_referral_hint TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE public.profiles
  SET
    referred_by_nurse = NULLIF(TRIM(COALESCE(p_nurse_name, '')), ''),
    referral_hint     = NULLIF(TRIM(COALESCE(p_referral_hint, '')), '')
  WHERE id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found for user %', auth.uid();
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_save_nurse_referral(text, text) TO authenticated;

-- ── fn_admin_get_tenant_signups ───────────────────────────────────────────────
-- Returns all onboarded hospital patients for a given tenant with their nurse
-- attribution. Used in TenantConfigEditor "Signups" section.

CREATE OR REPLACE FUNCTION public.fn_admin_get_tenant_signups(
  p_tenant_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role text;
  v_result      jsonb;
BEGIN
  SELECT account_type INTO v_caller_role
  FROM public.profiles
  WHERE id = auth.uid();

  IF COALESCE(v_caller_role, '') NOT IN ('admin', 'super_admin', 'superadmin') THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT jsonb_build_object(
    'signups', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'user_id',          p.id,
          'first_name',       p.first_name,
          'joined_at',        p.created_at,
          'department',       p.acquisition_department,
          'referred_by_nurse', p.referred_by_nurse,
          'referral_hint',    p.referral_hint
        )
        ORDER BY p.created_at DESC
      )
      FROM public.profiles p
      WHERE p.tenant_id = p_tenant_id
        AND p.onboarded = true
    ), '[]'::jsonb),

    -- Nurse leaderboard: group by nurse name, count patients per nurse
    'nurse_leaderboard', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'nurse_name', referred_by_nurse,
          'count',      cnt
        )
        ORDER BY cnt DESC
      )
      FROM (
        SELECT referred_by_nurse, COUNT(*) AS cnt
        FROM public.profiles
        WHERE tenant_id = p_tenant_id
          AND onboarded = true
          AND referred_by_nurse IS NOT NULL
          AND referred_by_nurse != ''
        GROUP BY referred_by_nurse
      ) ranked
    ), '[]'::jsonb)
  )
  INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_admin_get_tenant_signups(uuid) TO authenticated;
