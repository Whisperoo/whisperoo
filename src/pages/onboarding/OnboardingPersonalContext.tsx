import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import OnboardingLayout from '@/components/layouts/OnboardingLayout';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

const OnboardingPersonalContext: React.FC = () => {
  const navigate = useNavigate();
  const { profile, updateProfile } = useAuth();
  const [personalContext, setPersonalContext] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  // Load existing personal context when component mounts
  useEffect(() => {
    if (profile?.personal_context) {
      setPersonalContext(profile.personal_context);
    }
  }, [profile]);

  const handleNext = async () => {
    setIsLoading(true);
    try {
      if (personalContext.trim()) {
        const { error } = await updateProfile({ 
          personal_context: personalContext.trim() 
        });
        if (error) {
          console.error('Error updating personal context:', error);
        }
      }
      navigate('/onboarding/complete');
    } catch (error) {
      console.error('Error saving personal context:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = () => {
    navigate('/onboarding/complete');
  };

  const handleBack = () => {
    navigate('/onboarding/topics');
  };

  return (
    <OnboardingLayout
      step={6}
      total={6}
      onBack={handleBack}
      onSkip={handleSkip}
    >
      <div className="text-center space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3">
            We're here to listen
          </h1>
          <p className="text-gray-600 text-sm md:text-base leading-relaxed max-w-md mx-auto">
            Tell us about what you're looking for help with, any challenges you're facing, or things 
            we should know about you and your family
          </p>
        </div>

        <div className="space-y-4">
          <Textarea
            value={personalContext}
            onChange={(e) => setPersonalContext(e.target.value)}
            placeholder="Share what's on your mind... This will help us provide more personalized support and advice."
            className="min-h-[120px] resize-none text-sm border-gray-200 focus:ring-2 focus:ring-offset-2 transition-colors duration-200"
            style={{ '--tw-ring-color': '#2E54A5' } as React.CSSProperties}
            maxLength={1000}
          />
          
          {personalContext.length > 0 && (
            <p className="text-xs text-gray-500 text-right">
              {personalContext.length}/1000 characters
            </p>
          )}
        </div>

        <div className="pt-4">
          <Button 
            onClick={handleNext}
            disabled={isLoading}
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