import { useToast } from '@/hooks/use-toast';
import { getCurrentLimits } from '@/config/upload';

export const useUploadNotifications = () => {
  const { toast } = useToast();
  const limits = getCurrentLimits();

  const showFileSizeError = (fileName: string, fileSize: number, maxSize: number, fileType: string) => {
    const fileSizeMB = (fileSize / (1024 * 1024)).toFixed(1);
    toast({
      variant: "destructive",
      title: "File Too Large",
      description: `"${fileName}" is ${fileSizeMB}MB. Maximum size for ${fileType} files is ${maxSize}MB.`,
    });
  };

  const showFileTypeError = (fileName: string, fileType: string) => {
    toast({
      variant: "destructive", 
      title: "Unsupported File Type",
      description: `"${fileName}" has an unsupported file type (${fileType}). Please upload videos, documents, images, or audio files.`,
    });
  };

  const showFileCountError = (currentCount: number, maxCount: number) => {
    toast({
      variant: "destructive",
      title: "Too Many Files",
      description: `You can upload up to ${maxCount} files per product. You currently have ${currentCount} files selected.`,
    });
  };

  const showUploadSuccess = (fileCount: number, productTitle?: string) => {
    toast({
      variant: "success",
      title: "Upload Successful",
      description: `Successfully uploaded ${fileCount} file${fileCount !== 1 ? 's' : ''} ${productTitle ? `for "${productTitle}"` : ''}.`,
    });
  };

  const showUploadError = (error: string) => {
    toast({
      variant: "destructive",
      title: "Upload Failed",
      description: error || "An unexpected error occurred while uploading. Please try again.",
    });
  };

  const showUploadProgress = (fileName: string) => {
    toast({
      variant: "info",
      title: "Uploading File",
      description: `Uploading "${fileName}"... Please wait.`,
    });
  };

  const showValidationError = (message: string) => {
    toast({
      variant: "warning",
      title: "Validation Error", 
      description: message,
    });
  };

  const showNetworkError = () => {
    toast({
      variant: "destructive",
      title: "Network Error",
      description: "Please check your internet connection and try again.",
    });
  };

  const showQuotaExceeded = (currentSize: number, maxSize: number) => {
    toast({
      variant: "warning",
      title: "Storage Quota Exceeded",
      description: `Upload would exceed your storage quota. Current: ${(currentSize / 1024).toFixed(1)}GB, Limit: ${(maxSize / 1024).toFixed(1)}GB`,
    });
  };

  const showRetryableError = (fileName: string, attempt: number, maxAttempts: number) => {
    toast({
      variant: "warning",
      title: "Upload Retry",
      description: `Failed to upload "${fileName}". Retrying... (Attempt ${attempt} of ${maxAttempts})`,
    });
  };

  // Helper to get user-friendly file size limits
  const getLimitsDescription = () => {
    return `Current upload limits: Videos up to ${limits.video}MB, Documents up to ${limits.document}MB, Images up to ${limits.image}MB, Audio up to ${limits.audio}MB.`;
  };

  const showLimitsInfo = () => {
    toast({
      variant: "info",
      title: "Upload Limits",
      description: getLimitsDescription(),
    });
  };

  return {
    showFileSizeError,
    showFileTypeError,
    showFileCountError,
    showUploadSuccess,
    showUploadError,
    showUploadProgress,
    showValidationError,
    showNetworkError,
    showQuotaExceeded,
    showRetryableError,
    showLimitsInfo,
    getLimitsDescription,
  };
};