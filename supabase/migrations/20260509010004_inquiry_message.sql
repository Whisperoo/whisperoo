-- ============================================================================
-- Migration: Add inquiry_confirmation_message to expert profiles
-- Purpose: Allow SuperAdmins to set a custom confirmation message that users
--          see after requesting an appointment with an inquiry-based expert.
-- ============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS inquiry_confirmation_message text;

COMMENT ON COLUMN public.profiles.inquiry_confirmation_message
  IS 'Custom message shown to users after they submit a consultation inquiry for this expert. Editable by SuperAdmin.';
