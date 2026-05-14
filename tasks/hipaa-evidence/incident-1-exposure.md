# Incident 1 — Exposure Window Analysis

**Date of discovery:** 2026-05-12
**Discovered by:** Internal security/compliance review
**Remediation date:** 2026-05-12
**Closed date:** 2026-05-14
**Status:** ✅ Fully closed — all actions complete, founder/legal sign-off received

---

## What Was Exposed

Four objects in the `public` schema were readable by **any unauthenticated HTTP request** using the public `VITE_SUPABASE_ANON_KEY` (which is, by design, present in every page load of the SPA). No login was required.

| Object | What Leaked | Row Count at Discovery | Data Sensitivity |
|---|---|---|---|
| `flagged_messages_view` | Full `messages.content` of flagged chats, `user_name`, `tenant_id` | 7 rows | 🔴 High — PHI (chat content) |
| `admin_ai_audit_trail` | Truncated message content (150 chars), cohort code, `tenant_id`, escalation flag | 469 rows | 🔴 High — PHI (message fragments) |
| `tenant_user_details` | Per-user `first_name`, `tenant_id`, `acquisition_source`, `language_preference` | (not measured) | 🟠 Medium — PII |
| `consultation_bookings` | `user_email`, `user_name`, `expert_name`, `amount_paid`, `status` | 90 rows (23 distinct users) | 🔴 High — PHI + financial |

**Root cause:** Views were created without `security_invoker = on` on PostgreSQL 17, so they ran as the view owner (bypassing RLS). `consultation_bookings` additionally had RLS disabled at the table level in production.

---

## Remediation Applied

| Step | Action | Date | By |
|---|---|---|---|
| DB lockdown | Migration `20260512000001_lockdown_leaking_views_and_consultation_bookings.sql` applied via SQL Editor | 2026-05-12 | Engineer |
| View hardening | All 3 views set to `security_invoker = on` | 2026-05-12 | Engineer |
| RLS restored | `consultation_bookings` RLS re-enabled; "Users can view own bookings" policy recreated | 2026-05-12 | Engineer |
| Anon revoke | `REVOKE ALL` on all 4 objects from `anon` role | 2026-05-12 | Engineer |

**Verification queries (run after remediation):**

```sql
-- Views: all must show security_invoker = 'on'
SELECT relname,
  (SELECT option_value FROM pg_options_to_table(reloptions) WHERE option_name='security_invoker') AS si
FROM pg_class
WHERE relname IN ('flagged_messages_view','admin_ai_audit_trail','tenant_user_details');

-- Bookings: must show rowsecurity = true
SELECT tablename, rowsecurity FROM pg_tables WHERE tablename='consultation_bookings';
```

---

## PostgREST Log Review — Completed 2026-05-13

> ✅ **Action complete. No breach notification required.**

1. Go to **Supabase Dashboard → Logs & Analytics → API Gateway** (the PostgREST collection only captures errors; API Gateway captures all HTTP requests)
2. Time range: **Last 30 days** (maximum retention — note the actual lookback your plan supports)
3. Filter path containing any of:
   - `/rest/v1/flagged_messages_view`
   - `/rest/v1/admin_ai_audit_trail`
   - `/rest/v1/tenant_user_details`
   - `/rest/v1/consultation_bookings`
4. For each result, record: total request count, distinct source IPs, earliest and latest timestamp.
5. Cross-reference IPs against known Whisperoo infrastructure below.

**Known Whisperoo IPs to exclude from "unknown" count:**
- Fly.io egress IP(s) for this app (find via `fly ips list -a <app-name>`)
- Your dev machine IP (`curl ifconfig.me`)
- Any Vercel/CDN edge IPs (if still routing — recall `vercel.json` was removed 2026-05-12)

**Audit window:** 30 days (2026-04-13 01:24 → 2026-05-13 02:24 UTC equivalent, Supabase Team plan retention)
**Query method:** Supabase Dashboard → Logs & Analytics → API Gateway → search box, one path string at a time
**Reviewed:** 2026-05-13

| Object | Total Requests | Distinct IPs | First Seen | Last Seen | Unknown External IPs? |
|---|---|---|---|---|---|
| `flagged_messages_view` | 1 | 1 (Claude Code A2 verification) | 2026-05-13 02:02:47 | 2026-05-13 02:02:47 | **No** — only the A2 curl test, which returned 401 |
| `admin_ai_audit_trail` | 1 | 1 (Claude Code A2 verification) | 2026-05-13 02:02:48 | 2026-05-13 02:02:48 | **No** — same |
| `tenant_user_details` | 1 | 1 (Claude Code A2 verification) | 2026-05-13 02:02:49 | 2026-05-13 02:02:49 | **No** — same |
| `consultation_bookings` | 1 | 1 (Claude Code A2 verification) | 2026-05-13 02:02:50 | 2026-05-13 02:02:50 | **No** — same |

**Total external accesses in the 30-day window: 0.** The only requests recorded against these four endpoints are the post-lockdown A2 curl verification (this engagement), all of which correctly returned HTTP 401.

**Retention gap:** Supabase Team plan retains 30 days. Any access *before* 2026-04-13 is outside the auditable window. The leak is older than that window; we can establish no evidence of access in the available period, but cannot affirmatively prove non-access before April 13.

---

## Breach Decision

- [x] **No unknown IPs found within the 30-day audit window** → No breach notification triggered by the available evidence. Engineering position is "low probability of compromise" supported by: (a) zero anonymous reads in 30 days of logs, (b) lockdown verified, (c) the leaked view names are non-obvious internal identifiers not discoverable by generic scrapers.
- [ ] **Unknown IPs found** → N/A (none found)

**Engineering review (Claude Code-assisted):** 2026-05-13
**Final review by:** Founder + counsel
**Decision:** "Low probability of compromise — no notification required"
**Caveat on record:** The 30-day retention window does not cover the full lifetime of the leak. Final sign-off acknowledged this retention boundary.
**Incident closed:** ✅ 2026-05-14 — fully closed
