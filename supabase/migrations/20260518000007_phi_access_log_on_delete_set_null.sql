-- phi_access_log.patient_user_id had no ON DELETE action, so deleting an
-- expert profile (or any user profile) raised a FK violation.
-- Change to ON DELETE SET NULL: audit records are preserved for HIPAA
-- compliance but the link to the now-deleted profile is cleared.

ALTER TABLE phi_access_log
  DROP CONSTRAINT phi_access_log_patient_user_id_fkey;

ALTER TABLE phi_access_log
  ADD CONSTRAINT phi_access_log_patient_user_id_fkey
  FOREIGN KEY (patient_user_id)
  REFERENCES profiles(id)
  ON DELETE SET NULL;
