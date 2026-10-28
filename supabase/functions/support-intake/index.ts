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
//   parent email  BREVO_API_KEY + SUPPORT_FROM_EMAIL
//   parent SMS    BREVO_API_KEY + BREVO_SMS_SENDER, and ONLY
//                 if the parent opted in to SMS and has not opted out (TCPA)
//   team alert    BREVO_API_KEY + SUPPORT_FROM_EMAIL + SUPPORT_TEAM_EMAIL. Carries no
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

// Starts from chat_ai_rag_fixed ESCALATION_KEYWORDS, plus EMERGENCY_PHRASES below.
const ESCALATION_KEYWORDS = [
  'suicide', 'bleeding', 'emergency', 'fever over', 'self-harm', 'harm', 'kill',
  'choking', 'seizure', 'not breathing', 'unconscious', 'blue lips', 'high fever',
  'head injury', 'poisoning', 'anaphylaxis', 'allergic reaction', 'swallowed', 'overdose',
  'want to die', 'kill myself', 'end my life', 'hurting myself', 'cutting', 'depression',
  'depressed', 'hopeless', 'worthless', 'abuse', 'domestic violence', 'hitting', 'shaking baby',
  'unsafe', 'neglect', '911', 'call 911', 'ambulance', 'hospital now',
]

// Added 2026-10-08 after QA: "he stopped breathing for a second" was not caught —
// the base list only had "not breathing". Breathing, colour, responsiveness and
// seizure phrasings a parent actually writes. Over-escalation is the intended bias.
const EMERGENCY_PHRASES = [
  'stopped breathing', 'stop breathing', 'stops breathing', "isn't breathing", 'is not breathing',
  "wasn't breathing", 'was not breathing', "can't breathe", 'cant breathe', 'cannot breathe',
  'trouble breathing', 'struggling to breathe', 'hard to breathe', 'gasping', 'pauses in breathing',
  'turning blue', 'turned blue', 'blue around', 'went blue', 'went limp', 'gone limp', 'floppy',
  'unresponsive', "won't wake", 'wont wake', "can't wake", 'cant wake', 'passed out', 'fainted',
  'convulsing', 'convulsion', 'fitting', 'fell on his head', 'fell on her head', 'dropped the baby',
  'not moving', 'stopped moving', 'hurt myself', 'hurt my baby', 'hurt the baby', 'end it all',
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
  // Normalise curly apostrophes so "can’t breathe" matches "can't breathe".
  const t = text.toLowerCase().replace(/[‘’]/g, "'")
  // Match at the START of a word only: "pharmacy" no longer trips "harm" and "skills"
  // no longer trips "kill", while "killing" and "self-harm" still match. A trailing
  // boundary is deliberately NOT required — it would miss "killing", "depressed…".
  return [...ESCALATION_KEYWORDS, ...EMERGENCY_PHRASES].filter((k) => KEYWORD_RE.get(k)!.test(t))
}

const KEYWORD_RE = new Map(
  [...ESCALATION_KEYWORDS, ...EMERGENCY_PHRASES].map((k) => [
    k,
    new RegExp(`(^|[^a-z0-9])${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`),
  ]),
)

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

// Footer lines for the parent email, in the parent's language. The 911 line follows
// the project's over-escalation rule for anything a parent might read in a hurry.
const PARENT_FOOTER: Record<'en' | 'es' | 'vi', string[]> = {
  en: [
    'If you have an urgent medical concern, contact your provider or call 911.',
    'Questions? Email us at support@whisperoo.app.',
  ],
  es: [
    'Si tienes una preocupación médica urgente, comunícate con tu proveedor de salud o llama al 911.',
    '¿Preguntas? Escríbenos a support@whisperoo.app.',
  ],
  vi: [
    'Nếu bạn có vấn đề y tế khẩn cấp, hãy liên hệ bác sĩ của bạn hoặc gọi 911.',
    'Có câu hỏi? Gửi email cho chúng tôi tại support@whisperoo.app.',
  ],
}

const LOGO_URL = 'https://app.whisperoo.app/lovable-uploads/96238edd-91f3-4ff1-87be-ac5d867fa98a.png'
const FONT = 'Helvetica, Arial, sans-serif'

/**
 * Branded HTML matching supabase/templates/* (scripts/email/build-auth-templates.py):
 * table layout + inline styles, which is what mail clients render reliably.
 * Every dynamic string is escaped here; callers pass plain text.
 */
function brandedHtml(opts: {
  lang: string
  heading: string
  paragraphs: string[]
  button?: { label: string; url: string }
  banner?: string
  footer: string[]
}): string {
  const p = opts.paragraphs
    .map((t) => `<p style="margin:0 0 12px 0;">${escapeHtml(t)}</p>`)
    .join('')
  const banner = opts.banner
    ? `<tr><td style="padding:16px 32px 0 32px;"><div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:10px;padding:12px 14px;font-family:${FONT};font-size:14px;line-height:20px;font-weight:600;color:#991B1B;">${escapeHtml(opts.banner)}</div></td></tr>`
    : ''
  const button = opts.button
    ? `<tr><td style="padding:4px 32px 8px 32px;"><a href="${escapeHtml(opts.button.url)}" style="display:inline-block;background:#2E54A5;color:#ffffff;text-decoration:none;font-family:${FONT};font-size:15px;font-weight:600;line-height:20px;padding:14px 28px;border-radius:10px;">${escapeHtml(opts.button.label)}</a></td></tr>`
    : ''
  const footer = opts.footer.map(escapeHtml).join('<br>')
  return `<!DOCTYPE html><html lang="${escapeHtml(opts.lang)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>${escapeHtml(opts.heading)}</title></head>
<body style="margin:0;padding:0;background:#F5F7FB;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F5F7FB;"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#ffffff;border:1px solid #E2E8F0;border-radius:16px;">
<tr><td style="padding:32px 32px 8px 32px;"><img src="${LOGO_URL}" width="140" height="48" alt="Whisperoo" style="display:block;border:0;outline:none;text-decoration:none;"></td></tr>${banner}
<tr><td style="padding:16px 32px 4px 32px;font-family:${FONT};"><h1 style="margin:0;font-size:22px;line-height:30px;font-weight:700;color:#1A202C;">${escapeHtml(opts.heading)}</h1></td></tr>
<tr><td style="padding:8px 32px 8px 32px;font-family:${FONT};font-size:15px;line-height:24px;color:#4A5568;">${p}</td></tr>${button}
<tr><td style="padding:24px 32px 32px 32px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="border-top:1px solid #E2E8F0;padding-top:16px;font-family:${FONT};font-size:12px;line-height:18px;color:#718096;">${footer}</td></tr></table></td></tr>
</table></td></tr></table></body></html>`
}

// Brevo transactional email (client switched from SendGrid, 2026-10-16 — locked out
// of their SendGrid account). POST /v3/smtp/email, `api-key` header, 201 on success.
// `html` is the branded body; `text` is the plain-text alternative.
async function sendEmail(to: string, subject: string, text: string, html: string): Promise<string | null> {
  const key = Deno.env.get('BREVO_API_KEY')
  const from = Deno.env.get('SUPPORT_FROM_EMAIL')
  if (!key || !from) return 'skipped: Brevo not configured'
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': key, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      sender: { email: from, name: 'Whisperoo' },
      to: [{ email: to }],
      subject,
      textContent: text,
      htmlContent: html,
    }),
  })
  if (res.ok) return null
  // Brevo returns { code, message } on errors; the message never contains the key.
  const detail = await res.json().then((b) => b?.code ?? b?.message).catch(() => null)
  return `failed: Brevo HTTP ${res.status}${detail ? ` (${detail})` : ''}`
}

/**
 * profiles.phone_number is stored US-formatted with no country code, "(555) 123-4567"
 * (every row on staging and prod, checked 2026-10-17). Brevo wants digits with the
 * country code. Anything that isn't a 10-digit US number (or 11 starting with 1) is
 * rejected rather than guessed at.
 */
function toBrevoRecipient(phone: string): string | null {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 10) return `1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return digits
  return null
}

// Brevo transactional SMS (client moved SMS to Brevo, 2026-10-17). Uses the current
// async endpoint — POST /v3/transactionalSMS/send; the older /transactionalSMS/sms is
// deprecated. Same `api-key` as email. BREVO_SMS_SENDER is the Sender ID registered in
// Brevo (for the US this registers the toll-free number); unregistered US sends are
// suspended by Brevo. No "Reply STOP" in the body: Brevo reclassifies transactional SMS
// containing a stop code as marketing. STOP/START/HELP replies are handled by Brevo.
async function sendSms(phone: string, body: string, unicode: boolean): Promise<string | null> {
  const key = Deno.env.get('BREVO_API_KEY')
  const sender = Deno.env.get('BREVO_SMS_SENDER')
  if (!key || !sender) return 'skipped: Brevo SMS not configured'
  const recipient = toBrevoRecipient(phone)
  if (!recipient) return 'skipped: phone number is not a valid US number'
  const res = await fetch('https://api.brevo.com/v3/transactionalSMS/send', {
    method: 'POST',
    headers: { 'api-key': key, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      sender,
      recipient,
      content: body,
      type: 'transactional',
      // US carriers expect the brand up front; Brevo prepends it.
      organisationPrefix: 'Whisperoo',
      // Spanish/Vietnamese accents are outside GSM-7.
      unicodeEnabled: unicode,
    }),
  })
  if (res.ok) return null
  const detail = await res.json().then((b) => b?.code ?? b?.message).catch(() => null)
  return `failed: Brevo SMS HTTP ${res.status}${detail ? ` (${detail})` : ''}`
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
    const subject = CONFIRM_SUBJECT[opts.language]
    const footer = PARENT_FOOTER[opts.language]
    const html = brandedHtml({ lang: opts.language, heading: subject, paragraphs: [text], footer })
    await attempt('parent-email', 'parent_emailed_at', () =>
      sendEmail(opts.email!, subject, `${text}\n\n${footer.join('\n')}`, html))
  } else {
    log.push('parent-email skipped: no email on account')
  }

  if (p?.sms_opt_in === true && !p?.sms_opt_out_at && p?.phone_number) {
    await attempt('parent-sms', 'parent_texted_at', () => sendSms(p.phone_number, text, opts.language !== 'en'))
  } else {
    log.push('parent-sms skipped: no SMS consent or no phone')
  }

  const team = Deno.env.get('SUPPORT_TEAM_EMAIL')
  if (team) {
    const portal = `${Deno.env.get('APP_URL') ?? 'https://app.whisperoo.app'}/admin/super`
    const subject = opts.urgent ? 'URGENT: new Get Support request' : 'New Get Support request'
    const lead = opts.urgent
      ? 'A parent submitted a request that tripped the safety checks. They were shown crisis resources. Please reach out first.'
      : 'A parent submitted a new Get Support request.'
    const from = `From: ${opts.hospital ?? 'Direct signup'}`
    const privacy = 'Request details are in the admin portal only. They are not included in this email.'
    const body = [lead, from, `Open the queue: ${portal} (Support Requests tab)`, '', privacy].join('\n')
    const html = brandedHtml({
      lang: 'en',
      heading: subject,
      banner: opts.urgent ? 'Urgent: reach out to this parent first.' : undefined,
      paragraphs: [lead, from],
      button: { label: 'Open Support Requests', url: portal },
      footer: [privacy, 'Sent by Whisperoo to the support team.'],
    })
    await attempt('team-alert', 'team_alerted_at', () => sendEmail(team, subject, body, html))
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
    if (noteReason) {
      update.is_urgent = true
      update.urgent_reason = existing.is_urgent
        ? `${existing.urgent_reason ?? 'Urgent'}; in notes — ${noteReason}`
        : `In notes — ${noteReason}`
      // empathy_reply records what the parent was shown; from here on that is the crisis text.
      update.empathy_reply = CRISIS_TEXT[language]
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
