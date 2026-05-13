import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type ReasonCode = "user_reported_issue" | "quality_review" | "debugging" | "other";

interface Body {
  tenant_id?: string;
  date_from?: string;
  date_to?: string;
  escalation_only?: boolean;
  limit?: number;
  reason_code?: ReasonCode;
  reason_text?: string;
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

    const { data: accessorProfile, error: accessorErr } = await supabase
      .from("profiles")
      .select("account_type")
      .eq("id", user.id)
      .maybeSingle();

    if (accessorErr) return json(403, { error: "Access denied" });
    const role = accessorProfile?.account_type || "unknown";
    const isRoleAllowed = role === "super_admin" || role === "superadmin" || role === "admin";
    if (!isRoleAllowed) return json(403, { error: "Access denied", role });

    const body = (await req.json()) as Body;
    const limit = Math.min(Math.max(body.limit ?? 50, 1), 500);
    const reasonCode: ReasonCode = body.reason_code || "quality_review";
    const reasonText = (body.reason_text || "").trim() || "Audit trail list view";

    let query = supabase
      .from("admin_ai_audit_trail")
      .select("message_id, created_at, user_id, cohort, category, summary, escalation, tenant_id")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (body.tenant_id) query = query.eq("tenant_id", body.tenant_id);
    if (body.escalation_only) query = query.eq("escalation", true);
    if (body.date_from) query = query.gte("created_at", body.date_from);
    if (body.date_to) query = query.lte("created_at", body.date_to);

    const { data: rows, error } = await query;
    if (error) return json(500, { error: "Failed to load audit rows" });

    // Log PHI access per returned row so the accounting trail is explicit.
    if (rows && rows.length > 0) {
      const logRows = rows
        .filter((r: any) => r.user_id)
        .map((r: any) => ({
          accessor_user_id: user.id,
          accessor_role: role,
          patient_user_id: r.user_id,
          resource_type: "message",
          resource_id: String(r.message_id),
          action: "view_audit_row",
          reason_code: reasonCode,
          reason_text: reasonText,
        }));
      if (logRows.length > 0) {
        const { error: logErr } = await supabase.from("phi_access_log").insert(logRows);
        if (logErr) return json(500, { error: "Failed to record PHI access" });
      }
    }

    return json(200, { rows: rows ?? [] });
  } catch (e) {
    console.error("admin_ai_audit_read error:", e);
    return json(500, { error: "Internal server error" });
  }
});

