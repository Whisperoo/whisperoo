-- Drop FK constraints on phi_access_log so expert/user profiles can be deleted.
--
-- phi_access_log is an immutable append-only HIPAA audit trail. Its purpose
-- is to record THAT a UUID was accessed at a point in time. It does NOT need
-- FK enforcement — if the referenced profile is later deleted, the UUID in the
-- log is still meaningful as a historical record. ON DELETE RESTRICT was too
-- strict: it made it impossible to delete test experts or inactive accounts.
--
-- Both patient_user_id and accessor_user_id FKs are dropped for the same reason.
-- The NOT NULL constraints are preserved so new rows still require valid values
-- at INSERT time.

ALTER TABLE public.phi_access_log
  DROP CONSTRAINT IF EXISTS phi_access_log_patient_user_id_fkey;

ALTER TABLE public.phi_access_log
  DROP CONSTRAINT IF EXISTS phi_access_log_accessor_user_id_fkey;
