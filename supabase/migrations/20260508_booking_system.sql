-- ============================================================
-- Booking System Migration
-- Adds booking_model to products + consultation_bookings table
-- ============================================================

-- 1. Add booking model columns to products
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS booking_model TEXT DEFAULT 'direct'
    CHECK (booking_model IN ('direct', 'inquiry', 'hospital'));

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS how_to_schedule TEXT;

-- 2. Create consultation_bookings table
CREATE TABLE IF NOT EXISTS consultation_bookings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Who booked
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  user_email TEXT NOT NULL,
  user_name TEXT NOT NULL,

  -- Which expert
  expert_id UUID REFERENCES profiles(id) NOT NULL,
  expert_name TEXT NOT NULL,

  -- What was booked
  product_id UUID REFERENCES products(id) NOT NULL,
  appointment_name TEXT NOT NULL,

  -- Financial
  booking_type TEXT NOT NULL CHECK (booking_type IN ('direct', 'inquiry')),
  amount_paid NUMERIC(10,2) DEFAULT NULL,
  purchase_id UUID,

  -- Classification
  resource_type TEXT NOT NULL DEFAULT 'whisperoo'
    CHECK (resource_type IN ('whisperoo', 'hospital')),

  -- Lifecycle (admin manages this)
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'completed', 'cancelled')),

  -- Timestamps
  booked_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Indexes for admin dashboard performance
CREATE INDEX IF NOT EXISTS idx_cb_status ON consultation_bookings(status);
CREATE INDEX IF NOT EXISTS idx_cb_expert ON consultation_bookings(expert_id);
CREATE INDEX IF NOT EXISTS idx_cb_booked_at ON consultation_bookings(booked_at DESC);
CREATE INDEX IF NOT EXISTS idx_cb_user ON consultation_bookings(user_id);

-- 4. RLS
ALTER TABLE consultation_bookings ENABLE ROW LEVEL SECURITY;

-- Users can view their own bookings
CREATE POLICY "Users can view own bookings"
  ON consultation_bookings FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create their own bookings (inquiry flow)
CREATE POLICY "Users can create own bookings"
  ON consultation_bookings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Admins / service role full access
CREATE POLICY "Admins full access"
  ON consultation_bookings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND account_type IN ('admin', 'super_admin')
    )
  );

-- 5. Auto-update updated_at trigger
CREATE TRIGGER update_consultation_bookings_updated_at
  BEFORE UPDATE ON consultation_bookings
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- 6. Backfill existing consultation purchases (run once)
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
ON CONFLICT DO NOTHING;

