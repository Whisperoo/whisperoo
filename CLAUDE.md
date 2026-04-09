# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## ⚠️ CONFIDENTIAL — Whisperoo Hospital Pilot

This project is under active development for the **Hospital Pilot launch on May 3, 2026**. All work aligns with the Hospital Pilot SOW (Path A: True Multi-Tenancy). Do NOT deviate from the SOW scope without explicit approval.

---

## Claude's Operating Rules

1. **Plan first.** Read the codebase for relevant files and write a plan to `tasks/todo.md` before making changes.
2. **Checklist-driven.** The plan must be a list of checkable TODO items. Mark them off as you go.
3. **Get approval.** Before executing the plan, check in for verification.
4. **Explain as you go.** After each change, give a high-level summary of what changed and why.
5. **Simplicity above all.** Every change should be as small and isolated as possible. Touch as little code as you can. No monolithic rewrites.
6. **Summarize at the end.** Add a review section to `tasks/todo.md` with a summary of changes and any follow-up notes.
7. **Safety-first for AI.** Any code touching the AI chat pipeline must default to over-escalation. When in doubt, prompt the user to "See your provider."

---

## Development Commands

```bash
npm run dev          # Start Vite dev server (http://localhost:5173)
npm run build        # Production build (TypeScript check + Vite bundle)
npm run build:dev    # Development build (no minification)
npm run lint         # Run ESLint
npm run preview      # Preview production build locally
```

### Supabase Commands

```bash
supabase start                           # Start local Supabase stack (Docker required)
supabase db push                         # Apply all migrations to remote
supabase functions deploy <fn-name>      # Deploy a single Edge Function
supabase functions serve                 # Run Edge Functions locally
supabase gen types typescript --local > src/types/database.types.ts  # Regenerate DB types
```

> **Important:** After ANY schema change, you MUST regenerate `src/types/database.types.ts` so TypeScript stays in sync.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | React 18 + TypeScript |
| **Build** | Vite 5 (SWC plugin) |
| **UI Components** | shadcn/ui (Radix UI primitives) |
| **Styling** | Tailwind CSS 3 |
| **State / Data** | React Query (`@tanstack/react-query`) for server state; React Context for auth/nav |
| **Routing** | React Router v6 |
| **Forms** | React Hook Form + Zod validation |
| **Backend** | Supabase (PostgreSQL + Auth + Storage + Edge Functions) |
| **Vector Search** | pgvector extension (1536-dim embeddings) |
| **Edge Functions** | Deno runtime (Supabase Edge Functions) |
| **Payments** | Stripe (`@stripe/react-stripe-js`) |
| **Storage** | Cloudflare R2 (product file uploads) + Supabase Storage (profile images) |
| **Deployment** | Vercel (`vercel.json` configured with SPA rewrites) |

---

## Project Structure

```
whisperoo/
├── public/                        # Static assets
├── src/
│   ├── App.tsx                    # Root component – all routes defined here
│   ├── main.tsx                   # Entry point
│   ├── index.css                  # Tailwind directives + global styles
│   ├── components/
│   │   ├── ProtectedRoute.tsx     # Auth + onboarding gate
│   │   ├── ui/                    # shadcn/ui primitives (Button, Dialog, etc.)
│   │   ├── layouts/               # AuthLayout, OnboardingLayout
│   │   ├── navigation/            # AppLayout (sidebar + mobile tabs)
│   │   ├── chat/                  # MessageBubble, ChildSwitcher, chat UI
│   │   ├── dashboard/             # Dashboard widgets
│   │   ├── expert/                # ExpertDashboard, expert cards
│   │   ├── products/              # Product cards, purchase flows
│   │   ├── payments/              # Stripe checkout components
│   │   ├── admin/                 # Admin product management
│   │   ├── content/               # Content display components
│   │   └── mobile-tabs/           # Bottom tab navigation (mobile)
│   ├── pages/
│   │   ├── auth/                  # CreateAccount, Login, VerifyOTP, UpdatePassword
│   │   ├── onboarding/            # Role, Kids, KidsCount, KidsAges, ParentingStyles, Topics, Complete
│   │   ├── Dashboard.tsx          # Main dashboard
│   │   ├── Chat.tsx               # AI chat interface
│   │   ├── ExpertProfiles.tsx     # Expert directory
│   │   ├── ExpertDetails.tsx      # Individual expert page
│   │   ├── ProductsPage.tsx       # Product marketplace
│   │   ├── ProductDetailPage.tsx  # Product detail view
│   │   ├── MyPurchasesPage.tsx    # User's purchased items
│   │   ├── ProfilePage.tsx        # User profile
│   │   ├── SettingsPage.tsx       # User settings
│   │   └── AdminProductsPage.tsx  # Admin: product management
│   ├── contexts/
│   │   ├── AuthContext.tsx         # User/session/profile state (global)
│   │   └── NavigationContext.tsx   # Sidebar/tab navigation state
│   ├── hooks/                     # use-mobile, use-toast, usePayments, useStripePayment
│   ├── services/                  # products.ts, stripe.ts, storage.ts, cloudflare-storage.ts
│   ├── config/                    # cloudflare.ts, upload.ts
│   ├── lib/
│   │   ├── supabase.ts            # Supabase client initialization
│   │   └── utils.ts               # cn() helper (clsx + tailwind-merge)
│   ├── types/
│   │   └── database.types.ts      # Auto-generated Supabase types (DO NOT edit manually)
│   └── utils/
│       ├── auth.ts                # Auth helper utilities
│       ├── age.ts                 # Age calculation helpers
│       └── kids.ts                # Kids data utilities
├── supabase/
│   ├── config.toml                # Supabase project config
│   ├── migrations/                # Numbered SQL migration files (see below)
│   └── functions/                 # Edge Functions (Deno)
│       ├── chat_ai_rag_fixed/     # Main AI chat handler with RAG
│       ├── fn_get_chat_context/   # Builds context for AI prompts
│       ├── fn_update_session_summary/ # AI-powered conversation summarization
│       ├── create-payment/        # Stripe payment intent creation
│       └── verify-purchase/       # Stripe payment verification
├── database-schema.sql            # Legacy standalone schema (reference only)
├── vercel.json                    # Deployment config with SPA fallback
├── tailwind.config.ts             # Tailwind theme + animations
├── components.json                # shadcn/ui config
└── tasks/                         # Task tracking directory
```

---

## Database Schema (Current State)

Migrations live in `supabase/migrations/` and are applied in order. Current tables:

### Core Tables
| Table | Purpose | Key Columns |
|---|---|---|
| `profiles` | Parent/user accounts (extends `auth.users`) | `id` (FK to auth.users), `first_name`, `email`, `phone`, `onboarded` |
| `kids` (was `children`) | Child profiles under a parent | `parent_id` (FK), `first_name`, `birth_date`, `gender`, `notes`, `age` |
| `sessions` | Chat conversation sessions | `parent_id`, `child_id`, `summary`, `metadata` (JSONB) |
| `messages` | Individual chat messages | `session_id`, `parent_id`, `role` (user/assistant/system), `content`, `token_count` |
| `expert_documents` | Vector knowledge base for RAG | `title`, `content`, `embedding` (vector 1536) |
| Product tables | Digital marketplace | `products`, `product_files`, `purchases` (added in later migrations) |

### Row-Level Security (RLS)
- **ALL tables have RLS enabled.** Every table is scoped to the authenticated user via `auth.uid()`.
- Parents can only access their own profile, kids, sessions, and messages.
- `expert_documents` is read-only for all authenticated users.
- **Any new table MUST have RLS policies defined before deployment.**

### Migration Naming Convention
```
YYYYMMDD000NNN_description_in_snake_case.sql
```
Example: `20260406000001_add_tenant_tables.sql`

---

## Environment Variables

```env
# Supabase (REQUIRED)
VITE_SUPABASE_URL=<your-supabase-url>
VITE_SUPABASE_ANON_KEY=<your-supabase-anon-key>

# OpenAI (for Edge Functions – set in Supabase dashboard, not .env)
OPENAI_API_KEY=<key>

# Stripe (for payments)
VITE_STRIPE_PUBLISHABLE_KEY=<key>
STRIPE_SECRET_KEY=<key>  # Edge Function secret

# Cloudflare R2 (for product file storage)
VITE_CLOUDFLARE_ACCOUNT_ID=<id>
VITE_CLOUDFLARE_R2_ACCESS_KEY=<key>
VITE_CLOUDFLARE_R2_SECRET_KEY=<secret>
VITE_CLOUDFLARE_R2_BUCKET_NAME=<bucket>
VITE_CLOUDFLARE_R2_PUBLIC_URL=<url>
```

---

## Key Architecture Patterns

### Authentication Flow
1. User signs up via email/password → Supabase Auth creates `auth.users` row
2. Database trigger (`on_auth_user_created`) auto-creates a `profiles` row
3. `AuthContext.tsx` listens to `onAuthStateChange` and auto-fetches the profile
4. `ProtectedRoute` checks `requireAuth` and `requireOnboarding` props to gate access

### Chat AI Pipeline
1. User sends message → saved to `messages` table
2. Frontend calls `chat_ai_rag_fixed` Edge Function with session context
3. Edge Function calls `fn_get_chat_context` to gather: child profile + session summary + recent messages
4. RAG: query `expert_documents` via pgvector similarity search to inject relevant knowledge
5. LLM generates response → saved as assistant message
6. `fn_update_session_summary` periodically condenses conversation into session summary

### Protected Route Guard
`<ProtectedRoute requireAuth={true} requireOnboarding={true}>` — used on all post-onboarding routes. It checks:
- Is the user authenticated? (redirect to `/auth/login`)
- Has the user completed onboarding? (redirect to `/onboarding/role`)

### Data Fetching Pattern
- Use **React Query** (`useQuery`, `useMutation`) for all Supabase data operations.
- Keep Supabase calls in `src/services/` files, not directly in components.
- Components consume data via custom hooks in `src/hooks/`.

---

## Hospital Pilot SOW — Engineering Reference

> **Architecture:** Path A — True Multi-Tenancy. Single codebase, tenant config drives customization.
> **Timeline:** Apr 6 – May 3, 2026 (4 weeks). Ship every 1–2 days.
> **All CRITICAL items must ship before May 3 go-live.**

### Week 1 (Apr 6–12): AI Safety & Compliance
| ID | Task | Priority |
|---|---|---|
| 1.1 | **Escalation Triggers** — "See your provider" prompts for medical concerns, emergencies, edge-case symptoms | CRITICAL |
| 1.2 | **Guardrails** — System prompt + intent classification to prevent unsafe medical advice | CRITICAL |
| 1.3 | **Audit Trail** — Migrate from summary-only to **full Q&A logging** (append-only, queryable by date) | CRITICAL |
| 1.4 | **High-Risk Flags** — Flag depression/self-harm queries → route to internal review queue | CRITICAL |
| MT.1 | **Tenant Data Model** — `tenants` table, `tenant_id` FK on profiles, tenant-scoped RLS | CRITICAL |
| MT.2 | **Config System** — Branding, resource priority, segmentation via tenant config (not code forks) | CRITICAL |
| MT.3 | **Auth & Routing** — Tenant detection from QR/URL, auto-routing | CRITICAL |
| QA | Test 10+ clinical edge-case prompts; ALL must return escalation responses | CRITICAL |

### Week 2 (Apr 14–18): Onboarding & Search
| ID | Task | Priority |
|---|---|---|
| 2.1 | **QR/URL Onboarding** — Hospital-specific signup flows, capture acquisition department (OB, ER) | CRITICAL |
| 2.2 | **Organic Fallback** — "Are you a patient at [Hospital]?" routing for whisperoo.app signups | CRITICAL |
| 2.3 | **Data Isolation** — Enforce tenant-scoped RLS for hospital vs B2C experience layers | CRITICAL |
| 3.1 | **Expert Ranking** — Hospital experts rank #1, then Whisperoo, then best-match | CRITICAL |
| 3.2 | **Search Boosting** — Hospital content boosted in search for affiliated users | CRITICAL |
| 3.3 | **Direct Contact** — Hospital resource listings show direct contact info (P1 - post-launch) | P1 |
| 3.4 | **Dashboard Branding** — Hospital banner/card with name + department contact | P1 |
| 4.1 | **Care Checklists** — Auto-generated based on baby birth/due date | CRITICAL |

### Week 3 (Apr 21–25): Localization
| ID | Task | Priority |
|---|---|---|
| 5.1 | **Language Selection** — English, Spanish, Vietnamese. Persist across sessions | CRITICAL |
| 5.2 | **Static Strings** — Full translation of nav, buttons, labels, errors. Zero English leakage | CRITICAL |
| 5.3 | **AI Agent** — Detect and respond in user's stored language preference | CRITICAL |
| 5.4 | **Expert Profiles** — Bio, specialties, contact in correct language | CRITICAL |
| — | **Human Review** — Bilingual review required before go-live | CRITICAL |

### Week 4 (Apr 28–May 3): Reporting & Launch
| ID | Task | Priority |
|---|---|---|
| 6.1 | **HIPAA Compliance** — No individual patient IDs. Cohort aggregation + audit trails | CRITICAL |
| 6.2 | **Clinical Review Log** — Searchable/exportable AI exchange logs for liability | CRITICAL |
| 6.3 | **ROI Metrics** — Enrollment totals, channel breakdown, monthly trends | CRITICAL |
| 6.4 | **Engagement Metrics** — % saving resources, % purchasing, % booking consultations | CRITICAL |
| 6.5 | **Health Metrics** — Prenatal Risk Assessment + Postpartum visit completion rates | CRITICAL |
| 6.6 | **Patient Insights** — Aggregate "Common Concern Themes" (word cloud/rankings), updated weekly | CRITICAL |
| MT.4 | **Unified Analytics** — Single pipeline, sliced by tenant, de-identified | CRITICAL |
| MT.5 | **Admin Panel** — Whisperoo-managed admin for per-tenant content + expert curation | CRITICAL |

### SOW Operating Principles
1. **AI Safety is Day-1 priority.** Start clinical trigger lists immediately.
2. **Use Claude Code extensively** to maintain the 4-week shipping cadence.
3. **HIPAA Buffer:** Submit reporting layer to hospital compliance by **April 30**.
4. **Conservative AI:** When unsure of a guardrail, ALWAYS err toward over-escalation to clinical staff.

---

## Multi-Tenancy Architecture (MT) — Design Notes

The multi-tenancy system is the **prerequisite** for all hospital workstreams. Key decisions:

### Proposed Schema Additions
```sql
-- Tenants table
CREATE TABLE tenants (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug        TEXT UNIQUE NOT NULL,        -- "memorial-hospital"
  name        TEXT NOT NULL,               -- "Memorial Hospital"
  config      JSONB DEFAULT '{}'::jsonb,   -- branding colors, logo URL, department contacts
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Add tenant_id to profiles
ALTER TABLE profiles ADD COLUMN tenant_id UUID REFERENCES tenants(id);
ALTER TABLE profiles ADD COLUMN acquisition_source TEXT;  -- "qr_ob", "qr_er", "organic"
ALTER TABLE profiles ADD COLUMN language_preference TEXT DEFAULT 'en';
```

### Tenant Config JSON Shape (proposed)
```json
{
  "branding": {
    "primary_color": "#1A4B8E",
    "logo_url": "https://...",
    "display_name": "Memorial Hospital"
  },
  "departments": [
    { "name": "OB/GYN", "phone": "555-0101", "email": "ob@memorial.org" },
    { "name": "Emergency", "phone": "555-0102" }
  ],
  "expert_boost_ids": ["uuid1", "uuid2"],
  "escalation_triggers": ["custom_trigger_1"],
  "languages": ["en", "es", "vi"]
}
```

### RLS Pattern for Tenancy
- B2C users: `tenant_id IS NULL` — they see generic Whisperoo content.
- Hospital users: `tenant_id = <tenant_uuid>` — they see hospital-branded content + boosted resources.
- Tenant-scoped policies should use `profiles.tenant_id` for filtering.

---

## Coding Conventions

### File Naming
- Components: `PascalCase.tsx` (e.g., `ExpertProfiles.tsx`)
- Hooks: `camelCase.ts` prefixed with `use` (e.g., `usePayments.ts`)
- Services: `camelCase.ts` (e.g., `products.ts`)
- Utilities: `camelCase.ts` (e.g., `age.ts`)
- Migrations: `YYYYMMDD000NNN_snake_case.sql`

### Component Patterns
- Use **functional components** with hooks only. No class components.
- Extract reusable logic into custom hooks (`src/hooks/`).
- Keep page components (`src/pages/`) thin — delegate logic to hooks and services.
- UI primitives live in `src/components/ui/` — do NOT modify these directly; extend via composition.

### Styling
- Use **Tailwind utility classes** directly in JSX.
- For component variants, use `class-variance-authority` (cva).
- Use `cn()` from `src/lib/utils.ts` for conditional class merging.
- Design tokens (colors, radii, shadows) are in `tailwind.config.ts`.

### Error Handling
- Always wrap Supabase calls in try/catch.
- Use `console.error` with context (never silent catches).
- Surface errors to the user via `sonner` toast notifications.

### TypeScript
- Strict mode is enabled. No `any` types without explicit justification.
- Database types come from `src/types/database.types.ts` (auto-generated).
- Define component prop interfaces inline or in the same file.

---

## Testing Checklist (Pre-Launch QA)

### AI Safety — MUST PASS
- [ ] 10+ clinical edge-case prompts all return escalation responses
- [ ] Depression/self-harm queries are flagged and routed to review queue
- [ ] No medical diagnoses or prescription recommendations in AI responses
- [ ] Full Q&A audit trail is being recorded for every exchange

### Multi-Tenancy
- [ ] Hospital QR code signup creates user with correct `tenant_id`
- [ ] Organic signup correctly routes through "Are you a patient?" flow
- [ ] Hospital users see branded dashboard with hospital banner
- [ ] B2C users see generic Whisperoo experience
- [ ] RLS prevents cross-tenant data access

### Localization
- [ ] Language selector persists choice across sessions
- [ ] Zero English strings visible when Spanish or Vietnamese is selected
- [ ] AI responds in the user's stored language preference

### Reporting
- [ ] No individual patient identifiers in any dashboard view
- [ ] AI exchange logs are searchable and exportable
- [ ] ROI and engagement metrics render correctly with sample data

---

## Quick Reference — Where Things Live

| What you're looking for | Where to find it |
|---|---|
| Route definitions | `src/App.tsx` |
| Auth state / login logic | `src/contexts/AuthContext.tsx` |
| Supabase client | `src/lib/supabase.ts` |
| Database types | `src/types/database.types.ts` (auto-generated) |
| Chat AI logic | `supabase/functions/chat_ai_rag_fixed/` |
| Product/payment services | `src/services/products.ts`, `src/services/stripe.ts` |
| Storage (Cloudflare R2) | `src/services/cloudflare-storage.ts`, `src/config/cloudflare.ts` |
| Tailwind theme | `tailwind.config.ts` |
| shadcn/ui config | `components.json` |
| Migrations | `supabase/migrations/` |
| Task tracking | `tasks/` |
| Environment variables | `.env` (copy from `.env.example`) |