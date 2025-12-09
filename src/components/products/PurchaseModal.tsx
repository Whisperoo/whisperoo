import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { X, CreditCard, Shield, FileText, Video, Loader2 } from 'lucide-react';
import { ProductWithDetails } from '@/services/products';
import { formatCurrency } from '@/lib/utils';
import { StripeCheckout } from '@/components/payments/StripeCheckout';

interface PurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: ProductWithDetails;
  onPurchaseSuccess?: (purchaseId: string) => void;
}

interface PurchaseState {
  step: 'details' | 'payment' | 'processing' | 'success' | 'error';
  error?: string;
  purchaseId?: string;
}

export const PurchaseModal: React.FC<PurchaseModalProps> = ({
  isOpen,
  onClose,
  product,
  onPurchaseSuccess,
}) => {
  const [purchaseState, setPurchaseState] = useState<PurchaseState>({ step: 'details' });
  const navigate = useNavigate();

  const handlePaymentSuccess = (purchaseId: string) => {
    setPurchaseState({
      step: 'success',
      purchaseId,
    });

    // Navigate to success page after a brief delay
    setTimeout(() => {
      onPurchaseSuccess?.(purchaseId);
      onClose();
      navigate(`/purchase-success/${product.id}`, {
        state: { purchaseId },
      });
    }, 1500);
  };

  const handlePaymentError = (error: string) => {
    setPurchaseState({
      step: 'error',
      error,
    });
  };

  const handleClose = () => {
    if (purchaseState.step !== 'processing') {
      setPurchaseState({ step: 'details' });
      onClose();
    }
  };

  const renderContent = () => {
    switch (purchaseState.step) {
      case 'details':
        return (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                <CreditCard className="h-6 w-6 text-blue-600" />
                Complete Your Purchase
              </DialogTitle>
              <DialogDescription>
                You're about to purchase {product.title}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-4">
              {/* Product Summary */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex gap-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-50 to-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    {product.product_type === 'video' ? (
                      <Video className="h-8 w-8 text-blue-600" />
                    ) : (
                      <FileText className="h-8 w-8 text-blue-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-lg">{product.title}</h3>
                    {product.description && (
                      <p className="text-sm text-gray-600 line-clamp-2 mt-1">
                        {product.description}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="outline" className="capitalize">
                        {product.product_type}
                      </Badge>
                      {product.expert && (
                        <span className="text-sm text-gray-500">
                          by {product.expert.first_name}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Pricing Breakdown */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-700">{product.title}</span>
                  <span className="font-medium">{formatCurrency(product.price)}</span>
                </div>

                <Separator />

                <div className="flex justify-between items-center text-lg font-semibold">
                  <span>Total</span>
                  <span>{formatCurrency(product.price)}</span>
                </div>
              </div>

              {/* Security Notice */}
              <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                <Shield className="h-5 w-5 text-green-600" />
                <div className="text-sm text-green-800">
                  <p className="font-medium">Secure Payment</p>
                  <p>Your payment information is encrypted and secure.</p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <Button variant="outline" onClick={handleClose} className="flex-1">
                  Cancel
                </Button>
                <Button
                  onClick={() => setPurchaseState({ step: 'payment' })}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  Continue to Payment
                </Button>
              </div>
            </div>
          </>
        );

      case 'payment':
        return (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                <CreditCard className="h-6 w-6 text-blue-600" />
                Payment Information
              </DialogTitle>
              <DialogDescription>
                Complete your purchase securely with Stripe
              </DialogDescription>
            </DialogHeader>

            <StripeCheckout
              productId={product.id}
              productTitle={product.title}
              amount={product.price}
              onSuccess={handlePaymentSuccess}
              onError={handlePaymentError}
              onCancel={() => setPurchaseState({ step: 'details' })}
            />
          </>
        );

      case 'processing':
        return (
          <div className="text-center py-12">
            <Loader2 className="h-12 w-12 animate-spin mx-auto text-blue-600 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Processing Payment</h3>
            <p className="text-gray-600">Please don't close this window...</p>
          </div>
        );

      case 'success':
        return (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg
                className="w-8 h-8 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-2">
              Purchase Successful!
            </h3>
            <p className="text-gray-600 mb-6">
              Your payment has been processed successfully. Redirecting...
            </p>
            <div className="flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            </div>
          </div>
        );

      case 'error':
        return (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <X className="w-8 h-8 text-red-600" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Payment Failed</h3>
            <p className="text-gray-600 mb-6">
              {purchaseState.error || 'There was an error processing your payment.'}
            </p>
            <div className="space-y-3">
              <Button
                onClick={() => setPurchaseState({ step: 'payment' })}
                className="w-full"
              >
                Try Again
              </Button>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        {renderContent()}
      </DialogContent>
    </Dialog>
  );
};