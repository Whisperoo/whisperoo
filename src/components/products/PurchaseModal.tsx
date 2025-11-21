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
import { useAuth } from '@/contexts/AuthContext';
import { PaymentForm } from './PaymentForm';
import { usePayments } from '@/hooks/usePayments';
import { supabase } from '@/lib/supabase';

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
  const { user, profile } = useAuth();
  const { createPurchaseAsync, isCreatingPurchase } = usePayments();
  const [purchaseState, setPurchaseState] = useState<PurchaseState>({ step: 'details' });
  const navigate = useNavigate();

  const handleConsultationBooking = async () => {
    if (!user || !product) return;

    setPurchaseState({ step: 'processing' });

    try {
      // Create consultation booking directly without payment
      const { data: purchase, error: purchaseError } = await supabase
        .from('purchases')
        .insert({
          user_id: user.id,
          product_id: product.id,
          expert_id: product.expert_id,
          amount: product.price, // Record actual consultation rate for reference
          currency: 'USD',
          payment_method: 'arranged_separately',
          status: 'completed',
          purchased_at: new Date().toISOString(),
          metadata: {
            booking_type: 'consultation',
            payment_status: 'arranged_separately',
            consultation_rate: product.price
          }
        })
        .select('id')
        .single();

      if (purchaseError) {
        console.error('Database error creating consultation booking:', purchaseError);
        throw new Error('Failed to create consultation booking');
      }

      setPurchaseState({
        step: 'success',
        purchaseId: purchase.id
      });

      // Navigate to success page after a brief delay
      setTimeout(() => {
        onPurchaseSuccess?.(purchase.id);
        onClose();
        navigate(`/purchase-success/${product.id}`, {
          state: { purchaseId: purchase.id }
        });
      }, 1500);

    } catch (error: unknown) {
      console.error('Consultation booking error:', error);
      setPurchaseState({
        step: 'error',
        error: (error as Error)?.message || 'Failed to book consultation. Please try again.',
      });
    }
  };

  const handlePaymentSubmit = async (paymentData: {
    email: string;
    paymentMethod: 'card';
    cardNumber: string;
    expiryDate: string;
    cvc: string;
    nameOnCard: string;
    billingAddress: {
      line1: string;
      city: string;
      state: string;
      postalCode: string;
      country: string;
    };
  }) => {
    if (!user || !product) return;

    setPurchaseState({ step: 'processing' });

    try {
      const result = await createPurchaseAsync({
        product,
        paymentData,
      });

      if (result.success && result.purchaseId) {
        setPurchaseState({
          step: 'success',
          purchaseId: result.purchaseId
        });

        // Navigate to success page after a brief delay
        setTimeout(() => {
          onPurchaseSuccess?.(result.purchaseId!);
          onClose();
          navigate(`/purchase-success/${product.id}`, {
            state: { purchaseId: result.purchaseId }
          });
        }, 1500);
      } else {
        setPurchaseState({
          step: 'error',
          error: result.error || 'Payment processing failed. Please try again.',
        });
      }

    } catch (error: unknown) {
      console.error('Payment processing error:', error);
      setPurchaseState({
        step: 'error',
        error: (error as Error)?.message || 'Payment processing failed. Please try again.',
      });
    }
  };

  const handleClose = () => {
    if (purchaseState.step !== 'processing') {
      setPurchaseState({ step: 'details' });
      onClose();
    }
  };

  const isConsultation = product.product_type === 'consultation';
  // All consultations bypass payment regardless of price - payment arranged separately with expert
  const shouldBypassPayment = isConsultation;

  const renderContent = () => {
    switch (purchaseState.step) {
      case 'details':
        return (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                <CreditCard className="h-6 w-6 text-blue-600" />
                {isConsultation ? 'Book Your Consultation' : 'Complete Your Purchase'}
              </DialogTitle>
              <DialogDescription>
                {isConsultation
                  ? `You're about to book a consultation with ${product.expert?.first_name || 'this expert'}`
                  : `You're about to purchase ${product.title}`
                }
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

              {/* Pricing Breakdown - Only show for non-consultation products */}
              {!isConsultation && (
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
              )}

              {/* Consultation Info - All consultations bypass payment */}
              {isConsultation && (
                <div className="bg-blue-50 rounded-lg p-4">
                  <div className="flex items-center gap-3 text-blue-800">
                    <Shield className="h-5 w-5" />
                    <div>
                      <p className="font-medium">Book Consultation</p>
                      <p className="text-sm">Payment will be arranged directly with the expert. They will contact you within 24 hours to schedule your session.</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Security Notice - Only for non-consultation products */}
              {!isConsultation && (
                <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                  <Shield className="h-5 w-5 text-green-600" />
                  <div className="text-sm text-green-800">
                    <p className="font-medium">Secure Payment</p>
                    <p>Your payment information is encrypted and secure.</p>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <Button variant="outline" onClick={handleClose} className="flex-1">
                  Cancel
                </Button>
                <Button
                  onClick={shouldBypassPayment ? handleConsultationBooking : () => setPurchaseState({ step: 'payment' })}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  {shouldBypassPayment ? 'Book Consultation' : 'Continue to Payment'}
                </Button>
              </div>
            </div>
          </>
        );

      case 'payment':
        return (
          <>
            <DialogHeader>
              <DialogTitle>Payment Information</DialogTitle>
              <DialogDescription>
                Enter your payment details to complete the purchase
              </DialogDescription>
            </DialogHeader>

            <PaymentForm
              onSubmit={handlePaymentSubmit}
              onCancel={() => setPurchaseState({ step: 'details' })}
              product={product}
              defaultEmail={profile?.email || ''}
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
              {isConsultation ? 'Consultation Booked!' : 'Purchase Successful!'}
            </h3>
            <p className="text-gray-600 mb-6">
              {isConsultation
                ? 'Your consultation has been booked. The expert will contact you within 24 hours.'
                : 'Redirecting you to view your new purchase...'
              }
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