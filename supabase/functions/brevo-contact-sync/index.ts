// brevo-contact-sync — keeps the Brevo "Whisperoo parents" list in step with in-app
// email consent, so the client can run email sequences from Brevo (Sprint 2
// QUO-2026-004, "auto-enroll"; client go-ahead 2026-11-03).
//
// Safeguards agreed with the client (Brevo's terms forbid health information):
//   - only parents (account_type 'user') who opted in to email and have not opted out
//   - only contact basics: email, FIRSTNAME, LANGUAGE, and SMS (phone) only when the
//     parent ALSO opted in to texts
//   - nothing else: no hospital/tenant, department, dates, children or requests
//   - the list name is neutral; staging and prod use separate lists (one Brevo account)
//
// Two callers:
//   - a parent (their JWT), right after saving consent → syncs that parent only
//   - the service role with {"mode":"all"} → full reconcile: upsert every eligible
//     parent and remove list members who no longer qualify (opt-out, deleted account).
//     Used for the one-time import; safe to re-run.
//
// Removal takes the contact off OUR list only and never deletes the Brevo contact —
// the client may have them in other lists. Brevo's own unsubscribe link still applies.
//
// Kept as one self-contained file, like support-intake, for dashboard deploys.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

const BREVO = 'https://api.brevo.com/v3'
const LANGS = ['en', 'es', 'vi']

interface ParentRow {
  id: string
  first_name: string | null
  phone_number: string | null
  language_preference: string | null
  account_type: string | null
  email_opt_in: boolean
  email_opt_out_at: string | null
  sms_opt_in: boolean
  sms_opt_out_at: string | null
}

const PROFILE_COLS =
  'id, first_name, phone_number, language_preference, account_type, email_opt_in, email_opt_out_at, sms_opt_in, sms_opt_out_at'

const eligible = (p: ParentRow | null): p is ParentRow =>
  !!p && p.account_type === 'user' && p.email_opt_in === true && !p.email_opt_out_at

// Same rule as support-intake: profiles.phone_number is "(555) 123-4567"; Brevo wants
// digits with the country code. Anything else is left out rather than guessed at.
function toBrevoPhone(phone: string | null): string | null {
  const digits = (phone ?? '').replace(/\D/g, '')
  if (digits.length === 10) return `1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return digits
  return null
}

class Brevo {
  constructor(private key: string, private listId: number) {}

  private call(path: string, init: RequestInit = {}) {
    return fetch(`${BREVO}${path}`, {
      ...init,
      headers: { 'api-key': this.key, 'content-type': 'application/json', accept: 'application/json' },
    })
  }

  /** Adds or updates the contact on our list. Returns null on success, else a reason. */
  async upsert(email: string, p: ParentRow): Promise<string | null> {
    const attributes: Record<string, string> = {
      FIRSTNAME: (p.first_name ?? '').trim(),
      LANGUAGE: LANGS.includes(p.language_preference ?? '') ? p.language_preference! : 'en',
    }
    const phone = p.sms_opt_in && !p.sms_opt_out_at ? toBrevoPhone(p.phone_number) : null
    if (phone) attributes.SMS = phone
    const send = (attrs: Record<string, string>) =>
      this.call('/contacts', {
        method: 'POST',
        body: JSON.stringify({ email, attributes: attrs, listIds: [this.listId], updateEnabled: true }),
      })
    let res = await send(attributes)
    if (!res.ok && phone) {
      // Brevo refuses a phone number already used by another contact. The email
      // sync matters more than the phone field, so retry without it.
      const detail = await res.text()
      if (/duplicate|SMS/i.test(detail)) {
        const { SMS: _drop, ...rest } = attributes
        res = await send(rest)
      }
    }
    return res.ok ? null : `upsert HTTP ${res.status}`
  }

  /** Takes emails off our list (the contacts themselves stay in Brevo). */
  async remove(emails: string[]): Promise<string | null> {
    if (emails.length === 0) return null
    const res = await this.call(`/contacts/lists/${this.listId}/contacts/remove`, {
      method: 'POST',
      body: JSON.stringify({ emails }),
    })
    const detail = await res.text()
    if (res.ok) {
      // 201 can still list per-email failures.
      try {
        const failed = (JSON.parse(detail) as { contacts?: { failure?: string[] } }).contacts?.failure ?? []
        return failed.length ? `remove: ${failed.length} not removed` : null
      } catch {
        return null
      }
    }
    // 400 when none of them are on the list — already the state we want.
    if (res.status === 400 && /not.*(exist|found|part|belong)|already/i.test(detail)) return null
    return `remove HTTP ${res.status}`
  }

  async members(): Promise<string[]> {
    const out: string[] = []
    for (let offset = 0; ; offset += 500) {
      const res = await this.call(`/contacts/lists/${this.listId}/contacts?limit=500&offset=${offset}`)
      if (!res.ok) throw new Error(`list members HTTP ${res.status}`)
      const page = (await res.json()) as { contacts?: { email?: string }[] }
      const batch = (page.contacts ?? []).map((c) => (c.email ?? '').toLowerCase()).filter(Boolean)
      out.push(...batch)
      if (batch.length < 500) return out
    }
  }
}

// The role claim of a JWT. Safe to read unverified ONLY because verify_jwt is on for
// this function (the default): the gateway rejects any token with a bad signature
// before this code runs. The env service key may be the newer non-JWT format, so a
// plain string comparison alone would refuse the legacy service-role JWT.
function jwtRole(token: string): string | null {
  try {
    const part = token.split('.')[1] ?? ''
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=')
    return (JSON.parse(atob(b64)) as { role?: string }).role ?? null
  } catch {
    return null
  }
}

async function emailsById(db: SupabaseClient): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw new Error(`listUsers: ${error.message}`)
    for (const u of data.users) if (u.email) map.set(u.id, u.email.toLowerCase())
    if (data.users.length < 1000) return map
  }
}

async function syncOne(db: SupabaseClient, brevo: Brevo, userId: string, email: string) {
  const { data, error } = await db.from('profiles').select(PROFILE_COLS).eq('id', userId).maybeSingle()
  if (error) throw new Error(`profile read: ${error.code}`)
  const p = data as ParentRow | null
  if (eligible(p)) {
    const err = await brevo.upsert(email.toLowerCase(), p)
    return { action: 'added', error: err }
  }
  const err = await brevo.remove([email.toLowerCase()])
  return { action: 'removed', error: err }
}

async function reconcile(db: SupabaseClient, brevo: Brevo) {
  const emails = await emailsById(db)
  const { data, error } = await db
    .from('profiles')
    .select(PROFILE_COLS)
    .eq('account_type', 'user')
    .eq('email_opt_in', true)
    .is('email_opt_out_at', null)
  if (error) throw new Error(`profiles read: ${error.code}`)

  const keep = new Set<string>()
  let added = 0
  const failures: string[] = []
  for (const p of (data ?? []) as ParentRow[]) {
    const email = emails.get(p.id)
    if (!email) continue
    keep.add(email)
    const err = await brevo.upsert(email, p)
    if (err) failures.push(err)
    else added++
  }

  const stale = (await brevo.members()).filter((e) => !keep.has(e))
  for (let i = 0; i < stale.length; i += 150) {
    const err = await brevo.remove(stale.slice(i, i + 150))
    if (err) failures.push(err)
  }
  return { eligible: keep.size, added, removed: stale.length, failures: failures.length, failure_kinds: [...new Set(failures)] }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })

  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const db = createClient(Deno.env.get('SUPABASE_URL') ?? '', serviceKey)
  const apiKey = (Deno.env.get('BREVO_API_KEY') ?? '').trim()
  const listId = Number(Deno.env.get('BREVO_PARENTS_LIST_ID') ?? '')
  if (!apiKey || !Number.isInteger(listId) || listId <= 0) {
    console.error('brevo-contact-sync: BREVO_API_KEY or BREVO_PARENTS_LIST_ID not set')
    return json(503, { error: 'Not configured' })
  }
  const brevo = new Brevo(apiKey, listId)

  let body: Record<string, unknown> = {}
  try {
    body = await req.json()
  } catch {
    // Empty body is fine for the parent call.
  }

  const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '').trim()
  try {
    if (body.mode === 'all') {
      if (token !== serviceKey && jwtRole(token) !== 'service_role') {
        return json(403, { error: 'Service role required' })
      }
      const result = await reconcile(db, brevo)
      console.log('brevo-contact-sync reconcile', JSON.stringify(result))
      return json(200, result)
    }

    const { data: { user }, error: authErr } = await db.auth.getUser(token)
    if (authErr || !user?.email) return json(401, { error: 'Unauthorized' })
    const result = await syncOne(db, brevo, user.id, user.email)
    if (result.error) console.error('brevo-contact-sync self', result.action, result.error)
    return json(result.error ? 502 : 200, { action: result.action, ok: !result.error })
  } catch (e) {
    // Messages above carry status codes only, never emails or names.
    console.error('brevo-contact-sync failed:', e instanceof Error ? e.message : 'unknown')
    return json(500, { error: 'Sync failed' })
  }
})
