-- ============================================================================
-- Migration: Track discount code usage on purchases
-- Purpose: 1. Add discount_code column to purchases table
--          2. Add trigger to increment current_uses in discount_codes
--             only when a purchase is actually COMPLETED.
-- ============================================================================

-- 1. Add discount_code column to purchases
ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS discount_code text;

COMMENT ON COLUMN public.purchases.discount_code
  IS 'The discount code applied to this purchase.';

-- 2. Create function to handle discount usage increment via trigger
CREATE OR REPLACE FUNCTION public.fn_handle_discount_usage_increment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Guard: only act when there's actually a discount code
  IF NEW.discount_code IS NULL THEN
    RETURN NEW;
  END IF;

  -- INSERT path: free purchases are inserted directly with status='completed'
  IF TG_OP = 'INSERT' AND NEW.status = 'completed' THEN
    UPDATE public.discount_codes
    SET current_uses = current_uses + 1
    WHERE code = UPPER(NEW.discount_code)
      AND is_active = true;
  END IF;

  -- UPDATE path: paid purchases transition from 'pending' -> 'completed'
  IF TG_OP = 'UPDATE' AND NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
    UPDATE public.discount_codes
    SET current_uses = current_uses + 1
    WHERE code = UPPER(NEW.discount_code)
      AND is_active = true;
  END IF;

  RETURN NEW;
END;
$$;

-- 3. Create trigger on purchases
DROP TRIGGER IF EXISTS trigger_increment_discount_usage ON public.purchases;
CREATE TRIGGER trigger_increment_discount_usage
  AFTER INSERT OR UPDATE OF status ON public.purchases
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_handle_discount_usage_increment();

-- 4. (Optional) Backfill: If metadata has discount_code, pull it out to the column
-- This helps clean up existing data
UPDATE public.purchases
SET discount_code = metadata->>'discount_code'
WHERE discount_code IS NULL AND metadata->>'discount_code' IS NOT NULL;
