import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

interface CreatePaymentIntentRequest {
    product_id: string;
}

interface CreatePaymentIntentResponse {
    clientSecret: string;
    paymentIntentId: string;
    purchaseId: string;
    amount: number;
    currency: string;
}

interface PaymentStatus {
    status: 'pending' | 'completed' | 'failed' | 'canceled';
    purchaseId: string;
}

export const useStripePayment = () => {
    const { user } = useAuth();
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const createPaymentIntent = async (
        productId: string
    ): Promise<CreatePaymentIntentResponse | null> => {
        if (!user) {
            setError('User not authenticated');
            toast({
                title: 'Authentication Required',
                description: 'Please log in to continue with your purchase.',
                variant: 'destructive',
            });
            return null;
        }

        setIsLoading(true);
        setError(null);

        try {
            const { data: sessionData } = await supabase.auth.getSession();
            const token = sessionData?.session?.access_token;

            if (!token) {
                throw new Error('No authentication token found');
            }

            const { data, error: functionError } = await supabase.functions.invoke<CreatePaymentIntentResponse>(
                'create-payment',
                {
                    body: { product_id: productId } as CreatePaymentIntentRequest,
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            if (functionError) {
                console.error('Function error:', functionError);
                throw new Error(functionError.message || 'Failed to create payment intent');
            }

            if (!data) {
                throw new Error('No data returned from payment intent creation');
            }

            return data;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to create payment intent';
            setError(errorMessage);
            toast({
                title: 'Payment Error',
                description: errorMessage,
                variant: 'destructive',
            });
            return null;
        } finally {
            setIsLoading(false);
        }
    };

    const checkPaymentStatus = async (purchaseId: string): Promise<PaymentStatus | null> => {
        if (!user) {
            setError('User not authenticated');
            return null;
        }

        try {
            const { data, error: queryError } = await supabase
                .from('purchases')
                .select('status')
                .eq('id', purchaseId)
                .single();

            if (queryError) {
                throw new Error(queryError.message);
            }

            return {
                status: data.status as PaymentStatus['status'],
                purchaseId,
            };
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to check payment status';
            setError(errorMessage);
            console.error('Error checking payment status:', err);
            return null;
        }
    };

    const waitForPaymentConfirmation = async (
        purchaseId: string,
        maxAttempts: number = 30,
        intervalMs: number = 2000
    ): Promise<boolean> => {
        let attempts = 0;

        while (attempts < maxAttempts) {
            const status = await checkPaymentStatus(purchaseId);

            if (status?.status === 'completed') {
                return true;
            }

            if (status?.status === 'failed' || status?.status === 'canceled') {
                return false;
            }

            await new Promise((resolve) => setTimeout(resolve, intervalMs));
            attempts++;
        }

        return false;
    };

    return {
        createPaymentIntent,
        checkPaymentStatus,
        waitForPaymentConfirmation,
        isLoading,
        error,
    };
};