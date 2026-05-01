# Whisperoo Data Flow Map
**HIPAA Stage 2 Compliance Documentation**
**Last Updated:** May 1, 2026

The following map illustrates the flow of Protected Health Information (PHI) through the Whisperoo system architecture.

```mermaid
sequenceDiagram
    participant U as User (Patient)
    participant F as Fly.io (Frontend App)
    participant S as Supabase (PostgreSQL)
    participant E as Supabase Edge Functions
    participant O as OpenAI (Enterprise API)

    Note over U,O: All connections are TLS 1.3 encrypted

    U->>F: 1. User authenticates & sends chat message
    F->>S: 2. Save message to DB (Encrypted at Rest)
    F->>E: 3. Trigger chat-handler Edge Function
    E->>S: 4. Fetch User Profile & Context (Tenant, Kids)
    S-->>E: 5. Return context
    E->>O: 6. Send anonymized prompt to LLM
    Note over O: OpenAI Zero Data Retention (ZDR) Active<br/>No prompts stored or used for training
    O-->>E: 7. Return AI Response stream
    E->>S: 8. Save AI response to DB
    S-->>F: 9. Realtime broadcast response to client
    F-->>U: 10. Display response to User
```

### Key Technical Safeguards
1. **Encryption in Transit:** All traffic between the User, Fly.io, Supabase, and OpenAI is encrypted via TLS 1.2+.
2. **Encryption at Rest:** Supabase PostgreSQL database volumes are encrypted at rest using AES-256.
3. **Data Segregation:** Row Level Security (RLS) policies in Supabase ensure users can only access their own profile and chat data. Super Admins access is tightly controlled via `tenant_id` scoping.
4. **Third-Party Processing:** OpenAI is restricted to processing prompts purely in-memory. Zero Data Retention ensures no PHI is persisted on their servers.
