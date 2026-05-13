// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { S3Client, DeleteObjectCommand } from "https://esm.sh/@aws-sdk/client-s3@3.637.0";
import { PutObjectCommand } from "https://esm.sh/@aws-sdk/client-s3@3.637.0";
import { getSignedUrl } from "https://esm.sh/@aws-sdk/s3-request-presigner@3.637.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Action = "presign_put" | "delete";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

// Server-only R2 credentials (MUST NOT be VITE_ vars)
const R2_ACCOUNT_ID = Deno.env.get("CLOUDFLARE_ACCOUNT_ID") ?? "";
const R2_ACCESS_KEY_ID = Deno.env.get("CLOUDFLARE_R2_ACCESS_KEY_ID") ?? "";
const R2_SECRET_ACCESS_KEY = Deno.env.get("CLOUDFLARE_R2_SECRET_ACCESS_KEY") ?? "";
const R2_BUCKET_NAME = Deno.env.get("CLOUDFLARE_R2_BUCKET_NAME") ?? "";
const R2_ENDPOINT =
  Deno.env.get("CLOUDFLARE_R2_ENDPOINT") ||
  (R2_ACCOUNT_ID ? `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com` : "");

function requireConfigured(): void {
  const missing: string[] = [];
  if (!R2_ACCOUNT_ID) missing.push("CLOUDFLARE_ACCOUNT_ID");
  if (!R2_ACCESS_KEY_ID) missing.push("CLOUDFLARE_R2_ACCESS_KEY_ID");
  if (!R2_SECRET_ACCESS_KEY) missing.push("CLOUDFLARE_R2_SECRET_ACCESS_KEY");
  if (!R2_BUCKET_NAME) missing.push("CLOUDFLARE_R2_BUCKET_NAME");
  if (!R2_ENDPOINT) missing.push("CLOUDFLARE_R2_ENDPOINT");
  if (missing.length) {
    throw new Error(`R2 not configured (missing: ${missing.join(", ")})`);
  }
}

function getS3Client(): S3Client {
  requireConfigured();
  return new S3Client({
    region: "auto",
    endpoint: R2_ENDPOINT,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });
}

function isAllowedKeyForExpert(userId: string, key: string): boolean {
  // Experts can only write within their own expert folder prefixes
  // products/{expertId}/..., product-thumbnails/{expertId}/..., profile-images/{userId}/...
  const normalized = key.replace(/^\/+/, "");
  return (
    normalized.startsWith(`products/${userId}/`) ||
    normalized.startsWith(`product-thumbnails/${userId}/`) ||
    normalized.startsWith(`profile-images/${userId}/`)
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Missing Authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = userData.user.id;
    const { data: callerProfile, error: callerErr } = await supabase
      .from("profiles")
      .select("account_type")
      .eq("id", userId)
      .single();
    if (callerErr) throw callerErr;

    const accountType = (callerProfile?.account_type ?? "") as string;
    const isAdmin = accountType === "admin" || accountType === "super_admin";
    const isExpert = accountType === "expert";
    if (!isAdmin && !isExpert) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const action = body?.action as Action | undefined;
    const key = (body?.key as string | undefined)?.trim();
    const contentType = (body?.contentType as string | undefined)?.trim();

    if (!action || !key) {
      return new Response(JSON.stringify({ error: "Missing action or key" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (isExpert && !isAllowedKeyForExpert(userId, key)) {
      return new Response(JSON.stringify({ error: "Forbidden key prefix for expert" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const client = getS3Client();

    if (action === "presign_put") {
      const command = new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
        ContentType: contentType || "application/octet-stream",
      });
      const url = await getSignedUrl(client, command, { expiresIn: 60 * 10 }); // 10 minutes
      return new Response(JSON.stringify({ url }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete") {
      await client.send(
        new DeleteObjectCommand({
          Bucket: R2_BUCKET_NAME,
          Key: key,
        }),
      );
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

