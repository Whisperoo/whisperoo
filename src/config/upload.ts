/**
 * Upload Configuration for Production-Ready File Handling
 * Centralized configuration for file upload limits and validation
 */

// Environment-specific configuration with environment variable support
const isDevelopment = import.meta.env.DEV;
const isProduction = import.meta.env.PROD;

// Helper to get environment variable as number with fallback
const getEnvNumber = (key: string, fallback: number): number => {
  const value = import.meta.env[key];
  return value ? parseInt(value, 10) || fallback : fallback;
};

// Base file size limits (in MB) - configurable via environment variables
// Set to extremely high values to effectively remove file size restrictions
export const FILE_SIZE_LIMITS = {
  // Video files - no limit
  VIDEO: {
    DEVELOPMENT: getEnvNumber('VITE_MAX_VIDEO_SIZE_MB', 999999), // Effectively unlimited
    PRODUCTION: getEnvNumber('VITE_MAX_VIDEO_SIZE_MB', 999999),  // Effectively unlimited
  },

  // Document files (PDFs, etc.) - no limit
  DOCUMENT: {
    DEVELOPMENT: getEnvNumber('VITE_MAX_DOCUMENT_SIZE_MB', 999999),   // Effectively unlimited
    PRODUCTION: getEnvNumber('VITE_MAX_DOCUMENT_SIZE_MB', 999999),   // Effectively unlimited
  },

  // Image files - no limit
  IMAGE: {
    DEVELOPMENT: getEnvNumber('VITE_MAX_IMAGE_SIZE_MB', 999999),   // Effectively unlimited
    PRODUCTION: getEnvNumber('VITE_MAX_IMAGE_SIZE_MB', 999999),    // Effectively unlimited
  },

  // Audio files - no limit
  AUDIO: {
    DEVELOPMENT: getEnvNumber('VITE_MAX_AUDIO_SIZE_MB', 999999),  // Effectively unlimited
    PRODUCTION: getEnvNumber('VITE_MAX_AUDIO_SIZE_MB', 999999),   // Effectively unlimited
  },

  // Thumbnail images - no limit
  THUMBNAIL: {
    DEVELOPMENT: 999999,    // Effectively unlimited
    PRODUCTION: 999999,    // Effectively unlimited
  },
} as const;

// Maximum number of files per product - configurable via environment variables
// Set to extremely high value to effectively remove file count restrictions
export const MAX_FILES_PER_PRODUCT = {
  DEVELOPMENT: getEnvNumber('VITE_MAX_FILES_PER_PRODUCT', 999999),  // Effectively unlimited
  PRODUCTION: getEnvNumber('VITE_MAX_FILES_PER_PRODUCT', 999999),   // Effectively unlimited
} as const;

// Get current environment limits
export const getCurrentLimits = () => {
  const env = isProduction ? 'PRODUCTION' : 'DEVELOPMENT';
  
  return {
    video: FILE_SIZE_LIMITS.VIDEO[env],
    document: FILE_SIZE_LIMITS.DOCUMENT[env],
    image: FILE_SIZE_LIMITS.IMAGE[env],
    audio: FILE_SIZE_LIMITS.AUDIO[env],
    thumbnail: FILE_SIZE_LIMITS.THUMBNAIL[env],
    maxFiles: MAX_FILES_PER_PRODUCT[env],
  };
};

// File type validation
export const ACCEPTED_FILE_TYPES = {
  video: [
    'video/mp4',
    'video/webm',
    'video/quicktime',  // .mov files
    'video/x-msvideo',  // .avi files
    'video/x-ms-wmv',   // .wmv files
  ],
  document: [
    'application/pdf',
    'application/msword',  // .doc files
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx files
  ],
  image: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
  ],
  audio: [
    'audio/mpeg',       // .mp3
    'audio/wav',
    'audio/ogg',
    'audio/aac',
    'audio/mp4',        // .m4a
  ],
} as const;

// Get accepted file types as array for input elements
export const getAllAcceptedTypes = (): string[] => {
  return [
    ...ACCEPTED_FILE_TYPES.video,
    ...ACCEPTED_FILE_TYPES.document,
    ...ACCEPTED_FILE_TYPES.image,
    ...ACCEPTED_FILE_TYPES.audio,
  ];
};

// File validation function
export const validateFile = (file: File): { isValid: boolean; error?: string } => {
  // Check if file is actually a File object
  if (!file || typeof file !== 'object') {
    console.error('Invalid file object:', file);
    return {
      isValid: false,
      error: 'Invalid file object. Please try uploading the file again.',
    };
  }

  const limits = getCurrentLimits();
  const fileSizeMB = file.size / (1024 * 1024);

  // Ensure file.type and file.name exist
  const fileType = file.type || '';
  const fileName = (file.name || '').toLowerCase();

  // Determine file type and get appropriate limit
  let maxSize: number;
  let fileTypeName: string;
  let isDetected = false;

  // Try to detect by MIME type first, then by extension
  if (fileType.startsWith('video/') || /\.(mp4|webm|ogg|mov|avi|mkv)$/i.test(fileName)) {
    maxSize = limits.video;
    fileTypeName = 'video';
    isDetected = true;
  } else if (fileType.includes('pdf') || fileType.includes('document') || fileType.includes('word') ||
             fileType.includes('msword') || fileType.includes('wordprocessingml') ||
             fileType.includes('ms-excel') || fileType.includes('spreadsheetml') ||
             fileType.includes('ms-powerpoint') || fileType.includes('presentationml') ||
             /\.(pdf|doc|docx|xls|xlsx|ppt|pptx)$/i.test(fileName)) {
    maxSize = limits.document;
    fileTypeName = 'document';
    isDetected = true;
  } else if (fileType.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(fileName)) {
    maxSize = limits.image;
    fileTypeName = 'image';
    isDetected = true;
  } else if (fileType.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac)$/i.test(fileName)) {
    maxSize = limits.audio;
    fileTypeName = 'audio';
    isDetected = true;
  }

  if (!isDetected) {
    return {
      isValid: false,
      error: `Unsupported file type: ${fileType || 'unknown'} (${fileName || 'no filename'}). Please upload videos, documents, images, or audio files.`,
    };
  }

  // Check file size
  if (fileSizeMB > maxSize) {
    const compressionHint = fileTypeName === 'video' && fileSizeMB > 100
      ? ' Consider compressing your video or using a lower resolution.'
      : '';

    return {
      isValid: false,
      error: `File "${file.name}" is too large: ${fileSizeMB.toFixed(1)}MB. Maximum size for ${fileTypeName} files is ${maxSize}MB.${compressionHint}`,
    };
  }

  return { isValid: true };
};

// Format file size for display
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${Math.round((bytes / Math.pow(k, i)) * 100) / 100} ${sizes[i]}`;
};

// Chunked upload configuration
export const CHUNKED_UPLOAD_CONFIG = {
  // Files larger than this will use chunked upload (in MB)
  CHUNK_THRESHOLD: 10,
  
  // Chunk size for large file uploads (in MB)
  CHUNK_SIZE: 5,
  
  // Maximum retry attempts for failed chunks
  MAX_RETRY_ATTEMPTS: 3,
  
  // Delay between retry attempts (in ms)
  RETRY_DELAY: 1000,
} as const;

// Upload progress tracking
export interface UploadProgress {
  fileName: string;
  uploadedBytes: number;
  totalBytes: number;
  percentage: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  error?: string;
}

// Supabase storage configuration
export const STORAGE_CONFIG = {
  BUCKET_NAME: 'products',
  
  // URL pattern for public file access
  PUBLIC_URL_PATTERN: '/storage/v1/object/public/products/',
  
  // File path structure: products/{expertId}/{productId}/{fileId}_{filename}
  getFilePath: (expertId: string, productId: string, fileId: string, fileName: string) => 
    `${expertId}/${productId}/${fileId}_${fileName}`,
    
  // Clean filename for storage (remove special characters, spaces)
  cleanFileName: (fileName: string): string => {
    return fileName
      .replace(/[^a-zA-Z0-9._-]/g, '_')  // Replace special chars with underscore
      .replace(/_{2,}/g, '_')            // Replace multiple underscores with single
      .toLowerCase();
  },
} as const;