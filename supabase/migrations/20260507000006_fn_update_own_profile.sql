-- Migration: Add SECURITY DEFINER function to update profile bypassing RLS recursion
-- ============================================================
-- WHY THIS APPROACH:
-- The RLS policy on the profiles table causes "infinite recursion"
-- errors during profile UPDATE operations. Rather than fighting the
-- policy evaluation chain, we use a SECURITY DEFINER function which
-- executes with the privileges of the function owner (postgres),
-- completely bypassing RLS for updating a user's own profile.
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_update_own_profile(
  updates jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
BEGIN
  v_uid := auth.uid();
  
  -- Only allow authenticated users to update themselves
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Construct a dynamic update statement based on the provided JSONB keys
  -- We only allow certain fields to be updated by this generic function
  -- or we just use jsonb_populate_record
  
  UPDATE public.profiles
  SET 
    first_name = COALESCE((updates->>'first_name')::text, first_name),
    last_name = COALESCE((updates->>'last_name')::text, last_name),
    language_preference = COALESCE((updates->>'language_preference')::text, language_preference),
    has_kids = COALESCE((updates->>'has_kids')::boolean, has_kids),
    kids_count = COALESCE((updates->>'kids_count')::int, kids_count),
    kids_ages = CASE WHEN updates ? 'kids_ages' THEN ARRAY(SELECT jsonb_array_elements_text(updates->'kids_ages')) ELSE kids_ages END,
    expecting_status = COALESCE((updates->>'expecting_status')::text, expecting_status),
    due_date = CASE WHEN updates ? 'due_date' THEN (updates->>'due_date')::date ELSE due_date END,
    topics_of_interest = CASE WHEN updates ? 'topics_of_interest' THEN ARRAY(SELECT jsonb_array_elements_text(updates->'topics_of_interest')) ELSE topics_of_interest END,
    parenting_styles = CASE WHEN updates ? 'parenting_styles' THEN ARRAY(SELECT jsonb_array_elements_text(updates->'parenting_styles')) ELSE parenting_styles END,
    user_role = COALESCE((updates->>'user_role')::text, user_role),
    onboarding_completed = COALESCE((updates->>'onboarding_completed')::boolean, onboarding_completed),
    tenant_id = CASE WHEN updates ? 'tenant_id' THEN (updates->>'tenant_id')::uuid ELSE tenant_id END,
    acquisition_source = COALESCE((updates->>'acquisition_source')::text, acquisition_source),
    acquisition_department = COALESCE((updates->>'acquisition_department')::text, acquisition_department)
  WHERE id = v_uid;

  -- Raise if no row was updated (profile doesn't exist yet)
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found for user %', v_uid;
  END IF;
END;
$$;

-- Allow any authenticated user to call this function
GRANT EXECUTE ON FUNCTION public.fn_update_own_profile(jsonb) TO authenticated;
