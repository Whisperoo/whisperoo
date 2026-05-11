-- Ensure expert deletions cascade through bookings and products/resources.
-- products.expert_id already cascades; this migration aligns consultation_bookings.

ALTER TABLE consultation_bookings
  DROP CONSTRAINT IF EXISTS consultation_bookings_expert_id_fkey,
  ADD CONSTRAINT consultation_bookings_expert_id_fkey
    FOREIGN KEY (expert_id)
    REFERENCES profiles(id)
    ON DELETE CASCADE;

ALTER TABLE consultation_bookings
  DROP CONSTRAINT IF EXISTS consultation_bookings_product_id_fkey,
  ADD CONSTRAINT consultation_bookings_product_id_fkey
    FOREIGN KEY (product_id)
    REFERENCES products(id)
    ON DELETE CASCADE;
