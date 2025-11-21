import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { stripeService, formatAmountForStripe, PaymentIntent } from '@/services/stripe';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { ProductWithDetails } from '@/services/products';
import { PaymentFormData } from '@/components/products/PaymentForm';

export interface PurchaseResult {
  success: boolean;
  purchaseId?: string;
  error?: string;
}

interface CreatePurchaseParams {
  product: ProductWithDetails;
  paymentData: PaymentFormData;
}

export const usePayments = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [processing, setProcessing] = useState(false);

  // Create purchase mutation
  const createPurchaseMutation = useMutation({
    mutationFn: async ({ product, paymentData }: CreatePurchaseParams): Promise<PurchaseResult> => {
      if (!user) {
        throw new Error('User must be authenticated to make a purchase');
      }

      try {
        setProcessing(true);

        // Step 1: Create payment intent
        const paymentIntent = await stripeService.createPaymentIntent({
          amount: formatAmountForStripe(product.price),
          currency: 'usd',
          receipt_email: paymentData.email,
          metadata: {
            product_id: product.id,
            product_title: product.title,
            user_id: user.id,
          },
        });

        // Step 2: Confirm payment with mock card details
        const confirmedPayment = await stripeService.confirmPaymentIntent(paymentIntent.id, {
          payment_method: {
            type: 'card',
            card: {
              number: paymentData.cardNumber.replace(/\s/g, ''),
              exp_month: parseInt(paymentData.expiryDate.split('/')[0]),
              exp_year: 2000 + parseInt(paymentData.expiryDate.split('/')[1]),
              cvc: paymentData.cvc,
            },
            billing_details: {
              name: paymentData.nameOnCard,
              email: paymentData.email,
              address: {
                line1: paymentData.billingAddress.line1,
                city: paymentData.billingAddress.city,
                state: paymentData.billingAddress.state,
                postal_code: paymentData.billingAddress.postalCode,
                country: paymentData.billingAddress.country,
              },
            },
          },
        });

        if (confirmedPayment.status !== 'succeeded') {
          throw new Error('Payment was not successful');
        }

        // Step 3: Create purchase record in database
        const purchaseData = {
          user_id: user.id,
          product_id: product.id,
          expert_id: product.expert_id,
          amount: product.price,
          currency: 'USD',
          payment_method: 'card',
          payment_intent_id: confirmedPayment.id,
          status: 'completed',
          purchased_at: new Date().toISOString(),
          metadata: {
            stripe_payment_intent: confirmedPayment.id,
            payment_method_details: stripeService.getPaymentMethodFromCard(paymentData.cardNumber),
            billing_details: {
              name: paymentData.nameOnCard,
              email: paymentData.email,
              address: paymentData.billingAddress,
            },
          },
        };

        const { data: purchase, error: purchaseError } = await supabase
          .from('purchases')
          .insert(purchaseData)
          .select('id')
          .single();

        if (purchaseError) {
          console.error('Database error creating purchase:', purchaseError);
          throw new Error('Failed to create purchase record');
        }

        // Step 4: Invalidate relevant queries to refresh purchase status
        queryClient.invalidateQueries({ queryKey: ['user-purchases'] });
        queryClient.invalidateQueries({ queryKey: ['product-purchases'] });

        return {
          success: true,
          purchaseId: purchase.id,
        };

      } catch (error: unknown) {
        console.error('Purchase error:', error);
        
        // Handle different types of Stripe errors
        let errorMessage = 'Payment processing failed. Please try again.';
        
        const stripeError = error as any; // Stripe errors have specific structure
        if (stripeError.type === 'card_error') {
          errorMessage = stripeError.message || 'Your card was declined.';
        } else if (stripeError.type === 'validation_error') {
          errorMessage = 'Please check your payment information and try again.';
        } else if (stripeError.message) {
          errorMessage = stripeError.message;
        }

        return {
          success: false,
          error: errorMessage,
        };
      } finally {
        setProcessing(false);
      }
    },
    onSuccess: (result) => {
      if (result.success) {
        console.log('Purchase completed successfully:', result.purchaseId);
      } else {
        console.error('Purchase failed:', result.error);
      }
    },
    onError: (error) => {
      console.error('Purchase mutation error:', error);
      setProcessing(false);
    },
  });

  // Check if user has purchased a product
  const checkPurchaseStatus = async (productId: string): Promise<boolean> => {
    if (!user || !productId) return false;

    try {
      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const { data, error } = await supabase
        .from('purchases')
        .select('id')
        .eq('user_id', user.id)
        .eq('product_id', productId)
        .eq('status', 'completed')
        .abortSignal(controller.signal)
        .single();

      clearTimeout(timeoutId);

      if (error) {
        // PGRST116 means no rows returned, which is expected if no purchase exists
        if (error.code === 'PGRST116') {
          return false;
        }
        console.error('Error checking purchase status:', error);
        return false;
      }

      return !!data;
    } catch (error: any) {
      // Handle abort errors gracefully
      if (error?.name === 'AbortError') {
        console.warn('Purchase status check timed out');
        return false;
      }
      console.error('Error checking purchase status:', error);
      return false;
    }
  };

  // Get user's purchase for a specific product
  const getUserPurchase = async (productId: string) => {
    if (!user) return null;

    try {
      const { data, error } = await supabase
        .from('purchases')
        .select(`
          *,
          product:products(*)
        `)
        .eq('user_id', user.id)
        .eq('product_id', productId)
        .eq('status', 'completed')
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching user purchase:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error fetching user purchase:', error);
      return null;
    }
  };

  return {
    // Mutations
    createPurchase: createPurchaseMutation.mutate,
    createPurchaseAsync: createPurchaseMutation.mutateAsync,
    
    // State
    isCreatingPurchase: createPurchaseMutation.isPending || processing,
    purchaseError: createPurchaseMutation.error,
    
    // Utilities
    checkPurchaseStatus,
    getUserPurchase,
    
    // Test mode helpers
    isTestMode: stripeService.isTestMode(),
  };
};