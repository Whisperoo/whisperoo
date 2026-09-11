-- Backfill: the one production purchase that was paid but never marked completed.
--
-- Before the stripe-webhook function existed (20260912000001 + the function itself),
-- nothing server-side ever moved a card purchase out of 'pending'. On 2026-09-12 every
-- pending production purchase was checked against Stripe (live, read-only):
--
--   56  requires_payment_method   abandoned checkouts, never paid
--   12  resource_missing          Stripe does not know the PaymentIntent in live mode
--                                 (created with test keys against the prod DB, or from
--                                 a different account) -- never charged
--    5  (no payment_intent_id)    $0.00 rows from 2026-01-22, product since deleted
--    1  succeeded                 CHARGED, still pending  <-- this migration
--
-- Only the last one is a customer who paid and received nothing. Scope is exactly
-- that row, matched on its PaymentIntent id, so this cannot touch anything else.
--
-- Safe on staging: the PaymentIntent does not exist there, so the UPDATE matches
-- zero rows. Safe to re-run: the status guard makes it a no-op once applied.

UPDATE public.purchases
SET status = 'completed'
WHERE payment_intent_id = 'pi_3Smc5pGoPqMhq4zM1xKwhurM'
  AND status = 'pending';

-- The remaining 73 are deliberately left alone. The 56 abandoned intents will be
-- expired by Stripe; marking the 12 unknown and 5 orphaned rows 'failed' is a
-- tidy-up worth doing, but it is a judgement call about historical data and does
-- not belong bundled with a fix for a customer who was actually charged.
