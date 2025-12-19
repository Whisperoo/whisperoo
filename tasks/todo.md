# Migration Plan: Upload Files to Cloudflare R2 Instead of Supabase Storage

## Overview
Migrate all file uploads from Supabase Storage to Cloudflare R2. This affects profile images, product files, and thumbnails.

## Decisions Made
✅ **Storage Service**: Cloudflare R2 (S3-compatible)
✅ **Migration**: No migration needed - old files will be deleted manually
✅ **URL Structure**: Store relative paths in database, generate full URLs on-demand
✅ **Credentials**: Will be added to .env when available

## Current Upload Locations (Supabase)
- Profile images: `profile-images` bucket
- Product files: `products` bucket
- Product thumbnails: `product-thumbnails` bucket

## New Structure (Cloudflare R2)
- All files: Single R2 bucket with organized paths
  - Profile images: `profile-images/{userId}/{timestamp}.{ext}`
  - Product files: `products/{expertId}/{productId}/{fileId}.{ext}`
  - Product thumbnails: `product-thumbnails/{expertId}/{productId}-thumb.{ext}`

## Tasks

### Phase 1: Preparation ✅ COMPLETED
- [x] Create Cloudflare R2 configuration file with environment variable placeholders
- [x] Create Cloudflare upload service utility (S3-compatible SDK)
- [x] Update .env.example with Cloudflare R2 variables needed
- [x] Install @aws-sdk/client-s3 package (R2 is S3-compatible)
- [x] Create abstraction layer for storage operations

### Phase 2: Implementation ✅ COMPLETED
- [x] Add Cloudflare credentials to .env file
- [x] Update `products.ts` uploadProductFile() to use Cloudflare R2
- [x] Update `products.ts` uploadProductThumbnail() to use Cloudflare R2
- [x] Update `products.ts` addProductFile() to use Cloudflare R2
- [x] Update `products.ts` deleteProductFile() to use Cloudflare R2
- [x] Update `products.ts` deleteProduct() to use Cloudflare R2
- [x] Update file URL generation functions (getPublicFileUrl) to use Cloudflare R2
- [x] Fix dynamic imports to static imports for better performance
- [x] Build project successfully without errors

### Phase 3: Testing & Remaining Work ✅ COMPLETED
- [x] Update `AvatarUpload.tsx` to use Cloudflare service
- [ ] Test profile image uploads (ready to test)
- [ ] Test product file uploads (ready to test)
- [ ] Test thumbnail uploads (ready to test)

### Phase 4: Cleanup
- [ ] User deletes old Supabase Storage files manually
- [ ] Remove old Supabase storage code (optional - can keep for reference)
- [ ] Update CLAUDE.md documentation

## Summary

### ✅ All uploads migrated to Cloudflare R2

**Files Updated:**
1. `src/services/products.ts` - All product and file uploads
2. `src/components/ui/AvatarUpload.tsx` - Profile image uploads
3. `.env` - Cloudflare R2 credentials configured

**What's Ready:**
- Profile image uploads → Cloudflare R2
- Product file uploads → Cloudflare R2
- Product thumbnail uploads → Cloudflare R2
- File deletions → Cloudflare R2
- URL generation → Cloudflare R2

**Storage Structure in R2:**
All files go to bucket `whisperoo-files` with organized paths:
- `profile-images/{userId}/{timestamp}.{ext}`
- `products/{expertId}/{productId}/{fileId}.{ext}`
- `product-thumbnails/{expertId}/{productId}-thumb.{ext}`

**Next Steps:**
1. Test uploads in the application
2. Verify files are accessible via generated URLs
3. Optional: Clean up old Supabase Storage files

## Environment Variables Needed
```env
# Cloudflare R2 Configuration
VITE_CLOUDFLARE_ACCOUNT_ID=your_account_id
VITE_CLOUDFLARE_R2_ACCESS_KEY_ID=your_access_key
VITE_CLOUDFLARE_R2_SECRET_ACCESS_KEY=your_secret_key
VITE_CLOUDFLARE_R2_BUCKET_NAME=whisperoo-files
VITE_CLOUDFLARE_R2_PUBLIC_URL=https://your-bucket.r2.cloudflarestorage.com
```
