import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

function generateEmbedding(text: string): number[] {
  const tokens = text.toLowerCase().split(/[\s\W]+/).filter(Boolean);
  const vec = new Float64Array(384);
  for (const token of tokens) {
    let h = 2166136261;
    for (let i = 0; i < token.length; i++) {
      h ^= token.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    vec[((h >>> 0) % 384)] += 1;
    for (let i = 0; i < token.length - 2; i++) {
      let ng = 2166136261;
      for (let j = i; j < i + 3; j++) {
        ng ^= token.charCodeAt(j);
        ng = Math.imul(ng, 16777619);
      }
      vec[((ng >>> 0) % 384)] += 0.5;
    }
  }
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
  return norm > 0 ? Array.from(vec).map(v => v / norm) : Array.from(vec);
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
    if (authError || !user) throw new Error('Unauthorized');

    const { entry_id, batch_all } = await req.json();

    let entriesToProcess: any[] = [];

    if (batch_all) {
      const { data, error } = await supabase
        .from('compliance_training')
        .select('*')
        .eq('status', 'approved')
        .is('embedding', null);
      if (error) throw error;
      entriesToProcess = data || [];
    } else if (entry_id) {
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
    const errors: any[] = [];

    for (const entry of entriesToProcess) {
      try {
        const embeddingText = [
          `User Query: ${entry.user_query}`,
          `AI Response: ${entry.ai_response}`,
          `Classification: ${entry.classification}`,
        ].join('\n');

        const embedding = generateEmbedding(embeddingText);

        const { error: updateError } = await supabase
          .from('compliance_training')
          .update({ embedding: JSON.stringify(embedding) })
          .eq('id', entry.id);

        if (updateError) {
          const errMsg = `DB update failed: ${updateError.message}`;
          console.error(`Failed to save embedding for entry ${entry.id}:`, errMsg);
          errors.push({ entry_id: entry.id, error: errMsg });
          failed++;
        } else {
          processed++;
          console.log(`Saved embedding for entry ${entry.id}`);
        }
      } catch (entryError: any) {
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
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: any) {
    console.error('Error in generate_compliance_embedding:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
