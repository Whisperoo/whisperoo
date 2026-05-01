-- Create discount_codes table
CREATE TABLE IF NOT EXISTS discount_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    discount_type VARCHAR(20) NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
    discount_amount DECIMAL(10, 2) NOT NULL,
    max_uses INTEGER,
    current_uses INTEGER DEFAULT 0,
    valid_from TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    valid_until TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Note: In a real implementation we would probably link codes to specific products via a joining table or an array column,
-- but for the scope of this project, a global bundle discount table works.

ALTER TABLE discount_codes ENABLE ROW LEVEL SECURITY;

-- Allow read access to active codes
CREATE POLICY "Anyone can view active discount codes"
ON discount_codes
FOR SELECT
USING (is_active = true);

-- Add index
CREATE INDEX IF NOT EXISTS idx_discount_codes_code ON discount_codes(code);

-- Create function to increment discount usage
CREATE OR REPLACE FUNCTION increment_discount_usage(discount_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE discount_codes
  SET current_uses = current_uses + 1
  WHERE id = discount_id;
END;
$$;