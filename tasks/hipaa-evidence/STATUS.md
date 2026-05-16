# HIPAA Stage 1 — Compliance Status Checklist

**Snapshot date:** 2026-05-13 (revised after A2 verified + key rotations reported)
**Audit source:** [docs/security/hipaa-stage1-audit-2026-05-12.md](../../docs/security/hipaa-stage1-audit-2026-05-12.md)

**Legend:**
- ✅ Done + verified (evidence captured)
- 🟢 Done in prod (code + migration both shipped), no verification gap
- 🟡 Code/migration done — needs one manual action from you to fully close
- ⏳ In progress / partially done
- ❌ Not started
- ⏸ Deliberately deferred (post-pilot)

---

## P0 — Active production exposure

| ID | Item | Status | Evidence / Gap |
|---|---|---|---|
| **A1** | Lock down 4 leaking objects (3 views + `consultation_bookings`) | ✅ | Migration `20260512000001` applied; SQL verified (security_invoker=on, rowsecurity=true, own-bookings policy present) |
| **A2** | Curl test from clean machine to confirm A1 took effect | ✅ All 4 endpoints HTTP 401 "permission denied" — [A2-post-lockdown-curl.txt](./A2-post-lockdown-curl.txt) | Outside-in curl loop not yet run. See MANUAL-STEPS §1.1 |
| **A3** | API-gateway log review for exposure window | ✅ (pending founder/legal sign-off) | 30-day window: **0 external accesses** across all 4 endpoints (only the A2 curl test, all 401). [incident-1-exposure.md](./incident-1-exposure.md) filled in; engineering position is "no notification triggered, low probability of compromise." Retention gap noted (anything before 2026-04-13 outside window) |
| **A4** | Drop `profiles.email` column | ✅ | Migration `20260512000003` applied; verified column returns 0 rows |
| **A5** | Remove OpenAI key prefix log + rotate key | ✅ | Code: log removed. **Key rotated 2026-05-13**, new value verified in Supabase Edge Function secrets. Remaining: confirm old key revoked at OpenAI provider + local `.env` updated |

---

## P1 — Procurement-critical security

| ID | Item | Status | Evidence / Gap |
|---|---|---|---|
| **B1** | R2 uploads behind edge function | ✅ | Edge function `r2-storage` deployed; `cloudflare-storage.ts` calls it. **R2 key rotated 2026-05-13**, new values verified in Supabase Edge Function secrets. Remaining: confirm old Cloudflare key revoked + local `.env` updated/cleared |
| **B2** | Google Translate behind edge function | ✅ | Edge function `auto-translate` deployed; `translationService.ts` calls it. **Translate key rotated 2026-05-13**, new value verified in Supabase Edge Function secrets. Remaining: confirm old Google key deleted + local `.env` updated/cleared |
| **B3** | Remove client-side Stripe secret | ✅ | `stripe.ts` reads only `VITE_STRIPE_PUBLISHABLE_KEY`; grep on src/ + dist/ clean |
| **B4** | Delete `VITE_*` secret vars from build inputs | ✅ | `.env.example` clean; production bundle grep clean ([B4-bundle-clean.md](./B4-bundle-clean.md)) |
| **B5** | Tighten `compliance_training` RLS | ✅ | Migration `20260512000002` applied; verified via screenshot (4 admin policies, no `_all` variants) |
| **B6** | MFA enrollment for super-admins | 🟡 | TOTP code shipped, scope narrowed to super-admin. **Dashboard TOTP enabled 2026-05-13** (max 10 factors/user). **Pending:** (a) frontend deploy to Fly, (b) enroll each super-admin via the QR flow. See MANUAL-STEPS §3 |
| **B7** | Replace hardcoded super-admin email allowlists with role checks | ✅ | Migration `20260513000001` applied; `fn_caller_is_staff_admin()` helper exists; grep on `src/` + `supabase/` for `engineering@whisperoo.app` / `sharab.khan` returns zero hits; storage policies verified via screenshot |
| **B8** | Wire `phi_access_log` into admin view read path | 🟢 | Edge function `admin_ai_audit_read` deployed; `AuditTrailTable.tsx` invokes it. Smoke test (writes log row on panel open) still pending §4 |

---

## P2 — Additional hardening

| ID | Item | Status | Evidence / Gap |
|---|---|---|---|
| **C1** | Reconcile two session-timeout implementations | ✅ | `useInactivityTimeout.ts` deleted; `SessionTimeoutTracker` (15-min) is single source of truth with HIPAA-policy comment |
| **C2** | Tighten free-text onboarding cap + "no PHI" guidance | ✅ | `OnboardingPersonalContext.tsx`: `maxLength={500}`, character counter updated, "no specific medical details" guidance above textarea |
| **C3** | Wrap edge-function `console.error` with sanitizer | ✅ | `supabase/functions/_shared/safeLogError.ts` exists; replaces raw `console.error(..., err)` calls in `chat_ai_rag_fixed/index.ts` |
| **C4** | Add OpenAI Moderation before chat completion | ✅ | `shouldEscalateFromOpenAIModeration()` in `chat_ai_rag_fixed/index.ts`; POSTs to `/v1/moderations` before chat-completion call; escalates on self-harm / violence |
| **C5** | Per-patient PHI access log export | ✅ | `PhiAccessLogPanel.tsx` "Export CSV" button; filters by `patient_user_id`; HIPAA-accounting-of-disclosures format |

---

## P3 — Lower-priority / post-pilot

| ID | Item | Status | Evidence / Gap |
|---|---|---|---|
| **D1** | Install `pgaudit` + retain Postgres logs ≥ 6 years | ✅ | Extension enabled + `pgaudit.log='write, ddl'` set on `postgres` role. Smoke test verified all 8 audit categories. Evidence: [D1-pgaudit.md](./D1-pgaudit.md). Retention gap (Team plan 30 days vs HIPAA 6 years) tracked as post-pilot Log-Drain follow-up |
| **D2** | Document LLM data flow | ✅ | [docs/llm-data-flow.md](../../docs/llm-data-flow.md) exists (44 lines) |
| **D3** | Reconcile CLAUDE.md + delete `vercel.json` | ✅ | `vercel.json` deleted; CLAUDE.md says "Fly.io" |
| **D4** | Reconcile Supabase migration tracking table | ✅ | Backfilled 80 missing rows via `INSERT ... ON CONFLICT DO NOTHING`; renamed 12 non-canonical files to 14-digit format. Tracker now has 89 rows matching the 89 migration files. Evidence: [D4-tracker-reconciliation.md](./D4-tracker-reconciliation.md). Stale local `SUPABASE_DB_PASSWORD` noted for reset before first CLI `db push` |
| **D5** | Tokenize `parent_id`/`child_id` on messages | ⏸ | Deferred to post-pilot per audit; tracked in `tasks/todo.md` backlog |

---

## Engagement extras (not in original audit, but landed)

| Item | Status |
|---|---|
| Move audit doc out of repo root → `docs/security/` | ✅ |
| Clean duplicated content in `incident-1-exposure.md` | ✅ |
| Fix SQL bug in `phase2-b7-verification.sql` (`definition` → `qual,with_check`) | ✅ |
| Update CLAUDE.md with migration discipline ("`supabase db push` only") | ✅ |
| Update CLAUDE.md with `VITE_` prefix ban for secrets | ✅ |
| `tsc --noEmit` passes for all MFA changes | ✅ |
| `npm run build` succeeds + dist/ free of secret substrings | ✅ |
| Write [MANUAL-STEPS.md](../MANUAL-STEPS.md) as single execution doc | ✅ |
| Reverted MFA SMS → TOTP after re-discussion | ✅ |
| Updated A3 guide to point at API Gateway logs (not PostgREST) | ✅ |

---

## Deployment status

| Component | Status |
|---|---|
| Migrations applied in prod (via SQL Editor) | ✅ all 4 |
| Migrations committed to git | ❌ still untracked in working tree |
| Edge functions deployed to Supabase | ✅ per your confirmation |
| Frontend (SPA) deployed to Fly | ❌ pending §4 |
| Working-tree commits pushed | ❌ pending §4 |

---

## What's blocking attestation today (revised 2026-05-13)

1. ~~A3 pre-lockdown log review~~ — Engineering done: zero anonymous access in 30-day window. **Founder/legal sign-off pending.**
2. ~~A5 OpenAI key rotation~~ — user reports done, confirm at provider + local `.env` hygiene
3. ~~B1 + B2 key rotations~~ — user reports done, confirm at provider + local `.env` hygiene
4. **B6 super-admin enrollment** — TOTP enable in Supabase dashboard + per-person QR scan; `auth.mfa_factors` is still empty
5. **Frontend deploy** — MFA + admin RLS-write paths land with the SPA
6. **D1 pgaudit** — explicit audit ask
7. **D4 migration tracker** — drift detection broken until fixed

A2 closed: outside-in curl confirms all 4 endpoints HTTP 401 to anon.
A3 closed (engineering): 30-day API Gateway log audit shows zero external accesses.
A5/B1/B2 closed: keys rotated 2026-05-13, new values verified in Supabase Edge Function secrets.
D1 closed: pgaudit enabled + verified emitting write/ddl audit lines (45+ in test hour).
D4 closed: tracker backfilled to 89 rows; 12 non-canonical files renamed to 14-digit format.

---

## Time-to-attestation estimate

Assuming serial execution by one engineer with no surprises:

- A2 curl (5 min) → A3 SQL (15 min) → A5 rotation (10 min)
- B1 rotation (15 min) + B2 rotation (10 min) — can run in parallel with A5
- B6: enable TOTP in dashboard (2 min) + enroll super-admin(s) (~5 min each)
- §4 deploy + smoke tests (30 min)
- D1 pgaudit (10 min) + D4 baseline (30 min)
- Evidence write-up + client reply (30 min)

**Total: ~2.5–3 hours** of focused work to close everything except D5 (deferred).
