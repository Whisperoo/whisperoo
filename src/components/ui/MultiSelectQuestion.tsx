import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import OnboardingLayout from '../layouts/OnboardingLayout';
import { Button } from './button';
import { ArrowRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

interface MultiSelectOption {
  label: string;
  value: string;
}

interface MultiSelectQuestionProps {
  id: 'parenting_styles' | 'topics_of_interest';
  question: string;
  subtitle?: string;
  options: MultiSelectOption[];
  nextRoute: string;
  skipRoute: string;
  backRoute: string;
}

const MultiSelectQuestion: React.FC<MultiSelectQuestionProps> = ({
  id,
  question,
  subtitle,
  options,
  nextRoute,
  skipRoute,
  backRoute
}) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { profile, updateProfile } = useAuth();
  const [selectedValues, setSelectedValues] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Load existing selections from profile
  useEffect(() => {
    if (profile && profile[id]) {
      setSelectedValues(profile[id]);
    }
  }, [profile, id]);

  const handleOptionToggle = (value: string) => {
    setSelectedValues(prev => {
      if (prev.includes(value)) {
        return prev.filter(item => item !== value);
      } else {
        return [...prev, value];
      }
    });
  };

  const handleNext = async () => {
    if (selectedValues.length === 0) {
      toast({
        title: t('onboarding.multiSelect.selectionRequired'),
        description: t('onboarding.multiSelect.selectionRequiredDesc'),
        variant: "destructive",
      });
      return;
    }

    // Save the selections when user clicks Next
    setIsSaving(true);
    try {
      const updates = { [id]: selectedValues };
      const result = await updateProfile(updates);
      
      if (result.error) {
        console.error(`Error saving ${id}:`, result.error);
        toast({
          title: t('onboarding.multiSelect.saveError'),
          description: t('onboarding.multiSelect.saveErrorDesc'),
          variant: "destructive",
        });
        setIsSaving(false);
        return;
      }

      console.log(`${id} saved successfully`);
      navigate(nextRoute);
    } catch (error) {
      console.error(`Error in ${id} save:`, error);
      toast({
        title: "Save error",
        description: `Failed to save your selections. Please try again.`,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleBack = () => {
    navigate(backRoute);
  };

  const handleSkip = () => {
    navigate(skipRoute);
  };

  return (
    <OnboardingLayout
      onBack={handleBack}
      onSkip={handleSkip}
    >
      <div className="space-y-8">
        {/* Question */}
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-semibold leading-tight text-gray-800">
            {question}
          </h2>
          {subtitle && (
            <p className="text-sm text-slate-500">
              {subtitle}
            </p>
          )}
        </div>

        {/* Options */}
        <div className="space-y-4">
          {options.map((option) => (
            <button
              key={option.value}
              onClick={() => handleOptionToggle(option.value)}
              className={`w-full p-4 text-left rounded-2xl border-2 transition-all duration-150 ease-in ${
                selectedValues.includes(option.value)
                  ? 'border-action-primary bg-indigo-50 text-action-primary'
                  : 'border-slate-200 bg-white text-gray-700 hover:border-slate-300'
              }`}
              role="checkbox"
              aria-checked={selectedValues.includes(option.value)}
              aria-label={`Select ${option.label}`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">{option.label}</span>
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                  selectedValues.includes(option.value)
                    ? 'border-action-primary bg-action-primary'
                    : 'border-slate-300'
                }`}>
                  {selectedValues.includes(option.value) && (
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Next Button */}
        {selectedValues.length > 0 && (
          <div className="flex justify-end">
            <Button
              onClick={handleNext}
              disabled={isSaving}
              className="flex items-center space-x-2 animate-fade-in bg-action-primary text-white hover:bg-indigo-800 font-semibold rounded-2xl px-6 py-3 text-base transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-action-primary disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>{t('onboarding.multiSelect.saving')}</span>
                </>
              ) : (
                <>
                  <span>{t('onboarding.multiSelect.next')}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </OnboardingLayout>
  );
};

export default MultiSelectQuestion;