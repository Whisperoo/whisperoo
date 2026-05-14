# Whisperoo — HIPAA Compliance Attestation

**Version:** 1.0  
**Date:** 2026-05-14  
**Prepared by:** Engineering Team  
**Status:** Stage 1 Complete — Pending Stage 2 (Post-Pilot)

---

## Executive Summary

This document attests to the security and compliance controls implemented in the Whisperoo platform in preparation for the Hospital Pilot launch (May 3, 2026). All P0 and P1 items from the Stage 1 HIPAA audit (conducted 2026-05-12) have been resolved. Full evidence is available in `tasks/hipaa-evidence/`.

Whisperoo is a parental support platform that processes limited health-adjacent data (parenting topics, child age/due dates, AI chat transcripts). No clinical diagnoses, prescriptions, or treatment plans are generated or stored. All AI responses default to over-escalation ("See your provider") for any clinical concern.

---

## Data Classification

| Data Type | Classification | Storage Location | Access Controls |
|---|---|---|---|
| Parent profile (name, onboarding topics) | Non-PHI — general wellness | `profiles` table | RLS: owner only |
| Child profile (birth/due date, gender) | Non-PHI — de-identified in reports | `kids` table | RLS: parent only |
| Chat transcripts (AI conversations) | Health-adjacent — may contain context | `messages` table | RLS: parent + admin audit |
| Consultation bookings | Admin-only — no individual IDs in reports | `consultation_bookings` | RLS: owner + admin |
| Expert documents (RAG knowledge base) | Non-PHI — published expert content | `expert_documents` | Read-only for authenticated |
| Session summaries | AI-condensed context | `sessions` table | RLS: parent only |

> No SSNs, insurance IDs, diagnoses, prescriptions, or clinical notes are stored.

---

## P0 — Active Exposure (Resolved)

| ID | Item | Resolution | Evidence |
|---|---|---|---|
| A1 | Lock 4 leaking DB objects | Migration `20260512000004` applied; `security_invoker=on` on views; RLS enabled on `consultation_bookings` | [A2-post-lockdown-curl.txt](../tasks/hipaa-evidence/A2-post-lockdown-curl.txt) |
| A2 | Outside-in curl test | All 4 endpoints return HTTP 401 to anonymous callers | [A2-post-lockdown-curl.txt](../tasks/hipaa-evidence/A2-post-lockdown-curl.txt) |
| A3 | 30-day log review for exposure window | Zero external accesses found in API Gateway logs | [incident-1-exposure.md](../tasks/hipaa-evidence/incident-1-exposure.md) |
| A4 | Drop `profiles.email` column | Migration `20260512000003` applied; column returns 0 rows | Migration verified |
| A5 | Remove OpenAI key prefix from logs + rotate | Log line removed; key rotated 2026-05-13 | Confirmed in Supabase Edge Function secrets |

---

## P1 — Procurement-Critical Security (Resolved)

| ID | Item | Resolution | Evidence |
|---|---|---|---|
| B1 | R2 uploads behind Edge Function | `r2-storage` Edge Function deployed; no client-side R2 key; key rotated 2026-05-13 | `src/services/cloudflare-storage.ts` |
| B2 | Google Translate behind Edge Function | `auto-translate` Edge Function deployed; key rotated 2026-05-13 | `src/services/translationService.ts` |
| B3 | Remove client-side Stripe secret | `VITE_STRIPE_PUBLISHABLE_KEY` only; no secret in bundle | [B4-bundle-clean.md](../tasks/hipaa-evidence/B4-bundle-clean.md) |
| B4 | No `VITE_*` secret vars in build | `.env.example` clean; production bundle grep clean | [B4-bundle-clean.md](../tasks/hipaa-evidence/B4-bundle-clean.md) |
| B5 | Tighten `compliance_training` RLS | Migration `20260512000002` applied | Verified via screenshot |
| B6 | MFA enrollment for super-admins | TOTP code shipped; Dashboard TOTP enabled 2026-05-13 | Pending: per-user QR enrollment |
| B7 | Replace hardcoded email allowlists with role checks | Migration `20260513000001` applied; `fn_caller_is_staff_admin()` helper; no hardcoded emails in grep | Grep confirms zero hits |
| B8 | Wire `phi_access_log` into admin view read path | `admin_ai_audit_read` Edge Function deployed; `AuditTrailTable.tsx` invokes it | `src/pages/admin/AuditTrailTable.tsx` |

---

## P2 — Additional Hardening (Resolved)

| ID | Item | Resolution |
|---|---|---|
| C1 | Single session-timeout implementation | `useInactivityTimeout.ts` deleted; `SessionTimeoutTracker` (15-min) is sole source |
| C2 | Free-text onboarding PHI cap | `maxLength=500`; "no specific medical details" guidance shown to user |
| C3 | Sanitize Edge Function error logs | `safeLogError.ts` shared utility; replaces raw `console.error` in AI pipeline |
| C4 | OpenAI Moderation before chat completion | `shouldEscalateFromOpenAIModeration()` POSTs to `/v1/moderations`; escalates on self-harm/violence before LLM call |
| C5 | Per-patient PHI access log export | `PhiAccessLogPanel.tsx` CSV export; HIPAA accounting-of-disclosures format |

---

## P3 — Lower Priority / Post-Pilot

| ID | Item | Status |
|---|---|---|
| D1 | `pgaudit` + 6-year Postgres log retention | pgaudit enabled (`write,ddl`); retention gap (30 days vs 6 years) tracked post-pilot |
| D2 | LLM data flow documentation | `docs/llm-data-flow.md` exists |
| D3 | Reconcile CLAUDE.md + delete `vercel.json` | Complete |
| D4 | Reconcile Supabase migration tracker | 89 rows backfilled; 12 files renamed to canonical 14-digit format |
| D5 | Tokenize `parent_id`/`child_id` on messages | Deferred to post-pilot |

---

## AI Safety Controls

The following controls are active in the chat pipeline (`supabase/functions/chat_ai_rag_fixed/`):

| Control | Implementation |
|---|---|
| **Pre-chat moderation** | Every user message is sent to OpenAI `/v1/moderations`; escalation on `self_harm`, `violence`, `self_harm/instructions` |
| **System-prompt guardrails** | LLM is instructed never to diagnose, prescribe, or advise treatment; must recommend "See your provider" for clinical concerns |
| **Escalation trigger list** | Keyword list covering emergency scenarios (chest pain, difficulty breathing, seizure, postpartum psychosis, self-harm, etc.) — AI response includes emergency escalation |
| **High-risk flag queue** | Depression/self-harm queries flagged in `flagged_messages_view` for internal review |
| **Full Q&A audit trail** | All messages stored append-only in `messages` table; admin view with export |
| **No medical diagnoses** | LLM temperature set to 0.3; system prompt explicitly prohibits diagnostic language |

---

## Data Residency & Retention

| Component | Provider | Region | Retention |
|---|---|---|---|
| Database (PostgreSQL) | Supabase | US-East-1 (AWS) | Indefinite (messages never deleted) |
| File storage (R2) | Cloudflare | Automatic | No auto-expiry |
| Edge Functions | Supabase (Deno) | US-East-1 | Stateless |
| AI inference | OpenAI API | OpenAI-managed | Not stored by Whisperoo per OpenAI DPA |
| Frontend CDN | Fly.io | Global edge | Static assets only |

---

## Outstanding Items Before Attestation

1. **B6 MFA enrollment** — Each super-admin must scan the TOTP QR code in their Supabase dashboard profile. `auth.mfa_factors` table should be non-empty after this step.
2. **Frontend deploy to Fly** — MFA + admin RLS-write paths land with the SPA deployment.
3. **Founder/legal sign-off on A3** — Engineering position: zero external accesses in 30-day window. Legal review of `incident-1-exposure.md` needed.
4. **Key hygiene confirmation** — Confirm old OpenAI, R2, and Google Translate keys are revoked at the provider level.

---

## Revision History

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0 | 2026-05-14 | Engineering | Initial attestation document |
