import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  Users,
  Calendar,
  X,
  ExternalLink
} from 'lucide-react';
import { ProductWithDetails, ProductFile } from '@/services/products';
import { formatCurrency } from '@/lib/utils';
import { ProductContentPreview } from './ProductContentPreview';

interface ProductPreviewModalProps {
  open: boolean;
  onClose: () => void;
  product: ProductWithDetails;
  productFiles?: ProductFile[];
  onPurchase?: () => void;
  isPurchased?: boolean;
}

export const ProductPreviewModal: React.FC<ProductPreviewModalProps> = ({
  open,
  onClose,
  product,
  productFiles = [],
  onPurchase,
  isPurchased = false,
}) => {
  const [currentPreviewIndex, setCurrentPreviewIndex] = useState(0);
  
  const formatDuration = (minutes: number | null) => {
    if (!minutes) return '';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  const handlePurchaseClick = () => {
    onClose();
    onPurchase?.();
  };

  const renderPreviewContent = () => {
    const isConsultation = product.product_type === 'consultation';
    
    if (isConsultation) {
      return (
        <div className="space-y-6">
          {/* Consultation Preview Header */}
          <div className="text-center bg-gradient-to-br from-green-50 to-emerald-50 p-8 rounded-2xl border border-green-100">
            <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Users className="h-8 w-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">1-on-1 Expert Consultation</h2>
            <p className="text-green-700 font-medium">with {product.expert?.first_name}</p>
            <div className="mt-4 flex items-center justify-center gap-4 text-sm text-gray-600">
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4 text-green-600" />
                <span>{formatDuration(product.duration_minutes)}</span>
              </div>
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4 text-green-600" />
                <span>Schedule within 24hrs</span>
              </div>
            </div>
          </div>

          {/* What You'll Experience */}
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <h3 className="font-semibold text-lg mb-4 text-gray-900">What You'll Get</h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-gray-900">Personalized Guidance</p>
                    <p className="text-sm text-gray-600">Expert advice tailored to your specific situation</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-gray-900">Actionable Plan</p>
                    <p className="text-sm text-gray-600">Clear next steps and recommendations</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-gray-900">Session Recording</p>
                    <p className="text-sm text-gray-600">Lifetime access to your consultation</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-gray-900">Follow-up Resources</p>
                    <p className="text-sm text-gray-600">Additional materials and references</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
              <h3 className="font-semibold text-lg mb-4 text-blue-900">How It Works</h3>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">1</div>
                  <div>
                    <p className="font-medium text-blue-900">Purchase & Schedule</p>
                    <p className="text-sm text-blue-700">Book your consultation time</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">2</div>
                  <div>
                    <p className="font-medium text-blue-900">Expert Contact</p>
                    <p className="text-sm text-blue-700">Receive meeting details within 24hrs</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">3</div>
                  <div>
                    <p className="font-medium text-blue-900">Your Session</p>
                    <p className="text-sm text-blue-700">Get personalized guidance</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">4</div>
                  <div>
                    <p className="font-medium text-blue-900">Follow-up</p>
                    <p className="text-sm text-blue-700">Receive recording and resources</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sample Topics */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-6">
            <h3 className="font-semibold text-lg mb-4 text-gray-900">Sample Discussion Topics</h3>
            <div className="grid md:grid-cols-2 gap-3">
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <div className="w-2 h-2 bg-blue-600 rounded-full" />
                <span>Strategy development and planning</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <div className="w-2 h-2 bg-blue-600 rounded-full" />
                <span>Problem-solving approaches</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <div className="w-2 h-2 bg-blue-600 rounded-full" />
                <span>Best practices and recommendations</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <div className="w-2 h-2 bg-blue-600 rounded-full" />
                <span>Implementation guidance</span>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // For non-consultation products, show content preview
    return (
      <div className="space-y-6">
        {/* Preview Header with Product Thumbnail */}
        <div className="text-center bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-xl border border-blue-100">
          <div className="w-24 h-24 mx-auto mb-4 rounded-xl overflow-hidden shadow-lg">
            {product.thumbnail_url && product.thumbnail_url.trim() && !product.thumbnail_url.includes('placeholder') ? (
              <img
                src={product.thumbnail_url}
                alt={product.title}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                  if (fallback) fallback.style.display = 'flex';
                }}
              />
            ) : null}
            
            {/* Fallback icon when no thumbnail */}
            <div 
              className="w-full h-full bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center"
              style={{ display: (!product.thumbnail_url || product.thumbnail_url.includes('placeholder')) ? 'flex' : 'none' }}
            >
              <Eye className="h-8 w-8 text-white" />
            </div>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">Content Preview</h3>
          <p className="text-sm text-blue-700">Get a glimpse of what's included</p>
        </div>

        {/* Content Preview */}
        <ProductContentPreview
          product={product}
          productFiles={productFiles}
          onPurchase={handlePurchaseClick}
          onPreview={() => {}} // Prevent recursive calls
          isPurchased={isPurchased}
          showPreviewButton={false} // Don't show preview button since we're already in preview modal
        />

        {/* Locked Content Notice */}
        {!isPurchased && (
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4 text-center">
            <Lock className="h-8 w-8 text-amber-600 mx-auto mb-2" />
            <p className="text-sm font-medium text-amber-800 mb-1">
              Preview shows limited content
            </p>
            <p className="text-xs text-amber-700">
              Purchase to unlock full access to all files and content
            </p>
          </div>
        )}
      </div>
    );
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] p-0 overflow-y-auto">
        <DialogHeader className="px-4 py-3 border-b bg-white">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0 pr-4">
              <DialogTitle className="text-lg font-bold text-gray-900 mb-1 line-clamp-2">
                {product.title}
              </DialogTitle>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                {product.expert && (
                  <span>by {product.expert.first_name}</span>
                )}
                <Badge variant="outline" className="capitalize text-xs">
                  {product.product_type === 'consultation' ? 'Consultation' : product.product_type}
                </Badge>
                <span className="font-semibold text-base text-blue-600">
                  {formatCurrency(product.price)}
                </span>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="flex-shrink-0 h-8 w-8 rounded-full hover:bg-gray-100"
              aria-label="Close preview"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="p-4">
          {renderPreviewContent()}
        </div>

        {/* Footer Actions */}
        {!isPurchased && (
          <div className="px-4 py-3 border-t bg-gray-50 flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Ready to get started?</p>
              <p className="text-lg font-bold text-gray-900">{formatCurrency(product.price)}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose} size="sm">
                Maybe Later
              </Button>
              <Button onClick={handlePurchaseClick} className="bg-blue-600 hover:bg-blue-700" size="sm">
                Purchase Now
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};