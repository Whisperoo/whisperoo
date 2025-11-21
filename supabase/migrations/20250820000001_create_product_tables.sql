-- Create product-related tables for the Whisperoo family app

-- Product categories table
CREATE TABLE product_categories (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  description text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Products table
CREATE TABLE products (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  description text,
  content text, -- Main product content
  product_type text CHECK (product_type IN ('video', 'document', 'audio', 'course')) NOT NULL DEFAULT 'document',
  price decimal(10,2) NOT NULL DEFAULT 0.00,
  is_free boolean DEFAULT false,
  file_url text, -- URL to the actual product file
  thumbnail_url text,
  expert_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  status text CHECK (status IN ('draft', 'published', 'archived')) DEFAULT 'draft',
  tags text[] DEFAULT '{}',
  duration_minutes integer, -- For video/audio content
  difficulty_level text CHECK (difficulty_level IN ('beginner', 'intermediate', 'advanced')),
  age_range_min integer,
  age_range_max integer,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Product categories junction table
CREATE TABLE product_category_relations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid REFERENCES products(id) ON DELETE CASCADE,
  category_id uuid REFERENCES product_categories(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(product_id, category_id)
);

-- Purchases table
CREATE TABLE purchases (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  product_id uuid REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  amount_paid decimal(10,2) NOT NULL,
  currency text DEFAULT 'USD',
  payment_method text,
  stripe_payment_intent_id text,
  status text CHECK (status IN ('pending', 'completed', 'failed', 'refunded')) DEFAULT 'pending',
  purchased_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, product_id) -- Prevent duplicate purchases
);

-- Product reviews table
CREATE TABLE product_reviews (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  rating integer CHECK (rating >= 1 AND rating <= 5) NOT NULL,
  review_text text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(product_id, user_id) -- One review per user per product
);

-- Insert default product categories
INSERT INTO product_categories (name, description) VALUES
('Parenting Guides', 'Comprehensive guides for various parenting topics'),
('Sleep Training', 'Resources to help with child sleep issues'),
('Nutrition & Feeding', 'Guidance on child nutrition and feeding practices'),
('Behavioral Support', 'Tools and strategies for managing child behavior'),
('Development Milestones', 'Information about child development stages'),
('Educational Activities', 'Fun and educational activities for children'),
('Health & Safety', 'Important health and safety information for families'),
('Emotional Wellness', 'Supporting emotional development and mental health');

-- Enable RLS (Row Level Security)
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_category_relations ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_reviews ENABLE ROW LEVEL SECURITY;

-- RLS Policies for products
CREATE POLICY "Products are viewable by everyone" ON products FOR SELECT USING (status = 'published');
CREATE POLICY "Experts can manage their own products" ON products FOR ALL USING (auth.uid() = expert_id);
CREATE POLICY "Admins can manage all products" ON products FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND account_type = 'admin')
);

-- RLS Policies for product_categories (public read, admin write)
CREATE POLICY "Categories are viewable by everyone" ON product_categories FOR SELECT USING (true);
CREATE POLICY "Admins can manage categories" ON product_categories FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND account_type = 'admin')
);

-- RLS Policies for product_category_relations
CREATE POLICY "Category relations are viewable by everyone" ON product_category_relations FOR SELECT USING (true);
CREATE POLICY "Experts can manage their product categories" ON product_category_relations FOR ALL USING (
  EXISTS (SELECT 1 FROM products WHERE id = product_id AND expert_id = auth.uid())
);

-- RLS Policies for purchases
CREATE POLICY "Users can view their own purchases" ON purchases FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create purchases" ON purchases FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Experts can view purchases of their products" ON purchases FOR SELECT USING (
  EXISTS (SELECT 1 FROM products WHERE id = product_id AND expert_id = auth.uid())
);

-- RLS Policies for product_reviews
CREATE POLICY "Reviews are viewable by everyone" ON product_reviews FOR SELECT USING (true);
CREATE POLICY "Users can create reviews for purchased products" ON product_reviews FOR INSERT WITH CHECK (
  auth.uid() = user_id AND
  EXISTS (SELECT 1 FROM purchases WHERE user_id = auth.uid() AND product_id = product_reviews.product_id AND status = 'completed')
);
CREATE POLICY "Users can update their own reviews" ON product_reviews FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own reviews" ON product_reviews FOR DELETE USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX idx_products_expert_id ON products(expert_id);
CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_products_product_type ON products(product_type);
CREATE INDEX idx_products_created_at ON products(created_at DESC);
CREATE INDEX idx_purchases_user_id ON purchases(user_id);
CREATE INDEX idx_purchases_product_id ON purchases(product_id);
CREATE INDEX idx_purchases_status ON purchases(status);
CREATE INDEX idx_product_reviews_product_id ON product_reviews(product_id);
CREATE INDEX idx_product_reviews_user_id ON product_reviews(user_id);

-- Create function to automatically update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_product_categories_updated_at BEFORE UPDATE ON product_categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_product_reviews_updated_at BEFORE UPDATE ON product_reviews
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();