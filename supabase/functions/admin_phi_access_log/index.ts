import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface Body {
  patient_user_id?: string;
  accessor_user_id?: string;
  date_from?: string; // ISO
  date_to?: string; // ISO
  limit?: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

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

    if (authError || !user) return json(401, { error: "Unauthorized" });

    const { data: accessorProfile } = await supabase
      .from("profiles")
      .select("account_type")
      .eq("id", user.id)
      .maybeSingle();

    const role = accessorProfile?.account_type || "unknown";
    const isRoleAllowed =
      role === "super_admin" || role === "superadmin" || role === "admin";
    if (!isRoleAllowed) {
      return json(403, { error: "Access denied", role });
    }

    const body = (await req.json()) as Body;
    const limit = Math.min(Math.max(body.limit ?? 200, 1), 10000);

    let query = supabase
      .from("phi_access_log")
      .select(
        "id, accessed_at, accessor_user_id, accessor_role, patient_user_id, resource_type, resource_id, action, reason_code, reason_text",
      )
      .order("accessed_at", { ascending: false })
      .limit(limit);

    if (body.patient_user_id) query = query.eq("patient_user_id", body.patient_user_id);
    if (body.accessor_user_id) query = query.eq("accessor_user_id", body.accessor_user_id);
    if (body.date_from) query = query.gte("accessed_at", body.date_from);
    if (body.date_to) query = query.lte("accessed_at", body.date_to);

    const { data, error } = await query;
    if (error) return json(500, { error: "Failed to load access logs" });

    return json(200, { success: true, rows: data ?? [] });
  } catch (e) {
    console.error("admin_phi_access_log error:", e);
    return json(500, { error: "Internal server error" });
  }
});

