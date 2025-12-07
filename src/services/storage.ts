/**
 * Storage Service Abstraction Layer
 * Provides a unified interface for file storage operations
 * Currently supports: Cloudflare R2
 */

import * as CloudflareStorage from './cloudflare-storage';
import { STORAGE_PATHS } from '@/config/cloudflare';

export interface StorageUploadOptions {
  file: File;
  path: string;
  onProgress?: (progress: number) => void;
}

export interface StorageUploadResult {
  path: string; // Relative path (stored in database)
  url: string; // Full public URL
  size: number;
}

/**
 * Storage provider type
 */
type StorageProvider = 'cloudflare' | 'supabase';

// Current storage provider - will be cloudflare once configured
const STORAGE_PROVIDER: StorageProvider = 'cloudflare';

/**
 * Upload a file to storage
 */
export const uploadFile = async (options: StorageUploadOptions): Promise<StorageUploadResult> => {
  const { file, path, onProgress } = options;

  if (STORAGE_PROVIDER === 'cloudflare') {
    if (!CloudflareStorage.isConfigured()) {
      throw new Error('Cloudflare R2 is not configured. Please add credentials to your .env file.');
    }

    const result = await CloudflareStorage.uploadFileWithRetry({
      file,
      filePath: path,
      contentType: file.type,
      onProgress,
    });

    return {
      path: result.filePath,
      url: result.publicUrl,
      size: result.size,
    };
  }

  throw new Error(`Unsupported storage provider: ${STORAGE_PROVIDER}`);
};

/**
 * Delete a file from storage
 */
export const deleteFile = async (filePath: string): Promise<void> => {
  if (STORAGE_PROVIDER === 'cloudflare') {
    await CloudflareStorage.deleteFile(filePath);
    return;
  }

  throw new Error(`Unsupported storage provider: ${STORAGE_PROVIDER}`);
};

/**
 * Delete multiple files from storage
 */
export const deleteFiles = async (filePaths: string[]): Promise<void> => {
  if (STORAGE_PROVIDER === 'cloudflare') {
    await CloudflareStorage.deleteFiles(filePaths);
    return;
  }

  throw new Error(`Unsupported storage provider: ${STORAGE_PROVIDER}`);
};

/**
 * Get public URL for a file path
 */
export const getPublicUrl = (filePath: string): string => {
  if (STORAGE_PROVIDER === 'cloudflare') {
    return CloudflareStorage.getFileUrl(filePath);
  }

  return filePath;
};

/**
 * Check if storage is properly configured
 */
export const isStorageConfigured = (): boolean => {
  if (STORAGE_PROVIDER === 'cloudflare') {
    return CloudflareStorage.isConfigured();
  }

  return false;
};

/**
 * Helper functions for generating storage paths
 */
export const generateStoragePath = {
  /**
   * Generate path for profile image
   * Format: profile-images/{userId}/{timestamp}.{ext}
   */
  profileImage: (userId: string, fileName: string): string => {
    const ext = fileName.split('.').pop() || 'jpg';
    const timestamp = Date.now();
    return STORAGE_PATHS.profileImage(userId, timestamp, ext);
  },

  /**
   * Generate path for product file
   * Format: products/{expertId}/{productId}/{fileId}.{ext}
   */
  productFile: (expertId: string, productId: string, fileName: string): string => {
    const ext = fileName.split('.').pop() || 'bin';
    const fileId = crypto.randomUUID();
    return STORAGE_PATHS.productFile(expertId, productId, fileId, ext);
  },

  /**
   * Generate path for product thumbnail
   * Format: product-thumbnails/{expertId}/{productId}-thumb.{ext}
   */
  productThumbnail: (expertId: string, productId: string, fileName: string): string => {
    const ext = fileName.split('.').pop() || 'jpg';
    return STORAGE_PATHS.productThumbnail(expertId, productId, ext);
  },
};

/**
 * Upload profile image
 */
export const uploadProfileImage = async (
  userId: string,
  file: File,
  onProgress?: (progress: number) => void
): Promise<StorageUploadResult> => {
  const path = generateStoragePath.profileImage(userId, file.name);
  return uploadFile({ file, path, onProgress });
};

/**
 * Upload product file
 */
export const uploadProductFile = async (
  expertId: string,
  productId: string,
  file: File,
  onProgress?: (progress: number) => void
): Promise<StorageUploadResult> => {
  const path = generateStoragePath.productFile(expertId, productId, file.name);
  return uploadFile({ file, path, onProgress });
};

/**
 * Upload product thumbnail
 */
export const uploadProductThumbnail = async (
  expertId: string,
  productId: string,
  file: File,
  onProgress?: (progress: number) => void
): Promise<StorageUploadResult> => {
  const path = generateStoragePath.productThumbnail(expertId, productId, file.name);
  return uploadFile({ file, path, onProgress });
};
