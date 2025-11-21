-- Update products table for better download support
-- Add missing columns that are referenced in the frontend code

-- Check if file_size_mb column exists, if not add it
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'products' AND column_name = 'file_size_mb') THEN
        ALTER TABLE products ADD COLUMN file_size_mb decimal(10,2);
    END IF;
END $$;

-- Check if page_count column exists, if not add it
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'products' AND column_name = 'page_count') THEN
        ALTER TABLE products ADD COLUMN page_count integer;
    END IF;
END $$;

-- Check if is_active column exists, if not add it
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'products' AND column_name = 'is_active') THEN
        ALTER TABLE products ADD COLUMN is_active boolean DEFAULT true;
    END IF;
END $$;

-- Update the purchases table to match the frontend expectations
-- Check if amount column exists, if not rename amount_paid to amount
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'purchases' AND column_name = 'amount') 
    AND EXISTS (SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'purchases' AND column_name = 'amount_paid') THEN
        ALTER TABLE purchases RENAME COLUMN amount_paid TO amount;
    END IF;
END $$;

-- Check if expert_id column exists in purchases, if not add it
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'purchases' AND column_name = 'expert_id') THEN
        ALTER TABLE purchases ADD COLUMN expert_id uuid REFERENCES profiles(id) ON DELETE CASCADE;
        
        -- Update expert_id based on the product's expert_id
        UPDATE purchases 
        SET expert_id = p.expert_id 
        FROM products p 
        WHERE purchases.product_id = p.id;
    END IF;
END $$;

-- Fix the product_category_mappings table name mismatch
-- The frontend expects product_category_mappings but we have product_category_relations
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables 
               WHERE table_name = 'product_category_relations')
    AND NOT EXISTS (SELECT 1 FROM information_schema.tables 
                    WHERE table_name = 'product_category_mappings') THEN
        ALTER TABLE product_category_relations RENAME TO product_category_mappings;
    END IF;
END $$;

-- Create storage bucket for products if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('products', 'products', false)
ON CONFLICT (id) DO NOTHING;

-- Create storage bucket for product thumbnails if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-thumbnails', 'product-thumbnails', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for products bucket
DROP POLICY IF EXISTS "Authenticated users can upload product files" ON storage.objects;
CREATE POLICY "Authenticated users can upload product files" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'products' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can download purchased products" ON storage.objects;
CREATE POLICY "Users can download purchased products" 
ON storage.objects FOR SELECT 
USING (
  bucket_id = 'products' 
  AND (
    -- Allow if user has purchased this product
    EXISTS (
      SELECT 1 FROM purchases p
      JOIN products pr ON p.product_id = pr.id
      WHERE p.user_id = auth.uid()
        AND p.status = 'completed'
        AND storage.objects.name LIKE pr.expert_id || '/' || pr.id || '%'
    )
    -- Or if user is the expert who owns the product
    OR EXISTS (
      SELECT 1 FROM products pr
      WHERE pr.expert_id = auth.uid()
        AND storage.objects.name LIKE pr.expert_id || '/' || pr.id || '%'
    )
  )
);

-- RLS policies for product-thumbnails bucket (public read)
DROP POLICY IF EXISTS "Public can view thumbnails" ON storage.objects;
CREATE POLICY "Public can view thumbnails" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'product-thumbnails');

DROP POLICY IF EXISTS "Authenticated users can upload thumbnails" ON storage.objects;
CREATE POLICY "Authenticated users can upload thumbnails" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'product-thumbnails' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can update their product thumbnails" ON storage.objects;
CREATE POLICY "Users can update their product thumbnails" 
ON storage.objects FOR UPDATE 
USING (
  bucket_id = 'product-thumbnails' 
  AND EXISTS (
    SELECT 1 FROM products pr
    WHERE pr.expert_id = auth.uid()
      AND storage.objects.name LIKE pr.expert_id || '/' || pr.id || '%'
  )
);