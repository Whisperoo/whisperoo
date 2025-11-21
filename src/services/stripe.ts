// Mock Stripe service that matches real Stripe API patterns
// This allows easy switching to real Stripe implementation later

export interface StripeConfig {
  publishableKey: string;
  secretKey?: string;
  apiVersion?: string;
}

export interface PaymentIntent {
  id: string;
  client_secret: string;
  amount: number;
  currency: string;
  status: 'requires_payment_method' | 'requires_confirmation' | 'processing' | 'succeeded' | 'canceled' | 'requires_action';
  customer?: string;
  metadata: Record<string, string>;
  created: number;
  receipt_email?: string;
}

export interface Customer {
  id: string;
  email: string;
  name?: string;
  created: number;
  metadata: Record<string, string>;
}

export interface PaymentMethod {
  id: string;
  type: 'card';
  card: {
    brand: 'visa' | 'mastercard' | 'amex' | 'discover' | 'unknown';
    last4: string;
    exp_month: number;
    exp_year: number;
  };
}

export interface StripeError {
  type: 'card_error' | 'validation_error' | 'api_error';
  code?: string;
  message: string;
  param?: string;
}

class MockStripeService {
  private config: StripeConfig;
  private mockDelay = 1500; // Simulate network delay

  constructor(config: StripeConfig) {
    this.config = config;
  }

  // Simulate network delay
  private async delay(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, this.mockDelay));
  }

  // Generate mock IDs that look like Stripe IDs
  private generateId(prefix: string): string {
    const randomString = Math.random().toString(36).substring(2, 15);
    const timestamp = Date.now().toString(36);
    return `${prefix}_${timestamp}${randomString}`;
  }

  // Mock payment intent creation
  async createPaymentIntent(params: {
    amount: number;
    currency: string;
    customer?: string;
    receipt_email?: string;
    metadata?: Record<string, string>;
  }): Promise<PaymentIntent> {
    await this.delay();

    // Mock validation errors
    if (params.amount < 50) {
      throw new Error('Amount must be at least $0.50 USD');
    }

    const paymentIntent: PaymentIntent = {
      id: this.generateId('pi'),
      client_secret: this.generateId('pi') + '_secret_' + Math.random().toString(36),
      amount: params.amount,
      currency: params.currency,
      status: 'requires_payment_method',
      customer: params.customer,
      metadata: params.metadata || {},
      created: Math.floor(Date.now() / 1000),
      receipt_email: params.receipt_email,
    };

    return paymentIntent;
  }

  // Mock payment confirmation
  async confirmPaymentIntent(
    paymentIntentId: string,
    params: {
      payment_method: {
        type: 'card';
        card: {
          number: string;
          exp_month: number;
          exp_year: number;
          cvc: string;
        };
        billing_details?: {
          name?: string;
          email?: string;
          address?: {
            line1?: string;
            city?: string;
            state?: string;
            postal_code?: string;
            country?: string;
          };
        };
      };
    }
  ): Promise<PaymentIntent> {
    await this.delay();

    const cardNumber = params.payment_method.card.number.replace(/\s/g, '');

    // Mock card validation
    if (cardNumber === '4000000000000002') {
      const error: StripeError = {
        type: 'card_error',
        code: 'card_declined',
        message: 'Your card was declined.',
      };
      throw error;
    }

    if (cardNumber === '4000000000000119') {
      const error: StripeError = {
        type: 'card_error',
        code: 'processing_error',
        message: 'An error occurred while processing your card.',
      };
      throw error;
    }

    // Mock successful payment (most test cards)
    const updatedPaymentIntent: PaymentIntent = {
      id: paymentIntentId,
      client_secret: paymentIntentId + '_secret_confirmed',
      amount: 2000, // This would come from the original payment intent
      currency: 'usd',
      status: 'succeeded',
      metadata: {},
      created: Math.floor(Date.now() / 1000),
    };

    return updatedPaymentIntent;
  }

  // Mock customer creation
  async createCustomer(params: {
    email: string;
    name?: string;
    metadata?: Record<string, string>;
  }): Promise<Customer> {
    await this.delay();

    const customer: Customer = {
      id: this.generateId('cus'),
      email: params.email,
      name: params.name,
      created: Math.floor(Date.now() / 1000),
      metadata: params.metadata || {},
    };

    return customer;
  }

  // Mock retrieve customer
  async retrieveCustomer(customerId: string): Promise<Customer> {
    await this.delay();

    // Mock customer data
    const customer: Customer = {
      id: customerId,
      email: 'mock@example.com',
      name: 'Mock Customer',
      created: Math.floor(Date.now() / 1000),
      metadata: {},
    };

    return customer;
  }

  // Get payment method from card details (mock)
  getPaymentMethodFromCard(cardNumber: string): PaymentMethod {
    const cleanNumber = cardNumber.replace(/\s/g, '');
    let brand: PaymentMethod['card']['brand'] = 'unknown';

    if (cleanNumber.startsWith('4')) brand = 'visa';
    else if (cleanNumber.startsWith('5') || cleanNumber.startsWith('2')) brand = 'mastercard';
    else if (cleanNumber.startsWith('3')) brand = 'amex';
    else if (cleanNumber.startsWith('6')) brand = 'discover';

    return {
      id: this.generateId('pm'),
      type: 'card',
      card: {
        brand,
        last4: cleanNumber.slice(-4),
        exp_month: 12,
        exp_year: 2025,
      },
    };
  }

  // Helper method to determine if we're in test mode
  isTestMode(): boolean {
    return this.config.publishableKey.includes('test') || 
           this.config.publishableKey.includes('pk_test') ||
           !this.config.publishableKey.startsWith('pk_live');
  }
}

// Export singleton instance
export const stripeService = new MockStripeService({
  publishableKey: import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || 'pk_test_mock_key_for_development',
  secretKey: import.meta.env.VITE_STRIPE_SECRET_KEY || 'sk_test_mock_key_for_development',
});

// Test card numbers for documentation
export const TEST_CARDS = {
  VISA_SUCCESS: '4242424242424242',
  VISA_DECLINE: '4000000000000002',
  VISA_PROCESSING_ERROR: '4000000000000119',
  MASTERCARD_SUCCESS: '5555555555554444',
  AMEX_SUCCESS: '378282246310005',
};

// Helper function to format amount for Stripe (cents)
export const formatAmountForStripe = (amount: number): number => {
  return Math.round(amount * 100);
};

// Helper function to format amount from Stripe (dollars)
export const formatAmountFromStripe = (amount: number): number => {
  return amount / 100;
};

