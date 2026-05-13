
import React from 'react';
import BackButton from '../ui/BackButton';
import SkipLink from '../ui/SkipLink';
import PagerDots from '../ui/PagerDots';
import LanguageSwitcher from '../common/LanguageSwitcher';
import { useOnboardingProgress } from '@/hooks/useOnboardingProgress';

interface OnboardingLayoutProps {
  children: React.ReactNode;
  onBack?: () => void;
  onSkip?: () => void;
}

const OnboardingLayout: React.FC<OnboardingLayoutProps> = ({
  children,
  onBack,
  onSkip,
}) => {
  const { step, total } = useOnboardingProgress();

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex flex-col">
      {/* Header */}
      <div className="flex-none flex items-center p-4 md:p-6 bg-transparent z-10">
        <div className="flex-1 flex justify-start">
          <BackButton onClick={onBack} />
        </div>
        <div className="flex-1 flex justify-center items-center">
          <img
            src="/lovable-uploads/96238edd-91f3-4ff1-87be-ac5d867fa98a.png"
            alt="Whisperoo"
            className="h-6"
          />
        </div>
        <div className="flex-1 flex items-center justify-end gap-2">
          <LanguageSwitcher compact />
          <SkipLink onClick={onSkip} />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 w-full">
        <div className="min-h-full flex flex-col items-center justify-center py-4">
          <div className="w-full max-w-lg pb-12">
            {children}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex-none pb-8 pt-4 flex justify-center bg-white/50 backdrop-blur-md border-t border-white/20 z-10">
        <PagerDots current={step} total={total} />
      </div>
    </div>
  );
};

export default OnboardingLayout;