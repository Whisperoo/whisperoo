# Session Context — Fixes & Changes (2026-07-15)

Running log of all fixes made in this session, in order. All changes are on `main` (no Sprint 2 feature work touched here — these are all bug fixes / hotfixes to production).

---

## 1. Reverted four-metric dashboard redesign
- **Commit:** `872c24a` (revert of `d66b03a`)
- **What:** Reverted the "Add Clicks metric and correct all four resource engagement metrics" change — user asked to undo only this specific push.

## 2. Deleted user `sharab.khan101010@gmail.com`
- Removed the account and all FK-dependent rows (sessions, messages, kids, purchases, etc.) via SQL run directly in Supabase.

## 3. Created superadmin for `airafbhai2003@gmail.com`
- Promoted account to `super_admin` via SQL.

## 4. Fixed `fn_admin_qr_signup_metrics` console error
- **Error:** `column "email" does not exist`
- **Fix:** Ran migration `20260610000007_fix_qr_signups_onboarded_no_email_ref.sql` (function referenced a dropped `profiles.email` column post-HIPAA email removal).

## 5. Unavailable experts appearing in AI chat recommendations
- **Commits:** `eacada3`, `a68adb8`
- **Root cause:** PostgREST's `.neq('expert_availability_status', 'unavailable')` excludes rows where the column is `NULL` — which was most experts, so the filter was silently broken in the opposite direction for some queries and simply never applied in others.
- **Fix:** Changed to `.or('expert_availability_status.is.null,expert_availability_status.neq.unavailable')` across all three expert-lookup queries in `chat_ai_rag_fixed/index.ts`, and rebuilt the `find_similar_experts` RPC the same way (migration `20260613000001_filter_unavailable_experts_from_recommendations.sql`).

## 6. Shivani (Pediatric Oral Development Dentist) not recommended by AI chat
- **Commit:** `2da757a`
- **Root cause:** No dental/oral-health keyword group existed in `SPECIALTY_KEYWORDS` in `chat_ai_rag_fixed/index.ts`.
- **Fix:** Added a full dental keyword group (teeth, tooth, dental, cavity, teething, gums, oral health, etc.) mapped to her exact specialty strings.

## 7. Resource Utilization dashboard mislabeled metrics
- **Commit:** `a0e811d`
- **Root cause:** "Views" was actually showing purchase-backfill rows (`session_id LIKE 'backfill-%'`), and Saves/Downloads weren't wired to real data.
- **Fix:** Rebuilt `fn_get_resource_utilization` (migration `20260613000002_fix_resource_utilization_labels.sql`) to return `total_claims` (purchases), `total_views` (real content-viewer opens, backfill excluded), `total_downloads`, `total_saves` (wishlists), `total_revenue`. Updated `MetricsDash.tsx` columns to Claims | Opens | Downloads | Saves | Revenue Generated.

## 8. Added red `*` required markers to signup form
- **File:** `src/pages/auth/CreateAccount.tsx`
- Added `<span className="text-red-500">*</span>` to First Name, Email, and Password labels (Phone already had it).

## 9. Fixed blank Fly.io deployment
- **Root cause:** Vite inlines `VITE_*` env vars at **build time**. Running `fly deploy` without `--build-arg` flags produced a build with empty env vars → blank site.
- **Fix:** Always deploy with all 6 required build args (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_STRIPE_PUBLISHABLE_KEY`, `VITE_CLOUDFLARE_ACCOUNT_ID`, `VITE_CLOUDFLARE_R2_BUCKET_NAME`, `VITE_CLOUDFLARE_R2_PUBLIC_URL`).
- **Note:** PowerShell doesn't support `\` line continuation — the deploy command must be run as a single line.

## 10. Nurse referral tracking (new feature)
- **Commit:** `3f7421a`
- **Migration:** `20260623000001_nurse_referral.sql` — adds `profiles.referred_by_nurse`, `profiles.referral_hint`, and two SECURITY DEFINER RPCs: `fn_save_nurse_referral` (patient-facing) and `fn_admin_get_tenant_signups` (admin-facing, returns signups + nurse leaderboard).
- **New page:** `src/pages/onboarding/OnboardingReferred.tsx` — new onboarding step at `/onboarding/referred`, inserted between HospitalCheck and Kids. B2C users (no `tenant_id`) auto-skip. Patient enters a nurse's name, or toggles to a free-text description if they don't know the name.
- **Routing:** `App.tsx` new route; `OnboardingHospitalCheck.tsx` redirects to `/onboarding/referred` instead of `/onboarding/kids` after hospital linking (QR users and manual hospital selection both funnel through it).
- **Admin UI:** `TenantConfigEditor.tsx` — new "Signups & Nurse Attribution" section: nurse leaderboard chips + patient table (Patient, Joined, Referred by Nurse, Description, Department).
- **Fixed syntax error:** apostrophe in a single-quoted string (`'We'll continue...'`) broke the build — changed to double quotes.

## 11. Scrollable Signups & Nurse Attribution table
- **Commit:** `02a7065`
- Table now has `max-h-80 overflow-auto` with a sticky header, so the section stays a fixed height regardless of patient count instead of growing unbounded.

## 12. Superadmin rapid re-renders (fast-refresh flicker)
- **Commit:** `5764c8e`
- **Root cause:** `TenantConfigEditor.tsx` had three independent `useCallback`/`useEffect` pairs (`fetchTenant`, `fetchQrCodes`, `fetchSignups`), each firing its own `setState` on completion — three sequential re-renders per `tenantId` change.
- **Fix:** Consolidated into a single `fetchAll` using `Promise.all`, so all three queries resolve in one React state batch. Kept `fetchTenant`/`fetchQrCodes` as aliases so existing QR create/toggle/delete refresh calls still work.

## 13. Patient detail modal in Signups & Nurse Attribution
- **Commit:** `bb031c6`
- Clicking a patient row now opens a `Dialog` showing name, joined date, department, referred-by-nurse, and the **full untruncated** description (previously truncated in the table cell). Rows got an indigo hover + pointer cursor to signal clickability.

## 14–15. Product thumbnail image cropping / not filling hero area
- **Commits:** `bebfc5e`, `79555d0` (second commit supersedes the first)
- **Root cause:** The image wrapper `<div className="relative">` had no explicit height, so the `<img>`'s `h-full` resolved to nothing and the image only rendered at its natural intrinsic size, leaving gray space in the `aspect-video` container.
- **First attempt** (`bebfc5e`): made the wrapper `absolute inset-0` to force-fill the `aspect-video` box — this fixed the "not expanding" symptom but caused `object-cover` to crop images that didn't match a 16:9 ratio.
- **Correct fix** (`79555d0`): Removed the fixed `aspect-video` ratio entirely. Image now renders at `w-full h-auto` (natural proportions, no cropping). Fallback/placeholder states use `min-h-[200px]` instead of `h-full` so they don't collapse when there's no thumbnail.

## 16. Expert creation failing with generic "non-2xx status code"
- **Commit:** `344a916`
- Fixed access-check logic and made the `admin-create-expert` Edge Function surface its real error message (e.g. "A user with this email address has already been registered") instead of a generic 500, so admins can actually see why creation failed.

## 17. Deleted user `nnavni3+3@gmail.com`
- Removed the account and all FK-dependent rows via SQL run directly in Supabase (same pattern as item 2).

## 18. Video/audio uploads failing in superadmin Content panel ("Failed to save")
- **Commit:** `4829c53`
- **Migration:** `20260715000001_allow_video_audio_in_resource_files.sql`
- **Root cause:** The `resource-files` Supabase Storage bucket's `allowed_mime_types` (set back in `20260508000002_supabase_storage_expert_and_resources.sql`) only included PDFs/Word/PowerPoint/text/images — **no `video/*` or `audio/*` type was ever added** — and `file_size_limit` was capped at 50MB. Any video upload from `AdminProductForm.tsx` (which uploads directly to this bucket, separate from the Cloudflare R2 path used by the expert self-serve dashboard) was rejected outright by Supabase Storage.
- **Fix:** Additive `UPDATE` on the bucket row — added `video/mp4`, `video/webm`, `video/quicktime`, `video/x-msvideo`, `video/x-ms-wmv`, and `audio/*` MIME types; raised `file_size_limit` to 500MB. No schema drop, consistent with the "migrations are additive only" rule.
- **Open item at the time:** flagged that a project-wide Supabase Storage upload cap could still override the bucket-level limit — this is exactly what happened next (see item 19).

## 19. Video uploads still failing after item 18 ("object exceeded maximum allowed")
- **Commit:** `e4b41c2`
- **Root cause:** Confirmed the follow-up flagged in item 18 — Supabase Storage enforces a **project-wide upload size ceiling** (Dashboard-only setting, not controllable via SQL/migration) on top of the per-bucket `file_size_limit`. Raising the bucket limit to 500MB didn't help because the project-wide cap silently overrides it. This was the third tier of the same underlying problem: `AdminProductForm.tsx` was the only large-media upload path in the app still going through Supabase Storage — every other path (expert's own product uploads via `ProductEditModal.tsx`/`products.ts`, profile images) already uses Cloudflare R2 via presigned URLs specifically to avoid this.
- **Fix:** Rewired `AdminProductForm.tsx`'s `uploadPublic()` helper to upload via `uploadFileWithRetry` from `cloudflare-storage.ts` (R2 presigned PUT) instead of `supabase.storage.from(bucket).upload(...)`. Same function signature, so no call-site changes needed. R2 has no project-wide ceiling in this app, ending the tiered-limit whack-a-mole permanently instead of raising another number that would just get hit again on a larger file.

---

## Migrations added this session (run in order if setting up a fresh environment)
1. `20260613000001_filter_unavailable_experts_from_recommendations.sql`
2. `20260613000002_fix_resource_utilization_labels.sql`
3. `20260610000007_fix_qr_signups_onboarded_no_email_ref.sql`
4. `20260623000001_nurse_referral.sql`
5. `20260715000001_allow_video_audio_in_resource_files.sql`

## Edge Functions redeployed this session
- `chat_ai_rag_fixed` (dental keywords + availability filter)
- `admin-create-expert` (real error surfacing)

## Frontend fix (no migration, code-only)
- `AdminProductForm.tsx` — admin content uploads now go through Cloudflare R2 instead of Supabase Storage (item 19). Requires only a Fly.io redeploy, no DB migration.

## Fly.io deploys this session
Multiple redeploys, all using the full 6-arg `--build-arg` command (see item 9). Fly auth expired once mid-session (`no access token available`) — resolved by the user running `fly auth login` interactively; deploys resumed normally after.
