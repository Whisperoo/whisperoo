import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Download, 
  X, 
  FileText, 
  Image as ImageIcon,
  Play,
  ExternalLink,
  Loader2
} from 'lucide-react';
import { VideoPlayer } from './VideoPlayer';
import { CourseViewer } from './CourseViewer';
import { ProductFilesDisplay } from '../products/ProductFilesDisplay';
import { ProductWithDetails, ProductFile, productService } from '@/services/products';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

interface ContentViewerProps {
  open: boolean;
  onClose: () => void;
  product: ProductWithDetails;
}

export const ContentViewer: React.FC<ContentViewerProps> = ({
  open,
  onClose,
  product,
}) => {
  const [pdfLoaded, setPdfLoaded] = useState(false);
  const [productFiles, setProductFiles] = useState<ProductFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const isMobile = useIsMobile();

  // Reset states when modal closes
  useEffect(() => {
    if (!open) {
      setPdfLoaded(false);
      setProductFiles([]);
      setLoadingFiles(false);

      // Force cleanup of any lingering modal styles that may block interactions
      // This is especially important in production builds
      setTimeout(() => {
        document.body.style.pointerEvents = '';
        document.body.style.overflow = '';
      }, 100);
    }
  }, [open]);

  // Reset processing state when user returns to the page after opening file in new tab
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        setPdfLoaded(false);
        setLoadingFiles(false);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Initialize files from product if available, otherwise load them
  useEffect(() => {
    const initializeFiles = async () => {
      if (!open || !product) {
        setProductFiles([]);
        return;
      }

      // First, check if product already has files loaded
      if (product.files && product.files.length > 0) {
        setProductFiles(product.files);
        return;
      }

      // Only load files if product indicates it has multiple files but they're not loaded
      if (product.has_multiple_files || product.total_files_count > 1) {
        setLoadingFiles(true);
        try {
          const files = await productService.getProductFiles(product.id);
          setProductFiles(files);
        } catch (error) {
          console.error('Failed to load product files:', error);
          setProductFiles([]);
        } finally {
          setLoadingFiles(false);
        }
      } else {
        setProductFiles([]);
      }
    };

    initializeFiles();
  }, [open, product]);


  const getContentUrl = () => {
    // First check primary_file_url, then file_url
    const url = product.primary_file_url || product.file_url;

    console.log('Product content URLs:', {
      primary_file_url: product.primary_file_url,
      file_url: product.file_url,
      product_id: product.id,
      product_type: product.product_type
    });

    if (!url) {
      console.warn('No file URL found for product:', product.id);
      return null;
    }

    // Convert relative path to public URL if needed
    const publicUrl = productService.getPublicFileUrl(url);
    console.log('Generated public URL:', publicUrl);
    return publicUrl;
  };

  const handleDownloadFile = (file: ProductFile) => {
    const fileUrl = productService.getPublicFileUrl(file.file_url);
    window.open(fileUrl, '_blank');
    
    // Track download event
    productService.trackProductEvent(product.id, 'download');
  };

  const handlePreviewFile = (file: ProductFile) => {
    const fileUrl = productService.getPublicFileUrl(file.file_url);
    window.open(fileUrl, '_blank');
    
    // Track preview event
    productService.trackProductEvent(product.id, 'preview');
  };

  const renderContent = () => {
    if (loadingFiles) {
      return (
        <div className="flex flex-col items-center justify-center h-96 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Loading content...</p>
        </div>
      );
    }

    // Check if this is a multi-file product
    const hasMultipleFiles = productFiles.length > 1 || 
                            (product.has_multiple_files && productFiles.length >= 1) ||
                            (product.total_files_count > 1 && productFiles.length >= 1);
    
    // If it's a multi-file product, use CourseViewer for better organization
    if (hasMultipleFiles) {
      return (
        <div className="space-y-6">
          <CourseViewer
            title={product.title}
            files={productFiles}
            thumbnail={product.thumbnail_url || undefined}
            className="w-full"
          />
          
          {/* Show all files display below the course viewer for download options */}
          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold mb-4">All Files</h3>
            <ProductFilesDisplay
              files={productFiles}
              productTitle={product.title}
              isPurchased={true}
              onDownload={handleDownloadFile}
              onPreview={handlePreviewFile}
            />
          </div>
        </div>
      );
    }

    // Single file content - use existing logic
    const contentUrl = getContentUrl();
    
    if (!contentUrl) {
      return (
        <div className="flex flex-col items-center justify-center h-96 text-center px-6">
          <FileText className="h-16 w-16 text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Content Not Available</h3>
          <p className="text-gray-500 mb-4">
            This content is currently being processed or the file is not available.
          </p>
          <div className="text-left bg-gray-50 border border-gray-200 rounded-lg p-4 max-w-md">
            <p className="text-sm text-gray-700 mb-2 font-medium">Possible reasons:</p>
            <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
              <li>The file hasn't been uploaded yet</li>
              <li>The file is still being processed</li>
              <li>There was an error during upload</li>
              <li>The storage URL is not configured correctly</li>
            </ul>
          </div>
          <Button
            variant="outline"
            onClick={onClose}
            className="mt-6"
          >
            Close
          </Button>
        </div>
      );
    }

    // Single video content
    if (product.product_type === 'video') {
      return (
        <div className="w-full">
          <VideoPlayer
            src={contentUrl}
            title={product.title}
            poster={product.thumbnail_url || undefined}
            className="w-full aspect-video"
            controls={true}
          />
        </div>
      );
    }

    // PDF/Document content
    if (product.product_type === 'document' || contentUrl.includes('.pdf')) {
      if (isMobile) {
        return (
          <div className="w-full rounded-lg border bg-gray-50 p-6 text-center">
            <FileText className="h-10 w-10 mx-auto text-gray-400 mb-3" />
            <h3 className="text-base font-semibold text-gray-900 mb-1">Open Document</h3>
            <p className="text-sm text-gray-600 mb-4">For the best mobile experience, this document opens in a new tab.</p>
            <Button onClick={() => window.open(contentUrl, '_blank')}>
              <ExternalLink className="h-4 w-4 mr-2" />
              Open in New Tab
            </Button>
          </div>
        );
      }
      return (
        <div className="w-full relative">
          {!pdfLoaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
                <p className="text-gray-600">Loading document...</p>
              </div>
            </div>
          )}
          <iframe
            src={`${contentUrl}#toolbar=0&navpanes=0&scrollbar=1`}
            className="w-full h-[80vh] border-0 rounded-lg"
            title={product.title}
            onLoad={() => setPdfLoaded(true)}
            onError={() => setPdfLoaded(true)}
          />
          <div className="absolute bottom-4 right-4">
            <Button
              size="sm"
              variant="outline"
              onClick={() => window.open(contentUrl, '_blank')}
              className="bg-white/90 hover:bg-white"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Open in New Tab
            </Button>
          </div>
        </div>
      );
    }

    // Image content
    if (product.product_type === 'image' || contentUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
      return (
        <div className="w-full rounded-lg bg-gray-50">
          <img
            src={contentUrl}
            alt={product.title}
            className="w-full h-auto object-contain"
          />
        </div>
      );
    }

    // Generic file preview
    return (
      <div className="flex flex-col items-center justify-center h-96 text-center bg-gray-50 rounded-lg">
        <FileText className="h-16 w-16 text-gray-400 mb-4" />
        <h3 className="text-lg font-semibold text-gray-700 mb-2">Preview Not Available</h3>
        <p className="text-gray-500 mb-6">
          This file type cannot be previewed in the browser.
        </p>
        <div className="flex gap-3">
          <Button
            onClick={() => window.open(contentUrl, '_blank')}
            variant="outline"
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Open in New Tab
          </Button>
        </div>
      </div>
    );
  };

  const getFileIcon = () => {
    switch (product.product_type) {
      case 'video':
        return <Play className="h-4 w-4" />;
      case 'document':
        return <FileText className="h-4 w-4" />;
      case 'image':
        return <ImageIcon className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const formatFileSize = (sizeInMB: number | null) => {
    if (!sizeInMB) return '';
    if (sizeInMB < 1) return `${Math.round(sizeInMB * 1024)} KB`;
    return `${sizeInMB.toFixed(1)} MB`;
  };

  const formatDuration = (minutes: number | null) => {
    if (!minutes) return '';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  // Determine if this is a course for layout - improved detection
  const isCourse = (productFiles.length > 1) || 
    (product.has_multiple_files && product.total_files_count && product.total_files_count > 1) ||
    (product.content_type && ['bundle', 'course', 'collection'].includes(product.content_type));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className={cn(
        "w-[95vw] h-[90vh] p-0 overflow-y-auto",
        isCourse ? "max-w-7xl" : "max-w-5xl"
      )}>
        <div className="sticky top-0 z-10 px-4 py-3 border-b bg-white/95 backdrop-blur-sm">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0 pr-4">
              <DialogTitle className="text-lg font-semibold text-gray-900 mb-1 line-clamp-2">
                {product.title}
              </DialogTitle>
              <DialogDescription className="sr-only">
                View {product.product_type} content for {product.title}
              </DialogDescription>
              <div className="flex items-center gap-2 flex-wrap text-xs">
                {product.file_size_mb && (
                  <span className="text-gray-500">
                    {formatFileSize(product.file_size_mb)}
                  </span>
                )}

                {product.duration_minutes && (
                  <span className="text-gray-500">
                    {formatDuration(product.duration_minutes)}
                  </span>
                )}

                {product.page_count && (
                  <span className="text-gray-500">
                    {product.page_count} pages
                  </span>
                )}
              </div>
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="flex-shrink-0 h-8 w-8 rounded-full hover:bg-gray-100"
              aria-label="Close content viewer"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="p-4">
          {renderContent()}
        </div>

        {product.description && (
          <div className="px-4 pb-4 border-t bg-gray-50/50">
            <h4 className="font-medium text-gray-900 mb-2 mt-3 text-sm">About This Content</h4>
            <p className="text-gray-600 text-sm leading-relaxed">
              {product.description}
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};