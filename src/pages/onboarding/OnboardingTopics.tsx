import React from 'react';
import { useTranslation } from 'react-i18next';
import MultiSelectQuestion from '../../components/ui/MultiSelectQuestion';

const OnboardingTopics: React.FC = () => {
  const { t } = useTranslation();

  const topicOptions = [
    t('onboarding.topics.babyFeeding'),
    t('onboarding.topics.pelvicFloor'),
    t('onboarding.topics.sleepCoaching'),
    t('onboarding.topics.nervousSystem'),
    t('onboarding.topics.nutrition'),
    t('onboarding.topics.pediatricDentistry'),
    t('onboarding.topics.lifestyleCoaching'),
    t('onboarding.topics.fitnessYoga'),
    t('onboarding.topics.backToWork'),
    t('onboarding.topics.postpartumTips'),
    t('onboarding.topics.prenatalTips'),
  ];

  return (
    <MultiSelectQuestion
      stepIndex={5}
      totalSteps={5}
      id="topics_of_interest"
      question={t('onboarding.topics.question')}
      subtitle={t('onboarding.topics.subtitle')}
      options={topicOptions}
      nextRoute="/onboarding/complete"
      skipRoute="/onboarding/complete"
      backRoute="/onboarding/parenting-styles"
    />
  );
};

export default OnboardingTopics;