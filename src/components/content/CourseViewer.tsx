import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Play,
  SkipForward,
  SkipBack,
  List,
  Clock,
  Video,
  FileText,
  Image as ImageIcon,
  File,
  Music,
  BookOpen
} from 'lucide-react';
import { UnifiedMediaViewer } from './UnifiedMediaViewer';
import { ProductFile } from '@/services/products';
import { cn } from '@/lib/utils';

interface CourseViewerProps {
  title: string;
  files: ProductFile[];
  thumbnail?: string;
  className?: string;
}

export const CourseViewer: React.FC<CourseViewerProps> = ({
  title,
  files,
  thumbnail,
  className,
}) => {
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [showPlaylist, setShowPlaylist] = useState(true); // Default to true for enterprise UX

  // Sort all files by sort_order
  const sortedFiles = files.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  const videoFiles = sortedFiles.filter(file => file.file_type === 'video' || file.mime_type?.startsWith('video/'));
  const documentFiles = sortedFiles.filter(file => file.file_type === 'document' || file.mime_type?.includes('pdf'));
  const imageFiles = sortedFiles.filter(file => file.file_type === 'image' || file.mime_type?.startsWith('image/'));
  const audioFiles = sortedFiles.filter(file => file.file_type === 'audio' || file.mime_type?.startsWith('audio/'));

  const currentFile = sortedFiles[currentFileIndex];

  // Format duration for display
  const formatDuration = (minutes?: number) => {
    if (!minutes) return '';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  // Calculate total course duration from all files with duration
  const totalDuration = sortedFiles.reduce((sum, file) => sum + (file.duration_minutes || 0), 0);
  
  // Get file icon based on type
  const getFileIcon = (file: ProductFile) => {
    if (file.file_type === 'video' || file.mime_type?.startsWith('video/')) {
      return <Video className="w-4 h-4" />;
    }
    if (file.file_type === 'document' || file.mime_type?.includes('pdf')) {
      return <FileText className="w-4 h-4" />;
    }
    if (file.file_type === 'image' || file.mime_type?.startsWith('image/')) {
      return <ImageIcon className="w-4 h-4" />;
    }
    return <File className="w-4 h-4" />;
  };

  // Navigate to next file
  const goToNextFile = () => {
    if (currentFileIndex < sortedFiles.length - 1) {
      setCurrentFileIndex(currentFileIndex + 1);
    }
  };

  // Navigate to previous file
  const goToPreviousFile = () => {
    if (currentFileIndex > 0) {
      setCurrentFileIndex(currentFileIndex - 1);
    }
  };

  if (sortedFiles.length === 0) {
    return (
      <div className={cn("flex flex-col items-center justify-center h-96 text-center", className)}>
        <File className="h-16 w-16 text-gray-400 mb-4" />
        <h3 className="text-lg font-semibold text-gray-700 mb-2">No Content Found</h3>
        <p className="text-gray-500">This course doesn't contain any files.</p>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col space-y-4", className)}>
      {/* Course Header */}
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <BookOpen className="h-6 w-6 text-blue-600" />
            <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
          </div>
          
          <div className="flex items-center gap-2 text-sm text-gray-600 flex-wrap">
            {videoFiles.length > 0 && (
              <Badge variant="secondary" className="flex items-center gap-1">
                <Video className="h-3 w-3" />
                {videoFiles.length} video{videoFiles.length !== 1 ? 's' : ''}
              </Badge>
            )}
            {documentFiles.length > 0 && (
              <Badge variant="secondary" className="flex items-center gap-1">
                <FileText className="h-3 w-3" />
                {documentFiles.length} document{documentFiles.length !== 1 ? 's' : ''}
              </Badge>
            )}
            {audioFiles.length > 0 && (
              <Badge variant="secondary" className="flex items-center gap-1">
                <Music className="h-3 w-3" />
                {audioFiles.length} audio
              </Badge>
            )}
            {imageFiles.length > 0 && (
              <Badge variant="secondary" className="flex items-center gap-1">
                <ImageIcon className="h-3 w-3" />
                {imageFiles.length} image{imageFiles.length !== 1 ? 's' : ''}
              </Badge>
            )}
            <Badge variant="outline" className="flex items-center gap-1">
              <File className="h-3 w-3" />
              {sortedFiles.length} total items
            </Badge>
            {totalDuration > 0 && (
              <Badge variant="outline" className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatDuration(totalDuration)} total
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Media Viewer */}
        <div className={cn("space-y-4", showPlaylist ? "lg:col-span-3" : "lg:col-span-4")}>
          {!showPlaylist && (
            <div className="flex justify-end mb-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPlaylist(true)}
                className="flex items-center gap-2"
              >
                <List className="h-4 w-4" />
                Show Playlist
              </Button>
            </div>
          )}
          {currentFile && (
            <>
              <UnifiedMediaViewer
                file={currentFile}
                className="w-full"
              />
              
              {/* Current File Info */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                    {getFileIcon(currentFile)}
                    Item {currentFileIndex + 1}: {currentFile.display_title || currentFile.file_name.replace(/\.[^/.]+$/, "")}
                  </h3>
                </div>
                
                {currentFile.description && (
                  <p className="text-gray-600 text-sm mb-3">{currentFile.description}</p>
                )}
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <span className="capitalize bg-gray-200 px-2 py-1 rounded text-xs">
                      {currentFile.file_type || 'file'}
                    </span>
                    {currentFile.duration_minutes && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDuration(currentFile.duration_minutes)}
                      </span>
                    )}
                    {currentFile.file_size_mb && (
                      <span>
                        {currentFile.file_size_mb.toFixed(1)} MB
                      </span>
                    )}
                  </div>
                  
                  {/* Navigation Controls */}
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={goToPreviousFile}
                      disabled={currentFileIndex === 0}
                      className="flex items-center gap-2"
                    >
                      <SkipBack className="h-4 w-4" />
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={goToNextFile}
                      disabled={currentFileIndex === sortedFiles.length - 1}
                      className="flex items-center gap-2"
                    >
                      Next
                      <SkipForward className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Playlist */}
        {showPlaylist && (
          <div className="lg:col-span-1">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">Playlist</h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPlaylist(false)}
                  className="flex items-center gap-2"
                >
                  <List className="h-4 w-4" />
                  Hide
                </Button>
              </div>
              <div className="space-y-2">
                {sortedFiles.map((file, index) => (
                  <div
                    key={file.id}
                    className={cn(
                      "p-3 rounded-lg cursor-pointer transition-all",
                      index === currentFileIndex
                        ? "bg-blue-100 border-2 border-blue-500"
                        : "bg-white hover:bg-gray-100 border border-gray-200"
                    )}
                    onClick={() => setCurrentFileIndex(index)}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-1">
                        {index === currentFileIndex ? (
                          <Play className="h-5 w-5 text-blue-600" />
                        ) : (
                          <div className="h-5 w-5 rounded-full border-2 border-gray-300" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {getFileIcon(file)}
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {index + 1}. {file.display_title || file.file_name.replace(/\.[^/.]+$/, "")}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <span className="capitalize bg-gray-200 px-2 py-0.5 rounded">
                            {file.file_type || 'file'}
                          </span>
                          {file.duration_minutes && (
                            <span>{formatDuration(file.duration_minutes)}</span>
                          )}
                          {file.file_size_mb && (
                            <span>{file.file_size_mb.toFixed(1)} MB</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};