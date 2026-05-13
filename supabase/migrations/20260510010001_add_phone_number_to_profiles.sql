-- Add phone_number column to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone_number text;

-- Update the handle_new_user function to copy phone_number from user metadata
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
