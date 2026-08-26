-- Migration: Add profiles.account_type
-- Date: 2026-08-26 (backdated filename to 2025-08-19 — see ORDERING below)
-- Purpose: Repair a schema-drift gap discovered while building the staging environment.
--
-- WHY THIS FILE EXISTS
-- --------------------
-- `profiles.account_type` is referenced by 20+ migrations and is the backbone of the
-- entire staff-admin gate (`fn_caller_is_staff_admin`, every admin RLS policy, the
-- expert/admin/super_admin role model). It exists in production:
--
--     character varying(50), nullable, default 'user'::character varying
--
-- ...but **no migration in this repository ever created it.** Verified by grep:
-- 20+ files read `account_type`, zero contain an `ADD COLUMN account_type`.
--
-- It was therefore added to production directly through the Supabase SQL Editor,
-- bypassing `supabase_migrations.schema_migrations` — exactly the practice CLAUDE.md
-- prohibits under "Migration discipline (HIPAA D4)". The drift went unnoticed because
-- production already had the column; it only surfaced when the history was replayed
-- from empty for the first time, where 20250820000001_create_product_tables.sql died
-- with: ERROR: column "account_type" does not exist (SQLSTATE 42703).
--
-- ORDERING
-- --------
-- Filename is dated 20250819000001 so it sorts immediately BEFORE
-- 20250820000001_create_product_tables.sql, the earliest migration that reads the
-- column. Pushing this to production will be an out-of-order migration relative to
-- prod's tracker; that is expected and safe, because:
--
-- SAFETY ON PRODUCTION
-- --------------------
-- `ADD COLUMN IF NOT EXISTS` makes this a strict no-op where the column already
-- exists. On prod it changes nothing and simply records the missing tracker row,
-- bringing the repo and the live schema back into agreement.
--
-- SCOPE
-- -----
-- Column only. The `profiles_account_type_check` CHECK constraint is deliberately NOT
-- created here — it is owned by 20260513000005_widen_account_type_check_and_backfill.sql,
-- which drops and recreates it. Adding it here would duplicate that work and risk a
-- conflicting definition.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_type varchar(50) DEFAULT 'user';

COMMENT ON COLUMN public.profiles.account_type IS
  'Role of the account: user | parent | expert | admin | super_admin | superadmin. '
  'Constrained by profiles_account_type_check, added in 20260513000005.';
