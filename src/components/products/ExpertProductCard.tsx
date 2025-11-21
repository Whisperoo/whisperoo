import React, { useState } from 'react';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Star, Video, FileText, Clock, FileIcon, File, Play, Users } from 'lucide-react';
import { ProductWithDetails } from '@/services/products';
import { formatCurrency } from '@/lib/utils';
import { PurchaseModal } from './PurchaseModal';
import { useAuth } from '@/contexts/AuthContext';

interface ExpertProductCardProps {
  product: ProductWithDetails;
  onView?: () => void;
}

export const ExpertProductCard: React.FC<ExpertProductCardProps> = ({
  product,
  onView,
}) => {
  const { user } = useAuth();
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);

  const handlePurchaseClick = () => {
    if (!user) {
      console.log('User must be logged in to purchase');
      return;
    }
    setShowPurchaseModal(true);
  };

  const handlePurchaseSuccess = (purchaseId: string) => {
    setShowPurchaseModal(false);
    console.log('Purchase completed:', purchaseId);
  };

  const formatFileSize = (mb: number | null) => {
    if (!mb) return '';
    if (mb < 1) return `${Math.round(mb * 1024)} KB`;
    return `${mb.toFixed(1)} MB`;
  };

  const formatDuration = (minutes: number | null) => {
    if (!minutes) return '';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  return (
    <Card
      className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md active:shadow-lg active:scale-[0.98] transition-all duration-200 flex flex-col h-full cursor-pointer group touch-manipulation"
      onClick={onView}
    >
      {/* Enhanced Thumbnail Design */}
      <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-slate-50 to-slate-100">
        {product.thumbnail_url && product.thumbnail_url.trim() && !product.thumbnail_url.includes('placeholder') ? (
          <div className="relative group">
            <img
              src={product.thumbnail_url}
              alt={product.title}
              className="w-full h-full object-cover transition-transform group-hover:scale-105"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                if (fallback) fallback.style.display = 'flex';
              }}
            />
            
            {/* Hover overlay */}
            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity" />
            
            {/* Fallback that shows when image fails to load */}
            <div 
              className="absolute inset-0 w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100"
              style={{ display: 'none' }}
            >
              <div className="flex flex-col items-center">
                {product.product_type === 'consultation' && product.expert ? (
                  /* Show expert's profile image for consultations */
                  <div className="w-16 h-16 rounded-full overflow-hidden shadow-lg border-4 border-green-500">
                    <Avatar className="w-full h-full">
                      <AvatarImage src={product.expert.profile_image_url || undefined} />
                      <AvatarFallback className="bg-gradient-to-br from-green-500 to-green-600 text-white text-lg font-semibold">
                        {product.expert.first_name?.[0] || 'E'}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                ) : (
                  /* Default icon for other product types */
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg ${
                    product.product_type === 'video' 
                      ? 'bg-gradient-to-br from-red-500 to-red-600' 
                      : 'bg-gradient-to-br from-blue-500 to-blue-600'
                  }`}>
                    {product.product_type === 'video' ? (
                      <Play className="h-8 w-8 text-white ml-1" />
                    ) : (
                      <File className="h-8 w-8 text-white" />
                    )}
                  </div>
                )}
                
                {/* Show product type text only for non-consultation products */}
                {product.product_type !== 'consultation' && (
                  <p className="text-sm font-medium text-gray-600 mt-2 capitalize">
                    {product.product_type}
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Professional Fallback Graphics */
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 group hover:from-blue-100 hover:to-indigo-200 transition-colors">
            <div className="flex flex-col items-center">
              {product.product_type === 'consultation' && product.expert ? (
                /* Show expert's profile image for consultations */
                <div className="w-16 h-16 rounded-full overflow-hidden shadow-lg transition-transform group-hover:scale-110 border-4 border-green-500">
                  <Avatar className="w-full h-full">
                    <AvatarImage src={product.expert.profile_image_url || undefined} />
                    <AvatarFallback className="bg-gradient-to-br from-green-500 to-green-600 text-white text-lg font-semibold">
                      {product.expert.first_name?.[0] || 'E'}
                    </AvatarFallback>
                  </Avatar>
                </div>
              ) : (
                /* Default icon for other product types */
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg transition-transform group-hover:scale-110 ${
                  product.product_type === 'video' 
                    ? 'bg-gradient-to-br from-red-500 to-red-600' 
                    : 'bg-gradient-to-br from-blue-500 to-blue-600'
                }`}>
                  {product.product_type === 'video' ? (
                    <Play className="h-8 w-8 text-white ml-1" />
                  ) : (
                    <File className="h-8 w-8 text-white" />
                  )}
                </div>
              )}
              
              {/* Show product type text only for non-consultation products */}
              {product.product_type !== 'consultation' && (
                <p className="text-sm font-medium text-gray-600 mt-2 capitalize transition-colors group-hover:text-gray-700">
                  {product.product_type}
                </p>
              )}
            </div>
          </div>
        )}
        
        {/* Product Type Badge */}
        <Badge className="absolute top-3 left-3 capitalize bg-white/90 text-gray-800 backdrop-blur-sm">
          {product.product_type === 'consultation' ? 'Consultation' : product.product_type}
        </Badge>
        
        {/* Course badge */}
        {product.has_multiple_files && product.total_files_count && (
          <Badge className="absolute top-3 right-3 bg-blue-600 text-white">
            {product.total_files_count} files
          </Badge>
        )}
        
        {/* Price badge for featured products */}
        {product.price === 0 && (
          <Badge className="absolute bottom-3 left-3 bg-green-600 text-white">
            Free
          </Badge>
        )}
      </div>

      <CardContent className="p-6 flex-1 flex flex-col">
        <div className="flex-1">
          <h3 className="font-semibold text-lg text-gray-900 mb-2 line-clamp-2 group-hover:text-blue-600 group-active:text-blue-700 transition-colors">
            {product.title || 'Untitled Product'}
          </h3>
          
          {/* Expert Info */}
          {product.expert && (
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
              <Avatar className="h-6 w-6">
                <AvatarImage src={product.expert.profile_image_url || undefined} />
                <AvatarFallback className="text-xs bg-blue-100 text-blue-600 font-medium">
                  {product.expert.first_name?.[0] || 'E'}
                </AvatarFallback>
              </Avatar>
              <span>{product.expert.first_name || 'Expert'}</span>
            </div>
          )}

          {product.description && product.description.trim() && product.description !== 'testtestesese' && (
            <p className="text-sm text-gray-600 line-clamp-3 mb-4 leading-relaxed">
              {product.description}
            </p>
          )}

          {/* Metadata - Clean horizontal layout */}
          <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
            {/* File Count for multiple files */}
            {product.has_multiple_files && product.total_files_count && (
              <div className="flex items-center gap-1">
                <FileIcon className="h-4 w-4" />
                <span>{product.total_files_count} files</span>
              </div>
            )}

            {/* File Size */}
            {product.file_size_mb && !product.has_multiple_files && (
              <div className="flex items-center gap-1">
                <FileIcon className="h-4 w-4" />
                <span>{formatFileSize(product.file_size_mb)}</span>
              </div>
            )}

            {/* Duration for videos */}
            {product.product_type === 'video' && product.duration_minutes && (
              <div className="flex items-center gap-1 text-blue-600">
                <Clock className="h-4 w-4" />
                <span>{formatDuration(product.duration_minutes)}</span>
              </div>
            )}

            {/* Page count for documents */}
            {product.product_type === 'document' && product.page_count && (
              <div className="flex items-center gap-1 text-blue-600">
                <FileText className="h-4 w-4" />
                <span>{product.page_count} pages</span>
              </div>
            )}

            {/* Content type badge */}
            {product.content_type && product.content_type !== 'single' && (
              <Badge variant="secondary" className="text-xs">
                {product.content_type}
              </Badge>
            )}
          </div>
        </div>

        {/* Price and Purchase Button */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-100">
          <div>
            <div className="text-xl font-bold text-gray-900">
              {formatCurrency(product.price)}
            </div>
            <span className="text-xs text-gray-500">One-time purchase</span>
          </div>
          
          <Button
            onClick={(e) => {
              e.stopPropagation(); // Prevent card click when clicking purchase button
              handlePurchaseClick();
            }}
            className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white px-6 font-medium rounded-lg h-10 min-h-[44px] touch-manipulation"
          >
            Purchase
          </Button>
        </div>
      </CardContent>

      {/* Purchase Modal */}
      <PurchaseModal
        isOpen={showPurchaseModal}
        onClose={() => setShowPurchaseModal(false)}
        product={product}
        onPurchaseSuccess={handlePurchaseSuccess}
      />
    </Card>
  );
};