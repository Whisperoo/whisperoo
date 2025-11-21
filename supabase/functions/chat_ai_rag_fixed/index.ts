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

    const { message, sessionId, childId } = await req.json();

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

    // Store user message
    const { error: messageError } = await supabase
      .from('messages')
      .insert({
        session_id: currentSessionId,
        role: 'user',
        content: message,
        metadata: { child_id: childId }
      });

    if (messageError) throw messageError;

    // Get enhanced chat context
    const context = await getEnhancedChatContext(supabase, user.id, childId, currentSessionId);

    // RAG-FIRST Expert matching (FIXED: Semantic search first, keywords as fallback)
    const matchedExperts = await findMatchingExpertsRAGFirst(supabase, message);

    // Generate AI response
    const aiResponse = await generateEnhancedAIResponse(message, context, matchedExperts);

    // Store AI response
    const { error: aiMessageError } = await supabase
      .from('messages')
      .insert({
        session_id: currentSessionId,
        role: 'assistant',
        content: aiResponse,
        metadata: {
          child_id: childId,
          expert_suggestions: matchedExperts.length > 0 ? matchedExperts : undefined
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

// RAG-FIRST Expert matching (FIXED)
async function findMatchingExpertsRAGFirst(supabase, message) {
  console.log(`=== Expert Matching Started for: "${message}" ===`);
  const messageLower = message.toLowerCase();

  // First check for general browsing queries (show ALL experts)
  const generalBrowsingQueries = [
    'show me experts', 'show experts', 'list experts', 'available experts',
    'find experts', 'what experts do you have', 'who are your experts',
    'browse experts', 'see experts', 'expert list'
  ];

  const isGeneralBrowsing = generalBrowsingQueries.some(query =>
    messageLower.includes(query.toLowerCase())
  );

  if (messageLower.trim() === 'experts' || isGeneralBrowsing) {
    console.log('General browsing query detected - showing all experts');
    return await getAllAvailableExperts(supabase);
  }

  // PRIMARY: Try semantic search first (RAG-FIRST APPROACH)
  console.log('Attempting semantic search...');
  const semanticExperts = await findMatchingExpertsBySemantic(supabase, message);
  if (semanticExperts.length > 0) {
    console.log('Found experts via semantic search:', semanticExperts.map(e => e.name));
    return semanticExperts;
  }

  // No semantic matches found - let AI handle the response without expert recommendations
  console.log(`No semantic expert matches found for query: "${message}"`);
  return [];
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
      .filter(expert => expert.similarity >= 0.35)  // Still relevant but more inclusive
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
        similarity_score: expert.similarity
      }));

    return filteredExperts;

  } catch (error) {
    console.error('Error in semantic expert matching:', error);
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
      location: expert.expert_office_location
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

// Enhanced AI response generation with better context handling
async function generateEnhancedAIResponse(message, context, matchedExperts) {
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiApiKey) {
    return "I'm sorry, I'm having trouble connecting to my AI service right now. Please try again later.";
  }

  let systemPrompt = `You are Whisperoo's AI parenting assistant. Provide helpful, personalized responses.

PARENT: ${context.parentProfile?.first_name || 'Parent'}
- Role: ${context.parentProfile?.role || 'Not specified'}
- Parenting Styles: ${context.parentProfile?.parenting_styles?.join(', ') || 'Not specified'}`;

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

  // Add expert recommendations
  if (matchedExperts.length > 0) {
    systemPrompt += `\n\nAVAILABLE WHISPEROO EXPERTS:`;
    matchedExperts.forEach(expert => {
      systemPrompt += `\n- ${expert.name}, specializing in ${expert.specialty}`;
      if (expert.experience_years) {
        systemPrompt += ` (${expert.experience_years} years experience)`;
      }
      if (expert.similarity_score) {
        systemPrompt += ` [Relevance: ${(expert.similarity_score * 100).toFixed(0)}%]`;
      }
    });
    systemPrompt += `\n\nEXPERT RECOMMENDATIONS: Only mention these experts if their expertise is directly relevant to the user's specific query. Use the relevance scores to judge how well each expert matches. Don't force expert recommendations if the question can be answered with general parenting advice.`;
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
- Use proper list formatting as specified above`;

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
        max_tokens: 300,
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