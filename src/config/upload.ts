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
export const FILE_SIZE_LIMITS = {
  // Video files - matched to Supabase storage bucket limit (500MB)
  VIDEO: {
    DEVELOPMENT: getEnvNumber('VITE_MAX_VIDEO_SIZE_MB', 400), // Default 400MB for dev (some buffer)
    PRODUCTION: getEnvNumber('VITE_MAX_VIDEO_SIZE_MB', 500),  // Default 500MB for production
  },
  
  // Document files (PDFs, etc.)
  DOCUMENT: {
    DEVELOPMENT: getEnvNumber('VITE_MAX_DOCUMENT_SIZE_MB', 50),   // Default 50MB for dev
    PRODUCTION: getEnvNumber('VITE_MAX_DOCUMENT_SIZE_MB', 100),   // Default 100MB for production
  },
  
  // Image files
  IMAGE: {
    DEVELOPMENT: getEnvNumber('VITE_MAX_IMAGE_SIZE_MB', 10),   // Default 10MB for dev
    PRODUCTION: getEnvNumber('VITE_MAX_IMAGE_SIZE_MB', 25),    // Default 25MB for production
  },
  
  // Audio files
  AUDIO: {
    DEVELOPMENT: getEnvNumber('VITE_MAX_AUDIO_SIZE_MB', 100),  // Default 100MB for dev
    PRODUCTION: getEnvNumber('VITE_MAX_AUDIO_SIZE_MB', 500),   // Default 500MB for production
  },
  
  // Thumbnail images
  THUMBNAIL: {
    DEVELOPMENT: 5,    // 5MB for dev
    PRODUCTION: 10,    // 10MB for production
  },
} as const;

// Maximum number of files per product - configurable via environment variables
export const MAX_FILES_PER_PRODUCT = {
  DEVELOPMENT: getEnvNumber('VITE_MAX_FILES_PER_PRODUCT', 25),
  PRODUCTION: getEnvNumber('VITE_MAX_FILES_PER_PRODUCT', 100),
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
  const limits = getCurrentLimits();
  const fileSizeMB = file.size / (1024 * 1024);
  
  // Determine file type and get appropriate limit
  let maxSize: number;
  let fileTypeName: string;
  
  if (file.type.startsWith('video/')) {
    maxSize = limits.video;
    fileTypeName = 'video';
  } else if (file.type.includes('pdf') || file.type.includes('document') || file.type.includes('word')) {
    maxSize = limits.document;
    fileTypeName = 'document';
  } else if (file.type.startsWith('image/')) {
    maxSize = limits.image;
    fileTypeName = 'image';
  } else if (file.type.startsWith('audio/')) {
    maxSize = limits.audio;
    fileTypeName = 'audio';
  } else {
    return {
      isValid: false,
      error: `Unsupported file type: ${file.type}. Please upload videos, documents, images, or audio files.`,
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
  
  // Check if file type is explicitly supported
  const allAcceptedTypes = getAllAcceptedTypes();
  if (!allAcceptedTypes.includes(file.type)) {
    return {
      isValid: false,
      error: `File type "${file.type}" is not supported. Please upload supported file formats.`,
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