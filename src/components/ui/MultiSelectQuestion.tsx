import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import OnboardingLayout from '../layouts/OnboardingLayout';
import { Button } from './button';
import { ArrowRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

interface MultiSelectQuestionProps {
  stepIndex: number;
  totalSteps: number;
  id: 'parenting_styles' | 'topics_of_interest';
  question: string;
  subtitle?: string;
  options: string[];
  nextRoute: string;
  skipRoute: string;
  backRoute: string;
}

const MultiSelectQuestion: React.FC<MultiSelectQuestionProps> = ({
  stepIndex,
  totalSteps,
  id,
  question,
  subtitle,
  options,
  nextRoute,
  skipRoute,
  backRoute
}) => {
  const navigate = useNavigate();
  const { profile, updateProfile } = useAuth();
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Load existing selections from profile
  useEffect(() => {
    if (profile && profile[id]) {
      setSelectedOptions(profile[id]);
    }
  }, [profile, id]);

  const handleOptionToggle = (option: string) => {
    setSelectedOptions(prev => {
      if (prev.includes(option)) {
        return prev.filter(item => item !== option);
      } else {
        return [...prev, option];
      }
    });
  };

  const handleNext = async () => {
    if (selectedOptions.length === 0) {
      toast({
        title: "Selection required",
        description: "Please select at least one option to continue.",
        variant: "destructive",
      });
      return;
    }

    // Save the selections when user clicks Next
    setIsSaving(true);
    try {
      const updates = { [id]: selectedOptions };
      const result = await updateProfile(updates);
      
      if (result.error) {
        console.error(`Error saving ${id}:`, result.error);
        toast({
          title: "Save error",
          description: `Failed to save your selections. Please try again.`,
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
      step={stepIndex} 
      total={totalSteps} 
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
              key={option}
              onClick={() => handleOptionToggle(option)}
              className={`w-full p-4 text-left rounded-2xl border-2 transition-all duration-150 ease-in ${
                selectedOptions.includes(option)
                  ? 'border-action-primary bg-indigo-50 text-action-primary'
                  : 'border-slate-200 bg-white text-gray-700 hover:border-slate-300'
              }`}
              role="checkbox"
              aria-checked={selectedOptions.includes(option)}
              aria-label={`Select ${option}`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">{option}</span>
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                  selectedOptions.includes(option)
                    ? 'border-action-primary bg-action-primary'
                    : 'border-slate-300'
                }`}>
                  {selectedOptions.includes(option) && (
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
        {selectedOptions.length > 0 && (
          <div className="flex justify-end">
            <Button
              onClick={handleNext}
              disabled={isSaving}
              className="flex items-center space-x-2 animate-fade-in bg-action-primary text-white hover:bg-indigo-800 font-semibold rounded-2xl px-6 py-3 text-base transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-action-primary disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <span>Next</span>
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