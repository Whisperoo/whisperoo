-- Backfill phone_number into profiles for users who signed up before
-- migration 20260510010001 added phone_number to the handle_new_user trigger.
-- Those users have phone_number in auth.users.raw_user_meta_data but NULL in profiles.

UPDATE public.profiles p
SET phone_number = u.raw_user_meta_data->>'phone_number'
FROM auth.users u
WHERE u.id = p.id
  AND (p.phone_number IS NULL OR p.phone_number = '')
  AND u.raw_user_meta_data->>'phone_number' IS NOT NULL
  AND u.raw_user_meta_data->>'phone_number' != '';
