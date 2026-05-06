import React from 'react';
import { useTranslation } from 'react-i18next';
import MultiSelectQuestion from '../../components/ui/MultiSelectQuestion';

const OnboardingParentingStyles: React.FC = () => {
  const { t } = useTranslation();

  const parentingStyleOptions = [
    { label: t('onboarding.parentingStyles.option1'), value: 'direct' },
    { label: t('onboarding.parentingStyles.option2'), value: 'friendly' },
    { label: t('onboarding.parentingStyles.option3'), value: 'detailed' },
    { label: t('onboarding.parentingStyles.option4'), value: 'gentle' },
    { label: t('onboarding.parentingStyles.option5'), value: 'flexible' },
  ];

  return (
    <MultiSelectQuestion
      stepIndex={4}
      totalSteps={5}
      id="parenting_styles"
      question={t('onboarding.parentingStyles.question')}
      subtitle={t('onboarding.parentingStyles.subtitle')}
      options={parentingStyleOptions}
      nextRoute="/onboarding/topics"
      skipRoute="/onboarding/complete"
      backRoute="/onboarding/kids-count"
    />
  );
};

export default OnboardingParentingStyles;