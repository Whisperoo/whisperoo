# Whisperoo — Operational Flows

**Version:** 1.0  
**Date:** 2026-05-14  
**Audience:** Compliance team, hospital partners, onboarding staff

This document describes every user-facing flow in Whisperoo from three perspectives: **Parent/User**, **Expert**, and **Super Admin**.

---

## 1. Parent / User Flows

### 1.1 Sign-Up & Onboarding

**Hospital QR path (affiliated signup):**
1. Parent scans QR code posted in hospital (e.g., OB/GYN ward).
2. Browser opens `https://whisperoo.app/auth/create?tenant=<hospital-slug>`.
3. Parent enters name, email, and password. Account is created in Supabase Auth.
4. `profiles.tenant_id` is set to the hospital's tenant ID; `acquisition_source` is recorded (e.g., `qr_ob`, `qr_er`).
5. Onboarding wizard starts:
   - **Role selection** — Expecting, New Parent, or Parent of toddler+
   - **Child profiles** — Birth/due dates, names, genders
   - **Topics of interest** — Up to 12 topics (Lactation, Sleep Coaching, Pelvic Floor, etc.)
   - **Parenting styles** — Multi-select
6. On completion, `profiles.onboarded = true`. User lands on Dashboard.

**Organic path (whisperoo.app signup):**
1. Parent signs up at `https://whisperoo.app/auth/create` (no tenant query param).
2. Onboarding prompts: "Are you a patient at [Hospital]?" — affirmative routes through hospital affiliate flow; negative completes as B2C user.

**Language selection:**
- Available at any point in onboarding and via Settings.
- Stored as `profiles.language_preference` (en/es/vi).
- All UI strings, AI responses, and expert bios render in the selected language.

---

### 1.2 Dashboard

After login, the parent sees:
- **Welcome greeting** with first name.
- **Chat Genie card** — launches AI chat.
- **Recommended for You** — personalised product/consultation list based on onboarding topics and purchase history (weighted blend that shifts over 30 days toward behavioural signals).
- **Your Bookings** — shows pending/confirmed consultation bookings with quick-link to appointments tab.
- **Post-Delivery Prompt** — if the parent has an expecting child, prompts to record birth and update checklist.
- **Care Reminders** — appointment-stage checklists (prenatal T1, birth plan, 48hr post-discharge, 3-week postpartum, pediatrician schedule).
- **Explore Experts** card — navigates to expert directory.
- **Contact/Concierge** card — links to support email.

Hospital users additionally see a hospital branding banner (logo, primary color, department contacts) driven by tenant config.

---

### 1.3 Chat Genie (AI Chat)

1. Parent selects a child profile or "General" from the ChildSwitcher.
2. Parent types a message.
3. Frontend saves the message to `messages` table (`role: 'user'`).
4. `chat_ai_rag_fixed` Edge Function is called:
   - **Pre-moderation** — message sent to OpenAI `/v1/moderations`; if flagged for self-harm or violence, the response escalates immediately.
   - **Context assembly** — `fn_get_chat_context` returns child profile + session summary + recent messages.
   - **RAG** — pgvector similarity search on `expert_documents` injects relevant expert knowledge.
   - **LLM call** — OpenAI generates a response constrained by system-prompt guardrails.
   - **Escalation check** — keyword scan for clinical triggers; if matched, "See your provider" language is injected.
5. Assistant response saved to `messages` table (`role: 'assistant'`).
6. Periodically, `fn_update_session_summary` condenses the session into `sessions.summary`.
7. All messages are stored append-only and visible to admins in the Audit Trail panel.

**Escalation examples that always trigger "See your provider":**  
chest pain, difficulty breathing, seizure, high fever in infant, signs of postpartum psychosis, self-harm, emergency keywords.

---

### 1.4 Find Experts

1. Parent browses the expert directory.
2. Hospital users see their hospital's affiliated experts ranked first, then Whisperoo experts, then best-match.
3. Parent views an expert profile (bio, specialties, credentials, availability).
4. **Inquiry consultation** (free): Parent taps "Request Consultation" → booking recorded in `consultation_bookings` (status: pending) → expert is notified → expert contacts parent within 24 hours.
5. **Direct consultation** (paid): Parent taps "Book Now" → Stripe PaymentElement shown → payment processed → `consultation_bookings` record created (status: pending) → confirmation page shown.

---

### 1.5 Resources (Products)

1. Parent browses Whisperoo Resources and/or Hospital Resources tabs.
2. **Free document/video** — Taps "Save" → added to wishlist or "My Content" immediately.
3. **Paid document/video** — Taps "Purchase Now" → Stripe checkout → file available in "My Content" → downloadable.
4. **Consultation** — See §1.4.
5. Discount codes can be applied at checkout (percentage or fixed amount).

---

### 1.6 My Content

Three tabs:

| Tab | Content |
|---|---|
| **Content** | Purchased documents and videos. Download button triggers `verify-purchase` Edge Function which proxies the R2 file securely. |
| **Appointments** | Consultation bookings from `consultation_bookings`. Shows status (Pending / Confirmed / Completed). Unique constraint prevents duplicates. |
| **Saved** | Wishlisted items. Remove from wishlist available. |

---

### 1.7 Profile & Settings

- Edit name, phone, profile picture.
- Language preference toggle (English / Español / Tiếng Việt).
- Child profile management (add/edit/delete children).
- Account deletion (planned post-pilot).

---

## 2. Expert Flows

Experts are created by super admin — they do not self-register. An expert account is a `profiles` row with `account_type = 'expert'`.

### 2.1 Expert Profile (Public)

Each expert has:
- First name, bio, profile photo, specialties, credentials, years of experience, consultation rate, availability status.
- Linked to a tenant if they are a hospital expert (`tenant_id` set).
- Products/consultations associated with `expert_id`.

### 2.2 Booking Notification

When a parent books a consultation with an expert:
1. A `consultation_bookings` record is created (status: `pending`).
2. The `ConsultationBookingsPanel` in super admin shows the new booking.
3. Super admin (or the expert directly) reaches out to the parent via the contact information captured at signup.
4. Admin updates the booking status to `confirmed` or `completed` via the admin panel.

> **Note:** Expert-facing self-service portal (view own bookings, mark complete) is scoped for post-pilot. Currently all booking lifecycle management goes through super admin.

### 2.3 Expert Content

- Documents, videos, and consultations are published under the expert's name.
- Tags on each product control which users see it in the "Recommended for You" section.
- Expert's `expert_specialties` are also used as signals in the recommendation engine.

---

## 3. Super Admin Flows

Super admin access requires `profiles.account_type = 'super_admin'` (set by a `super_admin` user or via migration).

### 3.1 Admin Portal Overview

The Super Admin Portal (`/admin`) is tab-based:

| Tab | Purpose |
|---|---|
| **Dashboard / KPIs** | Enrollment totals, engagement metrics, consultation counts, ROI indicators |
| **Audit Trail** | AI conversation audit log (searchable, exportable for HIPAA accounting-of-disclosures) |
| **Compliance** | PHI access log, compliance training tracking, flagged message queue |
| **Content** | Manage products (create, edit, deactivate, tag, set booking model) |
| **Experts** | Create and manage expert profiles |
| **Consultations** | View and update consultation booking status |
| **Discount Codes** | Create percentage/fixed discount codes with validity windows and usage caps |
| **Tenant Config** | Hospital branding, departments, QR code generation, delete hospital |

---

### 3.2 Managing Experts

1. Navigate to **Experts** tab → **Add Expert**.
2. Fill in: name, email (optional placeholder), bio, profile photo URL, specialties, credentials, experience years, consultation rate, availability, tenant (hospital affiliation).
3. Submit → `fn_admin_create_expert` RPC creates an auth user + profile row atomically.
4. Expert immediately appears in the public directory.
5. To edit: select expert → update fields → save.
6. Deletion cascades: deleting an expert profile cascades to their consultation bookings and products.

---

### 3.3 Managing Content (Products)

1. Navigate to **Content** tab → **Add Content**.
2. Fill in:
   - Title, description, type (document/video/consultation), status.
   - Expert author, pricing (free or $ amount).
   - Tags — at least one canonical topic tag required (so the recommendation engine surfaces it to matching users).
   - Hospital Resource flag + tenant scoping (optional).
   - Booking model (Direct/Inquiry/Hospital) and scheduling instructions (for consultation types).
   - **Confirmation page message** — optional custom headline and sub-headline shown to the user after booking.
3. Upload file + thumbnail or provide URLs.
4. Save → product is live immediately if status = `published`.

---

### 3.4 Managing Hospital Tenants

1. Navigate to **Tenant Config** tab.
2. Select a hospital from the dropdown or create a new one.
3. Configure:
   - Display name, primary brand color, logo URL.
   - Department contacts (name, phone, email) — shown in hospital banner on user dashboard.
   - QR code for hospital-specific signup link.
4. **Delete Hospital**: removes the tenant record. All affiliated users' `tenant_id` is set to NULL (they become B2C users). All products scoped to the tenant remain but are unscoped.

> Deletion requires migration `20260514000001` to be applied (adds DELETE RLS policy + `ON DELETE SET NULL` on `profiles.tenant_id`).

---

### 3.5 Consultation Bookings Management

1. Navigate to **Consultations** tab.
2. View all bookings: user name, expert name, product, amount paid, status, booked date.
3. Update status: `pending` → `confirmed` → `completed`.
4. Add internal admin notes to any booking.
5. Export for reporting.

---

### 3.6 AI Audit Trail & Compliance

1. Navigate to **Audit Trail** tab.
2. Search/filter conversations by date, user (cohort-level only — no individual identifiers in export), escalation flag.
3. Export CSV for HIPAA accounting-of-disclosures.
4. **PHI Access Log** — every time an admin views a conversation, a row is written to `phi_access_log` with accessor identity, timestamp, and patient cohort reference.
5. **Flagged Messages** — self-harm or depression-flagged conversations surface in the Compliance tab for clinical review.
6. All message data is append-only; no deletion is permitted.

---

### 3.7 Reporting & KPIs

The Metrics Dashboard surfaces:
- **Enrollment**: total signups, channel breakdown (QR/organic), monthly trend.
- **Engagement**: % saving resources, % making purchases, % booking consultations.
- **AI interactions**: total messages, escalation rate, language distribution.
- **Appointments**: consultation completion rate by expert.
- **Care checklists**: prenatal/postnatal checklist completion rates.
- **Survey completion**: postpartum risk assessment completions.

All metrics are aggregate and de-identified — no individual patient identifiers appear in any dashboard view.

---

## 4. Data Flow Diagram (Summary)

```
Parent (Browser/App)
  │
  ├── Auth → Supabase Auth (JWT)
  │
  ├── Chat message
  │     └── chat_ai_rag_fixed (Edge Function)
  │           ├── OpenAI Moderation API
  │           ├── fn_get_chat_context (session + child + messages)
  │           ├── pgvector RAG (expert_documents)
  │           └── OpenAI Chat Completion → saved to messages table
  │
  ├── Purchase (paid)
  │     └── create-payment (Edge Function)
  │           ├── Stripe PaymentIntent created
  │           ├── purchases row inserted (pending)
  │           └── consultation_bookings row inserted (pending)
  │
  ├── Purchase (free)
  │     └── create-payment (Edge Function)
  │           ├── purchases row inserted (completed)
  │           └── consultation_bookings row inserted (pending)
  │
  └── File download
        └── verify-purchase (Edge Function)
              └── Proxies Cloudflare R2 file after validating purchases row

Super Admin (Browser)
  └── All admin reads/writes go through standard Supabase RLS
        - admin_phi_access_log Edge Function logs PHI access
        - admin_ai_audit_read Edge Function reads audit trail
```

---

## 5. Revision History

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0 | 2026-05-14 | Engineering | Initial operational flows document |
