import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { CreditCard, Lock, ArrowLeft } from 'lucide-react';
import { ProductWithDetails } from '@/services/products';
import { formatCurrency } from '@/lib/utils';

interface PaymentFormProps {
  onSubmit: (paymentData: PaymentFormData) => Promise<void>;
  onCancel: () => void;
  product: ProductWithDetails;
  defaultEmail: string;
}

export interface PaymentFormData {
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
}

export const PaymentForm: React.FC<PaymentFormProps> = ({
  onSubmit,
  onCancel,
  product,
  defaultEmail,
}) => {
  const [formData, setFormData] = useState<PaymentFormData>({
    email: defaultEmail,
    paymentMethod: 'card',
    cardNumber: '',
    expiryDate: '',
    cvc: '',
    nameOnCard: '',
    billingAddress: {
      line1: '',
      city: '',
      state: '',
      postalCode: '',
      country: 'US',
    },
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof PaymentFormData | 'cardNumber' | 'expiryDate' | 'cvc', string>>>({});

  // Format card number with spaces
  const formatCardNumber = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const matches = v.match(/\d{4,16}/g);
    const match = matches && matches[0] || '';
    const parts = [];

    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }

    if (parts.length) {
      return parts.join(' ');
    } else {
      return v;
    }
  };

  // Format expiry date
  const formatExpiryDate = (value: string) => {
    const v = value.replace(/\D/g, '');
    if (v.length >= 2) {
      return `${v.slice(0, 2)}/${v.slice(2, 4)}`;
    }
    return v;
  };

  // Format CVC
  const formatCVC = (value: string) => {
    return value.replace(/\D/g, '').slice(0, 4);
  };

  const handleInputChange = (field: string, value: string) => {
    let processedValue = value;

    // Apply formatting based on field
    if (field === 'cardNumber') {
      processedValue = formatCardNumber(value);
    } else if (field === 'expiryDate') {
      processedValue = formatExpiryDate(value);
    } else if (field === 'cvc') {
      processedValue = formatCVC(value);
    }

    // Handle nested billing address
    if (field.startsWith('billingAddress.')) {
      const addressField = field.replace('billingAddress.', '');
      setFormData(prev => ({
        ...prev,
        billingAddress: {
          ...prev.billingAddress,
          [addressField]: processedValue,
        },
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [field]: processedValue,
      }));
    }

    // Clear error when user starts typing
    if (errors[field as keyof typeof errors]) {
      setErrors(prev => ({
        ...prev,
        [field]: undefined,
      }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: typeof errors = {};

    // Email validation
    if (!formData.email || !/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    // Card number validation (basic length check)
    const cardNumberClean = formData.cardNumber.replace(/\s/g, '');
    if (!cardNumberClean || cardNumberClean.length < 13 || cardNumberClean.length > 19) {
      newErrors.cardNumber = 'Please enter a valid card number';
    }

    // Expiry date validation
    if (!formData.expiryDate || !/^\d{2}\/\d{2}$/.test(formData.expiryDate)) {
      newErrors.expiryDate = 'Please enter a valid expiry date (MM/YY)';
    }

    // CVC validation
    if (!formData.cvc || formData.cvc.length < 3) {
      newErrors.cvc = 'Please enter a valid CVC';
    }

    // Name on card validation
    if (!formData.nameOnCard.trim()) {
      newErrors.nameOnCard = 'Please enter the name on your card';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(formData);
    } catch (error) {
      console.error('Payment submission error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get card type icon based on card number
  const getCardIcon = () => {
    const number = formData.cardNumber.replace(/\s/g, '');
    if (number.startsWith('4')) return '💳'; // Visa
    if (number.startsWith('5') || number.startsWith('2')) return '💳'; // Mastercard
    if (number.startsWith('3')) return '💳'; // American Express
    return '💳';
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Order Summary */}
      <div className="bg-gray-50 rounded-lg p-4 space-y-3">
        <div className="flex justify-between items-center">
          <span className="font-medium">{product.title}</span>
          <Badge variant="outline">{product.product_type}</Badge>
        </div>
        <Separator />
        <div className="flex justify-between items-center font-semibold">
          <span>Total</span>
          <span>{formatCurrency(product.price)}</span>
        </div>
      </div>

      {/* Contact Information */}
      <div className="space-y-4">
        <h3 className="font-medium text-gray-900">Contact Information</h3>
        <div>
          <Label htmlFor="email">Email Address</Label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => handleInputChange('email', e.target.value)}
            placeholder="your@email.com"
            className={errors.email ? 'border-red-500' : ''}
          />
          {errors.email && (
            <p className="text-sm text-red-600 mt-1">{errors.email}</p>
          )}
        </div>
      </div>

      {/* Payment Information */}
      <div className="space-y-4">
        <h3 className="font-medium text-gray-900 flex items-center gap-2">
          <CreditCard className="h-4 w-4" />
          Payment Information
        </h3>
        
        {/* Card Number */}
        <div>
          <Label htmlFor="cardNumber">Card Number</Label>
          <div className="relative">
            <Input
              id="cardNumber"
              value={formData.cardNumber}
              onChange={(e) => handleInputChange('cardNumber', e.target.value)}
              placeholder="1234 5678 9012 3456"
              maxLength={19}
              className={errors.cardNumber ? 'border-red-500' : ''}
            />
            <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-lg">
              {getCardIcon()}
            </span>
          </div>
          {errors.cardNumber && (
            <p className="text-sm text-red-600 mt-1">{errors.cardNumber}</p>
          )}
        </div>

        {/* Expiry and CVC */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="expiryDate">Expiry Date</Label>
            <Input
              id="expiryDate"
              value={formData.expiryDate}
              onChange={(e) => handleInputChange('expiryDate', e.target.value)}
              placeholder="MM/YY"
              maxLength={5}
              className={errors.expiryDate ? 'border-red-500' : ''}
            />
            {errors.expiryDate && (
              <p className="text-sm text-red-600 mt-1">{errors.expiryDate}</p>
            )}
          </div>
          <div>
            <Label htmlFor="cvc">CVC</Label>
            <Input
              id="cvc"
              value={formData.cvc}
              onChange={(e) => handleInputChange('cvc', e.target.value)}
              placeholder="123"
              maxLength={4}
              className={errors.cvc ? 'border-red-500' : ''}
            />
            {errors.cvc && (
              <p className="text-sm text-red-600 mt-1">{errors.cvc}</p>
            )}
          </div>
        </div>

        {/* Name on Card */}
        <div>
          <Label htmlFor="nameOnCard">Name on Card</Label>
          <Input
            id="nameOnCard"
            value={formData.nameOnCard}
            onChange={(e) => handleInputChange('nameOnCard', e.target.value)}
            placeholder="John Doe"
            className={errors.nameOnCard ? 'border-red-500' : ''}
          />
          {errors.nameOnCard && (
            <p className="text-sm text-red-600 mt-1">{errors.nameOnCard}</p>
          )}
        </div>
      </div>

      {/* Billing Address (Simplified) */}
      <div className="space-y-4">
        <h3 className="font-medium text-gray-900">Billing Address</h3>
        <div>
          <Label htmlFor="address">Address</Label>
          <Input
            id="address"
            value={formData.billingAddress.line1}
            onChange={(e) => handleInputChange('billingAddress.line1', e.target.value)}
            placeholder="123 Main Street"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="city">City</Label>
            <Input
              id="city"
              value={formData.billingAddress.city}
              onChange={(e) => handleInputChange('billingAddress.city', e.target.value)}
              placeholder="New York"
            />
          </div>
          <div>
            <Label htmlFor="postalCode">ZIP Code</Label>
            <Input
              id="postalCode"
              value={formData.billingAddress.postalCode}
              onChange={(e) => handleInputChange('billingAddress.postalCode', e.target.value)}
              placeholder="10001"
            />
          </div>
        </div>
      </div>

      {/* Security Notice */}
      <div className="flex items-center gap-2 text-sm text-gray-600 bg-blue-50 p-3 rounded-lg">
        <Lock className="h-4 w-4 text-blue-600" />
        <span>Your payment information is secure and encrypted</span>
      </div>

      {/* Test Card Notice */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
        <p className="text-sm text-yellow-800">
          <strong>Test Mode:</strong> Use card number <code>4242 4242 4242 4242</code> with any future date and CVC for testing.
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isSubmitting}
          className="flex-1"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting}
          className="flex-1 bg-blue-600 hover:bg-blue-700"
        >
          {isSubmitting ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
              Processing...
            </>
          ) : (
            <>
              <Lock className="h-4 w-4 mr-2" />
              Pay {formatCurrency(product.price)}
            </>
          )}
        </Button>
      </div>
    </form>
  );
};