# Sprint 2 — Delivery Timeline

**Sprint start:** June 9, 2026  
**Target merge to `main`:** June 27, 2026 (3 weeks)  
**Working branch:** `sprint-2`

---

## Dependency Map

```
Phase A (DB Foundation)
    ├── Phase B (Paywall Enforcement — Edge Fn)
    ├── Phase C (Stripe Subscriptions)
    │       └── Phase D (Paywall UI)      ← needs B + C
    ├── Phase E (Recommendations)
    └── Phase F (Hospital Resource Chat)

B + C + D + E + F → Phase G (Integration QA + Merge)
```

Phases **B, E, and F** can run in parallel after Phase A lands.  
Phase **D** needs both B and C done first.

---

## Week 1 — June 9–13: Foundation + Parallel Feature Work

### Day 1 (Jun 9) — Phase A: DB Foundation
*Zero UI impact. Pure schema additions. Safe to deploy to production DB immediately.*

| Task | ID | Est. |
|---|---|---|
| Migration: `subscriptions` table (user_id, stripe_customer_id, tier, status, current_period_end) | A.1 | 1h |
| Migration: `ai_usage` table (user_id, period_month, message_count, token_cost) | A.2 | 1h |
| Migration: add `is_sponsored BOOLEAN DEFAULT false` to `tenants` | A.3 | 30m |
| Migration: add `subscription_tier TEXT DEFAULT 'free'` to `profiles` | A.4 | 30m |
| Regenerate `src/types/database.types.ts` | A.5 | 15m |
| Lint + build check | — | 15m |

**Day 1 exit criteria:** All 4 migrations committed, types regenerated, build passes.

---

### Day 2 (Jun 10) — Phase B: Paywall in Edge Function
*Modifies `chat_ai_rag_fixed`. Carefully backward-compatible.*

| Task | ID | Est. |
|---|---|---|
| Add tier check at start of `chat_ai_rag_fixed`: read `subscriptions` + `ai_usage`, check `tenants.is_sponsored` | B.1 | 2h |
| Return HTTP 402 `{ error: 'paywall', messages_used, limit }` when free cap hit | B.1 | 30m |
| On successful LLM completion: upsert `ai_usage` (message_count +1, token_cost from OpenAI usage) | B.2 | 1h |
| Deploy `chat_ai_rag_fixed` | B.3 | 15m |
| Manual test: send 1 message as free user → ai_usage row created; send as sponsored hospital user → no paywall | — | 30m |

**Day 2 exit criteria:** 402 returned correctly for over-cap users; sponsored users unblocked; ai_usage upserted on each message.

---

### Day 3 (Jun 11) — Phase E: Recommendation Priority Fix
*Modifies `chat_ai_rag_fixed`. Can work alongside B since B is already deployed.*

| Task | ID | Est. |
|---|---|---|
| Refactor resource suggestion query: fetch `products` by type (pdf/course/video), ordered by `is_hospital_resource DESC`, `is_free DESC` | E.1 | 2h |
| Build `recommendations[]` array with strict priority order (hospital expert=1, Whisperoo expert=2, free resource=3, paid resource=4) | E.2 | 1.5h |
| Update `MessageBubble.tsx`: render cards per type with source label (`Hospital Expert`, `Whisperoo Expert`, `Free`, `Premium`) and correct deep-link | E.3 | 2h |
| Deploy `chat_ai_rag_fixed` | E.4 | 15m |
| Lint + build check | — | 15m |

**Day 3 exit criteria:** Chat response metadata includes correctly ordered `recommendations[]`; cards render with right labels and deep-links in UI.

---

### Day 4–5 (Jun 12–13) — Phase F: Hospital Resource Chat (Part 1 — Backend)
*Net-new Edge Function. No existing code touched.*

| Task | ID | Est. |
|---|---|---|
| Create `supabase/functions/hospital_resource_chat/index.ts` | F.1 | — |
| Auth check + tenant_id required guard (return 403 for B2C users) | F.1 | 1h |
| Read tenant config → deterministic hospital facts object (phone/hours/address) | F.1 | 1h |
| pgvector search filtered by `metadata->>'tenant_id'` only | F.1 | 1.5h |
| Zero-chunk fallback: return `{ grounded: false }` without LLM call | F.1 | 30m |
| System prompt: strict grounding, no general knowledge, include hospital facts | F.1 | 1h |
| Safety pipeline: keyword escalation (pre-LLM) + OpenAI moderation + audit trail insert | F.1 | 1.5h |
| Include `sources[]` in response (document titles used) | F.1 | 30m |
| Deploy `hospital_resource_chat` | — | 15m |

**Day 5 exit criteria:** Function deployed; curl test returns grounded answer with sources; zero-chunk fallback returns correctly; B2C user gets 403; safety escalation fires on test keyword.

---

## Week 2 — June 16–20: Stripe + Hospital Chat UI

### Day 6–7 (Jun 16–17) — Phase C: Stripe Subscription Integration

| Task | ID | Est. |
|---|---|---|
| Create `supabase/functions/stripe-subscription/index.ts` with two handlers: | C.1 | — |
|   `POST /create-checkout` → Stripe Checkout Session for $9.99/mo → return `{ sessionUrl }` | C.1 | 2h |
|   `POST /webhook` → handle `customer.subscription.*` events → sync `subscriptions` + `profiles.subscription_tier` | C.1 | 3h |
| Set Stripe Edge Function secrets: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PREMIUM_PRICE_ID` | C.2 | 30m |
| Register Stripe webhook endpoint in Stripe dashboard pointing to Edge Function URL | C.3 | 30m |
| Deploy `stripe-subscription` | C.4 | 15m |
| Test: create test subscription in Stripe test mode → webhook fires → `subscriptions` row created → `profiles.subscription_tier = 'premium'` | — | 1h |

**Day 7 exit criteria:** Checkout session created; webhook syncs tier to DB; test subscription roundtrip works end-to-end.

---

### Day 8 (Jun 18) — Phase F: Hospital Resource Chat (Part 2 — Frontend)

| Task | ID | Est. |
|---|---|---|
| Create `src/pages/HospitalChat.tsx` — same conversation UX as `Chat.tsx` but calls `hospital_resource_chat` | F.2 | 3h |
| Show source citations below assistant responses | F.2 | 1h |
| Show `{ grounded: false }` fallback message + "Try Whisperoo Chat" button (pre-loads question via `/chat?q=...`) | F.2 | 1h |
| Show "Informational, not medical advice" disclaimer banner | F.2 | 30m |
| Paywall enforcement: intercept 402 from hospital chat → same `<PaywallDialog>` as Chat Genie | F.2 | 30m |
| Add route `/hospital-chat` in `src/App.tsx` behind `ProtectedRoute` | F.3 | 15m |
| Add "Hospital Resources" nav item in sidebar + mobile tabs — visible only when `profile.tenant_id != null` | F.4 | 45m |

**Day 8 exit criteria:** `/hospital-chat` accessible, renders correctly, shows citations, fallback works, B2C users don't see the nav item.

---

### Day 9–10 (Jun 19–20) — Phase D: Paywall UI

| Task | ID | Est. |
|---|---|---|
| Create `src/hooks/useSubscription.ts` → returns `{ tier, messagesUsed, limit, isSponsored }` via React Query | D.1 | 1.5h |
| Add usage counter badge in `Chat.tsx` input area (free tier only: "18 / 25 questions this month") | D.2 | 1h |
| Create `src/components/chat/PaywallDialog.tsx` — intercepts 402, shows usage, "Upgrade Now" CTA | D.3 | 2h |
| `PaywallDialog` → calls `stripe-subscription/create-checkout` → redirect to Stripe Checkout | D.4 | 1h |
| Add COGS superadmin view in `SuperAdminPortal`: table of `user_id, tier, messages_used, token_cost` by month | D.5 | 2h |
| Lint + build pass | D.6 | 15m |

**Day 10 exit criteria:** Free user sees counter; PaywallDialog appears mid-conversation at cap; "Upgrade Now" opens Stripe Checkout; COGS view loads in superadmin.

---

## Week 3 — June 23–27: QA, Hardening & Merge

### Day 11–12 (Jun 23–24) — Phase G Part 1: Integration Testing

| Test | Covers |
|---|---|
| Free user exhausts 25 messages → PaywallDialog mid-conversation (history visible) | WS 1.5 |
| Sponsored hospital user sends 30+ messages → no paywall ever | WS 1.4 |
| Stripe subscription webhook → tier updates within 30s → paywall gone | WS 1.3 |
| Chat Genie: topic with hospital expert → hospital expert card first | WS 2.2 |
| Chat Genie: at most 1 free + 1 paid resource card per response | WS 2.1 |
| B2C user never sees `is_hospital_resource` content | WS 2.2 |
| Hospital chat: question in docs → answer + source citation | WS 3.2 / 3.5 |
| Hospital chat: question NOT in docs → fallback + "Try Whisperoo Chat" button | WS 3.3 |
| Hospital chat: "Try Whisperoo Chat" pre-loads question | WS 3.3 |
| B2C user hits `/hospital-chat` → redirected | WS 3.1 |
| Safety keyword in hospital chat → escalation, not a hospital answer | WS 3.6 |
| Disclaimer visible on every hospital chat session | WS 3.6 |

---

### Day 13 (Jun 25) — Non-Regression Testing (production flows)

| Test | Covers |
|---|---|
| Marketplace product purchase (one-off) → unaffected | Non-regression |
| Expert booking flow → unaffected | Non-regression |
| Superadmin portal loads without errors | Non-regression |
| Existing Chat Genie works for B2C users after paywall enforcement | Non-regression |
| QR code signup → tenant attribution correct | Non-regression |

---

### Day 14 (Jun 26) — Hardening + Type Sync

| Task | Est. |
|---|---|
| Final `supabase gen types typescript` regeneration if any late schema changes | 15m |
| `npm run build` clean on `sprint-2` branch | 15m |
| Review all new environment variables are documented in `.env.example` | 30m |
| Stripe webhook URL confirmed registered in Stripe dashboard | 15m |
| Confirm `is_sponsored` status for current hospital tenant (business decision) | — |

---

### Day 15 (Jun 27) — PR + Merge

| Task | Est. |
|---|---|
| Create PR: `sprint-2` → `main` | 30m |
| Final review of PR diff | 1h |
| Merge to `main` | — |
| Deploy Edge Functions: `chat_ai_rag_fixed`, `hospital_resource_chat`, `stripe-subscription` | 30m |
| Smoke test on production: 1 chat message, 1 hospital chat, 1 paywall trigger | 30m |

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Stripe webhook setup delayed (need Stripe account access) | Medium | High | Start C.2/C.3 setup on Day 6 even before code is done; use Stripe test mode |
| Hospital resource chat hallucination despite grounding | Low | Critical | Zero-chunk fallback fires without LLM call; system prompt tested manually before deploy |
| `ai_usage` upsert race condition (concurrent messages) | Low | Medium | Use `ON CONFLICT (user_id, period_month) DO UPDATE ... message_count = ai_usage.message_count + 1` with DB-level atomicity |
| Sprint 2 DB migrations conflict with production hotfixes on `main` | Medium | Medium | Rebase `sprint-2` onto `main` at start of Week 3 before QA |
| `is_sponsored` flag defaults OFF → current hospital users hit paywall | By design | Business decision | Confirm with stakeholder before Phase B deploys to production |

---

## Summary: Task Count by Priority

| Phase | Tasks | Critical | High |
|---|---|---|---|
| A — DB Foundation | 5 | 4 | 1 |
| B — Paywall Edge Fn | 3 | 3 | 0 |
| C — Stripe Subscriptions | 4 | 4 | 0 |
| D — Paywall UI | 6 | 0 | 6 |
| E — Recommendations | 4 | 3 | 1 |
| F — Hospital Chat | 6 | 5 | 1 |
| G — QA + Merge | 5 | 5 | 0 |
| **Total** | **33** | **24** | **9** |
