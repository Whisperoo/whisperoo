import React from 'react';
import { useTranslation } from 'react-i18next';
import MultiSelectQuestion from '../../components/ui/MultiSelectQuestion';

const OnboardingTopics: React.FC = () => {
  const { t } = useTranslation();

  const topicOptions = [
    { label: t('onboarding.topics.lactation'), value: 'Lactation' },
    { label: t('onboarding.topics.babyFeeding'), value: 'Baby Feeding' },
    { label: t('onboarding.topics.pelvicFloor'), value: 'Pelvic Floor' },
    { label: t('onboarding.topics.sleepCoaching'), value: 'Sleep Coaching' },
    { label: t('onboarding.topics.nervousSystem'), value: 'Nervous System Regulation' },
    { label: t('onboarding.topics.nutrition'), value: 'Nutrition' },
    { label: t('onboarding.topics.pediatricDentistry'), value: 'Pediatric Dentistry' },
    { label: t('onboarding.topics.lifestyleCoaching'), value: 'Lifestyle Coaching' },
    { label: t('onboarding.topics.fitnessYoga'), value: 'Fitness/yoga' },
    { label: t('onboarding.topics.backToWork'), value: 'Back to Work' },
    { label: t('onboarding.topics.postpartumTips'), value: 'Postpartum Tips' },
    { label: t('onboarding.topics.prenatalTips'), value: 'Prenatal Tips' },
  ];

  return (
    <MultiSelectQuestion
      id="topics_of_interest"
      question={t('onboarding.topics.question')}
      subtitle={t('onboarding.topics.subtitle')}
      options={topicOptions}
      nextRoute="/onboarding/complete"
      skipRoute="/onboarding/complete"
      backRoute="/onboarding/kids-count"
    />
  );
};

export default OnboardingTopics;