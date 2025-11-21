import React from 'react';
import MultiSelectQuestion from '../../components/ui/MultiSelectQuestion';

const OnboardingTopics: React.FC = () => {
  const topicOptions = [
    'Sleep & Routines',
    'Feeding & Nutrition',
    'Developmental Milestones',
    'Mental Health & Self-Care',
    'Discipline & Boundaries',
    'Play & Learning',
    'Relationships & Co-Parenting',
    'Community & Support'
  ];

  return (
    <MultiSelectQuestion
      stepIndex={5}
      totalSteps={5}
      id="topics_of_interest"
      question="What topics are you most interested in?"
      subtitle="(Select as many as you want)"
      options={topicOptions}
      nextRoute="/onboarding/complete"
      skipRoute="/onboarding/complete"
      backRoute="/onboarding/parenting-styles"
    />
  );
};

export default OnboardingTopics;