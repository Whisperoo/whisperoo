import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { 
  FileText, 
  Image as ImageIcon,
  ExternalLink,
  Loader2,
  Download
} from 'lucide-react';
import { VideoPlayer } from './VideoPlayer';
import { ProductFile, productService } from '@/services/products';
import { cn } from '@/lib/utils';

interface UnifiedMediaViewerProps {
  file: ProductFile;
  className?: string;
  onComplete?: () => void;
}

export const UnifiedMediaViewer: React.FC<UnifiedMediaViewerProps> = ({
  file,
  className,
  onComplete,
}) => {
  const [pdfLoaded, setPdfLoaded] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  const getFileIcon = () => {
    if (file.file_type === 'video' || file.mime_type?.startsWith('video/')) {
      return null; // Video player handles its own UI
    }
    if (file.file_type === 'document' || file.mime_type?.includes('pdf')) {
      return <FileText className="h-16 w-16 text-red-400" />;
    }
    if (file.file_type === 'image' || file.mime_type?.startsWith('image/')) {
      return <ImageIcon className="h-16 w-16 text-green-400" />;
    }
    return <FileText className="h-16 w-16 text-gray-400" />;
  };

  // Video content
  if (file.file_type === 'video' || file.mime_type?.startsWith('video/')) {
    // Convert relative path to public URL
    const videoUrl = productService.getPublicFileUrl(file.file_url);
    
    return (
      <div className={cn("w-full", className)}>
        <VideoPlayer
          src={videoUrl}
          title={file.display_title || file.file_name}
          className="w-full aspect-video"
          controls={true}
          onEnded={onComplete}
        />
      </div>
    );
  }

  // PDF content
  if (file.file_type === 'document' || file.mime_type?.includes('pdf')) {
    // Convert relative path to public URL and create clean PDF URL without browser chrome
    const publicUrl = productService.getPublicFileUrl(file.file_url);
    const cleanPdfUrl = `${publicUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`;
    
    return (
      <div className={cn("w-full bg-white rounded-lg relative border", className)}>
        <div className="relative w-full min-h-[70vh] max-h-[80vh]">
          <iframe
            src={cleanPdfUrl}
            className="w-full h-full min-h-[70vh] border-0 rounded-lg bg-white"
            title={file.display_title || file.file_name}
            onLoad={() => {
              setPdfLoaded(true);
              // Mark as completed when PDF loads
              setTimeout(() => {
                onComplete?.();
              }, 3000); // Give user 3 seconds to see it loaded
            }}
            onError={() => setPdfLoaded(true)}
            style={{ 
              background: 'white',
              overflow: 'hidden'
            }}
          />
          
          {/* PDF Loading State */}
          {!pdfLoaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-white rounded-lg">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
                <p className="text-gray-600">Loading PDF document...</p>
              </div>
            </div>
          )}
          
          {/* Top controls bar */}
          <div className="absolute top-2 right-2 flex gap-2 z-10">
            <Button
              size="sm"
              variant="outline"
              onClick={() => window.open(publicUrl, '_blank')}
              className="bg-white/95 hover:bg-white shadow-sm text-xs px-2 py-1"
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              Full View
            </Button>
          </div>
          
          {/* Optional: Bottom info bar */}
          <div className="absolute bottom-2 left-2 right-2 bg-white/95 rounded px-3 py-2 text-xs text-gray-600 flex justify-between items-center">
            <span className="font-medium">{file.display_title || file.file_name.replace(/\.[^/.]+$/, "")}</span>
            <span>{file.file_size_mb?.toFixed(1)} MB</span>
          </div>
        </div>
      </div>
    );
  }

  // Image content
  if (file.file_type === 'image' || file.mime_type?.startsWith('image/')) {
    return (
      <div className={cn("w-full bg-gray-50 rounded-lg overflow-hidden", className)}>
        <div className="relative w-full max-h-[70vh] flex items-center justify-center">
          {!imageLoaded && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          )}
          <img
            src={productService.getPublicFileUrl(file.file_url)}
            alt={file.display_title || file.file_name}
            className="max-w-full max-h-full object-contain"
            onLoad={() => {
              setImageLoaded(true);
              // Mark as completed when image loads
              setTimeout(() => {
                onComplete?.();
              }, 1500);
            }}
            onError={() => setImageLoaded(true)}
          />
        </div>
      </div>
    );
  }

  // Generic file fallback
  return (
    <div className={cn("flex flex-col items-center justify-center h-96 text-center bg-gray-50 rounded-lg", className)}>
      {getFileIcon()}
      <h3 className="text-lg font-semibold text-gray-700 mb-2 mt-4">
        {file.display_title || file.file_name.replace(/\.[^/.]+$/, "")}
      </h3>
      <p className="text-gray-500 mb-2">
        {file.mime_type && (
          <span className="text-xs bg-gray-200 px-2 py-1 rounded">
            {file.mime_type}
          </span>
        )}
      </p>
      <p className="text-gray-500 mb-6">
        This file type cannot be previewed in the browser.
      </p>
      <div className="flex gap-3">
        <Button
          onClick={() => window.open(file.file_url, '_blank')}
          variant="outline"
        >
          <ExternalLink className="h-4 w-4 mr-2" />
          Open in New Tab
        </Button>
        <Button 
          onClick={() => {
            const link = document.createElement('a');
            link.href = file.file_url;
            link.download = file.file_name;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            onComplete?.();
          }}
        >
          <Download className="h-4 w-4 mr-2" />
          Download
        </Button>
      </div>
    </div>
  );
};