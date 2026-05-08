-- Add payment_status to consultation_bookings
-- Tracks whether the patient actually paid (separate from booking status)

ALTER TABLE consultation_bookings
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid', 'paid', 'free', 'refunded'));

-- Backfill payment_status from the linked purchase record
UPDATE consultation_bookings cb
SET payment_status = CASE
  WHEN p.status = 'completed' AND p.amount > 0 THEN 'paid'
  WHEN p.status = 'completed' AND (p.amount = 0 OR p.amount IS NULL) THEN 'free'
  WHEN p.status = 'refunded' THEN 'refunded'
  ELSE 'unpaid'
END
FROM purchases p
WHERE cb.purchase_id = p.id;

-- Also backfill any empty user_email fields from profiles
UPDATE consultation_bookings cb
SET user_email = COALESCE(
  (SELECT email FROM auth.users WHERE id = cb.user_id),
  cb.user_email
)
WHERE cb.user_email = '' OR cb.user_email IS NULL;
