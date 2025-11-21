# Whispéroo Setup Guide

## Overview
Whispéroo is a family-focused chat application that enables parents to have AI-powered conversations about their children, with comprehensive session management and context retention.

## Database Architecture

### Core Tables
- **`profiles`** - Parent/user accounts (extends Supabase auth)
- **`children`** - Child profiles linked to parents
- **`sessions`** - Chat conversation sessions
- **`messages`** - Individual chat messages within sessions
- **`expert_documents`** - Vector knowledge base for expert advice

### Key Features
- **UUID Primary Keys** - Scalable, non-sequential identifiers
- **Row Level Security (RLS)** - Data isolation between families
- **Vector Search** - AI-powered expert knowledge retrieval
- **Session Memory** - Conversation context and summarization

## Setup Instructions

### 1. Apply Database Migration

The migration file is located at:
```
supabase/migrations/20250701000001_initial_whisperoo_schema.sql
```

**Option A: Using Supabase CLI**
```bash
cd whisperoo-family-bloom
supabase db push
```

**Option B: Using Supabase Dashboard**
1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy and paste the contents of the migration file
4. Execute the SQL

### 2. Deploy Edge Functions

Deploy the two Edge Functions for chat functionality:

```bash
cd whisperoo-family-bloom

# Deploy session summary function
supabase functions deploy fn_update_session_summary

# Deploy chat context function  
supabase functions deploy fn_get_chat_context
```

### 3. Environment Variables

Set these environment variables in your Supabase project:

```bash
# Required for Edge Functions
OPENAI_API_KEY=your_openai_api_key_here
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 4. Test Database Security

Once the migration is applied, test that RLS policies work correctly:

```sql
-- Test as authenticated user
SELECT * FROM profiles;  -- Should only show your profile
SELECT * FROM children;  -- Should only show your children
SELECT * FROM sessions;  -- Should only show your sessions
```

## Edge Functions

### fn_update_session_summary
**Purpose**: Automatically summarizes conversation history using AI

**Usage**:
```typescript
const { data } = await supabase.functions.invoke('fn_update_session_summary', {
  body: { session_id: 'your-session-uuid' }
});
```

**Function**: 
- Retrieves last 10 messages from a session
- Calls OpenAI to generate a concise summary
- Updates the session's summary field
- Used for maintaining conversation context

### fn_get_chat_context  
**Purpose**: Retrieves complete context for AI chat prompts

**Usage**:
```typescript
const { data } = await supabase.functions.invoke('fn_get_chat_context', {
  body: { 
    parent_id: 'parent-uuid',
    child_id: 'child-uuid', // optional
    limit: 20 // optional, defaults to 20
  }
});
```

**Returns**:
```typescript
{
  child_profile?: {
    id: string;
    first_name: string;
    birth_date: string | null;
    age_in_months?: number;
    gender: string | null;
    notes: string | null;
  };
  session_summary: string;
  recent_messages: Message[];
  session_id?: string;
}
```

## Integration with Frontend

### 1. Install Supabase Client
```bash
npm install @supabase/supabase-js
```

### 2. Update Environment Variables
Add to your `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=your_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

### 3. Example Chat Implementation
```typescript
// Initialize chat context
const { data: context } = await supabase.functions.invoke('fn_get_chat_context', {
  body: { parent_id: user.id, child_id: selectedChild.id }
});

// Send message to AI with context
const aiResponse = await callOpenAI({
  context: context.context,
  userMessage: "My 3-year-old won't eat vegetables"
});

// Save messages to database
await supabase.from('messages').insert([
  {
    session_id: context.context.session_id,
    parent_id: user.id,
    role: 'user',
    content: userMessage
  },
  {
    session_id: context.context.session_id,
    parent_id: user.id,
    role: 'assistant', 
    content: aiResponse
  }
]);

// Update session summary periodically
await supabase.functions.invoke('fn_update_session_summary', {
  body: { session_id: context.context.session_id }
});
```

## Data Flow

1. **User Login** → Profile created/retrieved from `profiles`
2. **Add Children** → Child profiles stored in `children` table
3. **Start Chat** → New session created in `sessions` table
4. **Send Message** → Message stored in `messages` table
5. **Get AI Response** → Context retrieved via `fn_get_chat_context`
6. **Store AI Response** → AI message saved to `messages`
7. **Summarize** → Periodic calls to `fn_update_session_summary`

## Security Features

### Row Level Security Policies
- **Profiles**: Users can only access their own profile
- **Children**: Parents can only access their own children
- **Sessions**: Parents can only access their own chat sessions  
- **Messages**: Parents can only access messages from their sessions
- **Expert Documents**: Read-only access for all authenticated users

### Best Practices
- All user data is isolated by `auth.uid()`
- Service role key required for Edge Functions
- CORS headers configured for browser requests
- Input validation on all Edge Function parameters

## Future Enhancements

### Planned Features
- **Appointments** - Schedule expert consultations
- **File Upload** - Voice notes and images in chat
- **Multi-tenant** - Organization-level access control
- **Billing** - Subscription and usage tracking
- **Expert Matching** - Connect with child development specialists

### Scaling Considerations
- Vector index optimization for large knowledge bases
- Message archival for long-running sessions
- Caching layer for frequently accessed context
- Rate limiting on Edge Functions

## Troubleshooting

### Common Issues

**Migration Fails**
- Ensure pgvector extension is available
- Check for conflicting table names
- Verify Supabase project permissions

**Edge Functions Not Working**
- Verify environment variables are set
- Check function logs in Supabase dashboard
- Ensure OpenAI API key has sufficient credits

**RLS Policies Block Access**
- Test with service role key
- Check auth.uid() returns expected value
- Verify foreign key relationships are correct

### Support Resources
- [Supabase Documentation](https://supabase.com/docs)
- [Edge Functions Guide](https://supabase.com/docs/guides/functions)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)