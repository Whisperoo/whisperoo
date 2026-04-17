# Whisperoo Hospital Pilot — Week 2 Deliverables

> **Sprint:** Week 2 · Hospital Resource Prioritization & Patient Engagement  
> **Period:** April 14–17, 2026  
> **Status:** ✅ All SOW items implemented and build-verified

---

## Table of Contents

1. [Completed SOW Items](#completed-sow-items)
2. [Day 1 — QR/URL Onboarding & Data Isolation (2.1, 2.2, 2.3)](#day-1--qrurl-onboarding--data-isolation)
3. [Day 2 — Hospital Resource Prioritization (3.1, 3.2, 3.3, 3.4)](#day-2--hospital-resource-prioritization)
4. [Day 3 — Resource Filter & Care Checklists (3.5, 4.1)](#day-3--resource-filter--care-checklists)
5. [Client Testing Guide](#client-testing-guide)
6. [Deployment Checklist](#deployment-checklist)
7. [Pending Client Decisions](#pending-client-decisions)

---

## Completed SOW Items

| SOW | Requirement | Day | Status |
|-----|-------------|-----|--------|
| 2.1 | QR/URL onboarding with department tracking | Day 1 | ✅ |
| 2.2 | Organic fallback for self-affiliation | Day 1 | ✅ |
| 2.3 | Tenant-scoped data isolation (RLS) | Day 1 | ✅ |
| 3.1 | Hospital experts rank first in listings | Day 2 | ✅ |
| 3.2 | Hospital experts surface first in AI search | Day 2 | ✅ |
| 3.3 | Direct contact info on hospital expert profiles | Day 2 | ✅ |
| 3.4 | Hospital contact displayed on dashboard | Day 2 | ✅ |
| 3.5 | Filter toggle for hospital resources | Day 3 | ✅ |
| 4.1 | Care checklist auto-generated from birth/due date | Day 3 | ✅ |

---

## Day 1 — QR/URL Onboarding & Data Isolation

### 2.1 — QR/URL Onboarding with Department Tracking

**What was built:**
- Users who scan a hospital QR code or click a hospital URL (e.g., `/create-account?dept=maternity`) are automatically affiliated with the hospital.
- The `dept` query parameter is captured, stored in the user's profile as `acquisition_department`, and used to personalize their dashboard.
- The sign-up page shows a branded welcome message when a department parameter is present.

**Files changed:**
- `src/pages/auth/CreateAccount.tsx` — reads `?dept=` query parameter
- `src/contexts/AuthContext.tsx` — passes department to profile creation
- `supabase/migrations/20260414000001_add_acquisition_department.sql` — added column

---

### 2.2 — Organic Fallback (Self-Affiliation)

**What was built:**
- Users who sign up organically (no QR code) see a new onboarding step: **"Are you a patient at a partner hospital?"**
- If they select a hospital, they are linked to that tenant. If they select "No," they proceed as a standard B2C user.
- This step auto-skips if the user already has a `tenant_id` from QR signup or if no active hospital tenants exist.

**Files changed:**
- `src/pages/onboarding/OnboardingHospitalCheck.tsx` — new onboarding step
- `src/pages/onboarding/OnboardingRole.tsx` — routes to hospital check
- `src/pages/onboarding/OnboardingKids.tsx` — updated back navigation
- `src/App.tsx` — registered new route

**Onboarding flow is now:**  
`Role → Hospital Check → Kids → Kids Count → Kids Ages → Dashboard`

---

### 2.3 — Tenant-Scoped Data Isolation

**What was built:**
- Created tenant-scoped database views (`tenant_user_summary`, `tenant_user_details`) that only expose data belonging to users within the same hospital tenant.
- Implemented explicit Row-Level Security (RLS) policies on `sessions` and `messages` tables to enforce data isolation at the database layer.
- No B2C user data can leak to hospital admin views.

**Files changed:**
- `supabase/migrations/20260414000002_tenant_scoped_rls_enforcement.sql`

---

## Day 2 — Hospital Resource Prioritization

### 3.1 — Hospital Experts Rank First in Listings

**What was built:**
- On the **Experts** page (`/experts`), hospital-affiliated experts automatically appear at the top of results for hospital users.
- Boosted experts show a **"Recommended by [Hospital Name]"** badge with a purple ring highlight.
- The results count shows **"· Hospital partners shown first"** for hospital users.
- B2C users see the standard rating-based ordering with no badges.

**Files changed:**
- `src/pages/ExpertProfiles.tsx` — tenant-aware sorting, badge rendering

---

### 3.2 — Hospital Experts Surface First in AI Chat

**What was built:**
- The AI chat edge function now fetches the user's `tenant_id` and `expert_boost_ids` before generating responses.
- A new `prioritizeByTenant()` function sorts matched experts in 3 tiers:
  1. **Tier 1:** Hospital-affiliated experts (matching tenant or in boost list)
  2. **Tier 2:** Platform experts by similarity score
  3. **Tier 3:** Platform experts by rating
- The AI system prompt includes a **Hospital Expert Priority** instruction when hospital experts are in the results, telling the AI to recommend them first.
- B2C users see zero change — the tenant pipeline only activates when `tenant_id` is set.

**Files changed:**
- `supabase/functions/chat_ai_rag_fixed/index.ts` — 6 changes across 5 functions
- `supabase/migrations/20260416000001_update_find_similar_experts_rpc.sql` — added `tenant_id` to RPC return
- `supabase/migrations/20260416000002_seed_test_expert_boost.sql` — seeded test data

---

### 3.3 — Direct Contact on Hospital Expert Profiles

**What was built:**
- When a hospital user views a hospital-affiliated expert's profile, a **"Hospital Partner"** card appears below the main profile.
- This card shows the hospital name, a note that the expert is part of their care network, and clickable **phone** and **email** buttons pulled from the tenant's department configuration.
- Non-hospital users and non-affiliated experts do not see this card.

**Files changed:**
- `src/pages/ExpertDetails.tsx` — hospital partner contact section

---

### 3.4 — Hospital Contact on Dashboard

**What was built:**
- The dashboard hospital banner now shows the user's **department** (e.g., "Your department: MATERNITY").
- The user's own department contact button is **highlighted in indigo** to stand out from other departments.
- A new **"Hospital Partner Experts"** quick-link card navigates directly to the `/experts` page.

**Files changed:**
- `src/pages/Dashboard.tsx` — department context, highlighted contact, quick-link card

---

## Day 3 — Resource Filter & Care Checklists

### 3.5 — Resource Filter Toggle

**What was built:**
- Hospital users see a **"Hospital Partners"** toggle button in the filter bar on the Experts page.
- When activated, the button turns solid indigo and only hospital-affiliated experts are shown.
- The results count updates to **"· Showing hospital partners only"**.
- B2C users do not see this toggle.

**Files changed:**
- `src/pages/ExpertProfiles.tsx` — filter toggle state + UI

---

### 4.1 — Care Checklists

**What was built:**

**Database:**
- `care_checklist_templates` — admin-defined checklist items per developmental stage
- `care_checklist_progress` — per-user, per-child completion tracking
- 31 universal seed templates across 7 stages and 4 categories

**Stage Calculator:**
- Automatically determines a child's developmental stage from `birth_date` or `due_date`
- 7 stages: Expecting T1/T2/T3, Newborn (0-3m), Infant (3-6m), Infant (6-12m), Toddler (12-24m)

**Dashboard Widget:**
- Per-child expandable cards with animated gradient progress bars
- Tap-to-complete items with instant optimistic UI updates
- Category badges: 🏥 Medical, 🎯 Milestone, 🛡️ Safety, 🍼 Nutrition
- Hospital phone number displayed on medical items when available
- Completion celebration when all items are checked
- Auto-expands the first child's checklist on load

**Files changed:**
- `supabase/migrations/20260417000001_care_checklist_tables.sql`
- `supabase/migrations/20260417000002_seed_universal_checklists.sql`
- `src/utils/stageCalculator.ts`
- `src/components/dashboard/CareChecklist.tsx`
- `src/pages/Dashboard.tsx`

---

## Client Testing Guide

### Prerequisites

Before testing, ensure:
1. All SQL migrations have been run in the Supabase SQL Editor (see [Deployment Checklist](#deployment-checklist))
2. The frontend has been deployed with the latest build
3. The `chat_ai_rag_fixed` edge function has been redeployed

---

### Test Scenario 1: QR/URL Hospital Onboarding (SOW 2.1)

**Steps:**
1. Open the app with a department parameter: `https://your-app.com/create-account?dept=maternity`
2. Create a new account

**Expected Results:**
- ✅ The sign-up page shows a branded welcome message mentioning the hospital
- ✅ After completing onboarding, the dashboard shows the hospital banner
- ✅ The banner displays **"Your department: MATERNITY"**

---

### Test Scenario 2: Organic Self-Affiliation (SOW 2.2)

**Steps:**
1. Open the app normally (no `?dept=` parameter): `https://your-app.com/create-account`
2. Create a new account
3. Complete the Role selection step

**Expected Results:**
- ✅ After the Role step, you see a screen: **"Are you a patient at a partner hospital?"**
- ✅ Selecting a hospital links you to that tenant (dashboard shows hospital banner)
- ✅ Selecting "No, I'm using Whisperoo independently" skips to the next step with no hospital branding

---

### Test Scenario 3: Hospital Expert Ranking (SOW 3.1)

**Steps:**
1. Log in as a hospital-affiliated user
2. Navigate to the **Experts** page (`/experts`)

**Expected Results:**
- ✅ Hospital-affiliated experts appear at the **top** of the list
- ✅ These experts have a purple ring around their card
- ✅ These experts show a badge: **"Recommended by [Hospital Name]"**
- ✅ Below the search bar, it says: **"· Hospital partners shown first"**

---

### Test Scenario 4: AI Chat Expert Boosting (SOW 3.2)

**Steps:**
1. Log in as a hospital-affiliated user
2. Open the **Chat Genie**
3. Ask a question related to a hospital expert's specialty (e.g., "My baby won't sleep" if the boosted expert is a Sleep Coach)

**Expected Results:**
- ✅ The AI response mentions the hospital-affiliated expert **by name** before any other experts
- ✅ The expert recommendation feels natural and relevant to the question

**Comparison test:**
1. Log in as a standard B2C user
2. Ask the same question

**Expected Results:**
- ✅ The AI recommends experts based on relevance and rating only — no hospital bias

---

### Test Scenario 5: Direct Contact on Expert Profile (SOW 3.3)

**Steps:**
1. Log in as a hospital-affiliated user
2. Navigate to an expert who is affiliated with your hospital (they'll have the "Recommended" badge)
3. Open their profile

**Expected Results:**
- ✅ Below the main profile card, you see a blue **"Hospital Partner"** card
- ✅ The card shows: **"[Hospital Name] Partner - This expert is part of your hospital's care network"**
- ✅ Department phone numbers and email links are displayed as clickable buttons
- ✅ Tapping a phone number opens the dialer; tapping email opens the mail client

**Comparison test:**
1. As the same hospital user, open a **non-affiliated** expert's profile

**Expected Results:**
- ✅ The hospital partner card is **not visible** — only the standard profile and booking options appear

---

### Test Scenario 6: Dashboard Hospital Branding (SOW 3.4)

**Steps:**
1. Log in as a hospital-affiliated user who signed up via QR with `?dept=maternity`

**Expected Results:**
- ✅ The hospital banner shows: **"Your department: MATERNITY"** below the hospital name
- ✅ The "Maternity" department contact button is highlighted in indigo (visually distinct)
- ✅ Below the banner, a **"Hospital Partner Experts"** card is visible with a building icon
- ✅ Tapping it navigates to `/experts`

**Comparison test (B2C user):**
- ✅ No hospital banner, no department label, no hospital experts card

---

### Test Scenario 7: Hospital Filter Toggle (SOW 3.5)

**Steps:**
1. Log in as a hospital-affiliated user
2. Navigate to **Experts** page
3. Click the **"Hospital Partners"** toggle button in the filter bar

**Expected Results:**
- ✅ The button turns solid indigo and reads **"Hospital Only"**
- ✅ Only hospital-affiliated experts are displayed in the grid
- ✅ The results count shows: **"· Showing hospital partners only"**
- ✅ Clicking again toggles back to show all experts

**Comparison test (B2C user):**
- ✅ The toggle button is **not visible** — only the search bar and specialty dropdown appear

---

### Test Scenario 8: Care Checklist — Born Child (SOW 4.1)

**Steps:**
1. Log in as a user who has a child with a `birth_date` set (e.g., born 6 weeks ago)
2. Go to the **Dashboard**

**Expected Results:**
- ✅ A **"Care Checklist"** section appears below the Chat Genie card
- ✅ A card shows the child's name, stage (e.g., **"Newborn (0-3 months)"**), and age (e.g., **"6 weeks old"**)
- ✅ A progress bar shows completion (e.g., "0/6")
- ✅ Tapping the card expands it to show checklist items
- ✅ Each item has a category badge (Medical, Milestone, Safety, or Nutrition)
- ✅ Tapping an item checks it — the checkbox fills in, a strikethrough appears, and the progress bar updates
- ✅ Tapping again unchecks it
- ✅ When all items are checked, a green celebration banner appears: **"All done! Great job 🎉"**

---

### Test Scenario 9: Care Checklist — Expecting Parent (SOW 4.1)

**Steps:**
1. Log in as a user who is expecting (has `due_date` set, e.g., due in 8 weeks)
2. Go to the **Dashboard**

**Expected Results:**
- ✅ The checklist card shows a clock icon and the label **"Third Trimester"**
- ✅ The age description shows something like: **"32 weeks pregnant · Due in 8 weeks"**
- ✅ Checklist items are trimester-appropriate (e.g., "Pack hospital bag", "Install car seat")

---

### Test Scenario 10: Care Checklist — No Children (SOW 4.1)

**Steps:**
1. Log in as a user with no children added OR a child older than 24 months

**Expected Results:**
- ✅ The Care Checklist section **does not appear** on the dashboard — no empty state, no broken UI

---

### Test Scenario 11: Data Isolation (SOW 2.3)

**Steps:**
1. Log in as Hospital A's admin user
2. Check the `tenant_user_summary` and `tenant_user_details` views in the Supabase table editor

**Expected Results:**
- ✅ Only users with `tenant_id` matching Hospital A appear in the views
- ✅ B2C user data is **completely invisible** to hospital admin views
- ✅ Hospital B user data is **completely invisible** to Hospital A

---

## Deployment Checklist

Run these SQL files **in order** in the Supabase SQL Editor:

| # | Migration File | Purpose |
|---|---|---|
| 1 | `20260414000001_add_acquisition_department.sql` | Adds `acquisition_department` column to profiles |
| 2 | `20260414000002_tenant_scoped_rls_enforcement.sql` | RLS policies on sessions/messages + admin views |
| 3 | `20260416000001_update_find_similar_experts_rpc.sql` | Updates RPC to return `tenant_id` |
| 4 | `20260416000002_seed_test_expert_boost.sql` | Seeds test `expert_boost_ids` in tenant config |
| 5 | `20260417000001_care_checklist_tables.sql` | Creates checklist tables |
| 6 | `20260417000002_seed_universal_checklists.sql` | Seeds 31 universal checklist templates |

**Edge Function:**
```bash
npx supabase functions deploy chat_ai_rag_fixed
```

---

## Pending Client Decisions

> **Hospital-Specific Checklist Content**
>
> The care checklist system currently uses **universal templates** that apply to all users. The infrastructure fully supports **hospital-specific templates** (scoped via `tenant_id` on the `care_checklist_templates` table), including a `hospital_phone` field that displays a scheduling phone number on medical items.
>
> **We need the client to provide:**
> - Hospital-specific checklist items they want to add (if any)
> - Department phone numbers to display on medical checklist items
> - Any additional developmental stages or categories they require
>
> Once provided, these can be added as a single SQL seed migration with zero code changes.
