
import React from 'react';
import BackButton from '../ui/BackButton';
import SkipLink from '../ui/SkipLink';
import PagerDots from '../ui/PagerDots';

interface OnboardingLayoutProps {
  children: React.ReactNode;
  step: number;
  total: number;
  onBack?: () => void;
  onSkip?: () => void;
}

const OnboardingLayout: React.FC<OnboardingLayoutProps> = ({ 
  children, 
  step, 
  total, 
  onBack, 
  onSkip 
}) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 md:p-6">
        <BackButton onClick={onBack} />
        <div className="flex items-center">
          <img
            src="/lovable-uploads/96238edd-91f3-4ff1-87be-ac5d867fa98a.png"
            alt="Whisperoo"
            className="h-6"
          />
        </div>
        <SkipLink onClick={onSkip} />
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center px-4 pb-8">
        <div className="w-full max-w-lg">
          {children}
        </div>
      </div>

      {/* Footer */}
      <div className="pb-8 flex justify-center">
        <PagerDots current={step} total={total} />
      </div>
    </div>
  );
};

export default OnboardingLayout;
