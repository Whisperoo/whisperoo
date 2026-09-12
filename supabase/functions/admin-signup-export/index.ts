// Audited signup export with email addresses.
//
// Sprint 2 (QUO-2026-004): "Resolve missing email address ... in the existing CSV
// export." profiles.email was dropped for HIPAA, so the only copy of an email is
// in auth.users, which the browser can never read. This function is the one
// sanctioned path to it:
//
//   1. Verify the caller's JWT and that they are a staff admin.
//   2. Run the normal export RPC AS THE CALLER, so the RPC's own guard and
//      tenant/date filtering still apply -- this function adds nothing to what
//      the admin could already see except the email column.
//   3. Resolve emails with the service role via fn_service_emails_for_users,
//      which is executable by service_role only.
//   4. Write a phi_access_log row: who, when, which export, which filters, how
//      many rows. The log write happens BEFORE the data is returned; if logging
//      fails, nothing is returned.
//
// Contact details are export-only by design. Nothing here is ever rendered in a
// grid; the client turns the rows into a CSV download.

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

type ExportKind = 'qr' | 'independent'

interface ExportRequest {
  export: ExportKind
  p_tenant_id?: string | null
  p_start_date?: string | null
  p_end_date?: string | null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!supabaseUrl || !anonKey || !serviceKey) return json(500, { error: 'Function not configured' })

  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) return json(401, { error: 'Missing authorization header' })

  // Caller-scoped client: RPCs run under the admin's own identity and RLS.
  const asCaller = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: userData, error: userErr } = await asCaller.auth.getUser()
  if (userErr || !userData?.user) return json(401, { error: 'Unauthorized' })
  const caller = userData.user

  // Service client: only for the email lookup and the audit write.
  const asService = createClient(supabaseUrl, serviceKey)

  const { data: profile } = await asService
    .from('profiles')
    .select('account_type')
    .eq('id', caller.id)
    .maybeSingle()
  const role = profile?.account_type ?? ''
  if (!['admin', 'super_admin', 'superadmin'].includes(role)) {
    return json(403, { error: 'Access denied' })
  }

  let body: ExportRequest
  try {
    body = await req.json()
  } catch {
    return json(400, { error: 'Invalid JSON body' })
  }
  if (body.export !== 'qr' && body.export !== 'independent') {
    return json(400, { error: "export must be 'qr' or 'independent'" })
  }

  // 2. The export itself, as the caller. Same RPC the dashboard used before;
  //    the only difference is that it now returns user_id.
  const rpcName = body.export === 'qr' ? 'fn_admin_qr_signup_export' : 'fn_admin_independent_signups_export'
  const rpcArgs = body.export === 'qr'
    ? { p_tenant_id: body.p_tenant_id ?? null, p_start_date: body.p_start_date ?? null, p_end_date: body.p_end_date ?? null }
    : { p_start_date: body.p_start_date ?? null, p_end_date: body.p_end_date ?? null }

  const { data: rows, error: rpcErr } = await asCaller.rpc(rpcName, rpcArgs)
  if (rpcErr) {
    console.error('admin-signup-export: rpc failed', { rpcName, error: rpcErr })
    return json(rpcErr.message?.toLowerCase().includes('access denied') ? 403 : 500, { error: rpcErr.message })
  }
  const list = (rows as Array<Record<string, unknown> & { user_id: string }>) ?? []

  // 4. Audit first. No log, no data.
  const { error: logErr } = await asService.from('phi_access_log').insert({
    accessor_user_id: caller.id,
    accessor_role: role,
    patient_user_id: null,
    resource_type: 'signup_export',
    resource_id: body.export,
    action: 'export',
    reason_code: 'admin_export',
    reason_text: JSON.stringify({
      export: body.export,
      tenant_id: body.p_tenant_id ?? null,
      start_date: body.p_start_date ?? null,
      end_date: body.p_end_date ?? null,
      row_count: list.length,
      includes_email: true,
    }),
  })
  if (logErr) {
    console.error('admin-signup-export: audit log failed', logErr)
    return json(500, { error: 'Failed to record access' })
  }

  // 3. Emails, service-role only.
  const ids = list.map((r) => r.user_id).filter(Boolean)
  let emailById = new Map<string, string>()
  if (ids.length > 0) {
    const { data: emails, error: emailErr } = await asService.rpc('fn_service_emails_for_users', { p_user_ids: ids })
    if (emailErr) {
      console.error('admin-signup-export: email lookup failed', emailErr)
      return json(500, { error: 'Failed to resolve emails' })
    }
    emailById = new Map((emails as Array<{ user_id: string; email: string }>).map((e) => [e.user_id, e.email]))
  }

  const out = list.map(({ user_id, ...rest }) => ({ ...rest, email: emailById.get(user_id) ?? null }))
  return json(200, { rows: out, count: out.length })
})
