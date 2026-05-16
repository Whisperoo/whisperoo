# D4 — Migration tracker reconciliation

**Date:** 2026-05-13
**Approach:** Backfill via direct `INSERT ... ON CONFLICT DO NOTHING` (no baseline / no schema changes).
**Reason for approach:** preserves full migration history; avoids any risk of schema dump producing SQL that differs from what was actually applied; idempotent if re-run.

## Pre-state

- 9 rows in `supabase_migrations.schema_migrations` (last one: `20250905000001 add_consultation_product_type`)
- 89 migration files in `supabase/migrations/` after cleanup (the empty `20260513120000_baseline_post_pilot.sql` placeholder was removed earlier)
- 80 files missing from tracker (everything from 2026-04-06 onward, including the 4 May-12/13 security migrations)

## Sub-step 1 — Rename 12 non-canonical files

Supabase CLI requires 14-digit `YYYYMMDDHHMMSS_` version prefixes. The following had 8-digit prefixes that would collide and break future `supabase db push`:

| Old name | New name |
|---|---|
| `20260508_backfill_bookings.sql` | `20260508010001_backfill_bookings.sql` |
| `20260508_booking_system.sql` | `20260508010002_booking_system.sql` |
| `20260508_payment_status.sql` | `20260508010003_payment_status.sql` |
| `20260508_sync_payment_status_trigger.sql` | `20260508010004_sync_payment_status_trigger.sql` |
| `20260509_consultation_admin_notes.sql` | `20260509010001_consultation_admin_notes.sql` |
| `20260509_discount_usage_tracking.sql` | `20260509010002_discount_usage_tracking.sql` |
| `20260509_fix_appointment_kpi.sql` | `20260509010003_fix_appointment_kpi.sql` |
| `20260509_inquiry_message.sql` | `20260509010004_inquiry_message.sql` |
| `20260509_product_tenant_scoping.sql` | `20260509010005_product_tenant_scoping.sql` |
| `20260509_update_create_expert_rpc.sql` | `20260509010006_update_create_expert_rpc.sql` |
| `20260510_add_phone_number_to_profiles.sql` | `20260510010001_add_phone_number_to_profiles.sql` |
| `20260510_booking_confirmed_status.sql` | `20260510010002_booking_confirmed_status.sql` |

Renames preserved via `mv` (git tracks as add+delete in this engagement since the originals weren't committed yet).

## Sub-step 2 — Run backfill INSERT in Supabase SQL Editor

File: `D4-tracker-backfill.sql` (86 lines, 80 `VALUES` rows + `ON CONFLICT (version) DO NOTHING;`).

Each row uses `ARRAY['-- backfilled by D4 reconciliation 2026-05-13']::text[]` as the `statements` placeholder — same approach `supabase migration repair --status applied` uses internally.

## Post-state (verified)

Top 10 rows ordered DESC after backfill (from Supabase SQL Editor):

| Version | Name |
|---|---|
| 20260513000001 | phase2_b7_account_type_admin_gate |
| 20260512000003 | confirm_profiles_email_dropped |
| 20260512000002 | tighten_compliance_training_rls |
| 20260512000001 | lockdown_leaking_views_and_consultation_bookings |
| 20260511000001 | cascade_delete_expert_resources |
| 20260510010002 | booking_confirmed_status |
| 20260510010001 | add_phone_number_to_profiles |
| 20260509010006 | update_create_expert_rpc |
| 20260509010005 | product_tenant_scoping |
| 20260509010004 | inquiry_message |

All 4 May-12/13 security migrations present. All renamed non-canonical files present with their new 14-digit versions.

## Going forward

`CLAUDE.md` already enforces: all schema changes via `supabase db push`, never SQL Editor for migrations. CI drift detection (`supabase db diff`, `supabase migration list`) will now work correctly.

The local `SUPABASE_DB_PASSWORD` in `.env` is stale (auth failed during CLI testing). Reset in Supabase Dashboard → Database → Connection string → "Reset database password" before the first `supabase db push`.
