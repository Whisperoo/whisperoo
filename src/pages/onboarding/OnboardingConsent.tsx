import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import OnboardingLayout from '../../components/layouts/OnboardingLayout';
import { Button } from '../../components/ui/button';
import { ArrowRight, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { CONSENT_STEP_ENABLED } from '@/config/features';
import { ConsentChoices, useConsentForm } from '@/components/consent/ConsentChoices';

/**
 * Messaging consent — the last onboarding step before completion.
 * The rules (separate unchecked boxes, versioned wording, SMS optional) live in
 * ConsentChoices, shared with the one-time login prompt for existing parents.
 *
 * Continue and Skip both mark the parent as asked, so the login prompt never
 * shows to someone who already saw this step.
 */
const OnboardingConsent: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const form = useConsentForm();
  const [saving, setSaving] = useState(false);

  const finish = () => navigate('/onboarding/complete');

  // Flag off: every entry point still routes here, so forward to completion.
  if (!CONSENT_STEP_ENABLED) return <Navigate to="/onboarding/complete" replace />;

  const handleContinue = async () => {
    setSaving(true);
    try {
      await form.save();
    } finally {
      setSaving(false);
      finish();
    }
  };

  const handleSkip = async () => {
    await form.dismiss();
    finish();
  };

  const handleBack = () => navigate(-1);

  return (
    <OnboardingLayout onBack={handleBack} onSkip={handleSkip}>
      <div className="space-y-8">
        <div className="bg-white rounded-3xl shadow-lg p-8 space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold text-gray-900">{t('onboarding.consent.title')}</h1>
            <p className="text-gray-500 text-sm">{t('onboarding.consent.subtitle')}</p>
          </div>

          <ConsentChoices form={form} />
        </div>

        <Button
          onClick={handleContinue}
          disabled={saving || form.loading}
          className="w-full h-12 text-base font-semibold rounded-2xl"
        >
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : (
            <>
              {t('onboarding.common.continue')}
              <ArrowRight className="w-5 h-5 ml-2" />
            </>
          )}
        </Button>
      </div>
    </OnboardingLayout>
  );
};

export default OnboardingConsent;
