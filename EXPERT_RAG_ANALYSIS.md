# Expert RAG System Analysis

## Current State: What's Working

### ✅ Database Structure
- **Expert Embeddings Table**: `expert_embeddings` table exists with vector support
- **Expert Profiles**: All 6 experts have complete profiles in `profiles` table
- **Chat Context**: Session history and message storage working
- **Edge Functions**: RAG infrastructure in place

### ✅ RAG Infrastructure
- **Semantic Search Function**: `findMatchingExpertsBySemantic()` implemented
- **OpenAI Embeddings**: Using `text-embedding-3-small` model
- **Vector Similarity**: `find_similar_experts` RPC function available
- **Embedding Generation**: `generate_expert_embeddings` function exists

### ✅ Chat Memory System
- **Recent Messages**: Function retrieves last 15 messages from session
- **Session History**: Loads previous session summaries
- **Context Building**: `getEnhancedChatContext()` aggregates all context

## Current Issues: What's Broken

### ❌ Expert Coverage Problem
```sql
-- Only 3 out of 6 experts have embeddings
SELECT first_name, expert_specialties,
       CASE WHEN e.expert_id IS NOT NULL THEN 'HAS EMBEDDING' ELSE 'MISSING' END as embedding_status
FROM profiles p
LEFT JOIN expert_embeddings e ON p.id = e.expert_id
WHERE account_type = 'expert';
```

**Result:**
- ✅ **Becca** (Pelvic Floor) - HAS EMBEDDING
- ❌ **Francie** (Breastfeeding) - MISSING
- ❌ **Haley** (Chiropractor) - MISSING
- ❌ **Karen** (Family Dynamics) - MISSING
- ✅ **Radhika** (Yoga) - HAS EMBEDDING
- ✅ **Sarah** (Sleep Training) - HAS EMBEDDING

### ❌ Poor Quality Embeddings
Current embeddings contain generic placeholder text:
```
"Expert: Sarah\nBio: Experienced professional ready to help with family and parenting guidance.\nSpecialties: General Parenting Support"
```

**Should be:**
```
"Expert: Sarah\nBio: A gentle sleep coach who helps families create restful routines...\nSpecialties: Sleep Training"
```

### ❌ Fallback to Keywords Instead of RAG
The `chat_ai_fixed` function currently:
1. Tries keyword matching first (hardcoded "Katie" instead of "Sarah")
2. Falls back to semantic search only if keywords fail
3. **Should be:** Use RAG as primary method, keywords as fallback

### ❌ Incomplete Chat Context
Current context includes:
- ✅ Parent profile
- ✅ Children information
- ✅ Recent messages (last 15)
- ✅ Session summaries
- ❌ **Missing**: Last 4 messages specifically highlighted for immediate context

## Expert Specialties Mapping

### Current Experts and Their Domains:
1. **Sarah** - Sleep Training
   - Keywords: sleep, bedtime, naps, night wakings, sleep training, rest

2. **Francie** - Breastfeeding/Lactation
   - Keywords: breastfeeding, nursing, lactation, feeding, milk, latch

3. **Becca** - Pelvic Floor/Postpartum
   - Keywords: pelvic floor, pregnancy, postpartum, recovery, core strength, labor prep

4. **Haley** - Pediatric Chiropractic
   - Keywords: chiropractic, alignment, nervous system, infant tension, physical development

5. **Karen** - Family Dynamics/Lifestyle
   - Keywords: family dynamics, lifestyle, postpartum identity, emotional support, balance

6. **Radhika** - Prenatal/Postnatal Yoga
   - Keywords: yoga, prenatal, postnatal, mindfulness, breathing, movement

## Required Fixes

### 1. Generate Missing Embeddings
```typescript
// Call generate_expert_embeddings function
await supabase.functions.invoke('generate_expert_embeddings', {
  body: { regenerate_all: true }
});
```

### 2. Fix RAG Flow Priority
Current flow (WRONG):
```
keyword_match() → semantic_search() → general_browsing()
```

Should be (CORRECT):
```
semantic_search() → keyword_match() → general_browsing()
```

### 3. Enhance Chat Context for Memory
Current: Gets last 15 messages
Should:
- Highlight last 4 messages for immediate context
- Include session summaries for long-term memory
- Provide clear conversation continuity

### 4. Semantic Search Query Enhancement
Improve embedding queries to match:
- Specific symptoms/issues → Relevant experts
- General topics → Multiple relevant experts
- Urgent queries → Immediate expert suggestions

## Success Metrics

### After Fixes:
1. **Query**: "My baby won't sleep" → **Result**: Sarah (Sleep Training)
2. **Query**: "Trouble breastfeeding" → **Result**: Francie (Lactation)
3. **Query**: "Back pain after delivery" → **Result**: Becca (Pelvic Floor)
4. **Query**: "Baby seems tense" → **Result**: Haley (Chiropractic)
5. **Query**: "Feeling overwhelmed as new mom" → **Result**: Karen (Family Dynamics)
6. **Query**: "Want gentle exercise during pregnancy" → **Result**: Radhika (Yoga)

### Expected RAG Behavior:
- **High relevance queries** (0.8+ similarity) → Show 1-2 most relevant experts
- **Medium relevance queries** (0.6-0.8 similarity) → Show 2-3 relevant experts
- **Low relevance queries** (<0.6 similarity) → Fall back to keyword matching
- **General browsing** ("show me experts") → Show all experts

## Implementation Priority

1. **HIGH**: Generate missing embeddings for 3 experts
2. **HIGH**: Fix RAG flow to prioritize semantic search
3. **MEDIUM**: Enhance chat context with last 4 messages emphasis
4. **LOW**: Optimize similarity thresholds based on testing