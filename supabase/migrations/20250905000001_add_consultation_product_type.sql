-- Add consultation as a valid product type
ALTER TABLE products 
DROP CONSTRAINT IF EXISTS products_product_type_check,
ADD CONSTRAINT products_product_type_check 
CHECK (product_type IN ('video', 'document', 'audio', 'course', 'consultation'));

-- Comment on the change
COMMENT ON CONSTRAINT products_product_type_check ON products IS 'Updated to include consultation product type for expert consultations';