-- Fix for: "error while removing resources which are related to previously deleted experts"
-- This migration updates consultation_bookings to allow experts and products to be deleted
-- while preserving the historical booking records.

-- 1. Make IDs nullable so they can survive the deletion of the referenced entity
ALTER TABLE consultation_bookings 
  ALTER COLUMN expert_id DROP NOT NULL,
  ALTER COLUMN product_id DROP NOT NULL;

-- 2. Drop existing restrictive constraints
-- We use a DO block to find the constraint names if they aren't standard
DO $$
BEGIN
    -- Drop expert_id constraint
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'consultation_bookings_expert_id_fkey') THEN
        ALTER TABLE consultation_bookings DROP CONSTRAINT consultation_bookings_expert_id_fkey;
    END IF;
    
    -- Drop product_id constraint
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'consultation_bookings_product_id_fkey') THEN
        ALTER TABLE consultation_bookings DROP CONSTRAINT consultation_bookings_product_id_fkey;
    END IF;
END $$;

-- 3. Add back constraints with ON DELETE SET NULL
ALTER TABLE consultation_bookings
  ADD CONSTRAINT consultation_bookings_expert_id_fkey 
    FOREIGN KEY (expert_id) REFERENCES profiles(id) ON DELETE SET NULL,
  ADD CONSTRAINT consultation_bookings_product_id_fkey 
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL;
