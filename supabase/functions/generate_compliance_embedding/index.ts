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

    // Verify the caller is authenticated
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '') || '';
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { entry_id, batch_all } = await req.json();
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');

    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    let entriesToProcess = [];

    if (batch_all) {
      // Process all approved entries that don't have embeddings
      const { data, error } = await supabase
        .from('compliance_training')
        .select('*')
        .eq('status', 'approved')
        .is('embedding', null);

      if (error) throw error;
      entriesToProcess = data || [];
    } else if (entry_id) {
      // Process a single entry
      const { data, error } = await supabase
        .from('compliance_training')
        .select('*')
        .eq('id', entry_id)
        .single();

      if (error) throw error;
      if (data) entriesToProcess = [data];
    } else {
      throw new Error('Either entry_id or batch_all must be provided');
    }

    if (entriesToProcess.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No entries to process', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    let processed = 0;
    let failed = 0;
    const errors = [];

    for (const entry of entriesToProcess) {
      try {
        // Create rich text for embedding that captures the full context
        const embeddingText = [
          `User Query: ${entry.user_query}`,
          `AI Response: ${entry.ai_response}`,
          `Classification: ${entry.classification}`,
        ].join('\n');

        // Generate embedding via OpenAI
        const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'text-embedding-3-small',
            input: embeddingText,
            encoding_format: 'float'
          })
        });

        if (!embeddingResponse.ok) {
          const errBody = await embeddingResponse.text();
          const errMsg = `OpenAI API error (${embeddingResponse.status}): ${errBody}`;
          console.error(`Failed to generate embedding for entry ${entry.id}: ${errMsg}`);
          errors.push({ entry_id: entry.id, error: errMsg });
          failed++;
          continue;
        }

        const embeddingData = await embeddingResponse.json();
        const embedding = embeddingData.data[0].embedding;

        console.log(`Generated embedding with ${embedding.length} dimensions for entry ${entry.id}`);

        // Update the entry with the generated embedding
        const { error: updateError } = await supabase
          .from('compliance_training')
          .update({ embedding: JSON.stringify(embedding) })
          .eq('id', entry.id);

        if (updateError) {
          const errMsg = `DB update failed: ${updateError.message} (code: ${updateError.code})`;
          console.error(`Failed to save embedding for entry ${entry.id}:`, errMsg);
          errors.push({ entry_id: entry.id, error: errMsg });
          failed++;
        } else {
          processed++;
          console.log(`Saved embedding for entry ${entry.id}`);
        }
      } catch (entryError) {
        const errMsg = entryError.message || String(entryError);
        console.error(`Error processing entry ${entry.id}:`, errMsg);
        errors.push({ entry_id: entry.id, error: errMsg });
        failed++;
      }
    }

    return new Response(
      JSON.stringify({
        message: `Processed ${processed} entries, ${failed} failed`,
        processed,
        failed,
        total: entriesToProcess.length,
        errors: errors.length > 0 ? errors : undefined
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error('Error in generate_compliance_embedding:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    );
  }
});
