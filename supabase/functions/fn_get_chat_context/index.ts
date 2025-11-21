import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

interface GetChatContextRequest {
  parent_id: string;
  child_id?: string;
  limit?: number;
}

interface ChatContext {
  child_profile?: {
    id: string;
    first_name: string;
    birth_date: string | null;
    gender: string | null;
    notes: string | null;
    age_in_months?: number;
  };
  session_summary: string;
  recent_messages: Array<{
    id: string;
    role: string;
    content: string;
    created_at: string;
  }>;
  session_id?: string;
}

function calculateAgeInMonths(birthDate: string): number | null {
  if (!birthDate) return null;
  
  const birth = new Date(birthDate);
  const today = new Date();
  
  const years = today.getFullYear() - birth.getFullYear();
  const months = today.getMonth() - birth.getMonth();
  
  return years * 12 + months;
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
    const { parent_id, child_id, limit = 20 }: GetChatContextRequest = await req.json();
    
    if (!parent_id) {
      return new Response(
        JSON.stringify({ error: 'parent_id is required' }),
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

    const context: ChatContext = {
      session_summary: '',
      recent_messages: []
    };

    // Get child profile if child_id is provided
    if (child_id) {
      const { data: child, error: childError } = await supabaseClient
        .from('kids')
        .select('id, first_name, birth_date, gender, notes')
        .eq('id', child_id)
        .eq('parent_id', parent_id)
        .single();

      if (childError) {
        console.error('Error fetching child:', childError);
        return new Response(
          JSON.stringify({ error: 'Child not found or access denied' }),
          { 
            status: 404, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      if (child) {
        context.child_profile = {
          ...child,
          age_in_months: child.birth_date ? calculateAgeInMonths(child.birth_date) : undefined
        };
      }
    }

    // Get the most recent session for this parent/child combination
    let sessionQuery = supabaseClient
      .from('sessions')
      .select('id, summary, started_at')
      .eq('parent_id', parent_id)
      .order('started_at', { ascending: false })
      .limit(1);

    if (child_id) {
      sessionQuery = sessionQuery.eq('child_id', child_id);
    } else {
      sessionQuery = sessionQuery.is('child_id', null);
    }

    const { data: sessions, error: sessionError } = await sessionQuery;

    if (sessionError) {
      console.error('Error fetching session:', sessionError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch session' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const currentSession = sessions?.[0];
    
    if (currentSession) {
      context.session_id = currentSession.id;
      context.session_summary = currentSession.summary || '';

      // Get recent messages from the current session
      const { data: messages, error: messagesError } = await supabaseClient
        .from('messages')
        .select('id, role, content, created_at')
        .eq('session_id', currentSession.id)
        .order('created_at', { ascending: false })
        .limit(limit);

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

      // Reverse to get chronological order (oldest first)
      context.recent_messages = messages?.reverse() || [];
    }

    return new Response(
      JSON.stringify({
        success: true,
        context
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