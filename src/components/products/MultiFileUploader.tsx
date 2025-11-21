import React, { useState, useCallback } from 'react';
import { Upload, X, File, Video, Image, FileText, Music, Loader2, ChevronUp, ChevronDown, Star, Edit2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { validateFile, getCurrentLimits, getAllAcceptedTypes, formatFileSize } from '@/config/upload';
import { useUploadNotifications } from '@/hooks/use-upload-notifications';

interface FileWithPreview {
  file: File;
  id: string;
  preview?: string;
  progress?: number;
  error?: string;
  isPrimary?: boolean;
  displayTitle?: string;
}

export interface FileWithTitle {
  file: File;
  displayTitle: string;
}

interface MultiFileUploaderProps {
  onFilesChange: (files: FileWithTitle[]) => void;
  maxFiles?: number;
  maxSizePerFile?: number; // in MB
  acceptedFileTypes?: string[];
  className?: string;
}

export const MultiFileUploader: React.FC<MultiFileUploaderProps> = ({
  onFilesChange,
  maxFiles,
  maxSizePerFile,
  acceptedFileTypes,
  className,
}) => {
  // Use centralized configuration with fallbacks for props
  const limits = getCurrentLimits();
  const finalMaxFiles = maxFiles ?? limits.maxFiles;
  const finalAcceptedTypes = acceptedFileTypes ?? getAllAcceptedTypes();
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  
  // Use enhanced notification system
  const notifications = useUploadNotifications();

  const getFileIcon = (file: File) => {
    const type = file.type;
    if (type.startsWith('video/')) return <Video className="w-4 h-4" />;
    if (type.startsWith('image/')) return <Image className="w-4 h-4" />;
    if (type.startsWith('audio/')) return <Music className="w-4 h-4" />;
    if (type.includes('pdf') || type.includes('document')) return <FileText className="w-4 h-4" />;
    return <File className="w-4 h-4" />;
  };

  const getFileTypeColor = (file: File) => {
    const type = file.type;
    if (type.startsWith('video/')) return 'bg-action-primary text-white';
    if (type.startsWith('image/')) return 'bg-green-100 text-green-700';
    if (type.startsWith('audio/')) return 'bg-blue-100 text-blue-700';
    if (type.includes('pdf') || type.includes('document')) return 'bg-orange-100 text-orange-700';
    return 'bg-gray-100 text-gray-700';
  };

  // Use centralized file size formatting
  const formatFileSizeLocal = (bytes: number) => formatFileSize(bytes);

  // Generate a default display title from filename
  const generateDefaultTitle = (fileName: string): string => {
    return fileName.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ");
  };

  // Notify parent component of files with titles
  const notifyFilesChange = useCallback((filesList: FileWithPreview[]) => {
    const filesWithTitles: FileWithTitle[] = filesList.map(f => ({
      file: f.file,
      displayTitle: f.displayTitle || generateDefaultTitle(f.file.name)
    }));
    onFilesChange(filesWithTitles);
  }, [onFilesChange]);

  // Update display title for a file
  const updateFileTitle = useCallback((fileId: string, title: string) => {
    setFiles(prev => {
      const updated = prev.map(f => 
        f.id === fileId ? { ...f, displayTitle: title } : f
      );
      notifyFilesChange(updated);
      return updated;
    });
  }, [notifyFilesChange]);

  const handleFileSelection = useCallback((newFiles: FileList | File[]) => {
    const fileArray = Array.from(newFiles);
    
    // Validate file count
    if (files.length + fileArray.length > finalMaxFiles) {
      notifications.showFileCountError(files.length + fileArray.length, finalMaxFiles);
      return;
    }

    // Process and validate files using centralized validation
    const validFiles: FileWithPreview[] = [];
    
    fileArray.forEach(file => {
      // Use centralized file validation
      const validation = validateFile(file);
      if (!validation.isValid) {
        notifications.showValidationError(validation.error || 'Invalid file');
        return;
      }

      // Create file with preview and default title
      const fileWithPreview: FileWithPreview = {
        file,
        id: `${Date.now()}-${Math.random()}`,
        isPrimary: files.length === 0 && validFiles.length === 0, // First file is primary
        displayTitle: generateDefaultTitle(file.name),
      };

      // Generate preview for images
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setFiles(prev => prev.map(f => 
            f.id === fileWithPreview.id 
              ? { ...f, preview: reader.result as string }
              : f
          ));
        };
        reader.readAsDataURL(file);
      }

      validFiles.push(fileWithPreview);
    });

    const newFilesList = [...files, ...validFiles];
    setFiles(newFilesList);
    notifyFilesChange(newFilesList);
  }, [files, finalMaxFiles, notifyFilesChange]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelection(e.dataTransfer.files);
  }, [handleFileSelection]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const removeFile = useCallback((id: string) => {
    const updatedFiles = files.filter(f => f.id !== id);
    
    // If primary file was removed, make the first file primary
    if (files.find(f => f.id === id)?.isPrimary && updatedFiles.length > 0) {
      updatedFiles[0].isPrimary = true;
    }
    
    setFiles(updatedFiles);
    notifyFilesChange(updatedFiles);
  }, [files, notifyFilesChange]);

  const moveFile = useCallback((index: number, direction: 'up' | 'down') => {
    const newFiles = [...files];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    
    if (newIndex < 0 || newIndex >= files.length) return;
    
    [newFiles[index], newFiles[newIndex]] = [newFiles[newIndex], newFiles[index]];
    setFiles(newFiles);
    notifyFilesChange(newFiles);
  }, [files, notifyFilesChange]);

  const setPrimaryFile = useCallback((id: string) => {
    setFiles(files.map(f => ({
      ...f,
      isPrimary: f.id === id,
    })));
  }, [files]);

  return (
    <div className={cn("space-y-4", className)}>
      {/* Drop Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={cn(
          "relative border-2 border-dashed rounded-lg p-8 text-center transition-all",
          isDragging 
            ? "border-blue-500 bg-blue-50" 
            : "border-gray-300 hover:border-gray-400",
          files.length >= finalMaxFiles && "opacity-50 pointer-events-none"
        )}
      >
        <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        <p className="text-lg font-medium mb-2">
          {isDragging ? "Drop files here" : "Drag & drop files here"}
        </p>
        <p className="text-sm text-gray-500 mb-4">
          or click to select files
        </p>
        <input
          type="file"
          multiple
          accept={finalAcceptedTypes.join(',')}
          onChange={(e) => e.target.files && handleFileSelection(e.target.files)}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          disabled={files.length >= finalMaxFiles}
        />
        <p className="text-xs text-gray-400">
          Maximum {finalMaxFiles} files • Videos up to {limits.video}MB • Documents up to {limits.document}MB
        </p>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-2">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-sm font-medium">
              Uploaded Files ({files.length}/{finalMaxFiles})
            </h3>
            {files.length > 1 && (
              <p className="text-xs text-gray-500">
                Drag to reorder, click star to set primary file
              </p>
            )}
          </div>
          
          {files.map((fileItem, index) => (
            <Card key={fileItem.id} className="overflow-hidden">
              <CardContent className="p-3">
                <div className="flex items-center space-x-3">
                  {/* File Icon & Preview */}
                  <div className="flex-shrink-0">
                    {fileItem.preview ? (
                      <img
                        src={fileItem.preview}
                        alt={fileItem.file.name}
                        className="w-12 h-12 object-cover rounded"
                      />
                    ) : (
                      <div className={cn(
                        "w-12 h-12 rounded flex items-center justify-center",
                        getFileTypeColor(fileItem.file)
                      )}>
                        {getFileIcon(fileItem.file)}
                      </div>
                    )}
                  </div>

                  {/* File Info */}
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center space-x-2">
                      {fileItem.isPrimary && (
                        <Badge variant="default" className="text-xs">
                          Primary
                        </Badge>
                      )}
                    </div>
                    
                    {/* Title Input */}
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-700">
                        Display Title
                      </label>
                      <Input
                        value={fileItem.displayTitle || ''}
                        onChange={(e) => updateFileTitle(fileItem.id, e.target.value)}
                        placeholder="Enter display title..."
                        className="text-sm"
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-gray-500 truncate max-w-[200px]">
                        {fileItem.file.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatFileSizeLocal(fileItem.file.size)}
                      </p>
                    </div>
                    
                    {fileItem.progress !== undefined && (
                      <Progress value={fileItem.progress} className="h-1" />
                    )}
                    {fileItem.error && (
                      <p className="text-xs text-red-500">{fileItem.error}</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center space-x-1">
                    {files.length > 1 && (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setPrimaryFile(fileItem.id)}
                          className={cn(
                            "p-1",
                            fileItem.isPrimary && "text-yellow-500"
                          )}
                        >
                          <Star className={cn(
                            "w-4 h-4",
                            fileItem.isPrimary && "fill-current"
                          )} />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => moveFile(index, 'up')}
                          disabled={index === 0}
                          className="p-1"
                        >
                          <ChevronUp className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => moveFile(index, 'down')}
                          disabled={index === files.length - 1}
                          className="p-1"
                        >
                          <ChevronDown className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeFile(fileItem.id)}
                      className="p-1 text-red-500 hover:text-red-700"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};