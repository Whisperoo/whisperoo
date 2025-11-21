
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import OnboardingLayout from '../../components/layouts/OnboardingLayout';
import { Button } from '../../components/ui/button';
import { useAuth } from '@/contexts/AuthContext';

const OnboardingComplete: React.FC = () => {
  const navigate = useNavigate();
  const { updateProfile } = useAuth();

  useEffect(() => {
    // Mark onboarding as complete
    const completeOnboarding = async () => {
      await updateProfile({ onboarded: true });
      console.log('Onboarding marked as complete');
    };
    completeOnboarding();
  }, [updateProfile]);

  const handleContinue = () => {
    navigate('/dashboard');
  };

  return (
    <OnboardingLayout step={5} total={5}>
      <div className="text-center space-y-8">
        <div className="space-y-4">
          <h1 className="text-4xl font-bold text-action-primary">
            You're All Set!
          </h1>
          <p className="text-gray-500 text-lg">
            Welcome to your personalized Whisperoo experience
          </p>
        </div>

        <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-md p-8 max-w-md mx-auto">
          <p className="text-gray-700 mb-6">
            Based on your preferences, we've customized your experience to provide the most relevant support and resources.
          </p>
          
          <Button 
            onClick={handleContinue} 
            className="w-full bg-action-primary text-white hover:bg-indigo-800 font-semibold rounded-2xl px-6 py-3 text-base transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-action-primary"
          >
            Enter Whisperoo
          </Button>
        </div>
      </div>
    </OnboardingLayout>
  );
};

export default OnboardingComplete;
