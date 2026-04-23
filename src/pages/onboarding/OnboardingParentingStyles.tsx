import React from 'react';
import { useTranslation } from 'react-i18next';
import MultiSelectQuestion from '../../components/ui/MultiSelectQuestion';

const OnboardingParentingStyles: React.FC = () => {
  const { t } = useTranslation();

  const parentingStyleOptions = [
    t('onboarding.parentingStyles.option1'),
    t('onboarding.parentingStyles.option2'),
    t('onboarding.parentingStyles.option3'),
    t('onboarding.parentingStyles.option4'),
    t('onboarding.parentingStyles.option5'),
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