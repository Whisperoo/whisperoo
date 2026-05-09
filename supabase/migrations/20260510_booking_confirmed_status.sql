-- ============================================================================
-- Migration: Add 'confirmed' status to consultation_bookings
-- Purpose: Enable a three-step booking lifecycle:
--   pending → confirmed → completed (with cancel from any active state)
-- The SuperAdmin confirms the appointment after coordinating with the expert,
-- then marks it as completed once the consultation is done.
-- ============================================================================

-- Drop the existing CHECK constraint and re-create with 'confirmed' included
ALTER TABLE public.consultation_bookings
  DROP CONSTRAINT IF EXISTS consultation_bookings_status_check;

ALTER TABLE public.consultation_bookings
  ADD CONSTRAINT consultation_bookings_status_check
    CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled'));
