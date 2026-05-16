-- Phase 3 / B8 + C5 Verification Queries

-- ─────────────────────────────────────────────────────────────
-- B8: Confirm phi_access_log receives entries when admin reads audit trail
-- ─────────────────────────────────────────────────────────────

-- Step 1: Note the current row count
SELECT COUNT(*) AS rows_before FROM phi_access_log;

-- Step 2: Open the Audit Trail tab in the Super Admin portal (this triggers
--         admin_ai_audit_read edge function → inserts phi_access_log rows)

-- Step 3: Run again — count must be higher than rows_before
SELECT COUNT(*) AS rows_after FROM phi_access_log;

-- Step 4: Confirm the new entries look correct
SELECT
  accessed_at,
  accessor_role,
  resource_type,
  action,
  reason_code,
  reason_text
FROM phi_access_log
ORDER BY accessed_at DESC
LIMIT 10;
-- Expected: recent rows with action = 'view_audit_row', accessor_role = 'super_admin'/'admin'

-- ─────────────────────────────────────────────────────────────
-- B8: Confirm non-admin session gets 403 from edge function
-- ─────────────────────────────────────────────────────────────
-- (Manual test: log in as a regular parent user, open browser DevTools → Network,
--  attempt to load the audit trail — the admin_ai_audit_read call must return 403)

-- ─────────────────────────────────────────────────────────────
-- C5: Verify CSV export button exists and works
-- ─────────────────────────────────────────────────────────────
-- (Manual test in browser):
-- 1. Open Super Admin Portal → PHI Access Log tab
-- 2. Click "Refresh" to load rows
-- 3. Click "Export CSV" (green button)
-- 4. Verify a file named phi-access-log-YYYY-MM-DD.csv downloads
-- 5. Open the CSV — verify columns:
--    accessed_at, accessor_user_id, accessor_role, patient_user_id,
--    resource_type, resource_id, action, reason_code, reason_text
-- 6. Filter by patient_user_id and export again —
--    filename should include the patient ID prefix: phi-access-log-DATE-patient-XXXXXXXX.csv

-- ─────────────────────────────────────────────────────────────
-- B8: Confirm phi_access_log is append-only (no delete/update possible)
-- ─────────────────────────────────────────────────────────────
-- This will intentionally fail — that's the expected outcome:
-- UPDATE phi_access_log SET reason_text = 'test' WHERE id = (SELECT id FROM phi_access_log LIMIT 1);
-- Expected error: "phi_access_log is append-only"
-- DELETE FROM phi_access_log WHERE id = (SELECT id FROM phi_access_log LIMIT 1);
-- Expected error: "phi_access_log is append-only"
