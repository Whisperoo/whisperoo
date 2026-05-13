import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import OnboardingLayout from '@/components/layouts/OnboardingLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

/** Format a raw digit sequence as `(XXX) XXX-XXXX`. Returns the partial format for fewer digits. */
function formatUsPhone(digits: string): string {
  const d = digits.replace(/\D/g, '').slice(0, 10);
  if (d.length === 0) return '';
  if (d.length < 4) return `(${d}`;
  if (d.length < 7) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

const PHONE_PATTERN = /^\(\d{3}\) \d{3}-\d{4}$/;

const OnboardingPersonalContext: React.FC = () => {
  const navigate = useNavigate();
  const { profile, updateProfile } = useAuth();
  const [phone, setPhone] = useState<string>('');
  const [personalContext, setPersonalContext] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  // Load existing values when component mounts
  useEffect(() => {
    if (profile?.phone_number) {
      // Profile stores raw digits or already-formatted — always re-format
      setPhone(formatUsPhone(profile.phone_number));
    }
    if (profile?.personal_context) {
      setPersonalContext(profile.personal_context);
    }
  }, [profile]);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(formatUsPhone(e.target.value));
  };

  const phoneIsValid = PHONE_PATTERN.test(phone);
  const canContinue = phoneIsValid && !isLoading;

  const handleNext = async () => {
    if (!phoneIsValid) return;
    setIsLoading(true);
    try {
      const updates: { phone_number: string; personal_context?: string } = {
        phone_number: phone,
      };
      if (personalContext.trim()) {
        updates.personal_context = personalContext.trim();
      }
      const { error } = await updateProfile(updates);
      if (error) {
        console.error('Error updating profile:', error);
      }
      navigate('/onboarding/complete');
    } catch (error) {
      console.error('Error saving onboarding final step:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    navigate('/onboarding/topics');
  };

  return (
    <OnboardingLayout
      onBack={handleBack}
    >
      <div className="text-center space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3">
            We're here to listen
          </h1>
          <p className="text-gray-600 text-sm md:text-base leading-relaxed max-w-md mx-auto">
            Add your phone number so experts can reach you, and tell us about what you're looking for help with.
          </p>
        </div>

        <div className="space-y-4 text-left">
          <div className="space-y-1">
            <label htmlFor="phone" className="text-sm font-medium text-gray-700">
              Phone number <span className="text-red-500">*</span>
            </label>
            <Input
              id="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={phone}
              onChange={handlePhoneChange}
              placeholder="(555) 123-4567"
              maxLength={14}
              required
              aria-invalid={phone.length > 0 && !phoneIsValid}
              className="w-full px-4 py-3 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-offset-2 transition-colors duration-200"
              style={{ '--tw-ring-color': '#2E54A5' } as React.CSSProperties}
            />
            {phone.length > 0 && !phoneIsValid && (
              <p className="text-xs text-red-600">
                Enter a 10-digit US phone number — we'll format it as (XXX) XXX-XXXX.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Anything else you'd like us to know? <span className="text-gray-400">(optional)</span>
            </label>
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
              ⚠️ Please share general context only — do not include specific medical diagnoses, test results, or medication names. Your care provider is the right place for medical history.
            </p>
            <Textarea
              value={personalContext}
              onChange={(e) => setPersonalContext(e.target.value)}
              placeholder="Share what's on your mind... This will help us provide more personalized support and advice."
              className="min-h-[120px] resize-none text-sm border-gray-200 focus:ring-2 focus:ring-offset-2 transition-colors duration-200"
              style={{ '--tw-ring-color': '#2E54A5' } as React.CSSProperties}
              maxLength={500}
            />

            {personalContext.length > 0 && (
              <p className="text-xs text-gray-500 text-right">
                {personalContext.length}/500 characters
              </p>
            )}
          </div>
        </div>

        <div className="pt-4">
          <Button
            onClick={handleNext}
            disabled={!canContinue}
            className="w-full py-3 text-base font-semibold text-white rounded-full shadow-lg transition-all duration-200 disabled:opacity-50"
            style={{ backgroundColor: '#2E54A5' }}
          >
            {isLoading ? 'Saving...' : 'Continue'}
          </Button>
        </div>

        <div className="text-xs text-gray-500 max-w-sm mx-auto leading-relaxed">
          Your personal data will not be shared through the Whisperoo
          community or to any third party organizations.
        </div>
      </div>
    </OnboardingLayout>
  );
};

export default OnboardingPersonalContext;
