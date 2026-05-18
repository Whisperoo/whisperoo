-- Fix fn_update_own_profile: cast `role` column to user_role enum, not text.
--
-- Root cause: the dynamic SQL builder fell through to the default `::text` cast
-- for the `role` column. PostgreSQL cannot implicitly coerce text to a custom
-- enum (user_role), so saving profile changes that include `role` raised:
--   "column 'role' is of type user_role but expression is of type text"

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
  v_sql text := 'UPDATE public.profiles SET updated_at = NOW()';
  v_has_set boolean := false;

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

  FOR v_col IN SELECT jsonb_object_keys(updates)
  LOOP
    IF v_col = ANY(v_allowed_columns) THEN
      v_sql := v_sql || format(', %I = ($1->>%L)::', v_col, v_col);

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
      ELSIF v_col IN ('role', 'user_role') THEN
        v_sql := v_sql || 'user_role';
      ELSE
        v_sql := v_sql || 'text';
      END IF;
      v_has_set := true;
    END IF;
  END LOOP;

  -- Array columns need special handling (not simple text cast)
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

  EXECUTE v_sql USING updates, v_uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found for user %', v_uid;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_update_own_profile(jsonb) TO authenticated;
