
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import OnboardingLayout from '../../components/layouts/OnboardingLayout';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { ArrowRight, Plus, Minus } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { saveKidsData } from '../../utils/auth';
import PrivacyNotice from '../../components/ui/PrivacyNotice';
import { calculateAge, validateBirthDate } from '../../utils/age';

const OnboardingKidsCount: React.FC = () => {
  const navigate = useNavigate();
  const { profile, updateProfile } = useAuth();
  const [hasKids, setHasKids] = useState<string>('');
  const [kidsCount, setKidsCount] = useState<number>(1);
  const [kidsData, setKidsData] = useState<{name: string, birthdate: string}[]>([]);
  const [showKidsDetails, setShowKidsDetails] = useState<boolean>(false);

  // Initialize kids data when count changes
  useEffect(() => {
    if (hasKids === 'yes' && kidsCount > 0) {
      setKidsData(Array(kidsCount).fill(null).map(() => ({name: '', birthdate: ''})));
    }
  }, [hasKids, kidsCount]);

  // Auto-save when selections change
  useEffect(() => {
    if (hasKids) {
      const saveData = async () => {
        const hasKidsBoolean = hasKids === 'yes';
        const finalKidsCount = hasKidsBoolean ? kidsCount : 0;
        
        await updateProfile({ 
          has_kids: hasKidsBoolean, 
          kids_count: finalKidsCount 
        });
      };
      saveData();
    }
  }, [hasKids, kidsCount, updateProfile]);

  // Auto-save kids data with debouncing to prevent duplicates
  useEffect(() => {
    const validKids = kidsData.filter(kid => kid.name.trim() !== '' && kid.birthdate.trim() !== '');
    if (validKids.length > 0) {
      // Debounce the save operation to prevent rapid-fire saves
      const timeoutId = setTimeout(async () => {
        await saveKidsData(validKids);
      }, 1000); // Wait 1 second after user stops typing
      
      return () => clearTimeout(timeoutId);
    }
  }, [kidsData]);

  const handleNext = () => {
    if (hasKids === 'no') {
      navigate('/onboarding/parenting-styles');
    } else if (hasKids === 'yes' && !showKidsDetails) {
      setShowKidsDetails(true);
    } else if (showKidsDetails) {
      const validKids = kidsData.filter(kid => kid.name.trim() !== '' && kid.birthdate.trim() !== '');
      if (validKids.length === kidsCount) {
        navigate('/onboarding/parenting-styles');
      }
    }
  };

  const handleBack = () => {
    if (showKidsDetails) {
      setShowKidsDetails(false);
    } else {
      navigate('/onboarding/kids');
    }
  };

  const handleSkip = () => {
    navigate('/onboarding/complete');
  };

  const incrementCount = () => {
    setKidsCount(prev => Math.min(prev + 1, 10));
  };

  const decrementCount = () => {
    setKidsCount(prev => Math.max(prev - 1, 1));
  };

  const handleNameChange = (index: number, value: string) => {
    const newKidsData = [...kidsData];
    newKidsData[index] = { ...newKidsData[index], name: value };
    setKidsData(newKidsData);
  };

  const handleBirthdateChange = (index: number, value: string) => {
    const newKidsData = [...kidsData];
    newKidsData[index] = { ...newKidsData[index], birthdate: value };
    setKidsData(newKidsData);
  };

  return (
    <OnboardingLayout 
      step={3} 
      total={6} 
      onBack={handleBack}
      onSkip={handleSkip}
    >
      <div className="space-y-8">
        {/* Main Card */}
        <div className="bg-white rounded-3xl shadow-lg p-8 space-y-6">
          {/* Step indicator */}
          <div className="text-center">
            <span className="text-sm font-medium text-gray-500">3/6</span>
          </div>

          {/* Greeting */}
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold text-gray-900">
              Hey, {profile?.first_name || 'there'}!
            </h1>
            <p className="text-gray-500">
              Let's personalize Whisperoo for you...
            </p>
          </div>

          {!showKidsDetails ? (
            <>
              {/* Question 1: Do you have kids? */}
              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-gray-800 text-center">
                  Do you have kids?
                </h2>
                <div className="flex space-x-4 justify-center">
                  <button
                    onClick={() => setHasKids('yes')}
                    className={`px-8 py-3 rounded-3xl font-medium transition-all duration-200 ${
                      hasKids === 'yes'
                        ? 'bg-action-primary text-white shadow-lg'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Yes
                  </button>
                  <button
                    onClick={() => setHasKids('no')}
                    className={`px-8 py-3 rounded-3xl font-medium transition-all duration-200 ${
                      hasKids === 'no'
                        ? 'bg-action-primary text-white shadow-lg'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    No
                  </button>
                </div>
              </div>

              {/* Question 2: How many? (only show if has kids) */}
              {hasKids === 'yes' && (
                <div className="space-y-4 animate-fade-in">
                  <h3 className="text-lg font-medium text-gray-700 text-center">
                    How many?
                  </h3>
                  <div className="flex items-center justify-center space-x-6">
                    <button
                      onClick={decrementCount}
                      className="flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors duration-200 shadow-sm"
                      disabled={kidsCount <= 1}
                    >
                      <Minus className="w-5 h-5 text-gray-600" />
                    </button>
                    <div className="flex items-center justify-center w-20 h-20 rounded-full bg-indigo-50 border-2 border-indigo-200 shadow-sm">
                      <span className="text-3xl font-bold text-action-primary">{kidsCount}</span>
                    </div>
                    <button
                      onClick={incrementCount}
                      className="flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors duration-200 shadow-sm"
                      disabled={kidsCount >= 10}
                    >
                      <Plus className="w-5 h-5 text-gray-600" />
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Kids Details Form */
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-800 text-center">
                Tell us about your {kidsCount === 1 ? 'child' : 'children'}
              </h2>
              {kidsData.map((kid, index) => (
                <div key={index} className="space-y-3 p-6 bg-gray-50 rounded-3xl">
                  <h3 className="text-md font-medium text-gray-700">
                    Child {index + 1}
                  </h3>
                  <div className="space-y-3">
                    <Input
                      value={kid.name}
                      onChange={(e) => handleNameChange(index, e.target.value)}
                      placeholder="Name"
                      className="w-full px-4 py-3 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-action-primary focus:border-transparent transition-colors duration-200"
                    />
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Birthdate
                      </label>
                      <Input
                        type="date"
                        value={kid.birthdate}
                        onChange={(e) => handleBirthdateChange(index, e.target.value)}
                        placeholder="Select birthdate"
                        className="w-full px-4 py-3 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-action-primary focus:border-transparent transition-colors duration-200"
                      />
                      {kid.birthdate && validateBirthDate(kid.birthdate).isValid && (
                        <p className="text-sm text-gray-600 px-2">
                          Age: {calculateAge(kid.birthdate)}
                        </p>
                      )}
                      {kid.birthdate && !validateBirthDate(kid.birthdate).isValid && (
                        <p className="text-sm text-red-500 px-2">
                          {validateBirthDate(kid.birthdate).error}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Privacy Notice */}
          <PrivacyNotice />
        </div>

        {/* Next Button */}
        {((hasKids === 'no') || (hasKids === 'yes' && !showKidsDetails) || (showKidsDetails && kidsData.filter(kid => kid.name.trim() !== '' && kid.birthdate.trim() !== '').length === kidsCount)) && (
          <div className="flex justify-center">
            <Button
              onClick={handleNext}
              className="flex items-center space-x-2 animate-fade-in bg-action-primary text-white hover:bg-indigo-800 font-semibold rounded-3xl px-8 py-3.5 text-base transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-action-primary border-0 shadow-lg"
            >
              <span>{showKidsDetails ? 'Next' : (hasKids === 'yes' ? 'Continue' : 'Next')}</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>
    </OnboardingLayout>
  );
};

export default OnboardingKidsCount;
