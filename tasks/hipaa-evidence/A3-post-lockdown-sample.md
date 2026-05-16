# A3 — Post-lockdown log sample (supplemental evidence)

**Sampled:** 2026-05-12, ~1 hour after lockdown migration applied
**Source:** Supabase Dashboard → Logs & Analytics → API Gateway (CSV export)
**Scope:** Two CSV exports, ~13 entries total, post-lockdown only

## What the sample shows

| Endpoint | Method | Count | Status | User-Agents | Auth shape |
|---|---|---|---|---|---|
| `consultation_bookings` | GET | 11 | 200 | Chrome (Windows + Mac) | Filtered by `user_id=eq.<own-uuid>&status=in.(pending,confirmed)` — single logged-in parent fetching their own pending bookings |
| `consultation_bookings` | GET | 1 | 200 | Chrome Mac | `?select=*&order=booked_at.desc` — admin bookings panel, response now RLS-filtered to allowed rows |
| `consultation_bookings` | OPTIONS | 1 | 200 | Chrome Windows | CORS preflight |
| `admin_ai_audit_trail` | GET | 1 | 200 | Chrome Mac | Admin reading audit panel; response now RLS-filtered via `security_invoker = on` |

All entries: real-browser User-Agents, HTTP 200, no anomalous request shape.

## What this proves

- ✅ The lockdown did **not** break the legitimate post-lockdown traffic pattern.
- ✅ RLS is filtering correctly — the one admin `select=*` query still returns to the admin without error (server-side filter applied).
- ✅ No anonymous/scraper requests visible in the sample.

## What this does NOT prove

This sample is **post-lockdown only**. It says nothing about the pre-lockdown exposure window, which is the actual A3 question. See `incident-1-exposure.md` for the pre-lockdown log review that still needs to be completed.

To complete the breach-disclosure determination, run the SQL recipe documented in `incident-1-exposure.md` and `MANUAL-STEPS.md §1.4` against the **pre-lockdown** time window (anything before 2026-05-12 ~18:00 UTC).

---

**Sample collected by:** (engineer)
**Sample reviewed by:** (engineer)
**Date:** 2026-05-12
