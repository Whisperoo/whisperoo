import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Play, 
  FileText, 
  Clock, 
  Eye, 
  Lock, 
  Star,
  CheckCircle,
  Video,
  File,
  Users,
  Calendar
} from 'lucide-react';
import { ProductWithDetails, ProductFile } from '@/services/products';
import { formatCurrency } from '@/lib/utils';

interface ProductContentPreviewProps {
  product: ProductWithDetails;
  productFiles?: ProductFile[];
  onPurchase?: () => void;
  onPreview?: () => void;
  isPurchased?: boolean;
  className?: string;
  showPreviewButton?: boolean;
}

export const ProductContentPreview: React.FC<ProductContentPreviewProps> = ({
  product,
  productFiles = [],
  onPurchase,
  onPreview,
  isPurchased = false,
  className = '',
  showPreviewButton = true,
}) => {
  const isConsultation = product.product_type === 'consultation';
  const isCourse = productFiles.length > 1 || product.has_multiple_files;
  const totalFiles = productFiles.length || product.total_files_count || 1;
  
  const formatDuration = (minutes: number | null) => {
    if (!minutes) return '';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  const getTotalDuration = () => {
    if (productFiles.length > 0) {
      return productFiles.reduce((total, file) => total + (file.duration_minutes || 0), 0);
    }
    return product.duration_minutes || 0;
  };

  const renderConsultationPreview = () => (
    <div className="space-y-6">
      {/* Consultation Overview */}
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 rounded-lg">
              <Users className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg">1-on-1 Expert Consultation</CardTitle>
              <p className="text-sm text-blue-700">Personalized session with {product.expert?.first_name}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-600" />
              <span className="text-sm">{formatDuration(product.duration_minutes)} session</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-blue-600" />
              <span className="text-sm">Schedule within 24hrs</span>
            </div>
          </div>
          
          <div className="bg-white rounded-lg p-4">
            <h4 className="font-medium mb-3">What You'll Get:</h4>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span>Expert guidance tailored to your needs</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span>Actionable recommendations</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span>Follow-up notes and resources</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span>Lifetime access to session recording</span>
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderContentPreview = () => {
    if (isConsultation) {
      return renderConsultationPreview();
    }

    // Show preview for documents/videos
    const previewFiles = productFiles.slice(0, isPurchased ? productFiles.length : 3);
    
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">
            {isCourse ? 'Course Content' : 'Included Files'}
          </h3>
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
            {totalFiles} {totalFiles === 1 ? 'item' : 'items'}
          </Badge>
        </div>

        {/* Content Grid */}
        <div className="grid gap-3">
          {previewFiles.map((file, index) => (
            <Card 
              key={file.id} 
              className={`p-4 hover:bg-gray-50 transition-colors ${
                !isPurchased ? 'cursor-pointer' : ''
              }`}
              onClick={!isPurchased ? onPreview : undefined}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${
                  file.file_type === 'video' || file.mime_type?.startsWith('video/') 
                    ? 'bg-red-100' 
                    : 'bg-blue-100'
                }`}>
                  {file.file_type === 'video' || file.mime_type?.startsWith('video/') ? (
                    <Play className="h-4 w-4 text-red-600" />
                  ) : (
                    <FileText className="h-4 w-4 text-blue-600" />
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">
                    {file.display_title || file.file_name.replace(/\.[^/.]+$/, "")}
                  </p>
                  <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                    {file.duration_minutes && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDuration(file.duration_minutes)}
                      </span>
                    )}
                    {file.file_size_mb && (
                      <span>{file.file_size_mb < 1 ? `${Math.round(file.file_size_mb * 1024)} KB` : `${file.file_size_mb.toFixed(1)} MB`}</span>
                    )}
                  </div>
                </div>

                {!isPurchased && (
                  <Lock className="h-4 w-4 text-gray-400" />
                )}
              </div>
            </Card>
          ))}

          {/* Show "more content" teaser if not purchased */}
          {!isPurchased && productFiles.length > 3 && (
            <Card className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
              <div className="text-center">
                <Lock className="h-6 w-6 text-blue-600 mx-auto mb-2" />
                <p className="text-sm font-medium text-blue-800">
                  +{productFiles.length - 3} more {productFiles.length - 3 === 1 ? 'file' : 'files'} available after purchase
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  Unlock all content to see everything included
                </p>
              </div>
            </Card>
          )}
        </div>

        {/* Course Stats */}
        {isCourse && (
          <Card className="bg-gray-50 border-gray-200">
            <CardContent className="p-4">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-lg font-bold text-gray-900">{totalFiles}</div>
                  <div className="text-xs text-gray-500">Lessons</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-gray-900">
                    {formatDuration(getTotalDuration())}
                  </div>
                  <div className="text-xs text-gray-500">Total Duration</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-gray-900">
                    {product.average_rating ? product.average_rating.toFixed(1) : '5.0'}
                  </div>
                  <div className="text-xs text-gray-500 flex items-center justify-center gap-1">
                    <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                    Rating
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {renderContentPreview()}
      
      {/* Action Buttons */}
      {!isPurchased && (
        <div className="flex gap-3 pt-4 border-t">
          {showPreviewButton && (
            <Button 
              onClick={onPreview}
              variant="outline" 
              className="flex-1 gap-2"
            >
              <Eye className="h-4 w-4" />
              Preview Content
            </Button>
          )}
          <Button 
            onClick={onPurchase}
            className={`${showPreviewButton ? 'flex-1' : 'w-full'} bg-blue-600 hover:bg-blue-700`}
          >
            Purchase {formatCurrency(product.price)}
          </Button>
        </div>
      )}
    </div>
  );
};