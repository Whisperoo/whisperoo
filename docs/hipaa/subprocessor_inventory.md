# Whisperoo Subprocessor Inventory
**HIPAA Stage 2 Compliance Documentation**
**Last Updated:** May 1, 2026

The following third-party vendors and cloud providers act as subprocessors for Whisperoo and may come into contact with Protected Health Information (PHI) or Personally Identifiable Information (PII).

| Vendor / Provider | Purpose of Subprocessing | Data Classification | BAA Status | Notes |
|-------------------|--------------------------|---------------------|------------|-------|
| **Supabase** | Primary database, authentication, user profiles, chat history storage | PHI, PII | ✅ Active (Pro Plan) | Encrypted at rest (AES-256) and in transit (TLS 1.3). |
| **OpenAI** | LLM API for clinical chat and intent routing | PHI (via prompts) | ✅ Active (Enterprise) | Zero Data Retention (ZDR) enabled. Prompts are NOT used for training. |
| **Fly.io** | Application hosting (frontend & edge routing) | Transit only (No persistent storage) | ⚠️ Gap Identified | Fly.io does not offer a standard BAA. Mitigation: No PHI stored on disk, transit encrypted. Plan to migrate to AWS/Vercel Enterprise post-launch. |
| **Cloudflare R2** | Object storage (profile images, digital products) | PII, non-PHI assets | ⚠️ Gap Identified | Needs legal review for BAA coverage on R2 specifically. |
| **Stripe** | Payment processing for digital products | Financial info, PII | N/A (PCI Compliant) | Stripe does not process medical records or PHI. Covered under PCI-DSS. |

### Escalation Notice
As of May 2026, the lack of a formal Business Associate Agreement (BAA) with Fly.io represents a compliance gap for full HIPAA Stage 2 maturity, despite strong technical safeguards (transit-only processing). This has been documented for leadership review.
