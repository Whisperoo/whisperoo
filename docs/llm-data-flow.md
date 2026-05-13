# LLM data flow (Whisperoo)

This document supports **HIPAA Stage 1 / D2** operational transparency: what leaves our systems for model inference, what does not, and where it is stored.

## What we send to OpenAI

| Data | When | Purpose |
|------|------|---------|
| **User message** (current turn) | Every chat completion | Primary input for the reply |
| **System prompt** | Every chat completion | Persona, safety rules, formatting |
| **Child `first_name`, age text, `birth_date`** | When present in session/profile context | Personalization inside the system prompt |
| **Session summary** | When present | Continuity |
| **Recent message snippets** | When present | Short excerpts in system prompt (truncated in prompt construction) |
| **Expert/product titles and metadata** | When matched | Grounding suggestions only (no raw PHI from other users) |
| **User message text** | Moderation call (`text-moderation-latest`) | Safety classification before completion when not already keyword-escalated |

Embeddings (e.g. `text-embedding-3-small`) are computed from **user message text** and **compliance training snippets** for retrieval; they are not full chat logs.

## What we do **not** send to OpenAI (by design in this pipeline)

- User **email**, **phone**, or full **street address**
- **Payment**, **Stripe**, or **booking** payloads
- Other users’ **messages** or **profiles** (only the authenticated user’s context is loaded server-side)

> **Note:** Replace bracketed items below with your executed vendor agreements and console settings.

## Retention and configuration

- **OpenAI API**: Inference is **stateless** per request. Configure **zero retention** / **no training** in the OpenAI organization settings to match your BAA and security review.
- **Supabase**: Message content and embeddings are stored in **your** Postgres instance under **RLS**. Access is via authenticated users (parents) and audited admin paths where applicable.

## BAA / DPA status (fill in for compliance packet)

| Vendor | Document | Location / owner |
|--------|----------|------------------|
| OpenAI | BAA (or equivalent) | _Link or internal reference_ |
| Supabase | BAA / DPA | _Link or internal reference_ |

## Related code

- Chat orchestration: `supabase/functions/chat_ai_rag_fixed/index.ts`
- Session context RPCs / helpers: `supabase/functions/fn_get_chat_context` (if deployed) and in-function context builders

Last updated: 2026-05-12 (engineering template — legal should validate wording).
