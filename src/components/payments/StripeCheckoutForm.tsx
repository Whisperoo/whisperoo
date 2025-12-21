import React, { useState } from 'react';
import {
    PaymentElement,
    useStripe,
    useElements,
} from '@stripe/react-stripe-js';
import { Button } from '@/components/ui/button';
import { Loader2, CreditCard, Shield } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface StripeCheckoutFormProps {
    amount: number;
    productTitle: string;
    onSuccess: () => void;
    onError: (error: string) => void;
    purchaseId: string;
}

export const StripeCheckoutForm: React.FC<StripeCheckoutFormProps> = ({
    amount,
    productTitle,
    onSuccess,
    onError,
    purchaseId,
}) => {
    const stripe = useStripe();
    const elements = useElements();
    const [isProcessing, setIsProcessing] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [isPaymentElementReady, setIsPaymentElementReady] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!stripe || !elements) {
            return;
        }

        setIsProcessing(true);
        setErrorMessage(null);

        try {
            const { error: submitError } = await elements.submit();

            if (submitError) {
                throw new Error(submitError.message);
            }

            const { error } = await stripe.confirmPayment({
                elements,
                confirmParams: {
                    return_url: `${window.location.origin}/purchase-success?purchase_id=${purchaseId}`,
                },
                redirect: 'if_required',
            });

            if (error) {
                throw new Error(error.message);
            }

            onSuccess();
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Payment failed';
            setErrorMessage(message);
            onError(message);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-600">Product</span>
                    <span className="font-medium">{productTitle}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                    <span className="text-sm text-gray-600">Total</span>
                    <span className="text-xl font-bold text-gray-900">
                        {formatCurrency(amount)}
                    </span>
                </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-4">
                    <CreditCard className="h-5 w-5 text-blue-600" />
                    <h3 className="font-semibold text-gray-900">Payment Details</h3>
                </div>
                <PaymentElement
                    options={{
                        layout: 'tabs',
                        business: { name: 'Whisperoo' },
                    }}
                    onReady={() => setIsPaymentElementReady(true)}
                    onLoadError={(error) => {
                        console.error('PaymentElement load error:', error);
                        setErrorMessage('Failed to load payment form. Please refresh and try again.');
                    }}
                />
            </div>

            {errorMessage && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-sm text-red-800">{errorMessage}</p>
                </div>
            )}

            <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                <Shield className="h-5 w-5 text-green-600 flex-shrink-0" />
                <div className="text-sm text-green-800">
                    <p className="font-medium">Secure Payment</p>
                    <p className="text-xs">
                        Your payment is encrypted and processed securely by Stripe
                    </p>
                </div>
            </div>

            <Button
                type="submit"
                disabled={!stripe || !isPaymentElementReady || isProcessing}
                className="w-full bg-blue-600 hover:bg-blue-700 h-12 text-base font-semibold"
            >
                {isProcessing ? (
                    <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Processing Payment...
                    </>
                ) : (
                    <>
                        Pay {formatCurrency(amount)}
                    </>
                )}
            </Button>

            <p className="text-xs text-center text-gray-500">
                By completing this purchase, you agree to our Terms of Service and Privacy Policy
            </p>
        </form>
    );
};