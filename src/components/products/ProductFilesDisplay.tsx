import React, { useState } from 'react';
import { File, Video, Image, FileText, Music, Download, Play, Eye, ChevronDown, ChevronUp, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { Database } from '@/types/database.types';
import { productService } from '@/services/products';

type ProductFile = Database['public']['Tables']['product_files']['Row'];

interface ProductFilesDisplayProps {
  files: ProductFile[];
  productTitle: string;
  isPurchased?: boolean;
  onDownload?: (file: ProductFile) => void;
  onPreview?: (file: ProductFile) => void;
  className?: string;
}

export const ProductFilesDisplay: React.FC<ProductFilesDisplayProps> = ({
  files,
  productTitle,
  isPurchased = false,
  onDownload,
  onPreview,
  className,
}) => {
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [isDownloading, setIsDownloading] = useState(false);

  // Handle edge cases for files array
  if (!files || !Array.isArray(files)) {
    console.warn('ProductFilesDisplay: Invalid files prop provided:', files);
    return (
      <Card className={className}>
        <CardContent className="p-6 text-center text-gray-500">
          <FileText className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <p>No files available for this product.</p>
        </CardContent>
      </Card>
    );
  }

  if (files.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="p-6 text-center text-gray-500">
          <FileText className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <p>This product doesn't have any files yet.</p>
        </CardContent>
      </Card>
    );
  }

  const getFileIcon = (fileType: string) => {
    switch (fileType) {
      case 'video':
        return <Video className="w-5 h-5" />;
      case 'audio':
        return <Music className="w-5 h-5" />;
      case 'image':
        return <Image className="w-5 h-5" />;
      case 'document':
        return <FileText className="w-5 h-5" />;
      default:
        return <File className="w-5 h-5" />;
    }
  };

  const getFileTypeColor = (fileType: string) => {
    switch (fileType) {
      case 'video':
        return 'bg-action-primary text-white dark:bg-action-primary dark:text-white';
      case 'audio':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300';
      case 'image':
        return 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300';
      case 'document':
        return 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300';
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  const formatFileSize = (mb: number | null) => {
    if (!mb) return 'Unknown size';
    if (mb < 1) return `${(mb * 1024).toFixed(0)} KB`;
    if (mb > 1024) return `${(mb / 1024).toFixed(2)} GB`;
    return `${mb.toFixed(2)} MB`;
  };

  const formatDuration = (minutes: number | null) => {
    if (!minutes) return null;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  // Group files by type for better organization
  const filesByType = files.reduce((acc, file) => {
    const type = file.file_type;
    if (!acc[type]) {
      acc[type] = [];
    }
    acc[type].push(file);
    return acc;
  }, {} as Record<string, ProductFile[]>);

  const toggleGroup = (type: string) => {
    setExpandedGroups(prev => ({
      ...prev,
      [type]: !prev[type],
    }));
  };

  const handleBatchDownload = async (files: ProductFile[], productTitle: string) => {
    if (!files || files.length === 0) {
      console.warn('No files provided for batch download');
      return;
    }

    setIsDownloading(true);
    let successCount = 0;
    let failureCount = 0;
    
    try {
      // Create a delay between downloads to avoid overwhelming the browser
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Validate file URL exists
        if (!file.file_url || file.file_url.trim() === '') {
          console.error(`File ${file.file_name} has no URL`);
          failureCount++;
          continue;
        }

        try {
          // Generate public URL for the file
          const fileUrl = productService.getPublicFileUrl(file.file_url);
          
          if (!fileUrl || fileUrl.trim() === '') {
            console.error(`Failed to generate URL for file: ${file.file_name}`);
            failureCount++;
            continue;
          }

          // Create a temporary download link
          const link = document.createElement('a');
          link.href = fileUrl;
          link.download = file.file_name || `file_${i + 1}`;
          link.target = '_blank';
          
          // Add to DOM, click, and remove
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          
          successCount++;
          
          // Track download event
          if (onDownload) {
            onDownload(file);
          }

        } catch (fileError) {
          console.error(`Failed to download file ${file.file_name}:`, fileError);
          failureCount++;
        }
        
        // Small delay between downloads to prevent browser blocking
        if (i < files.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      // Show user feedback
      if (failureCount > 0) {
        const message = successCount > 0 
          ? `Downloaded ${successCount} files successfully. ${failureCount} files failed.`
          : `Failed to download all ${failureCount} files.`;
        
        // You could replace this with a toast notification
        console.warn(message);
      }

    } catch (error) {
      console.error('Batch download failed:', error);
      // Show user-friendly error message
      console.error('Failed to download files. Please try again or contact support.');
    } finally {
      setIsDownloading(false);
    }
  };

  // Single file display
  if (files.length === 1) {
    const file = files[0];
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-4">
              <div className={cn(
                "p-3 rounded-lg",
                getFileTypeColor(file.file_type)
              )}>
                {getFileIcon(file.file_type)}
              </div>
              <div>
                <h3 className="font-medium text-lg">
                  {file.display_title || file.file_name.replace(/\.[^/.]+$/, "")}
                </h3>
                {file.description && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {file.description}
                  </p>
                )}
                <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                  <span>{formatFileSize(file.file_size_mb)}</span>
                  {file.duration_minutes && (
                    <span>{formatDuration(file.duration_minutes)}</span>
                  )}
                  {file.page_count && (
                    <span>{file.page_count} pages</span>
                  )}
                </div>
              </div>
            </div>
            {isPurchased && (
              <div className="flex gap-2">
                {onPreview && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onPreview(file)}
                  >
                    <Eye className="w-4 h-4 mr-1" />
                    Preview
                  </Button>
                )}
                {onDownload && (
                  <Button
                    size="sm"
                    onClick={() => onDownload(file)}
                  >
                    <Download className="w-4 h-4 mr-1" />
                    Download
                  </Button>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Multiple files - grouped display
  const totalSize = files.reduce((sum, file) => sum + (file.file_size_mb || 0), 0);
  const primaryFile = files.find(f => f.is_primary);

  return (
    <div className={cn("space-y-4", className)}>
      {/* Summary Card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold">{productTitle} Bundle</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {files.length} files • {formatFileSize(totalSize)}
              </p>
            </div>
            {isPurchased && onDownload && (
              <Button 
                onClick={() => handleBatchDownload(files, productTitle)}
                disabled={isDownloading}
              >
                <Download className="w-4 h-4 mr-2" />
                {isDownloading ? 'Downloading...' : 'Download All'}
              </Button>
            )}
          </div>

          {/* File Type Badges */}
          <div className="flex gap-2 flex-wrap">
            {Object.keys(filesByType).map(type => (
              <Badge key={type} variant="secondary">
                {filesByType[type].length} {type}
                {filesByType[type].length > 1 ? 's' : ''}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Files by Type */}
      <Card>
        <CardContent className="p-0">
          {Object.entries(filesByType).map(([type, typeFiles], index) => {
            const isExpanded = expandedGroups[type] !== false; // Default expanded
            return (
              <div
                key={type}
                className={cn(
                  "border-b last:border-b-0",
                )}
              >
                {/* Group Header */}
                <button
                  onClick={() => toggleGroup(type)}
                  className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "p-2 rounded",
                      getFileTypeColor(type)
                    )}>
                      {getFileIcon(type)}
                    </div>
                    <div className="text-left">
                      <p className="font-medium capitalize">
                        {type} Files ({typeFiles.length})
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(typeFiles.reduce((sum, f) => sum + (f.file_size_mb || 0), 0))}
                      </p>
                    </div>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  )}
                </button>

                {/* File List */}
                {isExpanded && (
                  <div className="px-4 pb-4">
                    <div className="space-y-2 pl-11">
                      {typeFiles.map((file) => (
                          <div
                            key={file.id}
                            className="flex items-center justify-between py-2"
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <p className="text-sm">
                                  {file.display_title || file.file_name.replace(/\.[^/.]+$/, "")}
                                </p>
                                {file.is_primary && (
                                  <Badge variant="default" className="text-xs">
                                    <Star className="w-3 h-3 mr-1 fill-current" />
                                    Primary
                                  </Badge>
                                )}
                              </div>
                              {file.description && (
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {file.description}
                                </p>
                              )}
                              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                                <span>{formatFileSize(file.file_size_mb)}</span>
                                {file.duration_minutes && (
                                  <span>{formatDuration(file.duration_minutes)}</span>
                                )}
                                {file.page_count && (
                                  <span>{file.page_count} pages</span>
                                )}
                              </div>
                            </div>
                            {isPurchased && (
                              <div className="flex gap-1">
                                {onPreview && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => onPreview(file)}
                                  >
                                    <Eye className="w-4 h-4" />
                                  </Button>
                                )}
                                {onDownload && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => onDownload(file)}
                                  >
                                    <Download className="w-4 h-4" />
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
};