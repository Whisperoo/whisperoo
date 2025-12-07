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

### Phase 1: Preparation (Can do now, before credentials) ✅ COMPLETED
- [x] Create Cloudflare R2 configuration file with environment variable placeholders
- [x] Create Cloudflare upload service utility (S3-compatible SDK)
- [x] Update .env.example with Cloudflare R2 variables needed
- [x] Install @aws-sdk/client-s3 package (R2 is S3-compatible)
- [x] Create abstraction layer for storage operations

### Phase 2: Implementation (After credentials received)
- [ ] Add Cloudflare credentials to .env file
- [ ] Update `AvatarUpload.tsx` to use Cloudflare service
- [ ] Update `products.ts` uploadProductFile() to use Cloudflare
- [ ] Update `products.ts` uploadProductThumbnail() to use Cloudflare
- [ ] Update file URL generation functions (getPublicFileUrl)
- [ ] Test profile image uploads
- [ ] Test product file uploads
- [ ] Test thumbnail uploads

### Phase 3: Cleanup
- [ ] User deletes old Supabase Storage files manually
- [ ] Remove Supabase storage code (keep for reference initially)
- [ ] Update CLAUDE.md documentation

## Environment Variables Needed
```env
# Cloudflare R2 Configuration
VITE_CLOUDFLARE_ACCOUNT_ID=your_account_id
VITE_CLOUDFLARE_R2_ACCESS_KEY_ID=your_access_key
VITE_CLOUDFLARE_R2_SECRET_ACCESS_KEY=your_secret_key
VITE_CLOUDFLARE_R2_BUCKET_NAME=whisperoo-files
VITE_CLOUDFLARE_R2_PUBLIC_URL=https://your-bucket.r2.cloudflarestorage.com
```
