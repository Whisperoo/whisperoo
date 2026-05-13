import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

type ReasonCode =
  | "user_reported_issue"
  | "quality_review"
  | "debugging"
  | "other";

interface RequestBody {
  message_id?: string; // bigint-as-string
  session_id?: string; // uuid
  action: string; // e.g. 'view_conversation'
  reason_code: ReasonCode;
  reason_text?: string;
}

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

    const body = (await req.json()) as RequestBody;
    const { message_id, session_id, action, reason_code, reason_text } = body;

    if (!action?.trim()) return json(400, { error: "action is required" });
    if (!reason_code) return json(400, { error: "reason_code is required" });
    if (!message_id && !session_id) {
      return json(400, { error: "message_id or session_id is required" });
    }
    if (reason_code === "other" && !(reason_text || "").trim()) {
      return json(400, { error: "reason_text is required when reason_code=other" });
    }

    // Confirm accessor is super_admin/admin
    const { data: accessorProfile, error: accessorErr } = await supabase
      .from("profiles")
      .select("id, account_type")
      .eq("id", user.id)
      .maybeSingle();

    if (accessorErr) return json(403, { error: "Access denied" });
    const accessorRole = accessorProfile?.account_type || "unknown";
    const isRoleAllowed =
      accessorRole === "super_admin" ||
      accessorRole === "superadmin" ||
      accessorRole === "admin";
    if (!isRoleAllowed) {
      return json(403, {
        error: "Access denied",
        role: accessorRole,
      });
    }

    // Resolve session + patient
    let resolvedSessionId: string | null = session_id ?? null;
    let patientUserId: string | null = null;
    let resourceType: string = session_id ? "session" : "message";
    let resourceId: string = session_id ? String(session_id) : String(message_id);

    if (message_id) {
      const { data, error } = await supabase
        .from("messages")
        .select("session_id, sessions!inner(user_id)")
        .eq("id", message_id)
        .maybeSingle();

      if (error || !data) return json(404, { error: "Message not found" });

      resolvedSessionId = (data as any).session_id;
      patientUserId = (data as any).sessions?.user_id ?? null;
    } else if (session_id) {
      const { data, error } = await supabase
        .from("sessions")
        .select("user_id")
        .eq("id", session_id)
        .maybeSingle();
      if (error || !data) return json(404, { error: "Session not found" });
      patientUserId = (data as any).user_id ?? null;
    }

    if (!resolvedSessionId || !patientUserId) {
      return json(500, { error: "Failed to resolve session/user" });
    }

    // Write append-only audit log BEFORE returning content
    const { error: logErr } = await supabase.from("phi_access_log").insert({
      accessor_user_id: user.id,
      accessor_role: accessorRole,
      patient_user_id: patientUserId,
      resource_type: resourceType,
      resource_id: resourceId,
      action,
      reason_code,
      reason_text: (reason_text || "").trim() || null,
    });
    if (logErr) return json(500, { error: "Failed to log access" });

    const { data: messages, error: messagesErr } = await supabase
      .from("messages")
      .select("id, role, content, created_at, is_flagged_for_review, metadata")
      .eq("session_id", resolvedSessionId)
      .order("created_at", { ascending: true });
    if (messagesErr) return json(500, { error: "Failed to load messages" });

    const { data: recentAccess, error: recentErr } = await supabase
      .from("phi_access_log")
      .select(
        "id, accessed_at, accessor_user_id, accessor_role, action, reason_code, reason_text, resource_type, resource_id",
      )
      .eq("patient_user_id", patientUserId)
      .order("accessed_at", { ascending: false })
      .limit(10);
    if (recentErr) return json(500, { error: "Failed to load access history" });

    return json(200, {
      success: true,
      session_id: resolvedSessionId,
      patient_user_id: patientUserId,
      messages: messages ?? [],
      recent_access: recentAccess ?? [],
    });
  } catch (e) {
    console.error("admin_phi_conversation error:", e);
    return json(500, { error: "Internal server error" });
  }
});

