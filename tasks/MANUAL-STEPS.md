# HIPAA Stage 1 — Manual Finishing Steps

> **Companion doc.** Engineering work is complete. The items below are the manual / operational steps that cannot be done in code: secret rotations, dashboard configuration, evidence collection, and a client brief.
>
> Source audit: [docs/security/hipaa-stage1-audit-2026-05-12.md](../docs/security/hipaa-stage1-audit-2026-05-12.md)
> Plan: [`.claude/plans/whisperoo-security-jiggly-bubble.md`](../.claude/plans/whisperoo-security-jiggly-bubble.md)
> Evidence dir: [`tasks/hipaa-evidence/`](./hipaa-evidence/)

---

## TL;DR

| What | Status | Time |
|---|---|---|
| All P0 code/SQL | ✅ shipped (migrations applied via Studio) | — |
| All P1 code | ✅ shipped (edge functions deployed; frontend not yet) | — |
| All P2 code | ✅ shipped | — |
| All P3 code | ✅ shipped except D1 (pgaudit) and D4 (tracker) | — |
| **What you need to do (this doc)** | ⏳ ~4–5 hours total | — |

The work below is grouped by "go do these in order." Mark each `[ ]` as you finish.

---

## §1 — P0 verification & evidence  (≈ 60 min)

### 1.1 Confirm the lockdown took effect (outside-in curl) — **A2**

From a machine that is **not** logged into Whisperoo (your phone hotspot is fine, or any non-corporate network):

```bash
ANON_KEY="<paste from Supabase Dashboard → Project Settings → API → anon public key>"

for OBJ in flagged_messages_view admin_ai_audit_trail tenant_user_details consultation_bookings; do
  echo "=== $OBJ ==="
  curl -sS "https://wznevejkaefokgibkknt.supabase.co/rest/v1/$OBJ?select=*" \
       -H "apikey: $ANON_KEY" | head -c 300
  echo
done
```

- [ ] Each of the 4 outputs is `[]` (empty array) or an HTTP 401/403 error message
- [ ] Save the raw output to `tasks/hipaa-evidence/A2-post-lockdown-curl.txt`

> If any endpoint still returns data, **stop here** and re-investigate the migration — `tasks/hipaa-evidence/phase1-verification.sql` has the schema-level checks.

### 1.2 Schema-level confirmation — **A1 / A4 / B5**

In **Supabase Dashboard → SQL Editor**, paste and run the queries from [tasks/hipaa-evidence/phase1-verification.sql](./hipaa-evidence/phase1-verification.sql).

- [ ] All 3 views show `security_invoker = 'on'`
- [ ] `consultation_bookings.rowsecurity = true`
- [ ] `pg_policies` for `consultation_bookings` includes `"Users can view own bookings"`
- [ ] `profiles.email` column returns **0 rows** (column dropped)
- [ ] `compliance_training` policies are `compliance_admin_read / compliance_admin_update / compliance_admin_delete` (no `_all` variants)

Record results inline in the SQL file or copy outputs to `tasks/hipaa-evidence/phase1-results.txt`.

### 1.3 Phase 2 B7 verification

Run [tasks/hipaa-evidence/phase2-b7-verification.sql](./hipaa-evidence/phase2-b7-verification.sql) in the SQL Editor.

- [ ] `fn_caller_is_staff_admin()` exists, `security_type = 'DEFINER'`
- [ ] `profiles` admin policies reference `fn_caller_is_staff_admin()`, NOT `auth.jwt()->>'email'`
- [ ] `discount_codes`, `products`, `tenants` admin policies reference `fn_caller_is_staff_admin()`
- [ ] Expert-images storage policies reference `fn_caller_is_staff_admin()`
- [ ] Zero rows returned for "policies still referencing engineering@whisperoo or sharab.khan"

### 1.4 Pull API Gateway logs for exposure analysis — **A3 (breach-disclosure decision)**

This is the **single most time-sensitive** task in this document. Until you complete it, the breach-disclosure clock is undefined.

1. **Supabase Dashboard → Logs & Analytics → API Gateway** (NOT PostgREST — PostgREST only captures errors by default; the API Gateway collection captures all HTTP requests)
2. Click the SQL/query mode toggle (top-right of the logs page).
3. Run this query — it filters to the **pre-lockdown** window only, which is the actual breach question (post-lockdown logs just confirm the fix didn't break things):

```sql
SELECT
  timestamp,
  request.method,
  request.path,
  request.search,
  response.status_code,
  request.headers.cf_connecting_ip AS source_ip,
  request.headers.user_agent
FROM edge_logs
WHERE timestamp > now() - interval '7 days'   -- bump to 30 days on Team plan
  AND timestamp < timestamp '2026-05-12 18:00:00+00'  -- pre-lockdown only
  AND (
    request.path LIKE '%flagged_messages_view%'
    OR request.path LIKE '%admin_ai_audit_trail%'
    OR request.path LIKE '%tenant_user_details%'
    OR request.path LIKE '%consultation_bookings%'
  )
ORDER BY timestamp DESC
LIMIT 5000;
```

4. Export → group by `source_ip` and `user_agent` in Excel/Sheets. Flag anything that:
   - Has a non-browser User-Agent (`curl/`, `python-`, `Go-http-`, `wget/`, `Scrapy/`, empty UA)
   - Has an IP that doesn't match your Fly egress (`fly ips list -a <app-name>`), your office/dev IPs, or known CDN edge IPs
   - Has an unusual request shape (no row filter on `consultation_bookings`, generic User-Agent)

5. Decide:
   - **Zero rows returned** → No external scrape detected. Done.
   - **Only browser User-Agents + internal IPs** → Normal admin use. Done.
   - **Any anonymous/scraper-style requests** → Loop in founder + legal **immediately**. 72-hour HIPAA disclosure clock starts at this determination.

6. **Fill in [tasks/hipaa-evidence/incident-1-exposure.md](./hipaa-evidence/incident-1-exposure.md)** — the table at the bottom, plus the "Breach Decision" checkbox.

- [ ] Pre-lockdown query run + result reviewed
- [ ] `incident-1-exposure.md` "PostgREST Log Findings" table filled
- [ ] One of the two "Breach Decision" boxes checked
- [ ] If any unknown IPs found, founder + legal notified

> **Supplemental:** A post-lockdown sample is already documented at [tasks/hipaa-evidence/A3-post-lockdown-sample.md](./hipaa-evidence/A3-post-lockdown-sample.md) (Chrome browsers only, RLS-filtered traffic, no scrape activity). This is *not* a substitute for the pre-lockdown analysis — it's just confirmation that the lockdown didn't break legitimate traffic.

### 1.5 Rotate the OpenAI API key — **A5**

The audit noted that an earlier version of `chat_ai_rag_fixed` logged the first 8 characters of `OPENAI_API_KEY` on every chat request. That code is now removed, but the assumption is "those prefixes have already been seen in Deno logs." Rotate the key:

1. **OpenAI Dashboard → API Keys** → revoke current key, generate a new one
2. **Supabase Dashboard → Edge Functions → Settings → Secrets** → update `OPENAI_API_KEY` to the new value
3. Wait ~30 seconds for propagation
4. Trigger a test chat from a real user account; confirm the AI responds
5. Tail edge logs and confirm no `"starts with"` line is emitted

- [ ] Old OpenAI key revoked
- [ ] New key set in Supabase secrets
- [ ] Test chat works end-to-end
- [ ] Evidence: short screenshot or note at `tasks/hipaa-evidence/A5-openai-rotation.md`

---

## §2 — Bundle-leaked secret rotations  (≈ 60 min)

> **Two ways to push the new values to Supabase Edge Function secrets:** dashboard click-through (described in each subsection) or CLI (faster — see §2.0 below). Pick one; don't mix.

### 2.0 (Optional but recommended) — CLI rotation workflow

`supabase` CLI is already on your PATH. This lets you rotate all secrets in one batch.

```powershell
# 1) One-time setup
supabase login
supabase link --project-ref wznevejkaefokgibkknt

# 2) Create a TEMPORARY env file OUTSIDE the repo (paste new values from
#    Cloudflare / Google Cloud / OpenAI dashboards). Use UTF-8 encoding.
$env_path = "$env:USERPROFILE\whisperoo-secrets-rotation.env"
# (edit $env_path in a text editor — DO NOT commit this file)

# 3) Push to Supabase
supabase secrets set --env-file $env_path --project-ref wznevejkaefokgibkknt

# 4) Verify (lists names only; values are write-only)
supabase secrets list --project-ref wznevejkaefokgibkknt

# 5) DELETE the temp file
Remove-Item $env_path -Force

# 6) Clear PowerShell history (defensive)
Remove-Item (Get-PSReadlineOption).HistorySavePath
```

Expected secret names in the env file:

```
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
GOOGLE_TRANSLATE_API_KEY=...
OPENAI_API_KEY=...
```

Propagation: Edge Functions pick up new values within ~30s on next invocation. No redeploy needed.

**Order of operations for each provider (critical):**
1. Generate new key in the provider's dashboard
2. Push to Supabase via CLI
3. Test in the SPA
4. Only then **revoke** the old key in the provider's dashboard


> **Working assumption from the audit:** *"Assume the data has already been scraped."* The same logic applies to keys that were in every production bundle. The code change moved them server-side, but the **old keys are still valid** until you rotate them.

### 2.1 Cloudflare R2 — **B1 rotation**

1. **Cloudflare Dashboard → R2 → Manage R2 API Tokens** → create a new key pair scoped to your bucket with `Object Read + Write + Delete`
2. **Supabase Dashboard → Edge Functions → Settings → Secrets** → set:
   - `R2_ACCESS_KEY_ID` = (new key ID)
   - `R2_SECRET_ACCESS_KEY` = (new secret)
   - `R2_ENDPOINT` = `https://<account-id>.r2.cloudflarestorage.com` (no change unless you moved accounts)
3. Confirm Supabase Edge Function `r2-storage` is deployed (`supabase functions list`)
4. Test an upload through the SPA (product upload modal, avatar upload, or any expert-image upload)
5. **Revoke the OLD R2 token** in Cloudflare dashboard
6. Wait 5 min, test another upload — must still succeed

- [ ] New R2 key pair created
- [ ] Supabase secrets updated
- [ ] Upload works after rotation
- [ ] **Old R2 key revoked**

### 2.2 Google Translate — **B2 rotation**

1. **Google Cloud Console → APIs & Services → Credentials** → restrict the old key to be unused; create a new API key
2. Restrict the new key:
   - **API restriction:** Translation API only
   - **Application restriction:** none (Supabase Edge Functions don't have stable source IPs)
3. **Supabase Dashboard → Edge Functions → Settings → Secrets** → update `GOOGLE_TRANSLATE_API_KEY` to the new value
4. Trigger a translation in the SPA (Settings → Language → switch to ES or VI)
5. **Delete the OLD key** in Google Cloud Console

- [ ] New Translate key created + restricted to Translation API
- [ ] Supabase secret updated
- [ ] Translation works after rotation
- [ ] **Old Translate key deleted**

### 2.3 Stripe — **B3 sanity check**

Currently `src/services/stripe.ts` only reads `VITE_STRIPE_PUBLISHABLE_KEY` (public, fine). Confirm that:

```bash
# In repo root:
grep -rn 'VITE_STRIPE_SECRET' src/ .env.example fly.toml package.json
# Expected: zero results
fly secrets list -a <app-name>
# Expected: STRIPE_SECRET_KEY is NOT present on Fly. It should live only in Supabase Edge Function secrets.
```

If `STRIPE_SECRET_KEY` appears on Fly (unlikely given the current source), rotate it in **Stripe Dashboard → Developers → API Keys** and remove from Fly.

- [ ] No `VITE_STRIPE_SECRET` in source
- [ ] `fly secrets list` does not include a Stripe secret
- [ ] (If applicable) Stripe key rotated

### 2.4 Confirm B4 lockout

```bash
npm run build
grep -rE 'VITE_.*(SECRET|ACCESS_KEY|GOOGLE_TRANSLATE)' dist/
grep -rE '(sk_live_|sk_test_|R2_SECRET|r2-access-key|GOOGLE_TRANSLATE_API_KEY)' dist/
```

- [ ] Both greps return zero matches (already verified — see [tasks/hipaa-evidence/B4-bundle-clean.md](./hipaa-evidence/B4-bundle-clean.md))

---

## §3 — MFA enrollment (TOTP)  (≈ 20 min — no external service required)

The frontend code is TOTP (authenticator app) based. There is no third-party dependency — codes are generated locally by the user's authenticator app (Google Authenticator, Authy, 1Password, Bitwarden, Microsoft Authenticator).

### 3.1 Enable TOTP in Supabase Auth

1. **Supabase Dashboard → Authentication → Multi-Factor Auth** (or **Sign In / MFA** depending on dashboard version)
2. Toggle **TOTP** to **enabled**
3. Set **"Maximum enrolled factors per user"** to at least `1`
4. **Save**

- [ ] TOTP enabled in Supabase Auth

### 3.2 (HIPAA decision log) Document MFA scope choice

MFA is required for **super_admin / superadmin** only. Admins and experts are not gated. The audit recommended MFA for all PHI-handling staff. Defensible — but it's a downgrade you should document so the hospital procurement questionnaire has the answer ready.

Write a short rationale at `docs/security/mfa-policy.md` (one paragraph is fine). Include:

- [ ] Who is gated (super_admin only) and what factor (TOTP)
- [ ] Why scope is narrow (operational: small number of super-admin accounts; admin/expert paths have separate compensating controls — RLS via `fn_caller_is_staff_admin`, `phi_access_log` writes on every PHI view, password complexity)
- [ ] What it would take to broaden scope (1-line code change — broaden `STAFF_ACCOUNT_TYPES` in `src/hooks/useMfaStatus.ts:25`)
- [ ] Date + author

### 3.3 Enroll each super-admin

After §4 deploy, the next time a super-admin logs in they'll be auto-redirected to `/auth/mfa-enroll`. Walk each through it:

1. Login → redirected to enrollment page
2. Open authenticator app on phone (Google Authenticator / Authy / 1Password / Bitwarden / Microsoft Authenticator — any standard TOTP app)
3. Scan the QR code shown on screen (or copy the manual key fallback)
4. Enter the 6-digit code shown by the app → **Verify & Activate**
5. Redirected to `/admin/super`

Then verify in Studio:

```sql
SELECT user_id, factor_type, status, friendly_name, created_at
FROM auth.mfa_factors
WHERE factor_type = 'totp' AND status = 'verified';
```

- [ ] Every super-admin enrolled
- [ ] `auth.mfa_factors` shows verified TOTP factors for each
- [ ] Each super-admin has stored their authenticator backup (printed recovery codes, password-manager-synced authenticator, or photographed manual-key fallback) — losing the device without a backup means they're locked out (see Appendix C for unenrolling)

---

## §4 — Deploy frontend to Fly + smoke test  (≈ 30 min)

### 4.1 Pre-deploy

```bash
# 1) Fast-forward the local branch
git fetch origin
git rebase origin/main   # or merge — 6 unrelated commits ahead

# 2) Commit the security work in logical chunks (see suggested grouping in plan)
# 3) Push
git push origin main
```

### 4.2 Deploy

```bash
fly deploy
```

### 4.3 Smoke test (browser, against prod)

| Test | Pass? |
|---|---|
| Login as a regular parent → `/dashboard` loads, no MFA prompt | ☐ |
| Login as an admin (non-superadmin) → admin features load, no MFA prompt | ☐ |
| Login as an expert → `/expert-dashboard` loads, no MFA prompt | ☐ |
| Login as a super-admin without enrolled phone → redirected to `/auth/mfa-enroll` | ☐ |
| Complete enrollment → redirected to `/admin/super` | ☐ |
| Sign out and back in → redirected to `/auth/mfa-challenge` → SMS arrives → AAL2 → portal loads | ☐ |
| Open AuditTrail panel → rows visible → confirm new `phi_access_log` row (SQL below) | ☐ |
| Flagged-messages + tenant-user panels still load for admins | ☐ |
| Onboarding personal-context textarea hard-stops at 500 chars + shows "no medical details" guidance | ☐ |
| Session-timeout warning fires at ~14 min idle, signs out at 15 min | ☐ |
| Product upload via SPA still works (R2 flow through edge function) | ☐ |
| Language toggle still translates (Google Translate through edge function) | ☐ |
| PHI Access Log → Export CSV downloads non-empty file | ☐ |

```sql
-- Run after opening AuditTrail panel:
SELECT count(*) FROM phi_access_log
WHERE accessor_user_id = '<your-super-admin-uuid>'
  AND accessed_at > now() - interval '5 minutes';
-- Expected: > 0
```

- [ ] All smoke tests pass

---

## §5 — pgaudit + migration tracker  (≈ 45 min)

### 5.1 Enable `pgaudit` — **D1**

1. **Supabase Dashboard → Database → Extensions** → enable `pgaudit`
2. In SQL Editor:
   ```sql
   ALTER ROLE postgres SET pgaudit.log = 'write, ddl';
   -- OR (if storage allows + you want everything):
   -- ALTER ROLE postgres SET pgaudit.log = 'all';
   ```
3. Confirm `SHOW pgaudit.log;` returns the new value
4. Note your plan's log retention. HIPAA expects ≥ 6 years. Free/Pro plans retain ~7 days; Team/Enterprise can extend. Document the current retention + any plan upgrade decision.

- [ ] `pgaudit` extension enabled
- [ ] `pgaudit.log` set on `postgres` role
- [ ] Retention noted at `tasks/hipaa-evidence/D1-pgaudit.md`

### 5.2 Reconcile migration tracker — **D4** (recommended approach: baseline)

The auditor flagged that ~75 historical migrations are marked "not applied" in `supabase_migrations.schema_migrations` despite the schema reflecting them. The 4 May-12/13 migrations were also applied via SQL Editor, so they're also missing from the tracker. Future `supabase db diff` and CI drift checks are broken until this is fixed.

**Recommended: baseline.** Snapshot current prod, archive old migration files, restart the tracker.

```bash
# 1) Make sure you have the latest schema applied + are authed
supabase login
supabase link --project-ref wznevejkaefokgibkknt

# 2) Dump current prod schema as the new baseline
supabase db dump --schema public --schema storage \
  > supabase/migrations/20260513120000_baseline_post_pilot.sql

# 3) Archive the old migration files (don't delete — keep for history)
mkdir -p supabase/migrations/archive
git mv supabase/migrations/*.sql supabase/migrations/archive/
git mv supabase/migrations/archive/20260513120000_baseline_post_pilot.sql supabase/migrations/

# 4) Reset the tracker so it re-marks the baseline as applied
# In SQL Editor:
#   TRUNCATE supabase_migrations.schema_migrations;
# Then locally:
supabase db push --dry-run    # confirm it only proposes the baseline
supabase db push              # applies (no-op since schema already matches)

# 5) Verify the tracker now has exactly 1 row
# In SQL Editor:
#   SELECT version, name FROM supabase_migrations.schema_migrations;
```

- [ ] Baseline migration file created + committed
- [ ] Old migrations moved to `supabase/migrations/archive/`
- [ ] Tracker truncated + repopulated
- [ ] `supabase migration list --linked` shows only the baseline as applied
- [ ] CLAUDE.md note already added: "always `supabase db push`, never SQL Editor" (done)

> ⚠️ If you'd rather not baseline (because the archived files are useful for git history), the alternative is to **backfill** the tracker row-by-row with `INSERT INTO supabase_migrations.schema_migrations(version, name, statements) VALUES (...)` matching each file. Tedious but reversible.

---

## §6 — Compile evidence & brief client  (≈ 30 min)

### 6.1 Evidence pack

By now `tasks/hipaa-evidence/` should contain:

- [x] `incident-1-exposure.md` — filled in §1.4
- [x] `phase1-verification.sql` — results captured in §1.2
- [x] `phase2-b7-verification.sql` — results captured in §1.3
- [x] `phase3-b8-c5-verification.sql` — to run during §4 smoke test
- [x] `phase4-b6-mfa-verification.md` — filled during §3.3
- [x] `phase4-mfa-provider-setup.md` — filled during §3.1
- [x] `B4-bundle-clean.md` — pre-filled (rerun after §4 build)
- [ ] `A2-post-lactdown-curl.txt` — §1.1
- [ ] `A5-openai-rotation.md` — §1.5
- [ ] `D1-pgaudit.md` — §5.1

Optionally consolidate into `tasks/hipaa-evidence/SUMMARY.md` listing each remediation item (A1–A5, B1–B8, C1–C5, D1–D5), its status, and the evidence file that proves it.

### 6.2 Client reply (template)

Reply to the security-review thread with something like:

> **Subject:** HIPAA Stage 1 — engineering items closed
>
> Hi — quick close-out on the security review items.
>
> **P0 (active exposure):**
> - A1: Four leaking objects locked down via migration `20260512000001` (security_invoker on the 3 views, RLS re-enabled on consultation_bookings, anon revoked). Verified live.
> - A2: Confirmed from a clean network — all 4 endpoints now return `[]`/401 to anon. Output attached.
> - A3: Pulled PostgREST logs for past N days — [N requests across M IPs / no unknown IPs detected → no breach notification required] OR [unknown IPs found — escalated to legal]. Summary in `incident-1-exposure.md`.
> - A4: `profiles.email` column dropped after NULLing 2 stale rows. Verified.
> - A5: OpenAI key prefix log removed; key rotated.
>
> **P1 (procurement-critical):**
> - B1–B4: R2 + Google Translate + Stripe all behind edge functions. `.env.example` cleaned. Production bundle re-grep'd — no `*_SECRET` / `*_ACCESS_KEY` substrings. R2 + Translate keys rotated.
> - B5: `compliance_training` RLS tightened to admin-only (migration `20260512000002`).
> - B6: MFA shipped as TOTP (authenticator app) for super-admin accounts. Scope is super-admin-only (rationale: small role; admin/expert paths have RLS + phi_access_log compensating controls; expansion is a one-line change if procurement requires it). Documented at `docs/security/mfa-policy.md`.
> - B7: Hardcoded `engineering@whisperoo.app` allowlists removed everywhere; replaced with `fn_caller_is_staff_admin()` helper used by all admin RLS + RPC gates (migration `20260513000001`).
> - B8: `phi_access_log` now wired through `admin_ai_audit_read` edge function for every admin view read. Confirmed log row writes on each panel open.
>
> **P2:**
> - C1: 30-min `useInactivityTimeout` deleted; `SessionTimeoutTracker` (15-min) is the single source of truth.
> - C2: Onboarding personal-context cap tightened to 500 chars + "no specific medical details" guidance added above the textarea.
> - C3: `safeLogError` helper sanitizes long fields + sensitive keys; replaces all raw `console.error(err)` calls in `chat_ai_rag_fixed`.
> - C4: OpenAI Moderation API call now precedes every chat completion. Flags self-harm / violence semantically; escalates the response.
> - C5: PHI access log has CSV export filtered by `patient_user_id` (HIPAA accounting of disclosures).
>
> **P3:**
> - D1: pgaudit enabled with `log = 'write, ddl'` on postgres role.
> - D2: LLM data flow documented at `docs/llm-data-flow.md`.
> - D3: `vercel.json` removed; CLAUDE.md updated to reflect Fly deployment.
> - D4: Migration tracker reconciled via baseline (`20260513120000_baseline_post_pilot.sql`). Going forward, all schema changes go through `supabase db push`.
> - D5 (tokenize messages): deferred to post-pilot per the audit; tracking in `tasks/todo.md` backlog.
>
> Evidence pack at `tasks/hipaa-evidence/`. Happy to share specific files if helpful.

Adjust to whatever's actually true after your runs.

- [ ] Reply sent to client thread

---

## Appendix A — Schema changes shipped this engagement

| Migration | Item | Purpose |
|---|---|---|
| `20260512000001_lockdown_leaking_views_and_consultation_bookings.sql` | A1 | Revoke anon access on 4 objects, set `security_invoker = on` on 3 views, enable RLS on `consultation_bookings`, restore own-bookings policy |
| `20260512000002_tighten_compliance_training_rls.sql` | B5 | Drop `compliance_*_all` policies, replace with admin-only versions |
| `20260512000003_confirm_profiles_email_dropped.sql` | A4 | Definitively drop `profiles.email` column (sentinel) |
| `20260513000001_phase2_b7_account_type_admin_gate.sql` | B7 | Create `fn_caller_is_staff_admin()` helper, rewrite admin RLS on `profiles`/`tenants`/`products`/`discount_codes`/expert-images storage, rewrite 4 RPCs (`fn_get_resource_utilization`, `fn_get_admin_dashboard`, `fn_admin_create_expert`, `fn_admin_qr_signup_metrics`) to use it |

All four were applied via Supabase SQL Editor on 2026-05-12/13. After §5.2 baseline they will be folded into the snapshot.

---

## Appendix B — Decisions log (snapshot)

| Decision | Choice | Date | Source |
|---|---|---|---|
| MFA factor type | TOTP (authenticator app) | 2026-05-12 | Audit recommendation; revisited after considering SMS — TOTP is NIST-preferred over SMS, free, no third-party dependency |
| MFA scope | super_admin only | 2026-05-12 | Client preference (vs audit recommendation: admin + super_admin + expert) |
| Migration tracker fix | Baseline (snapshot + archive) vs row-by-row backfill | TBD §5.2 | Audit D4 recommendation either approach acceptable |
| Migration discipline going forward | `supabase db push` only — SQL Editor banned for schema changes | 2026-05-12 | This engagement, recorded in CLAUDE.md |
| `VITE_` prefix for secrets | Banned for any server-only value | 2026-05-12 | This engagement, recorded in CLAUDE.md |
| D5 message tokenization | Deferred to post-pilot | 2026-05-12 | Audit explicitly says "post-pilot" |

---

## Appendix C — Rollback recipes (if smoke test fails)

### Re-leak the views (only if admin UIs are broken and you need to ship a fix first)

```sql
BEGIN;
ALTER VIEW public.flagged_messages_view SET (security_invoker = off);
ALTER VIEW public.admin_ai_audit_trail  SET (security_invoker = off);
ALTER VIEW public.tenant_user_details   SET (security_invoker = off);
ALTER TABLE public.consultation_bookings DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own bookings" ON public.consultation_bookings;
GRANT SELECT ON public.flagged_messages_view, public.admin_ai_audit_trail,
              public.tenant_user_details TO anon, authenticated;
GRANT ALL ON public.consultation_bookings TO anon;
COMMIT;
```

> ⚠️ Only run this if breakage is severe and you need a few hours to land the real fix (B7 admin-bypass policy on base tables, then re-lock the views). The rollback restores the original PHI leak.

### Disable MFA for a locked-out super-admin (lost authenticator device)

```sql
-- Find the factor:
SELECT id, user_id, factor_type, status, friendly_name
FROM auth.mfa_factors
WHERE user_id = '<their-uuid>';

-- Unenroll:
DELETE FROM auth.mfa_factors WHERE id = '<factor-uuid>';
-- Their next login will skip the challenge; they'll be redirected back to /auth/mfa-enroll
-- where they can re-scan a new QR code with whatever device they now have.
```

> ⚠️ **Account recovery process:** Before unenrolling, verify the requester's identity out-of-band (founder confirmation, video call, known phone number callback) — not just "they emailed support." A compromised email account that can request MFA removal defeats the entire MFA control.
