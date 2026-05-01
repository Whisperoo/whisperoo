-- Create product_wishlists table
CREATE TABLE IF NOT EXISTS product_wishlists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(product_id, user_id)
);

-- Enable RLS
ALTER TABLE product_wishlists ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can manage their own wishlists"
ON product_wishlists
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Add index
CREATE INDEX IF NOT EXISTS idx_product_wishlists_user_id ON product_wishlists(user_id);
CREATE INDEX IF NOT EXISTS idx_product_wishlists_product_id ON product_wishlists(product_id);
