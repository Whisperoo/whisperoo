# Digital Products Feature Implementation Plan

## Overview
Implementation of a digital marketplace system where experts can upload and sell videos/documents, and users can purchase these products. Products will be displayed on expert profiles under a "Products" section.

## Database Schema Design

### 1. Products Table
```sql
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expert_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL CHECK (price >= 0),
    product_type VARCHAR(50) NOT NULL CHECK (product_type IN ('video', 'document')),
    file_url TEXT,
    thumbnail_url TEXT,
    file_size_mb DECIMAL(10,2),
    duration_minutes INTEGER, -- for videos only
    page_count INTEGER, -- for documents only
    is_active BOOLEAN DEFAULT true,
    view_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_products_expert_id ON products(expert_id);
CREATE INDEX idx_products_type ON products(product_type);
CREATE INDEX idx_products_active ON products(is_active);
```

### 2. Product Categories Table
```sql
CREATE TABLE product_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    slug VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE product_category_mappings (
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    category_id UUID REFERENCES product_categories(id) ON DELETE CASCADE,
    PRIMARY KEY (product_id, category_id)
);
```

### 3. Purchases Table
```sql
CREATE TABLE purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    expert_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    payment_method VARCHAR(50),
    payment_intent_id VARCHAR(255), -- Stripe payment intent
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
    purchased_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    access_expires_at TIMESTAMP WITH TIME ZONE, -- optional expiry
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_purchases_user_id ON purchases(user_id);
CREATE INDEX idx_purchases_product_id ON purchases(product_id);
CREATE INDEX idx_purchases_status ON purchases(status);
CREATE INDEX idx_purchases_expert_id ON purchases(expert_id);
```

### 4. Product Reviews Table
```sql
CREATE TABLE product_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    review_text TEXT,
    is_verified_purchase BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(product_id, user_id)
);

CREATE INDEX idx_reviews_product_id ON product_reviews(product_id);
```

### 5. Product Analytics Table
```sql
CREATE TABLE product_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    event_type VARCHAR(50) NOT NULL CHECK (event_type IN ('view', 'preview', 'download', 'share')),
    session_id VARCHAR(255),
    ip_address INET,
    user_agent TEXT,
    referrer TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_analytics_product_id ON product_analytics(product_id);
CREATE INDEX idx_analytics_event_type ON product_analytics(event_type);
```

## Storage Buckets Configuration

### 1. Create Storage Buckets
```sql
-- Products bucket for videos and documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
    ('products', 'products', false, 524288000, -- 500MB limit
     ARRAY['video/mp4', 'video/quicktime', 'video/x-msvideo', 
           'application/pdf', 'application/msword', 
           'application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
    
    ('product-thumbnails', 'product-thumbnails', true, 5242880, -- 5MB limit
     ARRAY['image/jpeg', 'image/png', 'image/webp']);
```

### 2. Storage Policies
```sql
-- Experts can upload to their own folder
CREATE POLICY "Experts can upload products" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'products' AND
    auth.uid()::text = (storage.foldername(name))[1]
);

-- Users can download products they purchased
CREATE POLICY "Users can download purchased products" ON storage.objects
FOR SELECT TO authenticated
USING (
    bucket_id = 'products' AND
    EXISTS (
        SELECT 1 FROM purchases 
        WHERE user_id = auth.uid() 
        AND product_id::text = (storage.foldername(name))[2]
        AND status = 'completed'
    )
);

-- Public access to thumbnails
CREATE POLICY "Public access to thumbnails" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'product-thumbnails');
```

## Row Level Security (RLS) Policies

### Products Table RLS
```sql
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Anyone can view active products
CREATE POLICY "View active products" ON products
FOR SELECT TO public
USING (is_active = true);

-- Experts can manage their own products
CREATE POLICY "Experts manage own products" ON products
FOR ALL TO authenticated
USING (expert_id = auth.uid())
WITH CHECK (expert_id = auth.uid());
```

### Purchases Table RLS
```sql
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;

-- Users can view their own purchases
CREATE POLICY "Users view own purchases" ON purchases
FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- Experts can view sales of their products
CREATE POLICY "Experts view their sales" ON purchases
FOR SELECT TO authenticated
USING (expert_id = auth.uid());

-- System can insert purchases
CREATE POLICY "System insert purchases" ON purchases
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());
```

## API Routes & Edge Functions

### 1. Product Management Edge Functions

#### upload-product
```typescript
// Handles product upload with file processing
// - Validates file type and size
// - Uploads to storage
// - Creates database entry
// - Generates thumbnail for videos
```

#### get-products
```typescript
// Retrieves products with filters
// - By expert
// - By category
// - By price range
// - With pagination
```

#### update-product
```typescript
// Updates product details
// - Validates ownership
// - Updates metadata
// - Handles file replacement
```

### 2. Purchase Flow Edge Functions

#### create-checkout-session
```typescript
// Creates Stripe checkout session
// - Validates product availability
// - Creates payment intent
// - Stores pending purchase
```

#### webhook-handler
```typescript
// Handles Stripe webhooks
// - Payment success: Updates purchase status
// - Payment failed: Cleans up pending purchase
// - Refund: Updates purchase status
```

#### verify-purchase
```typescript
// Verifies user has access to product
// - Checks purchase status
// - Validates expiry if applicable
// - Returns secure download URL
```

### 3. Analytics Edge Functions

#### track-product-event
```typescript
// Tracks product interactions
// - Views, downloads, shares
// - Updates analytics table
// - Increments view counters
```

## Frontend Implementation

### 1. Expert Dashboard Components

#### ProductUploadModal
```tsx
interface ProductUploadModalProps {
  expertId: string;
  onSuccess: () => void;
}

// Features:
// - Drag & drop file upload
// - Progress indicator
// - Metadata form (title, description, price)
// - Category selection
// - Preview generation
```

#### ProductManagementTable
```tsx
interface ProductManagementTableProps {
  products: Product[];
  onEdit: (product: Product) => void;
  onDelete: (productId: string) => void;
}

// Features:
// - List all expert's products
// - Sales statistics per product
// - Edit/Delete actions
// - Toggle active status
```

#### SalesAnalyticsDashboard
```tsx
interface SalesAnalyticsDashboardProps {
  expertId: string;
  dateRange: DateRange;
}

// Features:
// - Total revenue
// - Number of sales
// - Top performing products
// - Customer demographics
// - Download reports
```

### 2. User-Facing Components

#### ProductCard
```tsx
interface ProductCardProps {
  product: Product;
  isPurchased: boolean;
  onPurchase: () => void;
}

// Features:
// - Thumbnail display
// - Price & details
// - Purchase/Download button
// - Rating display
// - Preview option
```

#### ProductGrid
```tsx
interface ProductGridProps {
  expertId: string;
  filters: ProductFilters;
}

// Features:
// - Grid/List view toggle
// - Filter by category
// - Sort by price/date/rating
// - Pagination
// - Search functionality
```

#### PurchaseModal
```tsx
interface PurchaseModalProps {
  product: Product;
  onSuccess: () => void;
}

// Features:
// - Product summary
// - Price breakdown
// - Payment method selection
// - Terms acceptance
// - Stripe Elements integration
```

#### MyPurchasesPage
```tsx
// Features:
// - List all purchased products
// - Download links
// - Receipt/Invoice generation
// - Re-download capability
// - Review submission
```

### 3. Shared Components

#### VideoPlayer
```tsx
interface VideoPlayerProps {
  videoUrl: string;
  isPurchased: boolean;
  previewDuration?: number;
}

// Features:
// - Secure streaming
// - Preview mode (first X seconds)
// - Playback controls
// - Quality selection
// - Watermark for previews
```

#### DocumentViewer
```tsx
interface DocumentViewerProps {
  documentUrl: string;
  isPurchased: boolean;
  previewPages?: number;
}

// Features:
// - PDF rendering
// - Preview mode (first X pages)
// - Download button
// - Print protection
// - Watermark for previews
```

## Implementation Steps

### Phase 1: Database & Backend Setup (Week 1)
1. Create database tables with migrations
2. Set up storage buckets
3. Implement RLS policies
4. Create basic CRUD edge functions
5. Set up development branch for testing

### Phase 2: File Upload & Management (Week 2)
1. Implement file upload edge function
2. Add video thumbnail generation
3. Create document preview extraction
4. Build expert product management API
5. Add file validation and virus scanning

### Phase 3: Payment Integration (Week 3)
1. Integrate Stripe for payments
2. Create checkout session handler
3. Implement webhook processing
4. Add purchase verification system
5. Set up refund handling

### Phase 4: Frontend - Expert Side (Week 4)
1. Build product upload interface
2. Create product management dashboard
3. Add sales analytics views
4. Implement bulk operations
5. Add export functionality

### Phase 5: Frontend - User Side (Week 5)
1. Build product browsing interface
2. Implement purchase flow
3. Create "My Purchases" section
4. Add download management
5. Implement review system

### Phase 6: Advanced Features (Week 6)
1. Add product recommendations
2. Implement wishlist functionality
3. Create gift purchases
4. Add bulk discounts
5. Implement affiliate system

### Phase 7: Testing & Optimization (Week 7)
1. End-to-end testing
2. Performance optimization
3. Security audit
4. Load testing
5. User acceptance testing

### Phase 8: Deployment & Monitoring (Week 8)
1. Production deployment
2. Set up monitoring
3. Configure alerting
4. Documentation completion
5. Team training

## Security Considerations

### 1. File Security
- Implement virus scanning on upload
- Validate file types strictly
- Use signed URLs for downloads
- Implement rate limiting
- Add watermarking for previews

### 2. Payment Security
- Use Stripe's secure payment flow
- Never store card details
- Implement webhook signature verification
- Add fraud detection
- Monitor for suspicious activity

### 3. Access Control
- Verify purchases before downloads
- Implement temporary download links
- Add IP-based restrictions
- Monitor for sharing abuse
- Implement DMCA takedown process

## Performance Optimizations

### 1. Caching Strategy
- Cache product listings
- CDN for thumbnails
- Redis for session data
- Browser caching for static assets
- API response caching

### 2. Database Optimizations
- Proper indexing strategy
- Materialized views for analytics
- Connection pooling
- Query optimization
- Partitioning for large tables

### 3. File Delivery
- Use CDN for content delivery
- Implement progressive download
- Add video streaming (HLS)
- Compress documents
- Lazy loading for thumbnails

## Monitoring & Analytics

### 1. Business Metrics
- Total revenue
- Conversion rates
- Average order value
- Customer lifetime value
- Product performance

### 2. Technical Metrics
- API response times
- Upload success rates
- Payment failure rates
- Storage usage
- Bandwidth consumption

### 3. User Behavior
- Product view patterns
- Purchase funnel analysis
- Search queries
- User engagement
- Review sentiment

## Estimated Costs

### 1. Infrastructure
- Supabase: ~$25-100/month (depending on usage)
- Stripe fees: 2.9% + $0.30 per transaction
- CDN: ~$50-200/month
- Storage: ~$0.021/GB/month

### 2. Third-party Services
- Video processing: ~$50-200/month
- Email service: ~$20-50/month
- Analytics tools: ~$50-100/month
- Monitoring: ~$30-80/month

## Success Criteria

1. **Technical Success**
   - 99.9% uptime
   - <2s page load time
   - <5s file upload time
   - Zero security breaches
   - <0.1% payment failure rate

2. **Business Success**
   - 20% of experts listing products
   - 5% conversion rate
   - $10,000 monthly GMV
   - 4.5+ average rating
   - <2% refund rate

## Risk Mitigation

1. **Technical Risks**
   - Regular backups
   - Disaster recovery plan
   - Load balancing
   - Redundant storage
   - Automated testing

2. **Business Risks**
   - Content moderation
   - Copyright protection
   - Fraud prevention
   - Customer support
   - Legal compliance

## Next Steps

1. Review and approve implementation plan
2. Set up Supabase development branch
3. Configure Stripe test environment
4. Assign development resources
5. Begin Phase 1 implementation