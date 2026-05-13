
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import OnboardingLayout from '../../components/layouts/OnboardingLayout';
import RadioButton from '../../components/ui/RadioButton';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { ArrowRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import PrivacyNotice from '../../components/ui/PrivacyNotice';
import { useTranslation } from 'react-i18next';

const OnboardingRole: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { profile, updateProfile } = useAuth();
  const [role, setRole] = useState<string>('');
  const [customRole, setCustomRole] = useState<string>('');

  // Debug: Log when this component mounts
  useEffect(() => {
    console.log('OnboardingRole: Component mounted');
    console.log('OnboardingRole: Profile data:', profile);
  }, []);

  // Load existing role if any
  useEffect(() => {
    if (profile?.role) {
      setRole(profile.role);
      if (profile.custom_role) {
        setCustomRole(profile.custom_role);
      }
    }
  }, [profile]);

  // Auto-save when selections change
  useEffect(() => {
    if ((role && role !== 'other') || (role === 'other' && customRole.trim())) {
      const saveData = async () => {
        if (role === 'other') {
          await updateProfile({ role: 'other', custom_role: customRole });
        } else {
          await updateProfile({ role: role as 'mom' | 'dad' | 'caregiver', custom_role: null });
        }
      };
      saveData();
    }
  }, [role, customRole, updateProfile]);

  const handleNext = () => {
    const finalRole = role === 'other' ? customRole : role;
    if (finalRole) {
      navigate('/onboarding/hospital-check');
    }
  };

  const handleBack = () => {
    navigate('/auth/create');
  };

  const handleSkip = () => {
    navigate('/onboarding/complete');
  };

  const canProceed = (role && role !== 'other') || (role === 'other' && customRole.trim());

  return (
    <OnboardingLayout
      onBack={handleBack}
      onSkip={handleSkip}
    >
      <div className="space-y-8">
        {/* Main Card */}
        <div className="bg-white rounded-3xl shadow-lg p-8 space-y-6">
          {/* Greeting */}
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold text-gray-900">
              {t('onboarding.common.greeting', { name: profile?.first_name || t('onboarding.common.greetingFallback') })}
            </h1>
            <p className="text-gray-500">
              {t('onboarding.common.subtitle')}
            </p>
          </div>

          {/* Question: Are you a mom or dad? */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-800 text-center">
              {t('onboarding.role.question')}
            </h2>
            <div className="space-y-3">
              <RadioButton
                name="role"
                value="mom"
                checked={role === 'mom'}
                onChange={setRole}
              >
                {t('onboarding.role.mom')}
              </RadioButton>
              <RadioButton
                name="role"
                value="dad"
                checked={role === 'dad'}
                onChange={setRole}
              >
                {t('onboarding.role.dad')}
              </RadioButton>
              <RadioButton
                name="role"
                value="other"
                checked={role === 'other'}
                onChange={setRole}
              >
                {t('onboarding.role.other')}
              </RadioButton>

              {role === 'other' && (
                <div className="mt-4">
                  <Input
                    value={customRole}
                    onChange={(e) => setCustomRole(e.target.value)}
                    placeholder={t('onboarding.role.addRolePlaceholder')}
                    className="w-full px-4 py-3 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-colors duration-200"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Privacy Notice */}
          <PrivacyNotice />
        </div>

        {/* Next Button */}
        {canProceed && (
          <div className="flex justify-center">
            <Button
              onClick={handleNext}
              className="flex items-center space-x-2 animate-fade-in bg-indigo-600 text-white hover:bg-indigo-700 font-semibold rounded-3xl px-8 py-3.5 text-base transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-600 border-0 shadow-lg"
            >
              <span>{t('onboarding.common.next')}</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>
    </OnboardingLayout>
  );
};

export default OnboardingRole;
