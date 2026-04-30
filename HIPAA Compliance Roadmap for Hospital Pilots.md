# HIPAA Compliance Roadmap for Hospital Pilots

## Overview: 3 Stages of Progression

### Stage 1: "Built to HIPAA Standards"

Complete the technical architecture checklist. This is design-level work you can do now, pre-funding. Once done, you can honestly tell hospitals the platform is architected to HIPAA standards.

### Stage 2: "HIPAA Compliant"

Layer on the operational pieces: BAAs, written policies, designated officers, training, risk assessments. Once complete, you are genuinely HIPAA compliant and can say so. Most of this is free or low-cost; the expense is in vendor tiers that include BAAs.

### Stage 3: SOC 2 Type II or HITRUST + Vanta (Post-Funding)

Automated compliance monitoring and a real third-party audit. This is the artifact enterprise hospital buyers actually want to see. Budget roughly $15K to $40K for the audit plus Vanta's platform fee. Pursue HITRUST later if a major health system requires it.

---

## Stage 1 Checklist: Technical Architecture

### P0: Foundational (do these first, hard to change later)

- [ ] *[Infrastructure]* Database provider with BAA available
- [ ] *[Infrastructure]* Hosting provider with BAA available
- [ ] *[Infrastructure]* LLM provider with BAA available (Anthropic, OpenAI Enterprise with ZDR)
- [ ] *[Data Handling]* Apply the minimum necessary principle: only collect PHI you actually need
- [ ] *[Data Handling]* Encryption at rest (AES-256) across database, backups, and object storage
- [ ] *[Data Handling]* Encryption in transit (TLS 1.2+) for all connections
- [ ] *[LLM]* No PHI used in LLM training data under any circumstance
- [ ] *[LLM]* De-identify or tokenize PHI before sending to any LLM without a BAA

### P1: Critical Controls (required for compliance, but can be added iteratively)

- [ ] *[Data Handling]* No PHI in application logs, error messages, or analytics events
- [ ] *[Data Handling]* Audit Sentry, Datadog, PostHog, and similar tools for PHI leakage (defaults often leak)
- [ ] *[Infrastructure]* Error tracking and analytics vendors either have BAAs or do not receive PHI
- [ ] *[Access Control]* Role-based access controls on all PHI
- [ ] *[Access Control]* MFA required on every account touching production or PHI
- [ ] *[Access Control]* Unique logins per person (no shared accounts)
- [ ] *[Access Control]* Audit logging: who accessed what PHI, when
- [ ] *[LLM]* Prompt and response logs treated with same rigor as primary PHI store
- [ ] *[LLM]* Retrieval logs from knowledge base protected as PHI
- [ ] *[Infrastructure]* Secrets management in place (not in code or env files committed to git)

### P2: LLM Product Safety (high priority for your specific use case)

- [ ] *[LLM]* Guardrails preventing the LLM from producing medical advice vs. information
- [ ] *[LLM]* Human review workflow for flagged responses
- [ ] *[LLM]* Clear disclaimers on LLM output
- [ ] *[LLM]* Decision made on whether LLM output becomes part of the medical record

### P3: Hardening (important but lower urgency for pilot)

- [ ] *[Data Handling]* Separate identifiers from content where possible
- [ ] *[Access Control]* Automatic session timeouts
- [ ] *[Access Control]* Ability to produce an access log for a specific patient on request

---

## Stage 2 Checklist: Policies, BAAs, and Operations

### Business Associate Agreements (BAAs)

- [ ] Complete subprocessor inventory: every vendor that could touch PHI
- [ ] BAA signed with the hospital (they are the Covered Entity, you are the Business Associate)
- [ ] BAA signed with database provider
- [ ] BAA signed with hosting provider
- [ ] BAA signed with LLM provider
- [ ] BAA signed with email and SMS providers (if applicable)
- [ ] BAA signed with error tracking and monitoring vendors
- [ ] Any vendor that refuses to sign a BAA is removed or replaced

### Written Policies

- [ ] Privacy policy addressing PHI handling
- [ ] Terms of service appropriate for health data
- [ ] Access control policy
- [ ] Incident response plan
- [ ] Breach notification procedure (60-day rule)
- [ ] Data retention and destruction policy
- [ ] Employee training policy
- [ ] Password and MFA policy
- [ ] Acceptable use policy
- [ ] Vendor management policy

### Designated Roles

- [ ] Privacy Officer designated (can be a founder)
- [ ] Security Officer designated (can be the same person)
- [ ] Contact information for both documented and shared with hospital

### Documentation

- [ ] Data flow diagram showing where PHI enters, lives, moves, and exits
- [ ] Risk assessment completed (HHS SRA Tool is free)
- [ ] Subprocessor list with BAA status for each vendor
- [ ] Security posture one-pager ready to send to hospital compliance teams

### Training and Operations

- [ ] All employees with PHI access complete HIPAA training
- [ ] Training completion tracked and documented
- [ ] Annual refresher training scheduled
- [ ] Incident response plan tested (even a tabletop exercise counts)
- [ ] Process in place for patient requests (access, amendment, accounting of disclosures)

---

## Stage 3: Post-Funding

Not a checklist yet. Revisit once fundraising closes. Priorities in order:

1. Sign with Vanta or Drata for continuous compliance monitoring
2. Begin SOC 2 Type II audit process (6 to 12 month observation window)
3. Evaluate HITRUST CSF if a major health system requires it
4. Consider penetration testing
5. Hire or contract dedicated compliance support