-- Ensure phone_number column exists (migration 20260510010001 may not have been applied on prod)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone_number text;

-- Update handle_new_user to include phone_number going forward
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, first_name, phone_number)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'first_name', ''),
    new.raw_user_meta_data->>'phone_number'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Backfill phone_number for all existing users who have it in auth metadata but not in profiles
UPDATE public.profiles p
SET phone_number = u.raw_user_meta_data->>'phone_number'
FROM auth.users u
WHERE u.id = p.id
  AND (p.phone_number IS NULL OR p.phone_number = '')
  AND u.raw_user_meta_data->>'phone_number' IS NOT NULL
  AND u.raw_user_meta_data->>'phone_number' != '';
