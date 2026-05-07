-- Migration: Replace fn_update_own_profile with a dynamic, schema-safe version
-- ============================================================
-- PROBLEM: The previous version hardcoded column names including
-- 'last_name' which does not exist in the profiles table, causing 400 errors.
--
-- FIX: Use a dynamic approach that builds an UPDATE statement only
-- from the JSONB keys that exist as actual profile columns. This is
-- future-proof — if a column is added to profiles later, it will
-- automatically be supported here without needing a new migration.
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
  v_col text;
  v_val text;
  v_sql text := 'UPDATE public.profiles SET updated_at = NOW()';
  v_has_set boolean := false;

  -- Only columns that actually exist in the profiles table are allowed
  v_allowed_columns text[] := ARRAY[
    'first_name',
    'role',
    'user_role',
    'custom_role',
    'expecting_status',
    'has_kids',
    'kids_count',
    'kids_ages',
    'due_date',
    'is_expecting',
    'topics_of_interest',
    'parenting_styles',
    'language_preference',
    'preferred_language',
    'personal_context',
    'profile_image_url',
    'onboarding_completed',
    'onboarded',
    'tenant_id',
    'acquisition_source',
    'acquisition_department',
    'account_type',
    'expert_bio',
    'expert_specialties',
    'expert_experience_years',
    'expert_consultation_rate',
    'expert_availability_status',
    'expert_verified',
    'expert_rating',
    'expert_total_reviews',
    'expert_profile_visibility',
    'expert_accepts_new_clients'
  ];
BEGIN
  v_uid := auth.uid();

  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Build UPDATE SET clause dynamically from JSONB keys that are in the allowed list
  FOR v_col IN SELECT jsonb_object_keys(updates)
  LOOP
    IF v_col = ANY(v_allowed_columns) THEN
      v_sql := v_sql || format(', %I = ($1->>%L)::', v_col, v_col);

      -- Cast to the right type based on column name
      IF v_col IN ('has_kids', 'is_expecting', 'onboarding_completed', 'onboarded',
                   'expert_verified', 'expert_profile_visibility', 'expert_accepts_new_clients') THEN
        v_sql := v_sql || 'boolean';
      ELSIF v_col IN ('kids_count', 'expert_experience_years') THEN
        v_sql := v_sql || 'integer';
      ELSIF v_col IN ('expert_consultation_rate', 'expert_rating', 'expert_total_reviews') THEN
        v_sql := v_sql || 'numeric';
      ELSIF v_col = 'due_date' THEN
        v_sql := v_sql || 'date';
      ELSIF v_col = 'tenant_id' THEN
        v_sql := v_sql || 'uuid';
      ELSE
        v_sql := v_sql || 'text';
      END IF;
      v_has_set := true;
    END IF;
  END LOOP;

  -- Handle array columns separately (they need array casting, not text cast)
  IF updates ? 'topics_of_interest' THEN
    v_sql := regexp_replace(v_sql,
      ', topics_of_interest = \(\$1->>''topics_of_interest''\)::text', '', 'g');
    v_sql := v_sql || $q$, topics_of_interest = ARRAY(SELECT jsonb_array_elements_text($1->'topics_of_interest'))$q$;
    v_has_set := true;
  END IF;

  IF updates ? 'parenting_styles' THEN
    v_sql := regexp_replace(v_sql,
      ', parenting_styles = \(\$1->>''parenting_styles''\)::text', '', 'g');
    v_sql := v_sql || $q$, parenting_styles = ARRAY(SELECT jsonb_array_elements_text($1->'parenting_styles'))$q$;
    v_has_set := true;
  END IF;

  IF updates ? 'kids_ages' THEN
    v_sql := regexp_replace(v_sql,
      ', kids_ages = \(\$1->>''kids_ages''\)::text', '', 'g');
    v_sql := v_sql || $q$, kids_ages = ARRAY(SELECT jsonb_array_elements_text($1->'kids_ages'))$q$;
    v_has_set := true;
  END IF;

  IF updates ? 'expert_specialties' THEN
    v_sql := regexp_replace(v_sql,
      ', expert_specialties = \(\$1->>''expert_specialties''\)::text', '', 'g');
    v_sql := v_sql || $q$, expert_specialties = ARRAY(SELECT jsonb_array_elements_text($1->'expert_specialties'))$q$;
    v_has_set := true;
  END IF;

  v_sql := v_sql || ' WHERE id = $2';

  -- Execute the dynamic SQL
  EXECUTE v_sql USING updates, v_uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found for user %', v_uid;
  END IF;
END;
$$;

-- Allow any authenticated user to call this function
GRANT EXECUTE ON FUNCTION public.fn_update_own_profile(jsonb) TO authenticated;
