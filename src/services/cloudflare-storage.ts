/**
 * Cloudflare R2 Storage Service
 * S3-compatible upload and file management for Cloudflare R2
 */

import { S3Client, PutObjectCommand, DeleteObjectCommand, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { CLOUDFLARE_R2_CONFIG, isCloudflareConfigured, getPublicUrl, extractRelativePath } from '@/config/cloudflare';

// Initialize S3 client for Cloudflare R2
let s3Client: S3Client | null = null;

const getS3Client = (): S3Client => {
  if (!isCloudflareConfigured()) {
    throw new Error('Cloudflare R2 is not configured. Please check your environment variables.');
  }

  if (!s3Client) {
    // Cloudflare R2 endpoint format: https://<account_id>.r2.cloudflarestorage.com
    const endpoint = CLOUDFLARE_R2_CONFIG.endpoint ||
      `https://${CLOUDFLARE_R2_CONFIG.accountId}.r2.cloudflarestorage.com`;

    s3Client = new S3Client({
      region: 'auto', // R2 uses 'auto' for region
      endpoint,
      credentials: {
        accessKeyId: CLOUDFLARE_R2_CONFIG.accessKeyId,
        secretAccessKey: CLOUDFLARE_R2_CONFIG.secretAccessKey,
      },
    });
  }

  return s3Client;
};

export interface UploadOptions {
  filePath: string; // Relative path in bucket (e.g., "products/user123/file.mp4")
  file: File;
  contentType?: string;
  onProgress?: (progress: number) => void;
}

export interface UploadResult {
  filePath: string; // Relative path stored in database
  publicUrl: string; // Full public URL for accessing the file
  size: number; // File size in bytes
}

/**
 * Upload a file to Cloudflare R2
 */
export const uploadFile = async (options: UploadOptions): Promise<UploadResult> => {
  const { filePath, file, contentType, onProgress } = options;

  try {
    const client = getS3Client();

    // Read file as ArrayBuffer
    const fileBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(fileBuffer);

    // Create upload command
    const command = new PutObjectCommand({
      Bucket: CLOUDFLARE_R2_CONFIG.bucketName,
      Key: filePath,
      Body: uint8Array,
      ContentType: contentType || file.type,
      ContentLength: file.size,
    });

    // Execute upload
    await client.send(command);

    // Report 100% progress
    if (onProgress) {
      onProgress(100);
    }

    // Return result with relative path and public URL
    return {
      filePath, // Store relative path in database
      publicUrl: getPublicUrl(filePath),
      size: file.size,
    };
  } catch (error) {
    console.error('Cloudflare R2 upload error:', error);
    throw new Error(`Failed to upload file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

/**
 * Upload file with retry logic for large files
 */
export const uploadFileWithRetry = async (
  options: UploadOptions,
  maxRetries = 3
): Promise<UploadResult> => {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await uploadFile(options);
    } catch (error) {
      lastError = error as Error;
      console.warn(`Upload attempt ${attempt} failed:`, error);

      if (attempt < maxRetries) {
        // Wait before retrying (exponential backoff)
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error('Upload failed after retries');
};

/**
 * Delete a file from Cloudflare R2
 */
export const deleteFile = async (filePath: string): Promise<void> => {
  try {
    const client = getS3Client();

    // Extract relative path if full URL was provided
    const relativePath = extractRelativePath(filePath);

    const command = new DeleteObjectCommand({
      Bucket: CLOUDFLARE_R2_CONFIG.bucketName,
      Key: relativePath,
    });

    await client.send(command);
  } catch (error) {
    console.error('Cloudflare R2 delete error:', error);
    throw new Error(`Failed to delete file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

/**
 * Delete multiple files from Cloudflare R2
 */
export const deleteFiles = async (filePaths: string[]): Promise<void> => {
  if (filePaths.length === 0) return;

  try {
    const client = getS3Client();

    // Extract relative paths
    const relativePaths = filePaths.map(extractRelativePath);

    const command = new DeleteObjectsCommand({
      Bucket: CLOUDFLARE_R2_CONFIG.bucketName,
      Delete: {
        Objects: relativePaths.map(path => ({ Key: path })),
      },
    });

    await client.send(command);
  } catch (error) {
    console.error('Cloudflare R2 batch delete error:', error);
    throw new Error(`Failed to delete files: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

/**
 * Check if Cloudflare R2 is properly configured
 */
export const isConfigured = isCloudflareConfigured;

/**
 * Get public URL for a file path
 */
export const getFileUrl = getPublicUrl;

// Export client getter for advanced usage
export { getS3Client };
