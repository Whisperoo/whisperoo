# Whisperoo - Security / Compliance Review May 12 2026

HIPAA Stage 1 — Engineering Action Items

## P0 — Fix today (active production exposure)

These are not theoretical. Each one is an active vulnerability that any visitor can reach right now using the public anon key (which is, by design, in every page of the SPA).

### A1. Lock down the four leaking objects in Supabase

**Why:** Three views and one table in the `public` schema are readable by any unauthenticated request that includes the `VITE_SUPABASE_ANON_KEY` (which is, by design, in every page of the SPA). Confirmed against production 2026-05-12:

| Object                | Anon SELECT? | Bypasses RLS?                                                               | Live row count              | What leaks                                                                     |
| --------------------- | ------------ | --------------------------------------------------------------------------- | --------------------------- | ------------------------------------------------------------------------------ |
| flagged_messages_view | ✅            | ✅ security_invoker unset on PG 17 → runs as view owner                      | 7 rows                      | Full messages.content of flagged chats + user_name + tenant_id                 |
| admin_ai_audit_trail  | ✅            | ✅ same                                                                      | 469 rows                    | Truncated message content (150 chars), cohort code, tenant_id, escalation flag |
| tenant_user_details   | ✅            | ✅ same                                                                      | (not measured)              | Per-user first_name, tenant_id, acquisition_source, language_preference        |
| consultation_bookings | ✅            | ✅ RLS disabled at the table level in prod despite the migration enabling it | 90 rows (23 distinct users) | user_email, user_name, expert_name, amount_paid, status                        |

Any visitor can `curl https://wznevejkaefokgibkknt.supabase.co/rest/v1/flagged_messages_view?select=*` with `apikey: <anon_key>` and dump those rows. No login required. **Assume the data has already been scraped.** **What:** Run this SQL in a transaction so you can roll back if anything breaks (Supabase Studio → SQL Editor, or via Management API):

```sql
BEGIN;
```

\-- 1. Revoke anon (and authenticated) access to the four exposed objects
REVOKE ALL ON public.flagged_messages_view FROM anon, authenticated;
REVOKE ALL ON public.admin_ai_audit_trail  FROM anon, authenticated;
REVOKE ALL ON public.tenant_user_details   FROM anon, authenticated;
REVOKE ALL ON public.consultation_bookings FROM anon;

\-- 2. Recreate views with security_invoker so RLS on base tables applies
ALTER VIEW public.flagged_messages_view SET (security_invoker = on);
ALTER VIEW public.admin_ai_audit_trail  SET (security_invoker = on);
ALTER VIEW public.tenant_user_details   SET (security_invoker = on);

\-- 3. Re-enable RLS on consultation_bookings (prod has rowsecurity=false today)
ALTER TABLE public.consultation_bookings ENABLE ROW LEVEL SECURITY;

\-- 4. Add back the "Users can view own bookings" policy from migration 20260508
--    (live prod is missing this — only "Users can create own bookings" and
--    "Admins full access" exist)
CREATE POLICY "Users can view own bookings"
ON public.consultation_bookings
FOR SELECT
USING (auth.uid() = user_id);

\-- 5. Re-grant view SELECT to authenticated only. With security_invoker on,
--    RLS on base tables now filters results to what the caller may see.
GRANT SELECT ON public.flagged_messages_view, public.admin_ai_audit_trail,
public.tenant_user_details TO authenticated;

\-- Before COMMIT: smoke-test the admin UIs below in a parallel tab. If they
-- return empty / break, ROLLBACK and address the cause before retrying.
COMMIT;

```other

```

**Safety / rollback:** Switching the views from security-definer to security-invoker means the views now run with the *caller's* RLS context. Admin UIs that previously relied on the bypass will now see only rows their RLS policies permit. Before `COMMIT`, smoke-test:

- `src/pages/admin/AuditTrailTable.tsx` (reads `admin_ai_audit_trail`)
- The flagged-messages admin panel (reads `flagged_messages_view`)
- Any tenant/user-management screens (read `tenant_user_details`)
- The consultation-bookings admin view (now RLS-gated)

If an admin lists comes back empty, it means the underlying base tables (`messages`, `sessions`, `profiles`) don't have an admin-friendly RLS policy keyed on `account_type IN ('admin','super_admin')`. Either `ROLLBACK;` and land B7/B8 first (so admin reads go through an edge function with `service_role`), or add a temporary admin-bypass policy on the base tables and then proceed.

If you've already committed and need to revert:

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

The rollback restores the leak — only use it if the alternative is admin features being broken in front of users.

**Verification:** Run `SELECT relname, (SELECT option_value FROM pg_options_to_table(reloptions) WHERE option_name='security_invoker') AS si FROM pg_class WHERE relname IN ('flagged_messages_view','admin_ai_audit_trail','tenant_user_details');` — all three rows must show `si = on`. Run `SELECT rowsecurity FROM pg_tables WHERE tablename='consultation_bookings';` — must be `true`. Then move on to A2. **Refs:** Incident 1 · P1.4

### A2. Confirm the A1 lockdown closed the hole from outside

**Why:** A revoke that doesn't take is worse than no revoke — gives false confidence. The schema-level proof from A1's verification step isn't sufficient on its own; we need to confirm the actual public endpoint rejects the request. **What:** From a fresh browser/curl (no logged-in session), against each of the four objects from A1:

```other
ANON_KEY=...  # pull from Supabase dashboard → Project Settings → API → anon public key
for OBJ in flagged_messages_view admin_ai_audit_trail tenant_user_details consultation_bookings; do
  echo "=== $OBJ ==="
  curl -sS "https://wznevejkaefokgibkknt.supabase.co/rest/v1/$OBJ?select=*" -H "apikey: $ANON_KEY" | head -c 200
  echo
done
```

**Verification:** Each call must return either `[]` (empty array, RLS now filters everything) or HTTP 401/403. If any call still returns rows, A1 didn't take — re-investigate before claiming the fix. **Refs:** Incident 1 (see A1)

### A3. Pull PostgREST logs to estimate the A1 exposure window

**Why:** HIPAA breach-notification obligations depend on what was accessed and when. The four objects in A1 were publicly readable for some unknown period before today; we need to know whether unknown IPs ever hit those endpoints. If they did, this becomes a breach-disclosure conversation with counsel. **What:** Supabase dashboard → Logs → PostgREST. Filter on `path =~ /rest/v1/(flagged_messages_view|admin_ai_audit_trail|tenant_user_details|consultation_bookings)` for the past 30 days (max retention on default plans). Group by source IP, count requests, note any non-Whisperoo IP. **Verification:** Produce a short summary at `tasks/hipaa-evidence/incident-1-exposure.md`: total request count, distinct IPs, first-seen date, last-seen date. Hand to founder/legal for the breach-disclosure decision. **Refs:** Incident 1 (see A1)

### A4. Re-run the "drop profiles.email" migration for real

**Why:** Migration `20260504000001_hipaa_remove_email` claims to drop the `email` column from `profiles`, but live state shows the column still present with 2 stale values. The migration didn't take effect end-to-end. As long as the column exists, those 2 rows are PHI that the email-removal HIPAA work failed to clean up. **What:** Decide what to do with the 2 stale rows first — `SELECT id, email FROM profiles WHERE email IS NOT NULL;` to see them. Either `UPDATE profiles SET email = NULL` or migrate the addresses to another store if there's a real reason. Then write a fresh migration that runs `ALTER TABLE profiles DROP COLUMN email` and apply it (`supabase db push` or via Studio). **Verification:** `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='email';` returns zero rows. **Refs:** P0.4

### A5. Delete the OpenAI API-key prefix log

**Why:** `supabase/functions/chat_ai_rag_fixed/index.ts:1105` logs the first 8 chars + length of `OPENAI_API_KEY` on every chat request. Anyone with read access to Deno logs (Supabase dashboard → Edge Functions → Logs) can collect those prefixes over time. After deletion, rotate the OpenAI key on the assumption the prefix has already been observed. **What:** Remove the `console.log` at line 1105 (the one that includes `starts with: ${openaiApiKey.substring(0, 8)}`). Redeploy the edge function: `supabase functions deploy chat_ai_rag_fixed`. Coordinate with whoever owns OpenAI billing to rotate the key. **Verification:** `grep -n "starts with" supabase/functions/chat_ai_rag_fixed/index.ts` returns nothing. Send a chat from a test account; tail edge-function logs to confirm no key-prefix line is emitted. **Refs:** P1.1 · P1.10

---

## P1 — High priority (security & compliance critical)

These are the items a hospital procurement/security questionnaire will ask about directly. None of them ship a feature; all of them close a class of risk.

### B1. Move R2 uploads behind an edge function

**Why:** **Active leak — R2 write credentials in the public JS bundle.** Vite inlines `VITE_`-prefixed env vars into the production bundle at build time. `src/config/cloudflare.ts:12-13` reads `VITE_CLOUDFLARE_R2_ACCESS_KEY_ID` + `VITE_CLOUDFLARE_R2_SECRET_ACCESS_KEY`, which `src/services/cloudflare-storage.ts:22-29` uses to build an S3 client in the *browser*. Anyone who opens DevTools → Sources can extract these and gain read/write/delete on every object in the R2 bucket. Even if R2 currently holds only product files, the credentials let an attacker upload anything (malware, PHI exfiltrated elsewhere) served from your CDN domain. Highest severity of the three bundle-leak variables — write access to a customer-facing storage layer. **What:** New edge function `r2-upload` that accepts a file, validates the caller, and either signs a presigned URL or proxies the upload using server-side credentials. Frontend calls the edge function; never touches R2 directly. Move `VITE_CLOUDFLARE_R2_ACCESS_KEY_ID` + `VITE_CLOUDFLARE_R2_SECRET_ACCESS_KEY` from Vite env into Supabase Edge Function secrets (rename without `VITE_` prefix). **Verification:** Build a production bundle (`npm run build`) and `grep -r "VITE_CLOUDFLARE_R2_SECRET" dist/` — should return zero hits. Test an upload from the SPA end-to-end and confirm a new file appears in R2. **Refs:** P1.10

### B2. Move Google Translate calls behind the existing edge function

**Why:** **Active leak — Google Translate API key in the public JS bundle.** Same root cause as B1: `src/services/translationService.ts:21` reads `import.meta.env.VITE_GOOGLE_TRANSLATE_API_KEY` and uses it directly from the browser, so the key is in every production build's JS. Lower severity than R2 — capability is quota theft / financial DoS rather than data write — but the fix pattern is identical. **What:** Route translation through the existing `supabase/functions/auto-translate/` edge function. Remove the direct call site in `translationService.ts`. The edge function already has access to a `GOOGLE_TRANSLATE_API_KEY` secret (verified live in Supabase secrets). **Verification:** `grep -r "VITE_GOOGLE_TRANSLATE_API_KEY" dist/` returns nothing. Trigger a translation in the UI and confirm it still works. **Refs:** P1.10

### B3. Remove client-side Stripe secret usage

**Why:** **Potential leak — Stripe secret in the public JS bundle.** Same root cause as B1. `src/services/stripe.ts:229` reads `import.meta.env.VITE_STRIPE_SECRET_KEY`. If a production deploy ever passes a real secret key into that var, it's in the bundle and can be used to issue charges, refunds, and read all Stripe data on the live account. Today the fallback string is benign (`sk_test_mock_key_for_development`) — but the read itself is the bug, and there's nothing stopping a future deploy from injecting a live key. **What:** Move any code path that uses the Stripe *secret* key into `supabase/functions/create-payment/` (or a sibling). The frontend should only ever read `VITE_STRIPE_PUBLISHABLE_KEY`, never `VITE_STRIPE_SECRET_KEY`. **Verification:** `grep -n "VITE_STRIPE_SECRET_KEY" src/` returns nothing. `grep -r "VITE_STRIPE_SECRET" dist/` (after a prod build) returns nothing. Stripe payment flow still works end-to-end. **Refs:** P1.10

### B4. Delete VITE_* secret vars from build inputs (lockout after B1–B3)

**Why:** B1–B3 each remove one `import.meta.env.VITE_…` lookup from source. But the `VITE_` prefix convention means anyone could reintroduce the leak by adding the same name back to `.env.example` or a deploy script — Vite would happily inline it again. B4 is the lockout: drop the var names from every build input so the re-entry door is shut. **What:** Remove `VITE_STRIPE_SECRET_KEY`, `VITE_CLOUDFLARE_R2_ACCESS_KEY_ID`, `VITE_CLOUDFLARE_R2_SECRET_ACCESS_KEY`, `VITE_GOOGLE_TRANSLATE_API_KEY` from `.env.example`, any deploy script (Fly build args, CI), and any local `.env` files. Add a one-line note in `CLAUDE.md` or a `CONTRIBUTING.md`: "Never use `VITE_` prefix for anything that should be server-only." **Verification:** `grep -rE 'VITE_.*(SECRET|ACCESS_KEY)' .env.example fly.toml package.json src/ supabase/` returns nothing. **Refs:** P1.10

### B5. Tighten `compliance_training` RLS

**Why:** The current policies (`compliance_read_all`, `compliance_update_all`, `compliance_delete_all`) all have `qual: true` — any authenticated user can read, edit, or delete every Q&A pair. The table is used as a self-learning store and can contain real user queries that include PHI. Today, a logged-in parent could read another tenant's training data; tomorrow they could tamper with it. **What:** Add a migration that drops the three open policies and replaces them with admin-only versions:

```sql
DROP POLICY IF EXISTS compliance_read_all   ON public.compliance_training;
DROP POLICY IF EXISTS compliance_update_all ON public.compliance_training;
DROP POLICY IF EXISTS compliance_delete_all ON public.compliance_training;
```

CREATE POLICY "compliance_admin_read"
ON public.compliance_training FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()
AND account_type IN ('admin','super_admin')));
CREATE POLICY "compliance_admin_update"
ON public.compliance_training FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()
AND account_type IN ('admin','super_admin')));
CREATE POLICY "compliance_admin_delete"
ON public.compliance_training FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()
AND account_type IN ('admin','super_admin')));
-- Keep compliance_insert_own as-is.

```other

```

**Verification:** From a non-admin authenticated session, `SELECT count(*) FROM compliance_training` returns 0. From an `account_type='super_admin'` session it returns the real count. Confirm `SELECT policyname, qual FROM pg_policies WHERE tablename='compliance_training'` shows all four expected policies with non-`true` quals (except the insert policy's check). **Refs:** P1.4 · P1.8

### B6. Add MFA enrollment for admins/experts

**Why:** `auth.mfa_factors` is empty across all 135 production users. Hospital security questionnaires explicitly ask whether PHI-handling accounts use MFA — the answer today is "no." Admin and expert accounts touch PHI directly; parents are lower-risk but still worth offering MFA to. **What:** Build a TOTP enrollment flow using Supabase Auth's `mfa.enroll` / `mfa.challenge` / `mfa.verify` API. Gate it behind an "Account Security" tab. Make it *required* for `account_type IN ('admin','super_admin','expert')` — block access to admin/expert routes until enrolled. Offer it optionally to parents. **Verification:** `SELECT factor_type, status, count(*) FROM auth.mfa_factors GROUP BY 1,2;` returns a non-empty result after at least one admin enrolls. Attempt to access an admin route from a session whose user has `account_type='admin'` but no MFA factor — should be redirected to the enrollment flow. **Refs:** P1.5

### B7. Replace hardcoded super-admin email allowlist with role checks  *(do before B8)*

**Why:** Three different places hardcode `engineering@whisperoo.app` (and one hardcodes `sharab.khan101010@gmail.com`) as the super-admin gate: `src/pages/admin/SuperAdminPortal.tsx:18-21`, `supabase/functions/admin_phi_conversation/index.ts:32-35`, and the DB function `fn_get_admin_dashboard` (allows only that one email). This is a shared role-style mailbox masquerading as a personal account — no per-person accountability, and adding a new admin requires a code change. **What:** Replace all three allowlists with `profile.account_type IN ('admin','super_admin')`. Provision per-person accounts and set their `account_type='super_admin'`. Once no callsite reads the email allowlist, delete the constants. **Land this before B8** because B8 will route new admin reads through an authorization gate that should already use the unified `account_type` check. **Verification:** `grep -rn "engineering@whisperoo.app\|sharab.khan101010" src/ supabase/` returns zero hits. Log in as an `account_type='super_admin'` user with a different email and confirm super-admin features work. **Refs:** P1.6

### B8. Wire `phi_access_log` into the admin view read path  *(depends on B7)*

**Why:** The append-only `phi_access_log` table is well-designed but underused: only 1 row exists in production. The `admin_phi_conversation` edge function writes audit rows correctly, but the three admin views (`flagged_messages_view`, `admin_ai_audit_trail`, `tenant_user_details`) and Supabase Studio access bypass it. Hospitals will ask for "show me every time an employee read patient X's chat" — we can answer that today only for one access path. Depends on B7 because the new authorization gate inside the edge function/RPC should use the unified `account_type` check, not a copy of the email allowlist. **What:** Wrap each view read in an edge function (or `SECURITY DEFINER` RPC) that (a) confirms the caller is admin/super_admin via `account_type`, (b) inserts a `phi_access_log` row, then (c) returns rows from the view. Update `src/pages/admin/AuditTrailTable.tsx:83` and any other view consumers to call the edge function instead of querying the view directly. Revoke direct view SELECT from `authenticated` once the edge function is in place. For Supabase Studio access, see D1 (`pgaudit`). **Verification:** Open the admin audit trail in the UI; immediately `SELECT count(*) FROM phi_access_log WHERE accessor_user_id = '<your-uuid>' AND accessed_at > now() - interval '5 minutes';` must show new rows. From a non-admin session, the new edge function returns 403. **Refs:** P1.7

---

## P2 — Medium priority (additional hardening)

Lower urgency than P1 but each is a clear gap a sharp auditor would flag.

### C1. Reconcile the two session-timeout implementations

**Why:** `SessionTimeoutTracker` (15-min, mounted globally at `src/App.tsx:56`) and `useInactivityTimeout` (30-min, mounted in `src/components/navigation/AppLayout.tsx:26`) both run simultaneously on every authed page. The shorter wins, so the 30-min warning + UX is dead code, and we have two competing sources of truth for "what's our session policy." Pick one, document it, delete the other. **What:** Keep `SessionTimeoutTracker` (15-min is more HIPAA-aligned). Delete `useInactivityTimeout` and its mount in `AppLayout.tsx:26`. Add a one-line comment in `SessionTimeoutTracker.tsx` stating the policy. **Refs:** P3.2

### C2. Tighten free-text onboarding cap and add "no PHI" guidance

**Why:** `OnboardingPersonalContext.tsx:73` already sets `maxLength={1000}` on the personal-context textarea (and shows a `{count}/1000 characters` counter at lines 76-80) — so it's not unbounded, but 1000 chars still fits a paragraph of medical history. The current bottom-of-page note ("Your personal data will not be shared through the Whisperoo community or to any third party organizations.") says nothing about *not entering* PHI. The "minimum necessary" principle says we should both shrink the cap and warn the user up front. **What:** In `src/pages/onboarding/OnboardingPersonalContext.tsx`: change `maxLength={1000}` → `maxLength={500}` (and update the counter text accordingly), and add a short `<p className="text-xs text-gray-500">` *above* the Textarea reading something like "Please share context, not specific medical details — your care provider is the right place for medical history." **Verification:** Open the onboarding personal-context step; the textarea hard-stops at 500 chars and a guidance line appears above it. **Refs:** P0.4

### C3. Wrap edge-function `console.error` with a sanitizer

**Why:** Several `console.error` paths in `chat_ai_rag_fixed/index.ts` (lines 1128, 1141, 1146, 1150) re-emit `lastError` which can echo back the OpenAI request body on certain failure modes — and the request body contains chat content and child names. Today nothing parses these logs, but Supabase retains them and they may be auditable. **What:** A small helper `safeLogError(label, err)` that strips fields longer than 256 chars and removes known sensitive keys (`messages`, `content`, `first_name`, `birth_date`) before logging. Replace direct `console.error(…, err)` calls with `safeLogError(…)`. **Refs:** P1.1

### C4. Add OpenAI Moderation before chat completion

**Why:** Current escalation detection is keyword-only (`chat_ai_rag_fixed/index.ts:76-92`) — misses paraphrases like "I want to disappear." OpenAI's Moderation API is free, low-latency, and catches `self-harm` / `violence` semantically. Adding it lifts the safety floor for the AI chat without changing the human-review workflow. **What:** Before the chat-completion call, POST to `https://api.openai.com/v1/moderations` with the user message. If `flagged: true` for `self-harm` or `violence`, set `intent='escalation'` and return the escalation response. **Refs:** P2.1

### C5. Build the per-patient PHI access log export

**Why:** HIPAA gives patients the right to request an accounting of disclosures. `phi_access_log` already supports `WHERE patient_user_id = ?`, but there's no UI to export. Without it, a patient request becomes a manual SQL query. **What:** Add a "Export access history" button to `src/pages/admin/PhiAccessLogPanel.tsx` that downloads a CSV of rows for a selected `patient_user_id`. Re-uses the existing `admin_phi_access_log` edge function. **Refs:** P3.3

---

## P3 — Lower-priority / post-pilot

Items that improve the long-term security posture but aren't urgent.

### D1. Install `pgaudit` and retain Postgres logs

**Why:** Today, an admin running queries in Supabase Studio leaves no audit trail. If anyone ever asks "did anyone query patient X's data outside the app?" we can't answer. `pgaudit` solves this at the database level — much harder to bypass than app-level logging. **What:** Enable the extension in Supabase dashboard → Database → Extensions. Configure `pgaudit.log = 'write, ddl'` (or `'all'` if storage allows) on the `postgres` role. Confirm logs are retained ≥ 6 years per HIPAA. **Refs:** P1.7

### D2. Document the LLM data flow

**Why:** Hospital procurement packets often include a "data flow diagram" requirement. We send child first_name + birth_date + previous-session summaries + raw user message to OpenAI; under a BAA this is fine, but it must be written down so the procurement team can answer the questionnaire without re-reading the codebase. **What:** A one-pager at `docs/llm-data-flow.md` describing exactly which fields go to OpenAI in the system prompt, what's logged, what's retained where, and that OpenAI is covered by BAA. **Refs:** P0.8

### D3. Reconcile CLAUDE.md and delete unused vercel.json

**Why:** `CLAUDE.md:63` claims deployment is on Vercel; the actual deployment is Fly. `vercel.json` still exists at repo root. Any future engineer onboarding will be confused and may push to the wrong place. Not a security item, just hygiene. **What:** Update `CLAUDE.md` to say Fly. Delete `vercel.json` after confirming nothing references it. **Refs:** —

### D4. Reconcile the Supabase migration tracking table

**Why:** `supabase migration list --linked` shows ~75 migrations as "not applied" in the remote tracking table, even though the live schema confirms they were applied (we proved this against `pg_tables`, `information_schema.columns`, etc.). This means future drift detection won't work — if someone really does forget to push a migration, the tracking table won't help us catch it because it's already lying. **What:** Decide whether to (a) backfill the tracking table to match reality, or (b) start fresh with a baseline migration that snapshots current prod and supersedes everything before it. Either way, get the tracker honest. **Refs:** —

### D5. Tokenize parent_id/child_id on messages (post-pilot)

**Why:** Today `messages.content` lives in the same row as `session_id → sessions.user_id → profiles.id`. Direct identifiability in two joins. Acceptable for pilot under a BAA; not great long-term. Separating identifier from content adds a defense-in-depth layer for the day when (not if) some other RLS bug or admin-grant misconfiguration exposes message content. **What:** Introduce a rotating token column on `messages` that maps to user/child via a server-side function. Migrate the SPA to read messages by token. Decryption stays inside an edge function with the service role. **Refs:** P3.1

