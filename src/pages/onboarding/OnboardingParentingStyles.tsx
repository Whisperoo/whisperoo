import React from 'react';
import MultiSelectQuestion from '../../components/ui/MultiSelectQuestion';

const OnboardingParentingStyles: React.FC = () => {
  const parentingStyleOptions = [
    "Direct & to the point – Give me the facts quickly and clearly.",
    "Friendly & encouraging – A positive, motivating nudge helps me best.",
    "Detailed & thorough – I like context and step-by-step explanations.",
    "Gentle & patient – I prefer a softer approach with extra reassurance.",
    "Flexible – Depends on the situation, I can adapt."
  ];

  return (
    <MultiSelectQuestion
      stepIndex={4}
      totalSteps={5}
      id="parenting_styles"
      question="How do you like to receive information and support?"
      subtitle="(Totally okay if this changes—go with what fits today.)"
      options={parentingStyleOptions}
      nextRoute="/onboarding/topics"
      skipRoute="/onboarding/complete"
      backRoute="/onboarding/kids-count"
    />
  );
};

export default OnboardingParentingStyles;