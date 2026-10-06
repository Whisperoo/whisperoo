// support-intake — the "Get Support" card on the parent dashboard.
//
// Two actions, both for the signed-in parent only:
//   create  { text }                 → safety check → topic → short empathy reply → save
//                                      → confirmation to the parent + alert to the team
//   answers { id, answers }          → safety check on the free-text note → save
//
// Safety first (CLAUDE.md rule 7): every piece of free text goes through the same
// escalation keyword list and OpenAI Moderation check as the AI chat. On a hit we do
// NOT generate anything — the parent gets a fixed crisis message and the request is
// marked urgent so it sorts to the top of the admin queue.
//
// The empathy reply is deliberately tiny: 1–2 sentences of acknowledgement, no advice,
// no questions, no promises. The static "our team is taking care of this" line that
// follows it lives in the frontend, so the model never speaks for the team.
//
// Messages on create (client wording, 2026-10-07). Each channel runs only when its
// secrets are set, so this works before the providers are connected; the outcome of
// every attempt is written to support_requests.*_at / notify_log:
//   parent email  SENDGRID_API_KEY + SUPPORT_FROM_EMAIL
//   parent SMS    TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN + TWILIO_FROM_NUMBER, and ONLY
//                 if the parent opted in to SMS and has not opted out (TCPA)
//   team alert    SENDGRID_API_KEY + SUPPORT_FROM_EMAIL + SUPPORT_TEAM_EMAIL. Carries no
//                 request content (HIPAA): only that one exists, urgency, and a portal link
//
// Kept as one self-contained file on purpose: production function deploys currently go
// through the dashboard editor, which takes a single file. The keyword list mirrors
// chat_ai_rag_fixed/index.ts — keep the two in sync.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

const MAX_TEXT = 2000
const MAX_NOTE = 1000
const MAX_REQUESTS_PER_DAY = 10
const MAX_REPLY_CHARS = 360

// Mirrors chat_ai_rag_fixed ESCALATION_KEYWORDS.
const ESCALATION_KEYWORDS = [
  'suicide', 'bleeding', 'emergency', 'fever over', 'self-harm', 'harm', 'kill',
  'choking', 'seizure', 'not breathing', 'unconscious', 'blue lips', 'high fever',
  'head injury', 'poisoning', 'anaphylaxis', 'allergic reaction', 'swallowed', 'overdose',
  'want to die', 'kill myself', 'end my life', 'hurting myself', 'cutting', 'depression',
  'depressed', 'hopeless', 'worthless', 'abuse', 'domestic violence', 'hitting', 'shaking baby',
  'unsafe', 'neglect', '911', 'call 911', 'ambulance', 'hospital now',
]

const CRISIS_TEXT: Record<string, string> = {
  en: "Thank you for telling us. Your safety and your baby's safety come first. If you are in danger or this is an emergency, call 911 now. If you are having thoughts of harming yourself, call or text 988 to reach the Suicide & Crisis Lifeline any time. Please also contact your provider today.",
  es: 'Gracias por contarnos. Tu seguridad y la de tu bebé son lo primero. Si estás en peligro o es una emergencia, llama al 911 ahora. Si tienes pensamientos de hacerte daño, llama o envía un mensaje de texto al 988 para comunicarte con la Línea de Prevención del Suicidio y Crisis en cualquier momento. Por favor, comunícate también hoy con tu proveedor de salud.',
  vi: 'Cảm ơn bạn đã chia sẻ. Sự an toàn của bạn và em bé là trên hết. Nếu bạn đang gặp nguy hiểm hoặc đây là trường hợp khẩn cấp, hãy gọi 911 ngay. Nếu bạn có ý nghĩ làm hại bản thân, hãy gọi hoặc nhắn tin đến 988 để liên hệ Đường dây Hỗ trợ Khủng hoảng bất cứ lúc nào. Xin hãy liên hệ với bác sĩ của bạn ngay hôm nay.',
}

// Used when OpenAI is unavailable or its reply fails validation.
const FALLBACK_EMPATHY: Record<string, string> = {
  en: "Thank you for sharing that with us. Whatever you're dealing with right now, you don't have to figure it out alone.",
  es: 'Gracias por compartir esto con nosotros. Sea lo que sea que estés viviendo ahora, no tienes que resolverlo sola.',
  vi: 'Cảm ơn bạn đã chia sẻ với chúng tôi. Dù bạn đang trải qua điều gì, bạn không phải tự mình vượt qua một mình.',
}

const LANGUAGE_NAME: Record<string, string> = { en: 'English', es: 'Spanish', vi: 'Vietnamese' }

// Whitelisted optional answers. Values are the option labels the parent tapped.
const ANSWER_KEYS = ['support_type', 'insurance', 'provider', 'notes'] as const

function lang(code: string | null | undefined): 'en' | 'es' | 'vi' {
  return code === 'es' || code === 'vi' ? code : 'en'
}

function keywordHits(text: string): string[] {
  const t = text.toLowerCase()
  return ESCALATION_KEYWORDS.filter((k) => t.includes(k))
}

async function moderationFlags(apiKey: string, text: string): Promise<boolean> {
  if (!apiKey) return false
  try {
    const res = await fetch('https://api.openai.com/v1/moderations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'text-moderation-latest', input: text }),
    })
    if (!res.ok) return false
    const r = (await res.json())?.results?.[0]
    if (!r?.flagged) return false
    const c = r.categories ?? {}
    return c['self-harm'] === true || c['violence'] === true
  } catch (e) {
    console.error('support-intake: moderation call failed', (e as Error)?.message)
    return false
  }
}

/** Returns an urgent reason, or null when the text is safe to answer normally. */
async function safetyCheck(apiKey: string, text: string): Promise<string | null> {
  const hits = keywordHits(text)
  if (hits.length > 0) return `Escalation keywords: ${hits.join(', ')}`
  if (await moderationFlags(apiKey, text)) return 'OpenAI Moderation flagged self-harm or violence.'
  return null
}

async function detectTopic(supabase: ReturnType<typeof createClient>, text: string): Promise<string> {
  const { data, error } = await supabase
    .from('specialty_categories')
    .select('name, keywords')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
  if (error) {
    console.error('support-intake: categories load failed', error.message)
    return 'General Parenting'
  }
  const t = text.toLowerCase()
  for (const c of (data ?? []) as Array<{ name: string; keywords: string[] }>) {
    if ((c.keywords ?? []).some((k) => t.includes(k.toLowerCase()))) return c.name
  }
  return 'General Parenting'
}

async function empathyReply(apiKey: string, text: string, language: 'en' | 'es' | 'vi'): Promise<string> {
  if (!apiKey) return FALLBACK_EMPATHY[language]
  const system = [
    'You write ONE short, warm acknowledgement for a parent who just asked a parenting-support service for help.',
    `Write in ${LANGUAGE_NAME[language]}.`,
    'Rules:',
    '- 1 or 2 sentences, under 45 words total.',
    '- Acknowledge how they might be feeling and that reaching out is a good step.',
    '- Do NOT give advice, tips, information, diagnoses, or next steps.',
    '- Do NOT ask questions. Do NOT promise outcomes or timelines.',
    '- Do NOT mention products, experts, resources, AI, or the team.',
    '- No greetings, no names, no emojis, no lists, no links.',
    'Output only the acknowledgement text.',
  ].join('\n')

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.4,
        max_tokens: 90,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: text.slice(0, MAX_TEXT) },
        ],
      }),
    })
    if (!res.ok) {
      console.error('support-intake: completion HTTP', res.status)
      return FALLBACK_EMPATHY[language]
    }
    const reply = String((await res.json())?.choices?.[0]?.message?.content ?? '').trim()
    // Reject anything outside the brief: empty, too long, links, or a question.
    if (!reply || reply.length > MAX_REPLY_CHARS || /https?:\/\/|www\.|\?/.test(reply)) {
      return FALLBACK_EMPATHY[language]
    }
    return reply
  } catch (e) {
    console.error('support-intake: completion failed', (e as Error)?.message)
    return FALLBACK_EMPATHY[language]
  }
}

// -- Submit-time messages ------------------------------------------------------
const CONFIRM_SUBJECT: Record<string, string> = {
  en: "We're working on your request",
  es: 'Estamos trabajando en tu solicitud',
  vi: 'Chúng tôi đang xử lý yêu cầu của bạn',
}
// Client wording (2026-10-07). es/vi are our translations, pending bilingual review.
const confirmText = (language: 'en' | 'es' | 'vi', name: string) => ({
  en: `Hi ${name}. Whisperoo Team here - we just wanted to let you know, we're working on your request.`,
  es: `Hola ${name}. Te saluda el equipo de Whisperoo: solo queríamos avisarte que estamos trabajando en tu solicitud.`,
  vi: `Chào ${name}. Đội ngũ Whisperoo đây - chúng tôi muốn cho bạn biết rằng chúng tôi đang xử lý yêu cầu của bạn.`,
})[language]

const escapeHtml = (v: string) =>
  v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

async function sendEmail(to: string, subject: string, text: string): Promise<string | null> {
  const key = Deno.env.get('SENDGRID_API_KEY')
  const from = Deno.env.get('SUPPORT_FROM_EMAIL')
  if (!key || !from) return 'skipped: SendGrid not configured'
  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: from, name: 'Whisperoo' },
      subject,
      content: [
        { type: 'text/plain', value: text },
        { type: 'text/html', value: `<p>${escapeHtml(text).replace(/\n/g, '<br>')}</p>` },
      ],
    }),
  })
  return res.ok ? null : `failed: SendGrid HTTP ${res.status}`
}

async function sendSms(to: string, body: string): Promise<string | null> {
  const sid = Deno.env.get('TWILIO_ACCOUNT_SID')
  const token = Deno.env.get('TWILIO_AUTH_TOKEN')
  const from = Deno.env.get('TWILIO_FROM_NUMBER')
  if (!sid || !token || !from) return 'skipped: Twilio not configured'
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${sid}:${token}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ To: to, From: from, Body: body }),
  })
  return res.ok ? null : `failed: Twilio HTTP ${res.status}`
}

/** Sends the parent confirmation and team alert; never throws. Returns the columns to store. */
async function notify(
  supabase: ReturnType<typeof createClient>,
  opts: { userId: string; email: string | undefined; language: 'en' | 'es' | 'vi'; urgent: boolean; hospital: string | null },
): Promise<Record<string, unknown>> {
  const now = new Date().toISOString()
  const out: Record<string, unknown> = {}
  const log: string[] = []
  const attempt = async (label: string, col: string, fn: () => Promise<string | null>) => {
    try {
      const err = await fn()
      if (err) log.push(`${label} ${err}`)
      else out[col] = now
    } catch (e) {
      log.push(`${label} failed: ${(e as Error)?.message ?? 'error'}`)
    }
  }

  const { data: p } = await supabase
    .from('profiles')
    .select('first_name, phone_number, sms_opt_in, sms_opt_out_at')
    .eq('id', opts.userId)
    .single()
  const fallbackName = { en: 'there', es: '', vi: 'bạn' }[opts.language]
  const name = (p?.first_name ?? '').trim() || fallbackName
  const text = confirmText(opts.language, name).replace('Hola .', 'Hola.')

  if (opts.email) {
    await attempt('parent-email', 'parent_emailed_at', () => sendEmail(opts.email!, CONFIRM_SUBJECT[opts.language], text))
  } else {
    log.push('parent-email skipped: no email on account')
  }

  if (p?.sms_opt_in === true && !p?.sms_opt_out_at && p?.phone_number) {
    await attempt('parent-sms', 'parent_texted_at', () => sendSms(p.phone_number, text))
  } else {
    log.push('parent-sms skipped: no SMS consent or no phone')
  }

  const team = Deno.env.get('SUPPORT_TEAM_EMAIL')
  if (team) {
    const portal = `${Deno.env.get('APP_URL') ?? 'https://app.whisperoo.app'}/admin/super`
    const subject = opts.urgent ? 'URGENT: new Get Support request' : 'New Get Support request'
    const body = [
      opts.urgent
        ? 'A parent submitted a request that tripped the safety checks. They were shown crisis resources. Please reach out first.'
        : 'A parent submitted a new Get Support request.',
      `From: ${opts.hospital ?? 'Direct signup'}`,
      `Open the queue: ${portal} (Support Requests tab)`,
      '',
      'Request details are in the admin portal only. They are not included in this email.',
    ].join('\n')
    await attempt('team-alert', 'team_alerted_at', () => sendEmail(team, subject, body))
  } else {
    log.push('team-alert skipped: SUPPORT_TEAM_EMAIL not set')
  }

  if (log.length) out.notify_log = log.join('; ')
  return out
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )
  const openaiKey = (Deno.env.get('OPENAI_API_KEY') ?? '').trim()

  const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '')
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return json(401, { error: 'Unauthorized' })

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json(400, { error: 'Invalid JSON' })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('tenant_id, language_preference')
    .eq('id', user.id)
    .single()
  const language = lang(profile?.language_preference)

  // ── create ────────────────────────────────────────────────────────────────
  if (body.action === 'create') {
    const text = typeof body.text === 'string' ? body.text.trim() : ''
    if (!text) return json(400, { error: 'Please tell us what you need help with.' })
    if (text.length > MAX_TEXT) return json(400, { error: 'That message is too long.' })

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { count } = await supabase
      .from('support_requests')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', since)
    if ((count ?? 0) >= MAX_REQUESTS_PER_DAY) {
      return json(429, { error: 'You have sent several requests today. Our team will be in touch soon.' })
    }

    const urgentReason = await safetyCheck(openaiKey, text)
    const topic = await detectTopic(supabase, text)
    const reply = urgentReason ? CRISIS_TEXT[language] : await empathyReply(openaiKey, text, language)

    const { data: row, error: insErr } = await supabase
      .from('support_requests')
      .insert({
        user_id: user.id,
        tenant_id: profile?.tenant_id ?? null,
        request_text: text,
        topic,
        empathy_reply: reply,
        language,
        is_urgent: !!urgentReason,
        urgent_reason: urgentReason,
      })
      .select('id')
      .single()
    if (insErr || !row) {
      console.error('support-intake: insert failed', insErr?.message)
      return json(500, { error: 'We could not send your request. Please try again.' })
    }

    // Messages go out after the request is safely stored. A provider failure must
    // never lose the request, so the outcome is recorded rather than surfaced.
    let hospital: string | null = null
    if (profile?.tenant_id) {
      const { data: tenant } = await supabase.from('tenants').select('name').eq('id', profile.tenant_id).single()
      hospital = tenant?.name ?? null
    }
    const delivery = await notify(supabase, {
      userId: user.id, email: user.email, language, urgent: !!urgentReason, hospital,
    })
    const { error: dErr } = await supabase.from('support_requests').update(delivery).eq('id', row.id)
    if (dErr) console.error('support-intake: delivery record failed', dErr.message)

    return json(200, { id: row.id, topic, reply, urgent: !!urgentReason })
  }

  // ── answers ───────────────────────────────────────────────────────────────
  if (body.action === 'answers') {
    const id = typeof body.id === 'string' ? body.id : ''
    const raw = (body.answers && typeof body.answers === 'object') ? body.answers as Record<string, unknown> : {}
    if (!id) return json(400, { error: 'Missing request id' })

    const answers: Record<string, string> = {}
    for (const k of ANSWER_KEYS) {
      const v = raw[k]
      if (typeof v !== 'string') continue
      const s = v.trim()
      if (!s) continue
      answers[k] = s.slice(0, k === 'notes' ? MAX_NOTE : 200)
    }

    const { data: existing, error: getErr } = await supabase
      .from('support_requests')
      .select('id, user_id, status, is_urgent, urgent_reason')
      .eq('id', id)
      .single()
    if (getErr || !existing || existing.user_id !== user.id) return json(404, { error: 'Request not found' })
    if (existing.status === 'done') return json(409, { error: 'This request is already done.' })

    const noteReason = answers.notes ? await safetyCheck(openaiKey, answers.notes) : null
    const update: Record<string, unknown> = { answers, updated_at: new Date().toISOString() }
    if (noteReason && !existing.is_urgent) {
      update.is_urgent = true
      update.urgent_reason = `In notes — ${noteReason}`
    }

    const { error: upErr } = await supabase.from('support_requests').update(update).eq('id', id)
    if (upErr) {
      console.error('support-intake: answers update failed', upErr.message)
      return json(500, { error: 'We could not save your answers. Please try again.' })
    }

    return json(200, {
      ok: true,
      urgent: !!noteReason || existing.is_urgent,
      crisis: noteReason ? CRISIS_TEXT[language] : null,
    })
  }

  return json(400, { error: 'Unknown action' })
})
