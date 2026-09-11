-- Index purchases by payment_intent_id.
--
-- The stripe-webhook edge function looks purchases up by the PaymentIntent id on
-- every event Stripe sends. Until now nothing indexed that column, so each event
-- was a sequential scan. Small today, but it is on the payment path and grows
-- with every sale.
--
-- Deliberately NOT unique. Production holds no duplicates (checked: 0 groups with
-- more than one row per payment_intent_id across 275 purchases), so a unique index
-- would apply cleanly — but idempotency in the webhook is enforced by the row's
-- status, not by uniqueness, and a unique constraint is a permanent promise that a
-- future flow (gifting, split purchases) could trip on. A plain index gives the
-- lookup speed without the promise.
--
-- Free purchases have a NULL payment_intent_id; they are simply absent from the
-- index, which is correct — no webhook ever refers to them.

CREATE INDEX IF NOT EXISTS idx_purchases_payment_intent_id
  ON public.purchases (payment_intent_id)
  WHERE payment_intent_id IS NOT NULL;

-- ROLLBACK: DROP INDEX IF EXISTS public.idx_purchases_payment_intent_id;
