/**
 * Cloudflare R2 Storage Configuration
 * Environment-based configuration for Cloudflare R2 object storage
 */

// Cloudflare R2 credentials from environment variables
export const CLOUDFLARE_R2_CONFIG = {
  // Account ID for Cloudflare R2
  accountId: import.meta.env.VITE_CLOUDFLARE_ACCOUNT_ID || '',

  // R2 Access credentials (S3-compatible)
  accessKeyId: import.meta.env.VITE_CLOUDFLARE_R2_ACCESS_KEY_ID || '',
  secretAccessKey: import.meta.env.VITE_CLOUDFLARE_R2_SECRET_ACCESS_KEY || '',

  // Bucket configuration
  bucketName: import.meta.env.VITE_CLOUDFLARE_R2_BUCKET_NAME || 'whisperoo-files',

  // Public URL for accessing files (with CDN)
  publicUrl: import.meta.env.VITE_CLOUDFLARE_R2_PUBLIC_URL || '',

  // R2 endpoint (S3-compatible endpoint format)
  endpoint: import.meta.env.VITE_CLOUDFLARE_R2_ENDPOINT || '',
} as const;

// Validate configuration
export const isCloudflareConfigured = (): boolean => {
  return !!(
    CLOUDFLARE_R2_CONFIG.accountId &&
    CLOUDFLARE_R2_CONFIG.accessKeyId &&
    CLOUDFLARE_R2_CONFIG.secretAccessKey &&
    CLOUDFLARE_R2_CONFIG.bucketName &&
    CLOUDFLARE_R2_CONFIG.publicUrl
  );
};

// Storage path structure helpers
export const STORAGE_PATHS = {
  // Profile images: profile-images/{userId}/{timestamp}.{ext}
  profileImage: (userId: string, timestamp: number, ext: string) =>
    `profile-images/${userId}/${timestamp}.${ext}`,

  // Product files: products/{expertId}/{productId}/{fileId}.{ext}
  productFile: (expertId: string, productId: string, fileId: string, ext: string) =>
    `products/${expertId}/${productId}/${fileId}.${ext}`,

  // Product thumbnails: product-thumbnails/{expertId}/{productId}-thumb.{ext}
  productThumbnail: (expertId: string, productId: string, ext: string) =>
    `product-thumbnails/${expertId}/${productId}-thumb.${ext}`,
} as const;

// Get public URL for a file path
export const getPublicUrl = (filePath: string): string => {
  if (!filePath) return '';

  // If already a full URL, return as-is
  if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
    return filePath;
  }

  // Construct public URL from base URL and file path
  const baseUrl = CLOUDFLARE_R2_CONFIG.publicUrl.replace(/\/$/, ''); // Remove trailing slash
  return `${baseUrl}/${filePath}`;
};

// Extract relative path from full URL
export const extractRelativePath = (url: string): string => {
  if (!url) return '';

  // If it's already a relative path, return as-is
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return url;
  }

  // Extract path from full URL
  try {
    const urlObj = new URL(url);
    return urlObj.pathname.replace(/^\//, ''); // Remove leading slash
  } catch {
    return url;
  }
};
