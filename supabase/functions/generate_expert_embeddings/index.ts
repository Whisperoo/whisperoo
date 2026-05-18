import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type ExpertRow = {
  id: string;
  first_name: string | null;
  expert_bio: string | null;
  expert_specialties: string[] | null;
  expert_credentials: string[] | null;
  expert_experience_years: number | null;
  expert_office_location: string | null;
  expert_profile_visibility: boolean | null;
  expert_accepts_new_clients: boolean | null;
  expert_verified: boolean | null;
  account_type: string | null;
};

function profileTextForEmbedding(expert: ExpertRow): string {
  return [
    `Expert: ${expert.first_name || "Expert"}`,
    `Bio: ${expert.expert_bio || ""}`,
    `Specialties: ${(expert.expert_specialties || []).join(", ")}`,
    `Credentials: ${(expert.expert_credentials || []).join(", ")}`,
    `Experience: ${expert.expert_experience_years || 0} years`,
    `Location: ${expert.expert_office_location || ""}`,
  ].join("\n");
}

/**
 * Deterministic 384-dim text embedding using term-frequency hashing.
 * Produces normalized vectors suitable for cosine similarity.
 * No external API or model download required.
 */
function hashEmbedding(text: string, dim = 384): number[] {
  const tokens = text.toLowerCase().split(/[\s\W]+/).filter(Boolean);
  const vec = new Float64Array(dim);

  for (const token of tokens) {
    // FNV-1a hash for good distribution
    let h = 2166136261;
    for (let i = 0; i < token.length; i++) {
      h ^= token.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    // Bigram hash for basic phrase sensitivity
    vec[((h >>> 0) % dim)] += 1;

    // Character n-gram (trigrams) for morphological sensitivity
    for (let i = 0; i < token.length - 2; i++) {
      let ng = 2166136261;
      for (let j = i; j < i + 3; j++) {
        ng ^= token.charCodeAt(j);
        ng = Math.imul(ng, 16777619);
      }
      vec[((ng >>> 0) % dim)] += 0.5;
    }
  }

  // L2-normalize
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
  return norm > 0 ? Array.from(vec).map(v => v / norm) : Array.from(vec);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const token = req.headers.get("Authorization")?.replace("Bearer ", "") || "";
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error("Unauthorized");

    const { data: caller } = await supabase.from("profiles").select("account_type").eq("id", user.id).single();
    if (!["admin", "super_admin"].includes(caller?.account_type || "")) throw new Error("Forbidden");

    const { regenerate_all, expert_id } = await req.json();
    if (!regenerate_all && !expert_id) throw new Error("Provide expert_id or set regenerate_all=true");

    let query = supabase
      .from("profiles")
      .select("id, first_name, expert_bio, expert_specialties, expert_credentials, expert_experience_years, expert_office_location, expert_profile_visibility, expert_accepts_new_clients, expert_verified, account_type")
      .eq("account_type", "expert")
      .eq("expert_verified", true);

    if (expert_id) {
      query = query.eq("id", expert_id);
    } else {
      query = query.eq("expert_profile_visibility", true).eq("expert_accepts_new_clients", true);
    }

    const { data: experts, error: expertsErr } = await query;
    if (expertsErr) throw expertsErr;

    const targets = (experts || []) as ExpertRow[];
    if (!targets.length) {
      return new Response(
        JSON.stringify({ message: "No active experts found", processed: 0, failed: 0, total: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
      );
    }

    let processed = 0, failed = 0;
    const errors: Array<{ expert_id?: string; error: string }> = [];

    for (const expert of targets) {
      try {
        const profileText = profileTextForEmbedding(expert);
        const embedding = hashEmbedding(profileText);
        const embeddingLiteral = `[${embedding.join(",")}]`;

        const { error: upsertErr } = await supabase.from("expert_embeddings").upsert(
          { expert_id: expert.id, profile_text: profileText, embedding: embeddingLiteral, updated_at: new Date().toISOString() },
          { onConflict: "expert_id" },
        );
        if (upsertErr) throw upsertErr;

        await supabase.from("profiles").update({ expert_embedding: embeddingLiteral } as any).eq("id", expert.id);

        processed++;
      } catch (err) {
        failed++;
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`Failed for expert ${expert.id}:`, msg);
        errors.push({ expert_id: expert.id, error: msg });
      }
    }

    return new Response(
      JSON.stringify({ message: `Processed ${processed} experts, ${failed} failed`, processed, failed, total: targets.length, errors: errors.length ? errors : undefined }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 },
    );
  }
});
