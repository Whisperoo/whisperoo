import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

interface UpdateSessionSummaryRequest {
  session_id: string;
}

interface Message {
  id: string;
  role: string;
  content: string;
  created_at: string;
}

Deno.serve(async (req: Request) => {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Parse request body
    const { session_id }: UpdateSessionSummaryRequest = await req.json();
    
    if (!session_id) {
      return new Response(
        JSON.stringify({ error: 'session_id is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Get current session and its summary
    const { data: session, error: sessionError } = await supabaseClient
      .from('sessions')
      .select('id, summary')
      .eq('id', session_id)
      .single();

    if (sessionError) {
      console.error('Error fetching session:', sessionError);
      return new Response(
        JSON.stringify({ error: 'Session not found' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Get last 10 messages from the session
    const { data: messages, error: messagesError } = await supabaseClient
      .from('messages')
      .select('id, role, content, created_at')
      .eq('session_id', session_id)
      .order('created_at', { ascending: false })
      .limit(10);

    if (messagesError) {
      console.error('Error fetching messages:', messagesError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch messages' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Reverse messages to get chronological order
    const chronologicalMessages = messages?.reverse() || [];

    // Create prompt for AI summarization
    const existingSummary = session.summary || '';
    const messageContent = chronologicalMessages
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n');

    const prompt = `
You are an AI assistant helping to summarize parent-child conversations for context.

EXISTING SUMMARY:
${existingSummary}

RECENT MESSAGES:
${messageContent}

Please create a concise summary (2-3 sentences) that captures:
1. The main topic/concern discussed
2. Key advice or guidance provided
3. Any important context about the child or situation

Keep it brief but informative for future conversation context.
`;

    // Call OpenAI API for summarization
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that creates concise summaries of parent-child conversations.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 150,
        temperature: 0.3,
      }),
    });

    if (!openaiResponse.ok) {
      console.error('OpenAI API error:', await openaiResponse.text());
      return new Response(
        JSON.stringify({ error: 'Failed to generate summary' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const openaiResult = await openaiResponse.json();
    const newSummary = openaiResult.choices[0]?.message?.content || '';

    // Update session with new summary
    const { error: updateError } = await supabaseClient
      .from('sessions')
      .update({ summary: newSummary })
      .eq('id', session_id);

    if (updateError) {
      console.error('Error updating session:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update session summary' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        summary: newSummary,
        messages_processed: chronologicalMessages.length
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Function error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});