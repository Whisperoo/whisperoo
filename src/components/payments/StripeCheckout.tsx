import React, { useEffect, useState } from "react";
import { Elements } from "@stripe/react-stripe-js";
import { loadStripe, StripeElementsOptions } from "@stripe/stripe-js";
import { StripeCheckoutForm } from "./StripeCheckoutForm";
import { useStripePayment } from "@/hooks/useStripePayment";
import { Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { productService } from "@/services/products";
import { toast } from "@/hooks/use-toast";

const stripePromise = loadStripe(
  import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || "",
);

interface StripeCheckoutProps {
  productId: string;
  productTitle: string;
  amount: number;
  discountCode?: string;
  giftInfo?: { recipientEmail: string; recipientName: string; giftMessage: string };
  onSuccess: (purchaseId: string) => void;
  onError: (error: string) => void;
  onCancel: () => void;
}

export const StripeCheckout: React.FC<StripeCheckoutProps> = ({
  productId,
  productTitle,
  amount,
  discountCode,
  giftInfo,
  onSuccess,
  onError,
  onCancel,
}) => {
  const { createPaymentIntent, waitForPaymentConfirmation, isLoading } =
    useStripePayment();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [purchaseId, setPurchaseId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [promoInput, setPromoInput] = useState(discountCode || "");
  const [appliedDiscountCode, setAppliedDiscountCode] = useState<string | undefined>(discountCode);
  const [promoMessage, setPromoMessage] = useState<string | null>(null);
  const [validatingPromo, setValidatingPromo] = useState(false);
  const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || "";

  useEffect(() => {
    const initializePayment = async () => {
      setIsInitializing(true);
      setError(null);

      // Add a timeout to prevent infinite spinner
      const timeoutId = setTimeout(() => {
        setIsInitializing(false);
        if (!clientSecret) {
          setError("Payment initialization timed out. The payment service may be temporarily unavailable. Please try again.");
        }
      }, 20000);

      try {
        const result = await createPaymentIntent(productId, appliedDiscountCode, giftInfo);

        clearTimeout(timeoutId);

        if (result) {
          // Handle free purchases (100% discount)
          if (result.paymentIntentId === 'free' && !result.clientSecret) {
            onSuccess(result.purchaseId);
            return;
          }
          const normalizedClientSecret = (result.clientSecret || "").trim();
          if (!normalizedClientSecret) {
            setError("Payment setup failed: invalid client secret returned from server.");
            setIsInitializing(false);
            return;
          }
          const isPkLive = publishableKey.startsWith('pk_live_');
          const isPkTest = publishableKey.startsWith('pk_test_');
          if (result.stripeMode === 'live' && isPkTest) {
            setError("Stripe mode mismatch: server is LIVE but frontend key is TEST. Set VITE_STRIPE_PUBLISHABLE_KEY to a live key.");
            setIsInitializing(false);
            return;
          }
          if (result.stripeMode === 'test' && isPkLive) {
            setError("Stripe mode mismatch: server is TEST but frontend key is LIVE. Set VITE_STRIPE_PUBLISHABLE_KEY to a test key.");
            setIsInitializing(false);
            return;
          }
          setClientSecret(normalizedClientSecret);
          setPurchaseId(result.purchaseId);
        } else {
          setError("Failed to initialize payment. The payment service may be temporarily unavailable. Please try again.");
        }
      } catch (err) {
        clearTimeout(timeoutId);
        console.error('Payment initialization error:', err);
        setError(err instanceof Error ? err.message : "An unexpected error occurred while initializing payment.");
      } finally {
        setIsInitializing(false);
      }
    };

    // Re-initialize payment intent if discount code or gift info changes
    initializePayment();
  }, [productId, appliedDiscountCode, giftInfo, onSuccess, publishableKey]);

  const applyPromoCode = async () => {
    const code = promoInput.trim().toUpperCase();
    if (!code) return;
    setValidatingPromo(true);
    setPromoMessage(null);
    try {
      const result = await productService.validateDiscountCode(code);
      if (!result.isValid) {
        setPromoMessage(result.error || "Invalid discount code");
        return;
      }
      setAppliedDiscountCode(code);
      setPromoMessage(`Applied ${code}`);
      setClientSecret(null);
      setPurchaseId(null);
      toast({ title: "Promo applied", description: `${code} has been applied to this purchase.` });
    } catch (e) {
      setPromoMessage("Failed to validate promo code.");
    } finally {
      setValidatingPromo(false);
    }
  };

  const removePromoCode = () => {
    setAppliedDiscountCode(undefined);
    setPromoInput("");
    setPromoMessage("Promo removed");
    setClientSecret(null);
    setPurchaseId(null);
  };

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
      theme: "stripe",
      variables: {
        colorPrimary: "#2563eb",
        colorBackground: "#ffffff",
        colorText: "#1f2937",
        colorDanger: "#ef4444",
        fontFamily: "system-ui, sans-serif",
        borderRadius: "8px",
      },
    },
  };

  if (isLoading || isInitializing || !clientSecret) {
    // Show error state if initialization failed (not just loading)
    if (error) {
      return (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h3 className="text-xl font-semibold mb-2">Payment Error</h3>
          <p className="text-gray-600 mb-6">{error}</p>
          <div className="space-y-3">
            <Button onClick={() => window.location.reload()} className="w-full gap-2">
              <RefreshCw className="h-4 w-4" />
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
          <Button onClick={() => window.location.reload()} className="w-full">
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
      <div className="mb-4 border border-gray-200 rounded-lg p-3 bg-gray-50">
        <div className="flex items-center gap-2">
          <input
            value={promoInput}
            onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
            placeholder="Promo code"
            className="flex-1 border rounded-md px-3 py-2 text-sm bg-white"
          />
          {appliedDiscountCode ? (
            <Button type="button" variant="outline" onClick={removePromoCode}>
              Remove
            </Button>
          ) : (
            <Button type="button" onClick={applyPromoCode} disabled={validatingPromo || !promoInput.trim()}>
              {validatingPromo ? "Checking..." : "Apply"}
            </Button>
          )}
        </div>
        {(promoMessage || appliedDiscountCode) && (
          <p className="mt-2 text-xs text-gray-600">
            {promoMessage || `Applied: ${appliedDiscountCode}`}
          </p>
        )}
      </div>
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
        <Button variant="ghost" onClick={onCancel} className="w-full">
          Cancel Payment
        </Button>
      </div>
    </div>
  );
};
