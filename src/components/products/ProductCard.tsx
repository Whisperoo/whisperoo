import React, { useState } from 'react';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Star, Video, FileText, Clock, FileIcon, File, Play, Eye } from 'lucide-react';
import { ProductWithDetails, ProductFile, productService } from '@/services/products';
import { formatCurrency } from '@/lib/utils';
import { PurchaseModal } from './PurchaseModal';
import { ContentViewer } from '@/components/content/ContentViewer';
import { ProductPreviewModal } from './ProductPreviewModal';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';

interface ProductCardProps {
  product: ProductWithDetails;
  onView?: () => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onView,
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [isPurchased, setIsPurchased] = useState(false);
  const [isCheckingPurchase, setIsCheckingPurchase] = useState(false);
  const [productFiles, setProductFiles] = useState<ProductFile[]>([]);

  const isFreeProduct = product.price === 0;
  const hasContent = !!(product.primary_file_url || product.file_url);
  
  // Course detection logic - improved to detect multi-file products as courses
  const isCourse = (productFiles.length > 1) || 
    (product.has_multiple_files && product.total_files_count && product.total_files_count > 1) ||
    (product.content_type && ['bundle', 'course', 'collection'].includes(product.content_type));

  // Check if user has already saved this free content
  React.useEffect(() => {
    if (user && isFreeProduct) {
      checkSaveStatus();
    }
  }, [user, product.id, isFreeProduct]);

  // Check if user has purchased this paid product
  React.useEffect(() => {
    if (user && !isFreeProduct) {
      checkPurchaseStatus();
    }
  }, [user, product.id, isFreeProduct]);

  // Load product files if this is a multi-file product
  React.useEffect(() => {
    const loadProductFiles = async () => {
      if (product.has_multiple_files || (product.total_files_count && product.total_files_count > 1)) {
        try {
          const files = await productService.getProductFiles(product.id);
          setProductFiles(files);
        } catch (error) {
          console.error('Failed to load product files:', error);
        }
      }
    };

    loadProductFiles();
  }, [product.id, product.has_multiple_files, product.total_files_count]);

  const checkSaveStatus = async () => {
    if (!user) return;
    
    setIsCheckingStatus(true);
    try {
      const { data, error } = await supabase
        .from('purchases')
        .select('id')
        .eq('user_id', user.id)
        .eq('product_id', product.id)
        .limit(1);

      if (error) {
        console.error('Error checking save status:', error);
        return;
      }

      setIsSaved(data && data.length > 0);
    } catch (error) {
      console.error('Error checking save status:', error);
    } finally {
      setIsCheckingStatus(false);
    }
  };

  const checkPurchaseStatus = async () => {
    if (!user) return;
    
    setIsCheckingPurchase(true);
    try {
      const purchased = await productService.hasUserPurchased(user.id, product.id);
      setIsPurchased(purchased);
    } catch (error) {
      console.error('Error checking purchase status:', error);
    } finally {
      setIsCheckingPurchase(false);
    }
  };

  const handleSaveFreeContent = async () => {
    if (!user) {
      toast({
        title: "Login Required",
        description: "Please log in to save content to your library.",
        variant: "destructive",
      });
      return;
    }

    if (isSaved) {
      toast({
        title: "Already Saved",
        description: "This content is already in your My Content section.",
      });
      return;
    }

    try {
      // Save free content to user's purchases
      const { error } = await supabase
        .from('purchases')
        .insert({
          user_id: user.id,
          product_id: product.id,
          amount: 0,
          currency: 'usd',
          status: 'completed'
        });

      if (error) {
        console.error('Error saving free content:', error);
        toast({
          title: "Error",
          description: "Failed to save content. Please try again.",
          variant: "destructive",
        });
        return;
      }

      setIsSaved(true);
      toast({
        title: "Saved!",
        description: "This has been added to My Content.",
      });
    } catch (error) {
      console.error('Error saving free content:', error);
      toast({
        title: "Error",
        description: "Failed to save content. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handlePurchaseClick = () => {
    if (isFreeProduct) {
      handleSaveFreeContent();
      return;
    }

    if (!user) {
      toast({
        title: "Login Required",
        description: "Please log in to purchase this product.",
        variant: "destructive",
      });
      return;
    }
    setShowPurchaseModal(true);
  };

  const handlePurchaseSuccess = (purchaseId: string) => {
    setShowPurchaseModal(false);
    setIsPurchased(true); // Update purchase status
    console.log('Purchase completed:', purchaseId);
  };

  const handleViewContent = () => {
    if (!user) {
      toast({
        title: "Login Required",
        description: "Please log in to view content.",
        variant: "destructive",
      });
      return;
    }

    // Check if user has access to full content
    const hasFullAccess = isFreeProduct ? isSaved : isPurchased;
    
    if (hasFullAccess) {
      // Show full content viewer for purchased/saved content
      setShowPreview(true);
    } else {
      // Show preview modal for non-purchased content (no error messages)
      setShowPreviewModal(true);
    }
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
    <Card className="group hover:shadow-xl transition-all duration-300 cursor-pointer h-full flex flex-col bg-white border border-gray-200 hover:border-blue-200 rounded-xl overflow-hidden">
      {/* Thumbnail */}
      <div className="relative aspect-video overflow-hidden bg-gradient-to-br from-slate-50 to-slate-100">
        {product.thumbnail_url && product.thumbnail_url.trim() && !product.thumbnail_url.includes('placeholder') ? (
          <img
            src={product.thumbnail_url}
            alt={product.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
            onError={(e) => {
              // Hide image and show fallback if image fails to load
              e.currentTarget.style.display = 'none';
              const fallback = e.currentTarget.nextElementSibling as HTMLElement;
              if (fallback) fallback.style.display = 'flex';
            }}
          />
        ) : null}
        
        {/* Fallback Graphics - Always present but conditionally visible */}
        <div 
          className="absolute inset-0 w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100"
          style={{ display: (!product.thumbnail_url || product.thumbnail_url.includes('placeholder')) ? 'flex' : 'none' }}
        >
          {product.product_type === 'video' ? (
            <div className="flex flex-col items-center">
              <div className="relative">
                <div className="w-20 h-20 bg-gradient-to-br from-red-500 to-red-600 rounded-2xl flex items-center justify-center shadow-xl">
                  <Play className="h-10 w-10 text-white ml-1" />
                </div>
              </div>
              <p className="text-sm font-semibold text-gray-700 mt-3">Video Content</p>
            </div>
          ) : product.product_type === 'consultation' && product.expert ? (
            <div className="flex flex-col items-center">
              <div className="w-20 h-20 rounded-full overflow-hidden shadow-xl border-4 border-green-500">
                <Avatar className="w-full h-full">
                  <AvatarImage src={product.expert.profile_image_url || undefined} />
                  <AvatarFallback className="bg-gradient-to-br from-green-500 to-green-600 text-white text-xl font-bold">
                    {product.expert.first_name?.[0] || 'E'}
                  </AvatarFallback>
                </Avatar>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <div className="relative">
                <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-xl">
                  <File className="h-10 w-10 text-white" />
                </div>
              </div>
              <p className="text-sm font-semibold text-gray-700 mt-3">Document</p>
            </div>
          )}
        </div>
        {/* Product Type Badge */}
        <div className="absolute top-3 left-3 right-3 flex justify-between">
          <Badge className="capitalize bg-white/95 text-gray-800 font-medium shadow-md border border-white/50 backdrop-blur-sm">
            {isCourse ? 'Course' : product.product_type}
          </Badge>
          
          {isCourse && (
            <Badge className="bg-blue-600/95 text-white font-medium shadow-md border border-blue-700 backdrop-blur-sm">
              {productFiles.length > 0 ? productFiles.length : (product.total_files_count || 2)} lessons
            </Badge>
          )}
        </div>
      </div>

      <CardHeader className="pb-3 px-4">
        <div className="space-y-3">
          <h3 className="font-semibold text-lg line-clamp-2 text-gray-900 hover:text-blue-600 cursor-pointer transition-colors leading-tight" onClick={onView}>
            {product.title || 'Untitled Product'}
          </h3>
          
          {/* Expert Info */}
          {product.expert && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Avatar className="h-7 w-7 border border-gray-200">
                <AvatarImage src={product.expert.profile_image_url || undefined} />
                <AvatarFallback className="text-xs bg-blue-100 text-blue-600 font-medium">
                  {product.expert.first_name?.[0] || 'E'}
                </AvatarFallback>
              </Avatar>
              <span className="font-medium">{product.expert.first_name || 'Expert'}</span>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1 pb-3 px-4">
        {product.description && product.description.trim() && product.description !== 'testtestesese' && (
          <p className="text-sm text-gray-600 line-clamp-2 mb-4 leading-relaxed">
            {product.description}
          </p>
        )}

        {/* Course modules preview */}
        {isCourse && productFiles.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-medium text-gray-700 mb-2">Course Modules:</p>
            <ul className="text-xs text-gray-600 space-y-1">
              {productFiles.slice(0, 2).map((file, index) => (
                <li key={file.id} className="flex items-center">
                  <span className="w-4 h-4 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-[10px] font-medium mr-2">
                    {index + 1}
                  </span>
                  {file.display_title || file.file_name.replace(/\.[^/.]+$/, "")}
                </li>
              ))}
              {productFiles.length > 2 && (
                <li className="text-gray-500 pl-6">
                  +{productFiles.length - 2} more modules
                </li>
              )}
            </ul>
          </div>
        )}

        {/* Metadata row - inline format matching screenshot */}
        <div className="flex items-center gap-3 text-sm text-gray-600">
          {/* File Size */}
          {product.file_size_mb && (
            <div className="flex items-center gap-1">
              <FileIcon className="h-4 w-4 text-gray-400" />
              <span>{formatFileSize(product.file_size_mb)}</span>
            </div>
          )}

          {/* Duration for videos */}
          {product.product_type === 'video' && product.duration_minutes && (
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4 text-blue-500" />
              <span className="text-blue-600">{formatDuration(product.duration_minutes)}</span>
            </div>
          )}

          {/* Page count for documents */}
          {product.product_type === 'document' && product.page_count && (
            <div className="flex items-center gap-1">
              <FileText className="h-4 w-4 text-blue-500" />
              <span className="text-blue-600">{product.page_count} pages</span>
            </div>
          )}
        </div>

        {/* Rating */}
        {product.average_rating !== undefined && product.average_rating !== null && (
          <div className="flex items-center gap-1.5 mt-4">
            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
            <span className="text-sm font-semibold text-gray-800">{product.average_rating.toFixed(1)}</span>
            <span className="text-xs text-gray-500">
              ({product.total_reviews || 0} reviews)
            </span>
          </div>
        )}
      </CardContent>

      <CardFooter className="pt-4 px-4 pb-5">
        <div className="w-full">
          {/* Price Section */}
          <div className="flex items-center justify-between w-full mb-3">
            <div className="flex flex-col min-w-0">
              <div className="text-xl font-bold text-gray-900">
                {isCourse ? '' : (isFreeProduct ? 'Free' : formatCurrency(product.price))}
              </div>
              {product.price > 0 && !isFreeProduct && !(product.product_type === 'video') && !isCourse && (
                <span className="text-xs text-gray-500 leading-tight">One-time purchase</span>
              )}
            </div>
          </div>
          
          {/* Buttons Section - Full Width on Mobile */}
          <div className="flex flex-col sm:flex-row gap-2 w-full">
            {/* Preview Button - show for all products with content */}
            
            {(product.product_type === 'video' && !isFreeProduct) || isCourse ? (
              <div className="w-full text-sm text-muted-foreground py-2 px-4 text-center">
                Email contact@whisperoo.app to purchase
              </div>
            ) : (
              <Button 
                size="sm" 
                onClick={handlePurchaseClick}
                disabled={isFreeProduct && (isSaved || isCheckingStatus)}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white px-6 font-medium rounded-md h-9 whitespace-nowrap disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {isFreeProduct ? (
                  isCheckingStatus ? 'Checking...' : (isSaved ? 'Saved' : 'Save')
                ) : 'Purchase'}
              </Button>
            )}
          </div>
        </div>
      </CardFooter>

      {/* Purchase Modal */}
      <PurchaseModal
        isOpen={showPurchaseModal}
        onClose={() => setShowPurchaseModal(false)}
        product={product}
        onPurchaseSuccess={handlePurchaseSuccess}
      />

      {/* Content Preview Modal (Full Access) */}
      <ContentViewer
        open={showPreview}
        onClose={() => setShowPreview(false)}
        product={product}
      />

      {/* Product Preview Modal (Limited Access) */}
      <ProductPreviewModal
        open={showPreviewModal}
        onClose={() => setShowPreviewModal(false)}
        product={product}
        productFiles={productFiles}
        onPurchase={() => {
          setShowPreviewModal(false);
          handlePurchaseClick();
        }}
        isPurchased={isFreeProduct ? isSaved : isPurchased}
      />
    </Card>
  );
};