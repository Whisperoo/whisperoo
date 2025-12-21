import React, { useEffect, useState } from 'react';
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe, StripeElementsOptions } from '@stripe/stripe-js';
import { StripeCheckoutForm } from './StripeCheckoutForm';
import { useStripePayment } from '@/hooks/useStripePayment';
import { Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

const stripePromise = loadStripe(
  import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || ''
);

interface StripeCheckoutProps {
  productId: string;
  productTitle: string;
  amount: number;
  onSuccess: (purchaseId: string) => void;
  onError: (error: string) => void;
  onCancel: () => void;
}

export const StripeCheckout: React.FC<StripeCheckoutProps> = ({
  productId,
  productTitle,
  amount,
  onSuccess,
  onError,
  onCancel,
}) => {
  const { createPaymentIntent, waitForPaymentConfirmation, isLoading } = useStripePayment();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [purchaseId, setPurchaseId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);

  useEffect(() => {
    const initializePayment = async () => {
      const result = await createPaymentIntent(productId);
      
      if (result) {
        setClientSecret(result.clientSecret);
        setPurchaseId(result.purchaseId);
      } else {
        setError('Failed to initialize payment. Please try again.');
      }
    };

    initializePayment();
  }, [productId]);

  const handlePaymentSuccess = async () => {
    if (!purchaseId) return;

    setIsConfirming(true);

    const confirmed = await waitForPaymentConfirmation(purchaseId);

    setIsConfirming(false);

    if (confirmed) {
      onSuccess(purchaseId);
    } else {
      onSuccess(purchaseId);
    }
  };

  const handlePaymentError = (errorMessage: string) => {
    setError(errorMessage);
    onError(errorMessage);
  };

  const elementsOptions: StripeElementsOptions = {
    clientSecret: clientSecret || undefined,
    appearance: {
      theme: 'stripe',
      variables: {
        colorPrimary: '#2563eb',
        colorBackground: '#ffffff',
        colorText: '#1f2937',
        colorDanger: '#ef4444',
        fontFamily: 'system-ui, sans-serif',
        borderRadius: '8px',
      },
    },
  };

  if (isLoading || !clientSecret) {
    return (
      <div className="text-center py-12">
        <Loader2 className="h-12 w-12 animate-spin mx-auto text-blue-600 mb-4" />
        <h3 className="text-lg font-semibold mb-2">Initializing Payment</h3>
        <p className="text-gray-600">Please wait a moment...</p>
      </div>
    );
  }

  if (isConfirming) {
    return (
      <div className="text-center py-12">
        <Loader2 className="h-12 w-12 animate-spin mx-auto text-blue-600 mb-4" />
        <h3 className="text-lg font-semibold mb-2">Confirming Payment</h3>
        <p className="text-gray-600">Please don't close this window...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertCircle className="w-8 h-8 text-red-600" />
        </div>
        <h3 className="text-xl font-semibold mb-2">Payment Error</h3>
        <p className="text-gray-600 mb-6">{error}</p>
        <div className="space-y-3">
          <Button 
            onClick={() => window.location.reload()}
            className="w-full"
          >
            Try Again
          </Button>
          <Button variant="outline" onClick={onCancel} className="w-full">
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="py-4">
      {clientSecret ? (
        <Elements stripe={stripePromise} options={elementsOptions}>
          <StripeCheckoutForm
            amount={amount}
            productTitle={productTitle}
            onSuccess={handlePaymentSuccess}
            onError={handlePaymentError}
            purchaseId={purchaseId!}
          />
        </Elements>
      ) : (
        <div className="text-center py-12">
          <Loader2 className="h-12 w-12 animate-spin mx-auto text-blue-600 mb-4" />
          <h3 className="text-lg font-semibold mb-2">Setting up payment...</h3>
        </div>
      )}

      <div className="mt-4">
        <Button
          variant="ghost"
          onClick={onCancel}
          className="w-full"
        >
          Cancel Payment
        </Button>
      </div>
    </div>
  );
};