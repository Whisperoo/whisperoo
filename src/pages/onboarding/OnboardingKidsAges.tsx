
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import OnboardingLayout from '../../components/layouts/OnboardingLayout';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { saveKidsData } from '../../utils/kids';
import PrivacyNotice from '../../components/ui/PrivacyNotice';

const OnboardingKidsAges: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const kidsCount = profile?.kids_count || 1;
  const [kidsData, setKidsData] = useState<{name: string, birthdate: string}[]>(
    Array(kidsCount).fill(null).map(() => ({name: '', birthdate: ''}))
  );

  // Auto-save when kids data changes
  useEffect(() => {
    // Only save kids with both name and a valid birth date
    const validKids = kidsData.filter(kid => {
      const hasName = kid.name.trim() !== '';
      const hasBirthdate = kid.birthdate.trim() !== '';
      const isValidDate = hasBirthdate && !isNaN(Date.parse(kid.birthdate));
      return hasName && isValidDate;
    });

    if (validKids.length > 0) {
      const saveData = async () => {
        await saveKidsData(validKids);
      };
      saveData();
    }
  }, [kidsData]);

  const handleNameChange = (index: number, value: string) => {
    const newKidsData = [...kidsData];
    newKidsData[index] = { ...newKidsData[index], name: value };
    setKidsData(newKidsData);
  };

  const handleAgeChange = (index: number, value: string) => {
    const newKidsData = [...kidsData];
    newKidsData[index] = { ...newKidsData[index], birthdate: value };
    setKidsData(newKidsData);
  };

  const handleSave = async () => {
    const validKids = kidsData.filter(kid => kid.name.trim() !== '' && kid.birthdate.trim() !== '');
    if (validKids.length === kidsCount) {
      await saveKidsData(validKids);
      navigate('/onboarding/complete');
    }
  };

  const handleBack = () => {
    navigate('/onboarding/kids-count');
  };

  const handleSkip = () => {
    navigate('/onboarding/complete');
  };

  const allKidsCompleted = kidsData.every(kid => kid.name.trim() !== '' && kid.birthdate.trim() !== '');

  return (
    <OnboardingLayout 
      step={5} 
      total={5} 
      onBack={handleBack}
      onSkip={handleSkip}
    >
      <div className="space-y-8">
        {/* Main Card */}
        <div className="bg-white rounded-3xl shadow-lg p-8 space-y-6">
          {/* Step indicator */}
          <div className="text-center">
            <span className="text-sm font-medium text-gray-500">5/5</span>
          </div>

          {/* Greeting */}
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold text-gray-900">
              Hey, {profile?.first_name || 'there'}
            </h1>
            <p className="text-gray-500">
              Let's personalize Whisperoo for you...
            </p>
          </div>

          {/* Question: What are their ages? */}
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-800 text-center">
              Tell us about your kids
            </h2>
            
            <div className="space-y-6">
              {Array.from({ length: kidsCount }, (_, index) => (
                <div key={index} className="space-y-3 p-6 bg-gray-50 rounded-3xl">
                  <label className="text-gray-700 font-medium text-center block">
                    Child {index + 1}
                  </label>
                  <div className="space-y-3">
                    <Input
                      value={kidsData[index]?.name || ''}
                      onChange={(e) => handleNameChange(index, e.target.value)}
                      placeholder="First name"
                      className="w-full px-4 py-3 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-colors duration-200"
                    />
                    <Input
                      type="date"
                      value={kidsData[index]?.birthdate || ''}
                      onChange={(e) => handleAgeChange(index, e.target.value)}
                      max={new Date().toISOString().split('T')[0]}
                      className="w-full px-4 py-3 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-colors duration-200"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Privacy Notice */}
          <PrivacyNotice />
        </div>

        {/* Save Button */}
        {allKidsCompleted && (
          <div className="flex justify-center">
            <Button
              onClick={handleSave}
              className="w-full max-w-sm bg-indigo-600 text-white hover:bg-indigo-700 font-semibold rounded-3xl px-8 py-3.5 text-base transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-600 border-0 shadow-lg animate-fade-in"
            >
              Save
            </Button>
          </div>
        )}
      </div>
    </OnboardingLayout>
  );
};

export default OnboardingKidsAges;
