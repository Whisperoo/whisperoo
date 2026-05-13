-- ============================================================================
-- Migration: Deduplicate consultation_bookings + add guard against future dupes
-- Root cause: create-payment edge function inserts a booking on every call.
-- Double-click (or network retry) creates two purchases and two bookings for
-- the same user+product pair.
-- ============================================================================

-- 1. Remove existing duplicates: keep only the OLDEST booking per
--    (user_id, product_id) pair that is still active (pending/confirmed).
--    This preserves the first valid booking and removes stale copies.
DELETE FROM public.consultation_bookings
WHERE id IN (
  SELECT id FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY user_id, product_id
        ORDER BY booked_at ASC  -- keep the earliest (first real booking)
      ) AS rn
    FROM public.consultation_bookings
    WHERE status IN ('pending', 'confirmed')
  ) ranked
  WHERE rn > 1
);

-- 2. Partial unique index: at most one active booking per user per product.
--    Completed/cancelled bookings are excluded so users can re-book after
--    a consultation finishes or is cancelled.
CREATE UNIQUE INDEX IF NOT EXISTS idx_cb_one_active_per_user_product
  ON public.consultation_bookings (user_id, product_id)
  WHERE status IN ('pending', 'confirmed');
