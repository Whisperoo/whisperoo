import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '') || '';
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    // SOW 3.2: Fetch user's tenant_id for expert prioritization
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('tenant_id, topics_of_interest, expecting_status, parenting_styles, personal_context')
      .eq('id', user.id)
      .single();

    const userTenantId = userProfile?.tenant_id || null;
    const userTopics: string[] = userProfile?.topics_of_interest || [];
    const userExpectingStatus: string = userProfile?.expecting_status || '';
    const userParentingStyles: string[] = userProfile?.parenting_styles || [];
    const userPersonalContext: string = userProfile?.personal_context || '';

    // If user has tenant, fetch expert_boost_ids from tenant config
    let expertBoostIds: string[] = [];
    if (userTenantId) {
      const { data: tenantData } = await supabase
        .from('tenants')
        .select('config')
        .eq('id', userTenantId)
        .single();
      expertBoostIds = (tenantData?.config as any)?.expert_boost_ids || [];
    }

    const { message, sessionId, childId } = await req.json();

    // 1.1 & 1.2 High-Risk Flags & Intent Classification
    const ESCALATION_KEYWORDS = [
      "suicide", "bleeding", "emergency", "fever over", "self-harm", "harm", "kill",
      "choking", "seizure", "not breathing", "unconscious", "blue lips", "high fever", 
      "head injury", "poisoning", "anaphylaxis", "allergic reaction", "swallowed", "overdose",
      "want to die", "kill myself", "end my life", "hurting myself", "cutting", "depression", 
      "depressed", "hopeless", "worthless", "abuse", "domestic violence", "hitting", "shaking baby", 
      "unsafe", "neglect", "911", "call 911", "ambulance", "hospital now"
    ];
    
    const MEDICAL_KEYWORDS = [
      "diagnose", "prescription", "medication", "dosage", "symptoms of", 
      "treatment", "medicine", "tylenol", "advil", "ibuprofen", "motrin", "doctor"
    ];

    const messageLower = message.toLowerCase();
    const matchedEscalationKeywords = ESCALATION_KEYWORDS.filter(keyword => messageLower.includes(keyword));
    const isEscalation = matchedEscalationKeywords.length > 0;
    
    const isMedicalQuestion = !isEscalation && MEDICAL_KEYWORDS.some(keyword => messageLower.includes(keyword));
    
    let intent = 'general';
    if (isEscalation) intent = 'escalation';
    else if (isMedicalQuestion) intent = 'medical_question';

    // ── Admin Dashboard: Category tagging ────────────────────────
    // Maps message content to one of 6 display categories for the
    // AI Interaction Audit Trail and Common Concern Themes chart.
    // Written into messages.metadata.category — no schema change needed.
    const detectMessageCategory = (text: string): string => {
      const t = text.toLowerCase();
      if (
        t.includes('breastfeed') || t.includes('nursing') ||
        t.includes('latch') || t.includes('milk supply') ||
        t.includes('pump') || t.includes('weaning') ||
        t.includes('formula') || t.includes('bottle feed')
      ) return 'Breastfeeding Support';

      if (
        t.includes('lactation') || t.includes('lactation consultant')
      ) return 'Lactation Consultation';

      if (
        t.includes('depress') || t.includes('anxiet') ||
        t.includes('hopeless') || t.includes('worthless') ||
        t.includes('mental health') || t.includes('overwhelmed') ||
        t.includes('postpartum depression') || t.includes('ppd') ||
        t.includes('self-harm') || t.includes('harm') ||
        t.includes('suicide') || t.includes('want to die')
      ) return 'Mental Health';

      if (
        t.includes('postpartum') || t.includes('recovery') ||
        t.includes('pelvic floor') || t.includes('perineal') ||
        t.includes('c-section') || t.includes('bleeding') ||
        t.includes('lochia') || t.includes('after birth') ||
        t.includes('6 week') || t.includes('six week')
      ) return 'Postpartum Recovery';

      if (
        t.includes('sleep') || t.includes('bedtime') ||
        t.includes('nap') || t.includes('night waking') ||
        t.includes('sids') || t.includes('safe sleep') ||
        t.includes('swaddle') || t.includes('colic') ||
        t.includes('milestone') || t.includes('crawl') ||
        t.includes('walk') || t.includes('teethe') ||
        t.includes('solid') || t.includes('first food')
      ) return 'Infant Care';

      return 'General Parenting';
    };

    const messageCategory = detectMessageCategory(messageLower);

    let currentSessionId = sessionId;
    if (!currentSessionId) {
      const { data: newSession, error: sessionError } = await supabase
        .from('sessions')
        .insert({
          user_id: user.id,
          child_id: childId || null,
          title: message.substring(0, 50) + '...',
          is_active: true
        })
        .select()
        .single();

      if (sessionError) throw sessionError;
      currentSessionId = newSession.id;
    }

    // 1.4 Store user message with audit logging, detailed flag reason, and category tag
    const metadataToStore: any = {
      child_id: childId,
      flagged: isEscalation,
      intent: intent,
      category: messageCategory  // Powers admin AI Audit Trail + Concern Themes chart
    };
    if (isEscalation) {
      metadataToStore.flag_reason = `Escalation keywords detected: ${matchedEscalationKeywords.join(', ')}`;
    }

    const { error: messageError } = await supabase
      .from('messages')
      .insert({
        session_id: currentSessionId,
        role: 'user',
        content: message,
        metadata: metadataToStore,
        is_flagged_for_review: isEscalation
      });

    if (messageError) throw messageError;

    let aiResponse = "";
    let matchedExperts = [];

    if (isEscalation) {
      // 1.1 Override Generation with Escalation Response
      aiResponse = "Please see your provider immediately or call emergency services if this is a medical emergency. As an AI parenting assistant, I am not equipped to handle medical emergencies or provide clinical diagnoses. Your safety and your child's safety is the highest priority.";
    } else {
      // Get enhanced chat context
      const context = await getEnhancedChatContext(supabase, user.id, childId, currentSessionId);

      // ── Expert matching: semantics-first, max 3, NO fallback to all experts ──
      // We no longer dump all experts into the prompt. Only send those whose
      // embeddings match the user's specific query. This prevents the AI from
      // recommending every expert regardless of relevance.
      matchedExperts = await findMatchingExpertsRAGFirst(supabase, message, userTenantId, expertBoostIds);

      // RAG-FIRST Compliance Training Match
      const complianceContext = await getComplianceTrainingContext(supabase, message);

      // Generate AI response — now includes user's onboarding interests
      aiResponse = await generateEnhancedAIResponse(
        message, context, matchedExperts, intent, complianceContext,
        { topics: userTopics, expectingStatus: userExpectingStatus, parentingStyles: userParentingStyles, personalContext: userPersonalContext }
      );
    }

    // Store AI response
    const { error: aiMessageError } = await supabase
      .from('messages')
      .insert({
        session_id: currentSessionId,
        role: 'assistant',
        content: aiResponse,
        metadata: {
          child_id: childId,
          expert_suggestions: matchedExperts.length > 0 ? matchedExperts : undefined,
          original_user_query: message
        }
      });

    if (aiMessageError) throw aiMessageError;

    // Update session timestamp
    await supabase
      .from('sessions')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', currentSessionId);

    // Check for session summary update (every 10 messages)
    const { count } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', currentSessionId);

    if (count && count % 10 === 0) {
      await supabase.functions.invoke('fn_update_session_summary', {
        body: { session_id: currentSessionId }
      });
    }

    return new Response(
      JSON.stringify({
        response: aiResponse,
        sessionId: currentSessionId,
        expertSuggestions: matchedExperts
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error('Error in chat_ai function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    );
  }
});

// Fetch compliance training examples for system prompt self-learning
async function getComplianceTrainingContext(supabase, message) {
  try {
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) return "";

    const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${openaiApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'text-embedding-3-small', input: message, encoding_format: 'float' })
    });

    if (!embeddingResponse.ok) return "";

    const embeddingData = await embeddingResponse.json();
    const queryEmbedding = embeddingData.data[0].embedding;

    const { data: complianceMatches, error } = await supabase.rpc('match_compliance_training', {
      query_embedding: queryEmbedding,
      match_threshold: 0.20,
      match_count: 2
    });

    if (error || !complianceMatches || complianceMatches.length === 0) return "";

    let context = `\n\nCOMPLIANCE TRAINING EXAMPLES (Self-Learned Guidelines):`;
    context += `\nThe testing team has flagged similar past interactions. Please review these approved examples for how to handle this query properly:`;
    
    complianceMatches.forEach((match, idx) => {
      context += `\nExample ${idx + 1} (${match.classification.replace(/_/g, ' ')}):`;
      context += `\n- Similar User Query: ${match.user_query}`;
      context += `\n- Approved Correct Response / Guidelines: Avoid repeating the error related to ${match.classification}. Take a safer, more appropriate approach similar to: "${match.ai_response.substring(0, 200)}..."`;
    });
    
    return context + "\n\nCRITICAL: Adjust your response style to align with these approved training examples.";

  } catch (err) {
    console.error('Error fetching compliance context:', err);
    return "";
  }
}

// SOW 3.2: Tenant-aware expert prioritization
function prioritizeByTenant(experts, userTenantId, expertBoostIds = []) {
  return experts
    .map(expert => ({
      ...expert,
      is_hospital_partner:
        (expert.tenant_id && expert.tenant_id === userTenantId) ||
        expertBoostIds.includes(expert.id)
    }))
    .sort((a, b) => {
      // Tier 1: Hospital-affiliated experts first
      if (a.is_hospital_partner && !b.is_hospital_partner) return -1;
      if (!a.is_hospital_partner && b.is_hospital_partner) return 1;
      // Tier 2: Within same tier, sort by similarity score (if available), then rating
      if (a.similarity_score && b.similarity_score) return b.similarity_score - a.similarity_score;
      return (b.rating || 0) - (a.rating || 0);
    });
}

// Expert matching: semantic-first, max 3 experts, NO all-experts fallback
async function findMatchingExpertsRAGFirst(supabase, message, userTenantId = null, expertBoostIds = []) {
  console.log(`=== Expert Matching Started for: "${message}" ===`);

  // Only use semantic search — no all-experts fallback
  let experts = await findMatchingExpertsBySemantic(supabase, message);

  // Sort by similarity then rating
  experts.sort((a, b) => {
    if (a.similarity_score && b.similarity_score) return b.similarity_score - a.similarity_score;
    if (a.similarity_score && !b.similarity_score) return -1;
    if (!a.similarity_score && b.similarity_score) return 1;
    return (b.rating || 0) - (a.rating || 0);
  });

  // Apply tenant prioritization
  if (userTenantId && experts.length > 0) {
    experts = prioritizeByTenant(experts, userTenantId, expertBoostIds);
  }

  // Cap at 3 to avoid overwhelming the prompt with irrelevant suggestions
  const capped = experts.slice(0, 3);
  console.log(`Returning ${capped.length} experts (capped at 3 from ${experts.length} matches)`);
  return capped;
}

// Enhanced semantic search with proper similarity thresholds
async function findMatchingExpertsBySemantic(supabase, message) {
  try {
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      console.warn('OpenAI API key not available, skipping semantic search');
      return [];
    }

    // Generate embedding for user message
    const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: message,
        encoding_format: 'float'
      })
    });

    if (!embeddingResponse.ok) {
      console.error('Failed to generate embedding for user message');
      return [];
    }

    const embeddingData = await embeddingResponse.json();
    const queryEmbedding = embeddingData.data[0].embedding;

    // Search for similar experts with very permissive threshold for initial retrieval
    const { data: similarExperts, error } = await supabase.rpc('find_similar_experts', {
      query_embedding: queryEmbedding,
      match_threshold: 0.25,  // Very permissive to catch all potential matches
      match_count: 10        // Get more potential matches for AI to evaluate
    });

    if (error) {
      console.error('Error finding similar experts:', error);
      return [];
    }

    console.log(`Semantic search returned ${similarExperts?.length || 0} experts for query: "${message}"`);

    if (similarExperts && similarExperts.length > 0) {
      console.log('Similarity scores:', similarExperts.map(e => `${e.first_name}: ${e.similarity.toFixed(3)}`));
    }

    if (!similarExperts || similarExperts.length === 0) {
      console.log('No semantic matches found - will try keyword fallback');
      return [];
    }

    // Filter by similarity score and return formatted results - let AI decide relevance
    const filteredExperts = similarExperts
      .filter(expert => expert.similarity >= 0.30)  // Lowered to catch colloquial phrasing
      .map(expert => ({
        id: expert.expert_id,
        name: expert.first_name || 'Expert',
        specialty: expert.expert_specialties && expert.expert_specialties.length > 0
          ? expert.expert_specialties[0]
          : 'General',
        bio: expert.expert_bio || 'Experienced professional ready to help.',
        profile_image_url: expert.profile_image_url,
        rating: expert.expert_rating || 5.0,
        total_reviews: expert.expert_total_reviews || 0,
        consultation_fee: expert.expert_consultation_rate
          ? Math.round(expert.expert_consultation_rate * 100)
          : 10000,
        experience_years: expert.expert_experience_years,
        location: expert.expert_office_location,
        tenant_id: expert.tenant_id || null,
        similarity_score: expert.similarity
      }));

    return filteredExperts;

  } catch (error) {
    console.error('Error in semantic expert matching:', error);
    return [];
  }
}

// Keyword-based fallback for expert matching when semantic search misses
async function findMatchingExpertsByKeywords(supabase, message) {
  const messageLower = message.toLowerCase();

  // Specialty keyword maps
  const SPECIALTY_KEYWORDS = [
    {
      specialties: ['Pelvic Floor', 'Pelvic Health', 'Postpartum Recovery'],
      keywords: ['pee', 'leak', 'leaking', 'incontinence', 'pelvic', 'sneeze', 'kegel',
                 'bladder', 'pelvic floor', 'prolapse', 'diastasis', 'core recovery',
                 'postpartum body', 'perineal', 'vaginal pressure']
    },
    {
      specialties: ['Sleep Training', 'Sleep', 'Infant Sleep'],
      keywords: ['sleep', 'bedtime', 'nap', 'night waking', 'sleep training',
                 'won\'t sleep', 'crying at night', 'sleep regression']
    },
    {
      specialties: ['Breastfeeding', 'Lactation', 'Feeding'],
      keywords: ['breastfeed', 'nursing', 'lactation', 'latch', 'milk supply',
                 'bottle', 'pumping', 'weaning', 'formula']
    },
    {
      specialties: ['Chiropractic', 'Pediatric Chiropractic'],
      keywords: ['chiropractic', 'alignment', 'tension', 'colic', 'torticollis',
                 'spine', 'nervous system']
    },
    {
      specialties: ['Yoga', 'Prenatal Yoga', 'Postnatal Yoga'],
      keywords: ['yoga', 'prenatal exercise', 'postnatal exercise', 'mindfulness',
                 'breathing exercise', 'meditation', 'stretch']
    },
    {
      specialties: ['Family Dynamics', 'Lifestyle', 'Emotional Support'],
      keywords: ['overwhelmed', 'relationship', 'partner', 'family dynamics',
                 'identity', 'balance', 'stress', 'mental health', 'postpartum depression']
    }
  ];

  // Find which specialties match the user's message
  const matchedSpecialtyGroups = SPECIALTY_KEYWORDS.filter(group =>
    group.keywords.some(keyword => messageLower.includes(keyword))
  );

  if (matchedSpecialtyGroups.length === 0) return [];

  // Get all matched specialty names
  const matchedSpecialties = matchedSpecialtyGroups.flatMap(g => g.specialties);

  try {
    // Query experts whose specialties overlap with matched keywords
    const { data: experts, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('account_type', 'expert')
      .eq('expert_verified', true)
      .eq('expert_profile_visibility', true)
      .eq('expert_accepts_new_clients', true)
      .order('first_name');

    if (error || !experts) return [];

    // Filter experts whose specialties overlap with matched keywords
    const matchingExperts = experts.filter(expert => {
      const expertSpecs = expert.expert_specialties || [];
      return expertSpecs.some(spec =>
        matchedSpecialties.some(ms =>
          spec.toLowerCase().includes(ms.toLowerCase()) ||
          ms.toLowerCase().includes(spec.toLowerCase())
        )
      );
    });

    return matchingExperts.map(expert => ({
      id: expert.id,
      name: expert.first_name || 'Expert',
      specialty: expert.expert_specialties?.[0] || 'General',
      bio: expert.expert_bio || 'Experienced professional ready to help.',
      profile_image_url: expert.profile_image_url,
      rating: expert.expert_rating || 5.0,
      total_reviews: expert.expert_total_reviews || 0,
      consultation_fee: expert.expert_consultation_rate
        ? Math.round(expert.expert_consultation_rate * 100)
        : 10000,
      experience_years: expert.expert_experience_years,
      location: expert.expert_office_location,
      tenant_id: expert.tenant_id || null
    }));
  } catch (err) {
    console.error('Error in keyword expert fallback:', err);
    return [];
  }
}


// Get ALL available experts for general browsing
async function getAllAvailableExperts(supabase) {
  try {
    const { data: experts, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('account_type', 'expert')
      .eq('expert_verified', true)
      .eq('expert_profile_visibility', true)
      .eq('expert_accepts_new_clients', true)
      .order('first_name');

    if (error) {
      console.error('Error getting all experts:', error);
      return [];
    }

    return (experts || []).map(expert => ({
      id: expert.id,
      name: expert.first_name || 'Expert',
      specialty: expert.expert_specialties && expert.expert_specialties.length > 0
        ? expert.expert_specialties[0]
        : 'General Parenting',
      bio: expert.expert_bio || 'Experienced professional ready to help with parenting guidance.',
      profile_image_url: expert.profile_image_url,
      rating: expert.expert_rating || 5.0,
      total_reviews: expert.expert_total_reviews || 0,
      consultation_fee: expert.expert_consultation_rate
        ? Math.round(expert.expert_consultation_rate * 100)
        : 10000,
      experience_years: expert.expert_experience_years,
      location: expert.expert_office_location,
      tenant_id: expert.tenant_id || null
    }));

  } catch (error) {
    console.error('Error in getAllAvailableExperts:', error);
    return [];
  }
}

// Enhanced chat context with emphasis on last 4 messages
async function getEnhancedChatContext(supabase, userId, childId, sessionId) {
  const { data: parentProfile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  const { data: allChildren } = await supabase
    .from('kids')
    .select('*')
    .eq('parent_id', userId)
    .order('created_at', { ascending: true });

  const currentChild = childId ? allChildren?.find(child => child.id === childId) : null;

  let recentMessages = [];
  let lastFourMessages = [];
  let currentSessionSummary = '';
  let conversationHistory = '';

  if (sessionId) {
    // Get current session summary if it exists
    const { data: currentSession } = await supabase
      .from('sessions')
      .select('summary, created_at')
      .eq('id', sessionId)
      .single();

    if (currentSession?.summary) {
      currentSessionSummary = currentSession.summary;
    }

    const { data: messages } = await supabase
      .from('messages')
      .select('content, role, created_at')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })
      .limit(8); // Get more messages but emphasize recent ones

    if (messages && messages.length > 0) {
      const reversedMessages = messages.reverse();

      // Separate last 4 messages from earlier ones
      const earlierMessages = reversedMessages.slice(0, -4);
      const recentFourMessages = reversedMessages.slice(-4);

      let historyText = '';

      // Add earlier messages with less detail
      if (earlierMessages.length > 0) {
        const earlierSummary = earlierMessages
          .map(msg => `${msg.role}: ${msg.content.substring(0, 100)}${msg.content.length > 100 ? '...' : ''}`)
          .join('\n');
        historyText += `Earlier conversation:\n${earlierSummary}\n\n`;
      }

      // Add recent 4 messages with full detail
      if (recentFourMessages.length > 0) {
        const recentDetail = recentFourMessages
          .map(msg => `${msg.role}: ${msg.content}`)
          .join('\n');
        historyText += `Recent conversation (most important):\n${recentDetail}`;
      }

      conversationHistory = historyText;
      recentMessages = messages || [];
      lastFourMessages = recentFourMessages || [];
    }
  }

  // Get session history with smart filtering
  const { data: allSessionHistory } = await supabase
    .from('sessions')
    .select('id, summary, last_message_at, child_id, title, created_at')
    .eq('user_id', userId)
    .not('summary', 'is', null)
    .neq('id', sessionId || '') // Exclude current session
    .order('last_message_at', { ascending: false });

  // Filter and prioritize session history
  let sessionHistory = [];
  if (allSessionHistory) {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Priority 1: Recent sessions (last 7 days)
    const recentSessions = allSessionHistory.filter(session =>
      new Date(session.last_message_at) >= sevenDaysAgo
    );

    // Priority 2: Sessions about the same child (if childId provided)
    const childRelatedSessions = childId ? allSessionHistory.filter(session =>
      session.child_id === childId
    ) : [];

    // Combine and deduplicate, limit to 10 most relevant
    const combinedSessions = [...recentSessions];
    childRelatedSessions.forEach(session => {
      if (!combinedSessions.find(s => s.id === session.id)) {
        combinedSessions.push(session);
      }
    });

    sessionHistory = combinedSessions.slice(0, 10);
  }

  return {
    parentProfile,
    allChildren: allChildren || [],
    currentChild,
    recentMessages: recentMessages,
    lastFourMessages,  // Specifically highlighted last 4 messages
    conversationHistory, // Current session conversation history
    currentSessionSummary, // Summary of current session if exists
    sessionHistory: sessionHistory || []
  };
}

// Enhanced AI response generation with user interest context
async function generateEnhancedAIResponse(
  message, context, matchedExperts, intent = 'general', complianceContext = '',
  userInterests: { topics: string[]; expectingStatus: string; parentingStyles: string[]; personalContext: string } = { topics: [], expectingStatus: '', parentingStyles: [], personalContext: '' }
) {
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiApiKey) {
    return "I'm sorry, I'm having trouble connecting to my AI service right now. Please try again later.";
  }

  let systemPrompt = `You are Whisperoo's AI parenting assistant — focused exclusively on pregnancy, postpartum, baby care, and parenting support. Provide helpful, personalized responses ONLY within this scope.
CRITICAL MEDICAL GUARDRAIL: Under no circumstances should you diagnose medical conditions, suggest medications, or replace a doctor's advice. You are strictly for educational and supportive purposes. If a parent asks for clinical advice or details severe symptoms, gently but firmly advise them to contact their healthcare provider right away.
SCOPE GUARDRAIL: You MUST only answer questions related to pregnancy, prenatal care, postpartum recovery, baby care, child development, and parenting. If a user asks about anything outside this scope (e.g., cooking recipes unrelated to baby nutrition, tech support, travel advice, politics, general knowledge), respond with: "That's a bit outside the type of support I'm built for. I'm here to help with pregnancy, postpartum, baby, and parenting questions — and guide you to the right next step there. How can I help with that?"
Do NOT act as a general-purpose AI assistant. Do NOT answer off-topic questions even if you know the answer. Stay in your lane.`;

  // 1.2 Inject explicit medical disclaimer rule if medical question detected
  if (intent === 'medical_question') {
    systemPrompt += `\n\nMEDICAL INTENT DETECTED: The user has asked a medical-related question. You MUST include a concise disclaimer in your response stating that you are an AI assistant and not a doctor, and gently advise them to consult their pediatrician or view our expert list before providing any educational context.`;
  }
  
  if (complianceContext) {
    systemPrompt += complianceContext;
  }

  systemPrompt += `\n\nPARENT: ${context.parentProfile?.first_name || 'Parent'}
- Role: ${context.parentProfile?.role || 'Not specified'}
- Expecting status: ${userInterests.expectingStatus || context.parentProfile?.expecting_status || 'Not specified'}
- Parenting styles: ${(userInterests.parentingStyles.length > 0 ? userInterests.parentingStyles : context.parentProfile?.parenting_styles)?.join(', ') || 'Not specified'}`;

  // Inject onboarding topics of interest — core to resource/expert relevance
  if (userInterests.topics && userInterests.topics.length > 0) {
    systemPrompt += `\n- Topics of interest (from onboarding): ${userInterests.topics.join(', ')}`;
    systemPrompt += `\n\nCRITICAL PERSONALIZATION RULE: This parent has told us they care about: ${userInterests.topics.join(', ')}. ONLY recommend experts or resources directly relevant to these interests AND their current question. Do NOT recommend experts outside these topics unless the user's question explicitly asks about a different area.`;
  }

  if (userInterests.personalContext) {
    systemPrompt += `\n- Personal context: ${userInterests.personalContext}`;
  }

  // Add children information
  if (context.allChildren && context.allChildren.length > 0) {
    systemPrompt += `\n\nYOUR CHILDREN:`;
    context.allChildren.forEach((child, index) => {
      if (child.is_expecting) {
        systemPrompt += `\n${index + 1}. ${child.expected_name || 'Baby'} (Expecting${child.due_date ? ', Due: ' + child.due_date : ''})`;
      } else {
        systemPrompt += `\n${index + 1}. ${child.first_name || 'Child'} (Age: ${child.age || 'Not specified'}${child.birth_date ? ', Born: ' + child.birth_date : ''})`;
      }
    });
  } else {
    systemPrompt += `\n\nYOUR CHILDREN: No children information available`;
  }

  // Add current child focus
  if (context.currentChild) {
    systemPrompt += `\n\nCURRENT CONVERSATION FOCUS: ${context.currentChild.first_name || context.currentChild.expected_name}, Age: ${context.currentChild.age || 'Not specified'}`;
  }

  // Add expert recommendations with hospital prioritization (SOW 3.1/3.2)
  if (matchedExperts.length > 0) {
    const hospitalExperts = matchedExperts.filter(e => e.is_hospital_partner);

    systemPrompt += `\n\nRELEVANT EXPERTS (max 3, semantically matched to this query):`;
    matchedExperts.forEach(expert => {
      const hospitalTag = expert.is_hospital_partner ? ' [🏥 Hospital Partner]' : '';
      systemPrompt += `\n- ${expert.name}${hospitalTag}, specializing in ${expert.specialty}`;
      if (expert.experience_years) systemPrompt += ` (${expert.experience_years} years experience)`;
      if (expert.similarity_score) systemPrompt += ` [Relevance: ${(expert.similarity_score * 100).toFixed(0)}%]`;
    });

    if (hospitalExperts.length > 0) {
      systemPrompt += `\n\nHOSPITAL EXPERT PRIORITY: Prioritize the [🏥 Hospital Partner] experts as they are directly connected to the user's healthcare network.`;
    }

    systemPrompt += `\n\nEXPERT RECOMMENDATION RULE: Only mention an expert if their specialty is directly and specifically relevant to the user's current message. If the query can be answered with general advice, do NOT suggest experts. Never suggest all experts — only the most relevant 1-2.`;
  } else {
    systemPrompt += `\n\nNo experts closely matched this query — do NOT fabricate or suggest any expert names. Answer the question with general parenting guidance.`;
  }

  // Add session history from previous conversations
  if (context.sessionHistory && context.sessionHistory.length > 0) {
    systemPrompt += `\n\nPREVIOUS CONVERSATION HISTORY:`;
    context.sessionHistory.forEach((session, index) => {
      const sessionDate = new Date(session.last_message_at).toLocaleDateString();
      const childContext = session.child_id && context.allChildren ?
        context.allChildren.find(c => c.id === session.child_id)?.first_name : null;

      systemPrompt += `\n${index + 1}. [${sessionDate}${childContext ? `, about ${childContext}` : ''}]: ${session.summary}`;
    });
    systemPrompt += `\n\nIMPORTANT: Use this history to provide continuity and avoid repeating advice. Reference previous discussions when relevant.`;
  }

  // Add current session summary if available
  if (context.currentSessionSummary) {
    systemPrompt += `\n\nCURRENT SESSION SUMMARY: ${context.currentSessionSummary}`;
  }

  // Enhanced context with emphasis on last 4 messages
  if (context.lastFourMessages && context.lastFourMessages.length > 0) {
    systemPrompt += `\n\nIMMEDIATE CONVERSATION CONTEXT (Last 4 messages):`;
    context.lastFourMessages.forEach((msg, index) => {
      systemPrompt += `\n${index + 1}. ${msg.role === 'user' ? 'Parent' : 'Assistant'}: ${msg.content.substring(0, 100)}...`;
    });
  }

  systemPrompt += `\n\nFORMATTING GUIDELINES:
- When creating numbered lists, use proper sequential numbering: 1., 2., 3., etc.
- When creating bullet points, use consistent bullet symbols: - or •
- NEVER use "1." for every item in a numbered list
- Double-check that numbered lists increment properly (1., 2., 3., 4., not 1., 1., 1., 1.)
- For step-by-step instructions, always use sequential numbers

GUIDELINES:
- You have access to information about all of the user's children listed in the YOUR CHILDREN section
- When asked about their kids, provide the names and ages from that section
- Always reference children by name when discussing parenting topics
- Be helpful and provide specific guidance
- When experts are available, mention them by name and specialty
- NEVER invent expert names - only mention the ones provided above
- Be warm and supportive
- Keep responses concise but informative
- Use proper list formatting as specified above
- NEVER answer questions outside of pregnancy, postpartum, baby care, child development, and parenting
- If the user tries to use you as a general AI chatbot, gently redirect them back to parenting topics
- You are NOT a general-purpose assistant — you are a specialized parenting companion`;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...context.recentMessages.slice(-4).map(m => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.content
    })),
    { role: 'user', content: message }
  ];

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages,
        max_tokens: 1024,
        temperature: 0.2
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || "I'm sorry, I couldn't generate a response right now.";

  } catch (error) {
    console.error('OpenAI API error:', error);
    return "I'm experiencing some technical difficulties. Please try again in a moment.";
  }
}