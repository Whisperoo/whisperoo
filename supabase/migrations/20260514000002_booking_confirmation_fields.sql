-- ==========================================================================
-- Add per-product booking confirmation headline + description fields.
--
-- When set, these override the generic i18n strings on the
-- PurchaseSuccessPage, allowing super admin to customise the top-of-page
-- message per consultation product (e.g. "Your lactation session is booked!").
-- ==========================================================================

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS booking_confirmation_title TEXT,
  ADD COLUMN IF NOT EXISTS booking_confirmation_desc  TEXT;
