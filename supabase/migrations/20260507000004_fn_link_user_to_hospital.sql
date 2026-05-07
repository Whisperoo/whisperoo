-- Migration: Add SECURITY DEFINER function for hospital affiliation during onboarding
-- ============================================================
-- WHY THIS APPROACH:
-- The RLS policy on the profiles table causes "infinite recursion"
-- errors during profile UPDATE operations. Rather than fighting the
-- policy evaluation chain, we use a SECURITY DEFINER function which
-- executes with the privileges of the function owner (postgres),
-- completely bypassing RLS for this specific, controlled operation.
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_link_user_to_hospital(
  p_tenant_id uuid,
  p_department text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only allow authenticated users to link themselves
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Update the calling user's profile directly, bypassing RLS
  UPDATE public.profiles
  SET
    tenant_id             = p_tenant_id,
    acquisition_source    = 'organic_affiliate',
    acquisition_department = p_department
  WHERE id = auth.uid();

  -- Raise if no row was updated (profile doesn't exist yet)
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found for user %', auth.uid();
  END IF;
END;
$$;

-- Allow any authenticated user to call this function
GRANT EXECUTE ON FUNCTION public.fn_link_user_to_hospital(uuid, text) TO authenticated;
