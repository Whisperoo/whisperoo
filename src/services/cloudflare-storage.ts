/**
 * Cloudflare R2 Storage Service
 * Upload/delete via Edge Function (no client credentials).
 */

import { CLOUDFLARE_R2_CONFIG, isCloudflareConfigured, getPublicUrl, extractRelativePath } from '@/config/cloudflare';
import { supabase } from '@/lib/supabase';

async function presignPutUrl(key: string, contentType?: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke<{ url: string }>('r2-storage', {
    body: { action: 'presign_put', key, contentType },
  });
  if (error) throw error;
  if (!data?.url) throw new Error('Missing presigned upload url');
  return data.url;
}

async function deleteObject(key: string): Promise<void> {
  const { error, data } = await supabase.functions.invoke('r2-storage', {
    body: { action: 'delete', key },
  });
  if (error) throw error;
  if ((data as any)?.error) throw new Error((data as any).error);
}

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
    if (!isCloudflareConfigured()) {
      throw new Error('Cloudflare R2 is not configured. Please check your environment variables.');
    }

    const url = await presignPutUrl(filePath, contentType || file.type);

    const res = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': contentType || file.type || 'application/octet-stream' },
      body: file,
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`Upload failed (HTTP ${res.status}) ${txt}`.trim());
    }

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
    // Extract relative path if full URL was provided
    const relativePath = extractRelativePath(filePath);
    await deleteObject(relativePath);
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
    // Extract relative paths
    const relativePaths = filePaths.map(extractRelativePath);
    // Best-effort sequential deletes (simple + reliable).
    for (const key of relativePaths) {
      await deleteObject(key);
    }
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
