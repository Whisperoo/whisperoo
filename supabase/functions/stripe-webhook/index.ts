// Stripe webhook receiver — the authoritative source of truth for purchase status.
//
// WHY THIS EXISTS
// ---------------
// create-payment inserts a purchase as 'pending' and hands the client a
// PaymentIntent. Nothing server-side ever observed the outcome: the frontend
// polled the row for 60s waiting for 'completed', a status that could never
// arrive for a card payment, and then reported success regardless. Stripe took
// the money; verify-purchase refused the download because the row never left
// 'pending'. Confirmed on staging with a real test checkout, and production
// shows the same shape (74 pending purchases).
//
// Stripe calls this endpoint directly with a signed payload. The signature is
// the security boundary — there is no Supabase JWT on these requests, which is
// why config.toml sets verify_jwt = false for this function ONLY.
//
// IDEMPOTENCY
// -----------
// Stripe retries events and can deliver them out of order. Every update below is
// guarded by the row's current status so a replayed event is a no-op, and a
// 'completed' row is never downgraded. We return 200 for anything we verified
// and understood — including no-ops — so Stripe stops retrying. We return 500
// only for a real database failure, which is the one case a retry can fix.

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'jsr:@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.11.0'

const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY') || ''
const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') || ''
const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

const stripe = new Stripe(stripeSecretKey, { apiVersion: '2024-06-20' })

type PurchaseStatus = 'pending' | 'completed' | 'failed' | 'refunded'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  if (!stripeSecretKey || !webhookSecret || !supabaseUrl || !serviceRoleKey) {
    console.error('stripe-webhook: missing configuration', {
      hasStripeKey: !!stripeSecretKey,
      hasWebhookSecret: !!webhookSecret,
      hasSupabaseUrl: !!supabaseUrl,
      hasServiceRole: !!serviceRoleKey,
    })
    return json({ error: 'Webhook not configured' }, 500)
  }

  // The signature is computed over the exact raw bytes Stripe sent. Reading the
  // body as JSON and re-serialising would change whitespace and break it.
  const signature = req.headers.get('stripe-signature')
  if (!signature) {
    return json({ error: 'Missing stripe-signature header' }, 400)
  }
  const rawBody = await req.text()

  let event: Stripe.Event
  try {
    // constructEventAsync, not constructEvent: the sync variant needs Node's
    // crypto module, which Deno's edge runtime does not provide.
    event = await stripe.webhooks.constructEventAsync(rawBody, signature, webhookSecret)
  } catch (err) {
    console.error('stripe-webhook: signature verification failed', (err as Error).message)
    return json({ error: 'Invalid signature' }, 400)
  }

  // Service role: this runs with no user context and must update rows it does
  // not own. RLS on purchases is scoped to the buyer, so anon would see nothing.
  const supabase = createClient(supabaseUrl, serviceRoleKey)

  /**
   * Move a purchase to a new status, but only from the states where that
   * transition makes sense. Returns what happened so the log is useful.
   */
  const transition = async (
    paymentIntentId: string,
    to: PurchaseStatus,
    from: PurchaseStatus[],
  ): Promise<'updated' | 'noop' | 'not_found' | 'error'> => {
    const { data: rows, error: findErr } = await supabase
      .from('purchases')
      .select('id, status')
      .eq('payment_intent_id', paymentIntentId)

    if (findErr) {
      console.error('stripe-webhook: lookup failed', { paymentIntentId, error: findErr })
      return 'error'
    }
    if (!rows || rows.length === 0) {
      // Not necessarily wrong: a PaymentIntent created outside create-payment,
      // or an event for a purchase row that was deleted. Log and acknowledge.
      console.warn('stripe-webhook: no purchase for payment intent', { paymentIntentId, to })
      return 'not_found'
    }

    const eligible = rows.filter((r) => from.includes(r.status as PurchaseStatus))
    if (eligible.length === 0) {
      // Replay, out-of-order delivery, or already handled. Never downgrade.
      return 'noop'
    }

    const { error: updateErr } = await supabase
      .from('purchases')
      .update({ status: to })
      .in('id', eligible.map((r) => r.id))

    if (updateErr) {
      console.error('stripe-webhook: update failed', { paymentIntentId, to, error: updateErr })
      return 'error'
    }
    return 'updated'
  }

  let outcome: string = 'ignored'
  let paymentIntentId: string | null = null

  try {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const pi = event.data.object as Stripe.PaymentIntent
        paymentIntentId = pi.id
        outcome = await transition(pi.id, 'completed', ['pending', 'failed'])
        break
      }
      case 'payment_intent.payment_failed': {
        const pi = event.data.object as Stripe.PaymentIntent
        paymentIntentId = pi.id
        // Only a pending purchase can fail. A completed one stays completed —
        // a later failure event for the same intent would be out of order.
        outcome = await transition(pi.id, 'failed', ['pending'])
        break
      }
      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge
        paymentIntentId =
          typeof charge.payment_intent === 'string'
            ? charge.payment_intent
            : charge.payment_intent?.id ?? null
        if (!paymentIntentId) {
          console.warn('stripe-webhook: charge.refunded without payment_intent', { chargeId: charge.id })
          outcome = 'not_found'
          break
        }
        outcome = await transition(paymentIntentId, 'refunded', ['completed', 'pending'])
        break
      }
      default:
        // Subscribed events only; anything else is acknowledged and ignored so
        // Stripe does not retry it.
        outcome = 'ignored'
    }
  } catch (err) {
    console.error('stripe-webhook: handler threw', { type: event.type, error: (err as Error).message })
    return json({ error: 'Handler error' }, 500)
  }

  console.log('stripe-webhook', { id: event.id, type: event.type, paymentIntentId, outcome })

  // A database error is the one thing a Stripe retry can fix.
  if (outcome === 'error') {
    return json({ received: true, outcome }, 500)
  }
  return json({ received: true, outcome })
})
