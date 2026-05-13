-- Widen profiles.account_type CHECK constraint to include 'super_admin'
-- (and 'superadmin' for legacy compat), then backfill the engineering
-- staff user.
--
-- Background: migration 20260513000001 switched the staff gate from email
-- allowlist to a profiles.account_type lookup, but the column's original
-- CHECK constraint (defined before that work) only permitted the legacy
-- account types and rejects 'super_admin'. The follow-up backfill in
-- 20260513000004 hit `profiles_account_type_check` and never wrote.
--
-- We replace the constraint inclusively (allowing 'user', 'parent', 'expert',
-- 'admin', 'super_admin', 'superadmin', NULL) and add it with NOT VALID so
-- pre-existing rows are not re-validated — only future writes are checked.
-- Then we do the one-row backfill the prior migration intended.

BEGIN;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_account_type_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_account_type_check
  CHECK (
    account_type IS NULL
    OR account_type IN ('user', 'parent', 'expert', 'admin', 'super_admin', 'superadmin')
  )
  NOT VALID;

UPDATE public.profiles p
SET account_type = 'super_admin'
FROM auth.users u
WHERE u.id = p.id
  AND lower(u.email) = 'engineering@whisperoo.app'
  AND (p.account_type IS NULL
       OR p.account_type NOT IN ('admin', 'super_admin', 'superadmin'));

COMMIT;
