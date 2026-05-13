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
  const specialties = (expert.expert_specialties || []).join(", ");
  const credentials = (expert.expert_credentials || []).join(", ");

  return [
    `Expert: ${expert.first_name || "Expert"}`,
    `Bio: ${expert.expert_bio || ""}`,
    `Specialties: ${specialties}`,
    `Credentials: ${credentials}`,
    `Experience: ${expert.expert_experience_years || 0} years`,
    `Location: ${expert.expert_office_location || ""}`,
  ].join("\n");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "") || "";
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    // Restrict to admin/super-admin callers.
    const { data: callerProfile, error: callerErr } = await supabase
      .from("profiles")
      .select("account_type")
      .eq("id", user.id)
      .single();
    if (callerErr) throw callerErr;
    if (!["admin", "super_admin"].includes(callerProfile?.account_type || "")) {
      throw new Error("Forbidden");
    }

    const { regenerate_all, expert_id } = await req.json();
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiApiKey) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    let query = supabase
      .from("profiles")
      .select(
        "id, first_name, expert_bio, expert_specialties, expert_credentials, expert_experience_years, expert_office_location, expert_profile_visibility, expert_accepts_new_clients, expert_verified, account_type",
      )
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

    if (!regenerate_all && !expert_id) {
      throw new Error("Provide expert_id or set regenerate_all=true");
    }

    if (!targets.length) {
      return new Response(
        JSON.stringify({ message: "No active experts found", processed: 0, failed: 0, total: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
      );
    }

    let processed = 0;
    let failed = 0;
    const errors: Array<{ expert_id?: string; error: string }> = [];

    for (const expert of targets) {
      try {
        const profileText = profileTextForEmbedding(expert);

        const embeddingResponse = await fetch("https://api.openai.com/v1/embeddings", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${openaiApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "text-embedding-3-small",
            input: profileText,
            encoding_format: "float",
          }),
        });

        if (!embeddingResponse.ok) {
          const body = await embeddingResponse.text();
          throw new Error(`OpenAI embeddings failed (${embeddingResponse.status}): ${body}`);
        }

        const embeddingData = await embeddingResponse.json();
        const embedding = embeddingData?.data?.[0]?.embedding;
        if (!Array.isArray(embedding)) {
          throw new Error("OpenAI returned invalid embedding payload");
        }

        const embeddingLiteral = `[${embedding.join(",")}]`;

        // Primary storage used by admin tooling/history.
        const { error: upsertErr } = await supabase.from("expert_embeddings").upsert(
          {
            expert_id: expert.id,
            profile_text: profileText,
            embedding: embeddingLiteral,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "expert_id" },
        );
        if (upsertErr) throw upsertErr;

        // Compatibility update for existing `find_similar_experts` RPC that reads profiles.expert_embedding.
        const { error: profileEmbeddingErr } = await supabase
          .from("profiles")
          .update({ expert_embedding: embeddingLiteral } as any)
          .eq("id", expert.id);
        if (profileEmbeddingErr) {
          console.warn(
            `Could not write profiles.expert_embedding for ${expert.id}. expert_embeddings table was updated.`,
            profileEmbeddingErr,
          );
        }

        processed += 1;
      } catch (err) {
        failed += 1;
        errors.push({
          expert_id: expert.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return new Response(
      JSON.stringify({
        message: `Processed ${processed} experts, ${failed} failed`,
        processed,
        failed,
        total: targets.length,
        errors: errors.length ? errors : undefined,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      },
    );
  }
});
