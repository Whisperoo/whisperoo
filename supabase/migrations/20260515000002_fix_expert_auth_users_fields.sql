-- Fix: Expert auth.users rows created by fn_admin_create_expert have NULL
-- in fields GoTrue expects to be empty strings. This causes a 500
-- "Database error querying schema" response from GoTrue's /token endpoint
-- during login even though the session is created successfully.
--
-- Affected fields: confirmation_token, recovery_token, email_change_token_new,
-- email_change_token_current, phone_change_token.

UPDATE auth.users u
SET
  confirmation_token      = COALESCE(confirmation_token, ''),
  recovery_token          = COALESCE(recovery_token, ''),
  email_change_token_new  = COALESCE(email_change_token_new, ''),
  email_change_token_current = COALESCE(email_change_token_current, ''),
  phone_change_token      = COALESCE(phone_change_token, '')
FROM public.profiles p
WHERE p.id = u.id
  AND p.account_type = 'expert'
  AND (
    confirmation_token IS NULL
    OR recovery_token IS NULL
    OR email_change_token_new IS NULL
    OR email_change_token_current IS NULL
    OR phone_change_token IS NULL
  );
