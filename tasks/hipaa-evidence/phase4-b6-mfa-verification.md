# Phase 4 — B6 MFA Verification Guide (TOTP)

## What Was Implemented

| File | Change |
|---|---|
| `src/hooks/useMfaStatus.ts` | New hook — checks TOTP enrollment + AAL level. `STAFF_ACCOUNT_TYPES` narrowed to `['super_admin','superadmin']` (audit had recommended also admin + expert; narrowed by scope decision 2026-05-12). |
| `src/pages/auth/MfaEnrollPage.tsx` | New page `/auth/mfa-enroll` — TOTP QR + manual secret + verify flow |
| `src/pages/auth/MfaChallengePage.tsx` | New page `/auth/mfa-challenge` — AAL1→AAL2 challenge after login |
| `src/components/ProtectedRoute.tsx` | Added `requireMfa` prop — gates super-admin routes via `useMfaStatus` |
| `src/App.tsx` | Added MFA routes; applied `requireMfa={true}` to 5 staff routes (only super-admin actually gated; admin/expert pass through because `useMfaStatus` returns `not_required` for them) |

**Routes that pass `requireMfa={true}` (only super-admin actually challenged):**
- `/admin/super` — Super Admin Portal
- `/admin/products` — Admin Products Page
- `/compliance/training` — Compliance Portal
- `/expert-dashboard` — Expert Dashboard
- `/expert-settings` — Expert Profile Settings

> **Scope decision (2026-05-12):** MFA enforced for `super_admin` / `superadmin` only.
> Admins and experts retain password-only access. If hospital procurement requires
> MFA for all PHI-handling staff, broaden `STAFF_ACCOUNT_TYPES` in
> `src/hooks/useMfaStatus.ts:25` — the rest of the flow handles any role transparently.

---

## ⚠️ Required Manual Step — Enable TOTP in Supabase Dashboard

> **This must be done before testing — otherwise `supabase.auth.mfa.enroll()` will return an error.**

1. Go to **Supabase Dashboard → Authentication → Multi-Factor Auth** (or **Sign In / MFA** depending on dashboard version)
2. Under **"Multi-Factor Authentication"**, enable **TOTP**
3. Set **"Number of MFA factors per user"** to at least `1`
4. Click **Save**

No external service is required for TOTP. Codes are generated locally by the user's authenticator app (Google Authenticator, Authy, 1Password, Bitwarden, Microsoft Authenticator — any standard TOTP app).

---

## Verification Test Plan

### Test 1 — Regular parent user (MFA must NOT trigger)

1. Log in as a regular parent account (`account_type = 'parent'` or null)
2. Navigate to `/dashboard` — loads normally, no MFA prompt
3. `useMfaStatus` returns `not_required`

### Test 2 — Admin / expert (non-superadmin staff — MFA must NOT trigger)

1. Log in as `account_type = 'admin'` or `'expert'`
2. Navigate to `/admin/products` or `/expert-dashboard`
3. **Expected:** Page loads directly. No MFA prompt.
4. `useMfaStatus` returns `not_required` because the role is not in `STAFF_ACCOUNT_TYPES`.

### Test 3 — New super-admin user (not yet enrolled)

1. Log in as `account_type = 'super_admin'` or `'superadmin'`
2. Navigate to `/admin/super`
3. **Expected:** Redirected to `/auth/mfa-enroll?returnTo=%2Fadmin%2Fsuper`
4. QR code appears — scan with Google Authenticator / Authy / 1Password / Bitwarden / Microsoft Authenticator
5. Enter the 6-digit code → click **Verify & Activate**
6. **Expected:** Green success screen → clicking "Continue" lands at `/admin/super`

### Test 4 — Enrolled super-admin (session needs AAL2)

1. Sign out completely, sign back in as the same super-admin
2. Navigate to `/admin/super`
3. **Expected:** Redirected to `/auth/mfa-challenge?returnTo=%2Fadmin%2Fsuper`
4. Enter TOTP code → verify
5. **Expected:** Lands at `/admin/super` (portal loads)

### Test 5 — Verified-in-session stickiness

1. After Test 4 (AAL2 session active)
2. Navigate between admin pages — should NOT be re-challenged
3. Session timeout (15 min idle) → re-login → MFA challenge required again ✅

### Test 6 — Reject tampered access attempt

1. Log in as a regular parent, manually navigate to `/admin/super`
2. **Expected:** No MFA prompt shown (parent is not staff)
3. Super Admin Portal's own RLS / `account_type` checks inside the page block data — admin portal shows "Access denied" or empty state

### Test 7 — Backend factor verification

```sql
SELECT user_id, factor_type, status, friendly_name, created_at
FROM auth.mfa_factors
WHERE factor_type = 'totp'
ORDER BY created_at DESC
LIMIT 10;
```

Expected: at least one row with `status = 'verified'` for the test super-admin.

---

## Evidence to Record

| Check | Result | Date | By |
|---|---|---|---|
| Supabase TOTP setting enabled | _(fill in)_ | _(fill in)_ | _(fill in)_ |
| Test 1 — parent unaffected | _(fill in)_ | _(fill in)_ | _(fill in)_ |
| Test 2 — admin/expert unaffected | _(fill in)_ | _(fill in)_ | _(fill in)_ |
| Test 3 — super-admin enroll flow completes | _(fill in)_ | _(fill in)_ | _(fill in)_ |
| Test 4 — super-admin challenge flow works | _(fill in)_ | _(fill in)_ | _(fill in)_ |
| Test 5 — no re-challenge in session | _(fill in)_ | _(fill in)_ | _(fill in)_ |
| Test 6 — parent blocked from admin data | _(fill in)_ | _(fill in)_ | _(fill in)_ |
| Test 7 — `auth.mfa_factors` row present | _(fill in)_ | _(fill in)_ | _(fill in)_ |

**Verified by:** ________________
**Date:** ________________
