-- ============================================================================
-- Migration: Add admin_notes and discount_code to consultation_bookings
-- Purpose: Allow SuperAdmins to record coordination notes and see promo codes
--          for consultations, improving transparency and oversight.
-- ============================================================================

ALTER TABLE public.consultation_bookings
  ADD COLUMN IF NOT EXISTS admin_notes text,
  ADD COLUMN IF NOT EXISTS discount_code text;

COMMENT ON COLUMN public.consultation_bookings.admin_notes
  IS 'Private notes for SuperAdmin coordination with experts and users.';

COMMENT ON COLUMN public.consultation_bookings.discount_code
  IS 'The discount code applied to this consultation (if any).';
