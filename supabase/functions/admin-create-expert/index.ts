import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Caller client (anon key + caller's JWT — used only to verify the caller's role)
    const callerClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } },
    );

    // Service-role client — used for admin user creation and profile writes
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Verify caller is authenticated
    const { data: { user: caller }, error: authErr } = await callerClient.auth.getUser();
    if (authErr || !caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify caller is admin or super_admin
    const { data: callerProfile } = await adminClient
      .from("profiles")
      .select("account_type")
      .eq("id", caller.id)
      .single();

    if (!["admin", "super_admin"].includes(callerProfile?.account_type ?? "")) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const {
      email,
      password,
      first_name,
      profile_image_url,
      expert_bio,
      inquiry_confirmation_message,
      inquiry_prebook_message,
      expert_specialties,
      expert_credentials,
      expert_experience_years,
      expert_consultation_rate,
      expert_availability_status,
      expert_rating,
      tenant_id,
    } = await req.json();

    if (!email || !password || !first_name) {
      return new Response(JSON.stringify({ error: "email, password, and first_name are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create the auth user through GoTrue — this uses proper password hashing
    // and creates all required auth.users + auth.identities records correctly.
    const { data: newUser, error: createErr } = await adminClient.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password: password.trim(),
      email_confirm: true,
      user_metadata: { first_name: first_name.trim() },
    });

    if (createErr || !newUser.user) {
      return new Response(JSON.stringify({ error: createErr?.message ?? "Failed to create auth user" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = newUser.user.id;

    // Upsert the profile so it's always created with the right fields even if
    // the handle_new_user trigger races with this request on the remote instance.
    const { error: profileErr } = await adminClient
      .from("profiles")
      .upsert({
        id: userId,
        first_name: first_name.trim(),
        profile_image_url: profile_image_url || null,
        expert_bio: expert_bio?.trim() || null,
        inquiry_confirmation_message: inquiry_confirmation_message?.trim() || null,
        inquiry_prebook_message: inquiry_prebook_message?.trim() || null,
        expert_specialties: expert_specialties ?? [],
        expert_credentials: expert_credentials ?? [],
        expert_experience_years: expert_experience_years ?? 0,
        expert_consultation_rate: expert_consultation_rate ?? 0,
        expert_availability_status: expert_availability_status ?? "available",
        expert_rating: expert_rating ?? 5.0,
        account_type: "expert",
        expert_verified: true,
        expert_profile_visibility: true,
        expert_accepts_new_clients: true,
        onboarded: true,
        tenant_id: tenant_id || null,
      }, { onConflict: "id" });

    if (profileErr) {
      // Auth user was created — clean it up to avoid orphaned records
      await adminClient.auth.admin.deleteUser(userId);
      return new Response(JSON.stringify({ error: `Profile setup failed: ${profileErr.message}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ id: userId, email: email.trim().toLowerCase() }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
