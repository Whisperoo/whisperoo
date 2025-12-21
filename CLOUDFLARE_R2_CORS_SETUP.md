# Cloudflare R2 CORS Setup Guide

## Problem
PDFs are not displaying in production because the Cloudflare R2 bucket needs CORS (Cross-Origin Resource Sharing) headers configured to allow embedding PDFs in iframes.

## Solution

### Option 1: Using Wrangler CLI (Recommended)

1. Install Wrangler CLI if you haven't already:
```bash
npm install -g wrangler
```

2. Login to Cloudflare:
```bash
wrangler login
```

3. Apply CORS configuration to your R2 bucket:
```bash
npx wrangler r2 bucket cors put whisperoo-files --file cors-config.json
```

The `cors-config.json` file has already been created in the project root with these settings:
```json
[
  {
    "AllowedOrigins": ["*"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag", "Content-Length", "Content-Type"],
    "MaxAgeSeconds": 3600
  }
]
```

### Option 2: Using Cloudflare Dashboard

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Navigate to R2 → Your Bucket (`whisperoo-files`)
3. Go to Settings → CORS Policy
4. Add the following CORS rule:
   - **Allowed Origins**: `*` (or your specific domain like `https://yourdomain.com`)
   - **Allowed Methods**: `GET`, `HEAD`
   - **Allowed Headers**: `*`
   - **Exposed Headers**: `ETag`, `Content-Length`, `Content-Type`
   - **Max Age**: `3600`

### Option 3: More Restrictive (Production-Ready)

For better security in production, use your specific domain instead of `*`:

```json
[
  {
    "AllowedOrigins": ["https://yourdomain.com", "https://www.yourdomain.com"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["Range", "Content-Type"],
    "ExposeHeaders": ["ETag", "Content-Length", "Content-Type", "Accept-Ranges"],
    "MaxAgeSeconds": 3600
  }
]
```

## Verification

After applying CORS configuration:

1. Deploy your changes and test in production
2. Open browser DevTools → Network tab
3. Try viewing a PDF
4. Check the response headers for:
   - `Access-Control-Allow-Origin: *` (or your domain)
   - `Access-Control-Allow-Methods: GET, HEAD`

## Fallback Implemented

Even if CORS is not configured, the app now has a fallback:
- If PDF fails to load in iframe, users see an "Open in New Tab" button
- Users can also click "Try Again" to retry loading
- When PDF loads successfully, there's an "Open" button in the bottom bar

## Files Modified

- `/src/components/content/UnifiedMediaViewer.tsx` - Added error handling and fallback UI for PDFs

## Next Steps

1. Apply CORS configuration using one of the methods above
2. Test PDF viewing in production
3. If issues persist, check browser console for specific CORS errors
