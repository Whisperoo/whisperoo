-- Standalone backfill: populate consultation_bookings from existing purchases
-- Run this AFTER the 20260508_booking_system.sql migration has created the table

INSERT INTO consultation_bookings
  (user_id, user_email, user_name, expert_id, expert_name,
   product_id, appointment_name, booking_type, amount_paid,
   purchase_id, resource_type, status, booked_at)
SELECT
  p.user_id,
  COALESCE(prof.email, ''),
  COALESCE(prof.first_name, 'User'),
  p.expert_id,
  COALESCE(exp.first_name, 'Expert'),
  p.product_id,
  COALESCE(pr.title, 'Consultation'),
  'direct',
  p.amount,
  p.id,
  CASE WHEN pr.is_hospital_resource THEN 'hospital' ELSE 'whisperoo' END,
  CASE
    WHEN p.consultation_completed = true THEN 'completed'
    ELSE 'pending'
  END,
  COALESCE(p.purchased_at, pr.created_at, NOW())
FROM purchases p
JOIN products pr ON p.product_id = pr.id
LEFT JOIN profiles prof ON p.user_id = prof.id
LEFT JOIN profiles exp ON p.expert_id = exp.id
WHERE pr.product_type = 'consultation'
  AND p.expert_id IS NOT NULL
  AND p.user_id IS NOT NULL
ON CONFLICT DO NOTHING;
