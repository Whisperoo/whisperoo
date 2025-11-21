import React from 'react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle2, XCircle, Loader2, RefreshCw, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatFileSize } from '@/config/upload';

export interface UploadFileStatus {
  id: string;
  fileName: string;
  fileSize: number;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error' | 'retrying';
  error?: string;
  retryAttempt?: number;
  maxRetries?: number;
}

interface UploadProgressProps {
  files: UploadFileStatus[];
  onRetry?: (fileId: string) => void;
  onCancel?: (fileId: string) => void;
  className?: string;
}

export const UploadProgress: React.FC<UploadProgressProps> = ({
  files,
  onRetry,
  onCancel,
  className,
}) => {
  const getStatusIcon = (status: UploadFileStatus['status']) => {
    switch (status) {
      case 'pending':
        return <div className="w-5 h-5 rounded-full border-2 border-gray-300" />;
      case 'uploading':
        return <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />;
      case 'retrying':
        return <RefreshCw className="w-5 h-5 text-yellow-600 animate-spin" />;
      case 'completed':
        return <CheckCircle2 className="w-5 h-5 text-green-600" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-600" />;
      default:
        return <AlertCircle className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusBadge = (file: UploadFileStatus) => {
    switch (file.status) {
      case 'pending':
        return <Badge variant="outline">Pending</Badge>;
      case 'uploading':
        return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">Uploading</Badge>;
      case 'retrying':
        return (
          <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">
            Retry {file.retryAttempt || 1}/{file.maxRetries || 3}
          </Badge>
        );
      case 'completed':
        return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Completed</Badge>;
      case 'error':
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const getProgressColor = (status: UploadFileStatus['status']) => {
    switch (status) {
      case 'uploading':
        return 'bg-blue-600';
      case 'retrying':
        return 'bg-yellow-600';
      case 'completed':
        return 'bg-green-600';
      case 'error':
        return 'bg-red-600';
      default:
        return 'bg-gray-400';
    }
  };

  if (files.length === 0) return null;

  const totalFiles = files.length;
  const completedFiles = files.filter(f => f.status === 'completed').length;
  const failedFiles = files.filter(f => f.status === 'error').length;
  const uploadingFiles = files.filter(f => f.status === 'uploading' || f.status === 'retrying').length;

  const overallProgress = totalFiles > 0 ? (completedFiles / totalFiles) * 100 : 0;

  return (
    <Card className={cn("w-full", className)}>
      <CardContent className="p-4">
        {/* Overall Progress */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-sm font-medium">Upload Progress</h3>
            <span className="text-xs text-gray-500">
              {completedFiles}/{totalFiles} files completed
            </span>
          </div>
          <Progress value={overallProgress} className="h-2" />
          
          {/* Summary Stats */}
          <div className="flex gap-4 mt-2 text-xs text-gray-600">
            {uploadingFiles > 0 && (
              <span className="flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                {uploadingFiles} uploading
              </span>
            )}
            {completedFiles > 0 && (
              <span className="flex items-center gap-1 text-green-600">
                <CheckCircle2 className="w-3 h-3" />
                {completedFiles} completed
              </span>
            )}
            {failedFiles > 0 && (
              <span className="flex items-center gap-1 text-red-600">
                <XCircle className="w-3 h-3" />
                {failedFiles} failed
              </span>
            )}
          </div>
        </div>

        {/* Individual File Progress */}
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {files.map((file) => (
            <div key={file.id} className="flex items-center gap-3 p-2 rounded-lg bg-gray-50">
              {/* Status Icon */}
              <div className="flex-shrink-0">
                {getStatusIcon(file.status)}
              </div>

              {/* File Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {file.fileName}
                  </p>
                  {getStatusBadge(file)}
                </div>
                
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>{formatFileSize(file.fileSize)}</span>
                  {file.status === 'uploading' || file.status === 'retrying' ? (
                    <span>{Math.round(file.progress)}%</span>
                  ) : null}
                </div>

                {/* Progress Bar for Individual File */}
                {(file.status === 'uploading' || file.status === 'retrying') && (
                  <Progress 
                    value={file.progress} 
                    className={cn("h-1 mt-1", `[&>div]:${getProgressColor(file.status)}`)}
                  />
                )}

                {/* Error Message */}
                {file.error && file.status === 'error' && (
                  <p className="text-xs text-red-600 mt-1">{file.error}</p>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1">
                {file.status === 'error' && onRetry && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onRetry(file.id)}
                    className="h-6 w-6 p-0"
                    title="Retry upload"
                  >
                    <RefreshCw className="h-3 w-3" />
                  </Button>
                )}
                
                {(file.status === 'pending' || file.status === 'error') && onCancel && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onCancel(file.id)}
                    className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                    title="Cancel upload"
                  >
                    <XCircle className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};