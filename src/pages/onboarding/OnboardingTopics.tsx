import React from 'react';
import { useTranslation } from 'react-i18next';
import MultiSelectQuestion from '../../components/ui/MultiSelectQuestion';

const OnboardingTopics: React.FC = () => {
  const { t } = useTranslation();

  const topicOptions = [
    t('onboarding.topics.sleep'),
    t('onboarding.topics.feeding'),
    t('onboarding.topics.milestones'),
    t('onboarding.topics.mentalHealth'),
    t('onboarding.topics.discipline'),
    t('onboarding.topics.play'),
    t('onboarding.topics.relationships'),
    t('onboarding.topics.community'),
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