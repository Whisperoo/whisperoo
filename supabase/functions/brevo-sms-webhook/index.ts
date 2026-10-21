// brevo-sms-webhook — Brevo calls this when a parent texts STOP or START.
//
// Brevo handles the keywords itself (it blocklists on STOP, re-subscribes on
// START/YES, auto-replies to HELP). This keeps OUR consent record in step, so the
// app never relies on Brevo alone for "may we text this person".
//
// Auth: Brevo webhooks can carry custom headers. Register the webhook with header
//   X-Webhook-Secret: <BREVO_WEBHOOK_SECRET>
// (an `Authorization: Bearer <secret>` header is also accepted). Anything else → 401.
// verify_jwt is off for this function (config.toml) because Brevo sends no Supabase JWT.
//
// Payload (Brevo "Transactional webhooks" docs, SMS events): `msg_status` is
// "unsubscribed" for STOP and "subscribe" for START; `to` is the number with its
// country code, e.g. "12018570057". Other events are acknowledged and ignored.
// Brevo may batch events into an array when the webhook is created with batched=true.
//
// No phone numbers or message content are logged.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const OPT_OUT = new Set(['unsubscribed', 'unsubscribe'])
const OPT_IN = new Set(['subscribe', 'subscribed'])

/** Constant-time string comparison, so the secret can't be probed by timing. */
function safeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder()
  const x = enc.encode(a)
  const y = enc.encode(b)
  let diff = x.length ^ y.length
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0)
  return diff === 0
}

serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })

  const secret = Deno.env.get('BREVO_WEBHOOK_SECRET') ?? ''
  if (!secret) {
    console.error('brevo-sms-webhook: BREVO_WEBHOOK_SECRET not set — refusing all calls')
    return json(503, { error: 'Not configured' })
  }
  const presented =
    req.headers.get('x-webhook-secret') ??
    (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!presented || !safeEqual(presented, secret)) return json(401, { error: 'Unauthorized' })

  let payload: unknown
  try {
    payload = await req.json()
  } catch {
    return json(400, { error: 'Invalid JSON' })
  }

  const events = (Array.isArray(payload) ? payload : [payload]) as Array<Record<string, unknown>>
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  let applied = 0
  let ignored = 0
  for (const ev of events) {
    const status = String(ev?.msg_status ?? ev?.description ?? '').toLowerCase()
    const event = OPT_OUT.has(status) ? 'opt_out' : OPT_IN.has(status) ? 'opt_in' : null
    const phone = typeof ev?.to === 'string' ? ev.to : ''
    if (!event || !phone) {
      ignored++
      continue
    }
    const ref = ev?.messageId != null ? String(ev.messageId) : null
    const { data, error } = await supabase.rpc('fn_service_apply_sms_keyword', {
      p_phone: phone,
      p_event: event,
      p_provider_ref: ref,
    })
    if (error) {
      // 500 makes Brevo retry, which is what we want for a consent change.
      console.error('brevo-sms-webhook: apply failed', error.message)
      return json(500, { error: 'Failed to apply consent change' })
    }
    applied += Number(data ?? 0)
  }

  return json(200, { ok: true, applied, ignored })
})
