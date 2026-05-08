import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

// Helper to detect language from message content
function detectLanguage(message: string): string | null {
  const m = message.toLowerCase();
  
  // Spanish keywords
  const esKeywords = ['hola', 'bebe', 'niño', 'niña', 'embarazo', 'parto', 'leche', 'pecho', 'sueño', 'llanto'];
  if (esKeywords.some(kw => m.includes(kw))) return 'es';
  
  // Vietnamese keywords
  const viKeywords = ['xin chào', 'bé', 'em bé', 'mang thai', 'sinh con', 'sữa', 'ngủ', 'khóc'];
  if (viKeywords.some(kw => m.includes(kw))) return 'vi';
  
  return null;
}

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
      .select('tenant_id, topics_of_interest, expecting_status, parenting_styles, personal_context, language_preference')
      .eq('id', user.id)
      .single();

    const userTenantId = userProfile?.tenant_id || null;
    const userTopics: string[] = userProfile?.topics_of_interest || [];
    const userExpectingStatus: string = userProfile?.expecting_status || '';
    const userParentingStyles: string[] = userProfile?.parenting_styles || [];
    const userPersonalContext: string = userProfile?.personal_context || '';
    const userLanguage: string = userProfile?.language_preference || 'en';

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
        t.includes('formula') || t.includes('bottle feed') ||
        t.includes('lactation')
      ) return 'Baby Feeding';

      if (
        t.includes('depress') || t.includes('anxiet') ||
        t.includes('hopeless') || t.includes('worthless') ||
        t.includes('mental health') || t.includes('overwhelmed') ||
        t.includes('postpartum depression') || t.includes('ppd') ||
        t.includes('self-harm') || t.includes('harm') ||
        t.includes('suicide') || t.includes('nervous system') ||
        t.includes('stress') || t.includes('regulation')
      ) return 'Nervous System Regulation';

      if (
        t.includes('pelvic floor') || t.includes('perineal') ||
        t.includes('c-section') || t.includes('bleeding') ||
        t.includes('lochia') || t.includes('after birth') ||
        t.includes('recovery') || t.includes('vaginal pressure')
      ) return 'Pelvic Floor';

      if (
        t.includes('sleep') || t.includes('bedtime') ||
        t.includes('nap') || t.includes('night waking') ||
        t.includes('sleep training') || t.includes('regression')
      ) return 'Sleep Coaching';

      if (
        t.includes('yoga') || t.includes('fitness') ||
        t.includes('exercise') || t.includes('stretch') ||
        t.includes('workout')
      ) return 'Fitness/yoga';

      if (
        t.includes('teeth') || t.includes('dental') ||
        t.includes('cavity') || t.includes('brushing') ||
        t.includes('dentist')
      ) return 'Pediatric Dentistry';

      if (
        t.includes('work') || t.includes('career') ||
        t.includes('job') || t.includes('childcare') ||
        t.includes('daycare') || t.includes('nanny')
      ) return 'Back to Work';

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

    // Update user interests based on detected category — makes recommendations dynamic
    if (messageCategory && messageCategory !== 'General Parenting') {
      const updatedTopics = Array.from(new Set([...userTopics, messageCategory]));
      if (updatedTopics.length !== userTopics.length) {
        await supabase
          .from('profiles')
          .update({ topics_of_interest: updatedTopics })
          .eq('id', user.id);
      }
    }

    let aiResponse = "";
    let matchedExperts: any[] = [];
    let matchedProducts: any[] = [];
    let debugError: string | null = null;
    
    // SOW 1.1: Compliance context for medical questions
    const complianceContext = isMedicalQuestion ? 
      "The user is asking a medical question. Provide guidance but emphasize that this is not medical advice and recommend consulting a professional." : 
      "General parenting guidance.";

    if (isEscalation) {
      // 1.1 Override Generation with Escalation Response
      aiResponse = "Please see your provider immediately or call emergency services if this is a medical emergency. As an AI parenting assistant, I am not equipped to handle medical emergencies or provide clinical diagnoses. Your safety and your child's safety is the highest priority.";
    } else {
      // Get enhanced chat context
      const context = await getEnhancedChatContext(supabase, user.id, childId, currentSessionId);

      // ── Recurring Topic Detection ──
      // Count how many times this topic category has appeared in this session.
      // On 2nd+ mention, we proactively recommend matched experts.
      let isRecurringTopic = false;
      if (currentSessionId && messageCategory && messageCategory !== 'General Parenting') {
        const { data: prevMessages } = await supabase
          .from('messages')
          .select('metadata')
          .eq('session_id', currentSessionId)
          .eq('role', 'user');

        if (prevMessages) {
          const categoryCount = prevMessages.filter(
            m => (m.metadata as any)?.category === messageCategory
          ).length;
          // categoryCount >= 1 means there's already at least one prior message with this category
          // (the current message hasn't been counted yet since it was stored above)
          isRecurringTopic = categoryCount >= 1;
          if (isRecurringTopic) {
            console.log(`Recurring topic detected: "${messageCategory}" appeared ${categoryCount + 1} times — will recommend experts`);
          }
        }
      }

      // ── Expert/Resource matching: semantic + keyword ──
      matchedExperts = await findMatchingExpertsRAGFirst(supabase, message, userTenantId, expertBoostIds);
      matchedProducts = await findMatchingProductsRAG(supabase, message, userTopics);

      // Generate AI response — now includes user's onboarding interests and products
      const aiResult = await generateEnhancedAIResponse(
        message, context, matchedExperts, matchedProducts, intent, complianceContext,
        { topics: userTopics, expectingStatus: userExpectingStatus, parentingStyles: userParentingStyles, personalContext: userPersonalContext },
        userLanguage,
        isRecurringTopic
      );

      // Support returning { response, error } for debugging
      if (typeof aiResult === 'object' && aiResult !== null && 'response' in aiResult) {
        aiResponse = aiResult.response;
        debugError = aiResult.error || null;
      } else {
        aiResponse = aiResult;
      }

      // Handle language sync marker if user spoke in a different language
      const detectedLanguage = detectLanguage(messageLower);
      if (detectedLanguage && detectedLanguage !== userLanguage) {
        aiResponse += `\n\n[SWITCH_LANGUAGE:${detectedLanguage}]`;
      }
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
          original_user_query: message,
          ...(debugError ? { ai_error: debugError } : {})
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
        expertSuggestions: matchedExperts,
        ...(debugError ? { debug_error: debugError } : {})
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error('Error in chat_ai function:', error);
    return new Response(
      JSON.stringify({
        response: "I can still help with general parenting guidance right now. If this concern may be urgent or medical, please contact your provider.",
        sessionId: null,
        expertSuggestions: [],
        debug_error: `Outer catch: ${(error as any)?.message || String(error)}`
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
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
  console.log(`=== Expert Matching Started ===`);

  // Only use semantic search — no all-experts fallback
  let experts = await findMatchingExpertsBySemantic(supabase, message);

  // Fallback to keyword matching if semantic search returns no results
  if (experts.length === 0) {
    experts = await findMatchingExpertsByKeywords(supabase, message);
  }

  // Sort by similarity then rating
  experts.sort((a, b) => {
    if (a.similarity_score && b.similarity_score) return b.similarity_score - a.similarity_score;
    if (a.similarity_score && !b.similarity_score) return -1;
    if (!a.similarity_score && b.similarity_score) return 1;
    return (b.rating || 0) - (a.rating || 0);
  });

  // Apply tenant prioritization (hospital/boosted experts first)
  if (experts.length > 0) {
    experts = prioritizeByTenant(experts, userTenantId, expertBoostIds);
  }

  // Cap at 3 to avoid overwhelming the prompt with irrelevant suggestions
  const capped = experts.slice(0, 3);
  console.log(`Expert matching: found ${capped.length} semantic matches`);
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
      match_threshold: 0.15,  // Very permissive to catch all potential matches
      match_count: 10        // Get more potential matches for AI to evaluate
    });

    if (error) {
      console.error('Error finding similar experts:', error);
      return [];
    }

    console.log(`Similarity search returned ${similarExperts?.length || 0} candidates`);

    // Similarity scores removed for privacy

    if (!similarExperts || similarExperts.length === 0) {
      console.log('No semantic matches found - will try keyword fallback');
      return [];
    }

    // Filter by similarity score and return formatted results - let AI decide relevance
    const filteredExperts = similarExperts
      .filter(expert => expert.similarity >= 0.15)  // Lowered to catch colloquial phrasing
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


// Find relevant products/resources using semantic and keyword search
async function findMatchingProductsRAG(supabase, message, userTopics = []) {
  try {
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) return [];

    // 1. Semantic Search for Products
    const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${openaiApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'text-embedding-3-small', input: message, encoding_format: 'float' })
    });

    let semanticProducts = [];
    if (embeddingResponse.ok) {
      const embeddingData = await embeddingResponse.json();
      const queryEmbedding = embeddingData.data[0].embedding;

      const { data: matches, error } = await supabase.rpc('match_products_v2', {
        query_embedding: queryEmbedding,
        match_threshold: 0.2,
        match_count: 5
      });
      if (!error && matches) semanticProducts = matches;
    }

    // 2. Keyword Fallback (searching title, tags, description)
    const { data: allProducts } = await supabase
      .from('products')
      .select('id, title, description, tags, price, product_type')
      .eq('is_active', true)
      .limit(50);

    const messageLower = message.toLowerCase();
    const keywordProducts = (allProducts || []).filter(p => {
      const title = (p.title || '').toLowerCase();
      const desc = (p.description || '').toLowerCase();
      const tags = (p.tags || []).map(t => t.toLowerCase());
      return title.includes(messageLower) || 
             desc.includes(messageLower) || 
             tags.some(t => messageLower.includes(t)) ||
             userTopics.some(topic => title.includes(topic.toLowerCase()));
    });

    // Merge and deduplicate
    const seen = new Set();
    const results = [];
    
    [...semanticProducts, ...keywordProducts].forEach(p => {
      if (!seen.has(p.id)) {
        seen.add(p.id);
        results.push({
          id: p.id,
          title: p.title,
          type: p.product_type,
          price: p.price,
          description: p.description?.substring(0, 100) + '...'
        });
      }
    });

    return results.slice(0, 3);
  } catch (err) {
    console.error('Error finding products:', err);
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

    sessionHistory = combinedSessions.slice(0, 5);  // Reduced from 10 to 5 to cut token bloat
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

// Enhanced AI response generation with user interest and product context
async function generateEnhancedAIResponse(
  message, context, matchedExperts, matchedProducts = [], intent = 'general', complianceContext = '',
  userInterests: { topics: string[]; expectingStatus: string; parentingStyles: string[]; personalContext: string } = { topics: [], expectingStatus: '', parentingStyles: [], personalContext: '' },
  userLanguage: string = 'en',
  isRecurringTopic: boolean = false
) {
  const openaiApiKey = (Deno.env.get('OPENAI_API_KEY') || '').trim();
  if (!openaiApiKey) {
    console.error('CRITICAL: OPENAI_API_KEY is not set in Supabase Edge Function secrets. AI chat will use fallback responses only.');
    return { response: buildDeterministicFallbackResponse(message, matchedExperts, matchedProducts, intent, userLanguage), error: 'OPENAI_API_KEY is missing from Edge Function secrets' };
  }

  let systemPrompt = `Do NOT act as a general-purpose AI assistant. Do NOT answer off-topic questions even if you know the answer. Stay in your lane.

LANGUAGE SWITCHING RULE: If the user indicates they do not speak English, or if they speak in Spanish or Vietnamese while their current setting is English, you MUST:
1. Respond in THEIR language saying: "Ok, we'll update your language settings. You can always update your settings in your profile." (Translate this naturally).
2. End the response with a hidden marker: [SWITCH_LANGUAGE:code] where code is 'es' for Spanish or 'vi' for Vietnamese.
3. If they ask to switch back to English, use [SWITCH_LANGUAGE:en].`;

  // SOW 5.3: Respond in user's stored language preference
  const LANGUAGE_NAMES: Record<string, string> = {
    en: 'English',
    es: 'Spanish (Español)',
    vi: 'Vietnamese (Tiếng Việt)',
  };
  const languageName = LANGUAGE_NAMES[userLanguage] || 'English';

  if (userLanguage !== 'en') {
    systemPrompt += `\n\nLANGUAGE DIRECTIVE (CRITICAL): This user has selected ${languageName} as their preferred language. You MUST respond entirely in ${languageName}. Do NOT mix languages. Do NOT include English unless the user writes to you in English. Every word of your response — including expert names, disclaimers, and formatting — must be in ${languageName}.`;
  }

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

    if (isRecurringTopic) {
      // RECURRING TOPIC: The user has asked about this topic before — proactively recommend experts
      systemPrompt += `\n\nRECURRING TOPIC DETECTED: The user has asked about this topic multiple times in this conversation. This signals deeper interest or an ongoing concern. You MUST:
1. Provide your helpful answer as usual.
2. At the END of your response, add a section like: "Since you've been asking about [topic], I'd recommend connecting with one of our experts who specializes in this area:"
3. Recommend the most relevant 1-2 experts from the list above by name, specialty, and a brief reason why they'd be a great fit.
4. Frame it warmly and naturally — not as a sales pitch, but as a helpful next step.`;
    } else {
      systemPrompt += `\n\nEXPERT RECOMMENDATION RULE: Only mention an expert if their specialty is directly and specifically relevant to the user's current message. If the query can be answered with general advice, do NOT suggest experts. Never suggest all experts — only the most relevant 1-2.`;
    }
  } else {
    systemPrompt += `\n\nNo experts closely matched this query — do NOT fabricate or suggest any expert names. Answer the question with general parenting guidance.`;
  }

  // Add platform resources/products
  if (matchedProducts.length > 0) {
    systemPrompt += `\n\nRELEVANT PLATFORM RESOURCES (Products/Guides):`;
    matchedProducts.forEach(product => {
      systemPrompt += `\n- ${product.title} (${product.type === 'video' ? 'Video Guide' : product.type === 'consultation' ? 'Consultation' : 'Resource'}) - ${product.price === 0 ? 'Free' : '$' + (product.price / 100).toFixed(2)}`;
    });
    systemPrompt += `\n\nRESOURCE RECOMMENDATION RULE: If any of these resources are a perfect match for the user's question, mention them naturally in your response as a "helpful resource available in Whispéroo".`;
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

  // Don't duplicate conversation history: it's already in the system prompt via context.conversationHistory
  // Only add the current user message as a separate message object
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: message }
  ];

  try {
    const modelCandidates = ['gpt-4o-mini', 'gpt-4o', 'gpt-3.5-turbo'];
    let lastError: string | null = null;

    console.log(`OpenAI API key present: ${!!openaiApiKey}, length: ${openaiApiKey.length}, starts with: ${openaiApiKey.substring(0, 8)}...`);
    console.log(`System prompt length: ${systemPrompt.length} chars, ~${Math.ceil(systemPrompt.length / 4)} tokens`);

    for (const model of modelCandidates) {
      console.log(`Attempting OpenAI model: ${model}`);
      try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model,
            messages,
            max_tokens: 1024,
            temperature: 0.2
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          lastError = `${model}: HTTP ${response.status} - ${errorText.substring(0, 300)}`;
          console.error('OpenAI API error:', lastError);
          continue;
        }

        const data = await response.json();
        const content = data?.choices?.[0]?.message?.content;
        if (content && typeof content === 'string') {
          console.log(`OpenAI response received from model: ${model}, tokens used: ${data?.usage?.total_tokens || 'unknown'}`);
          return content;
        }
        lastError = `${model}: empty response content - ${JSON.stringify(data).substring(0, 200)}`;
      } catch (fetchError) {
        lastError = `${model}: fetch exception - ${(fetchError as any)?.message || String(fetchError)}`;
        console.error('OpenAI fetch error:', lastError);
        continue;
      }
    }

    console.error('All OpenAI model attempts failed:', lastError);
    console.error('FALLING BACK to deterministic safe response.');
    return { response: buildDeterministicFallbackResponse(message, matchedExperts, matchedProducts, intent, userLanguage), error: `All models failed: ${lastError}` };
  } catch (error) {
    console.error('OpenAI API error:', error);
    return { response: buildDeterministicFallbackResponse(message, matchedExperts, matchedProducts, intent, userLanguage), error: `Exception: ${(error as any)?.message || String(error)}` };
  }
}

function buildDeterministicFallbackResponse(
  message: string,
  matchedExperts: any[],
  matchedProducts: any[],
  intent: string,
  userLanguage: string
): string {
  const isSpanish = userLanguage === 'es';
  const isVietnamese = userLanguage === 'vi';

  if (intent === 'escalation') {
    if (isSpanish) {
      return 'Por favor, consulta a tu proveedor de salud de inmediato o llama a emergencias si crees que es urgente. Tu seguridad y la de tu bebé es la prioridad.';
    }
    if (isVietnamese) {
      return 'Vui lòng liên hệ bác sĩ của bạn ngay hoặc gọi cấp cứu nếu đây là tình huống khẩn cấp. Sự an toàn của bạn và em bé là ưu tiên hàng đầu.';
    }
    return 'Please see your provider immediately or call emergency services if this is urgent. Your safety and your child\'s safety is the top priority.';
  }

  const expertLine = matchedExperts?.length
    ? `\n- ${isSpanish ? 'Expertos recomendados' : isVietnamese ? 'Chuyen gia de xuat' : 'Suggested experts'}: ${matchedExperts.slice(0, 2).map((e) => `${e.name} (${e.specialty})`).join(', ')}`
    : '';
  const productLine = matchedProducts?.length
    ? `\n- ${isSpanish ? 'Recursos utiles' : isVietnamese ? 'Tai nguyen huu ich' : 'Helpful resources'}: ${matchedProducts.slice(0, 2).map((p) => p.title).join(', ')}`
    : '';

  if (isSpanish) {
    return `Gracias por tu mensaje. En este momento estoy en modo de respuesta segura, así que compartiré una orientación general breve: prioriza hidratación, descanso, observación de señales de alarma y seguimiento con tu pediatra/proveedor si los síntomas persisten o empeoran.${expertLine}${productLine}\n\nSi quieres, puedo ayudarte con pasos prácticos según la edad de tu bebé y la situación exacta.`;
  }
  if (isVietnamese) {
    return `Cam on ban da chia se. Hien tai toi dang o che do phan hoi an toan, vi vay toi se dua huong dan tong quat ngan gon: uu tien bo sung nuoc, nghi ngoi, theo doi dau hieu bat thuong va lien he bac si nhi/kham benh neu trieu chung keo dai hoac nang hon.${expertLine}${productLine}\n\nNeu ban muon, toi co the dua cac buoc cu the hon theo do tuoi cua be va tinh huong hien tai.`;
  }
  return `Thanks for sharing this. I’m currently in safe-response mode, so I’ll provide concise general guidance: prioritize hydration, rest, monitoring for warning signs, and follow up with your pediatric/provider if symptoms persist or worsen.${expertLine}${productLine}\n\nIf you want, I can walk you through practical next steps based on your child’s age and exact symptoms/situation.`;
}