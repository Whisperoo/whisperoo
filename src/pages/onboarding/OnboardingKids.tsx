
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import OnboardingLayout from '../../components/layouts/OnboardingLayout';
import RadioButton from '../../components/ui/RadioButton';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { ArrowRight, Calendar } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { saveExpectingBaby, validateDueDate, formatDueDate } from '../../utils/kids';
import { Calendar as CalendarComponent } from '../../components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../../components/ui/popover';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import PrivacyNotice from '../../components/ui/PrivacyNotice';

const OnboardingKids: React.FC = () => {
  const navigate = useNavigate();
  const { profile, updateProfile } = useAuth();
  const [expectingStatus, setExpectingStatus] = useState<string>('');
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [expectedBabyName, setExpectedBabyName] = useState<string>('');
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Auto-save when selections change
  useEffect(() => {
    if (expectingStatus) {
      const saveData = async () => {
        setIsSaving(true);
        console.log('OnboardingKids: Saving data...', { expectingStatus, dueDate });
        
        try {
          const profileResult = await updateProfile({ expecting_status: expectingStatus as 'yes' | 'no' | 'trying' });
          console.log('Profile update result:', profileResult);
          
          if (expectingStatus === 'yes' && dueDate && expectedBabyName.trim()) {
            console.log('Saving expecting baby with due date and name:', dueDate.toISOString().split('T')[0], expectedBabyName);
            const result = await saveExpectingBaby(dueDate.toISOString().split('T')[0], expectedBabyName);
            console.log('Save expecting baby result:', result);
            
            if (!result.success) {
              console.error('Error saving expecting baby:', result.error);
            }
          }
          
          console.log('Profile and expecting data saved successfully');
        } catch (error) {
          console.error('Error in onboarding save:', error);
        } finally {
          setIsSaving(false);
        }
      };
      saveData();
    }
  }, [expectingStatus, dueDate, expectedBabyName, updateProfile]);

  const handleNext = () => {
    // For expecting status, ensure due date and name are provided if "yes" is selected
    if (expectingStatus === 'yes' && !dueDate) {
      toast({
        title: "Due date required",
        description: "Please select your due date to continue.",
        variant: "destructive",
      });
      return;
    }
    
    if (expectingStatus === 'yes' && !expectedBabyName.trim()) {
      toast({
        title: "Baby name required",
        description: "Please enter your baby's name to continue.",
        variant: "destructive",
      });
      return;
    }
    
    if (expectingStatus) {
      navigate('/onboarding/kids-count');
    }
  };

  const handleDateSelect = (selectedDate: Date | undefined) => {
    if (selectedDate) {
      const validation = validateDueDate(selectedDate);
      if (!validation.isValid) {
        toast({
          title: "Invalid due date",
          description: validation.error,
          variant: "destructive",
        });
        return;
      }
      setDueDate(selectedDate);
    }
    setIsCalendarOpen(false);
  };

  const handleBack = () => {
    navigate('/onboarding/role');
  };

  const handleSkip = () => {
    navigate('/onboarding/complete');
  };

  return (
    <OnboardingLayout 
      step={2} 
      total={5} 
      onBack={handleBack}
      onSkip={handleSkip}
    >
      <div className="space-y-8">
        {/* Main Card */}
        <div className="bg-white rounded-3xl shadow-lg p-8 space-y-6">
          {/* Step indicator */}
          <div className="text-center">
            <span className="text-sm font-medium text-gray-500">2/5</span>
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

          {/* Question: Are you expecting? */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-800 text-center">
              Are you expecting?
            </h2>
            <div className="space-y-3">
              <RadioButton
                name="expecting"
                value="yes"
                checked={expectingStatus === 'yes'}
                onChange={setExpectingStatus}
              >
                Yes
              </RadioButton>
              <RadioButton
                name="expecting"
                value="no"
                checked={expectingStatus === 'no'}
                onChange={setExpectingStatus}
              >
                No
              </RadioButton>
              <RadioButton
                name="expecting"
                value="trying"
                checked={expectingStatus === 'trying'}
                onChange={setExpectingStatus}
              >
                Trying
              </RadioButton>
            </div>
          </div>

          {/* Baby Details Section - Only show if expecting */}
          {expectingStatus === 'yes' && (
            <div className="space-y-6 animate-fade-in">
              <h3 className="text-lg font-medium text-gray-700 text-center">
                Tell us about your baby
              </h3>
              
              {/* Baby Name Input */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 text-center">
                  Baby's name (or what you're calling them)
                </label>
                <Input
                  value={expectedBabyName}
                  onChange={(e) => setExpectedBabyName(e.target.value)}
                  placeholder="Baby name"
                  className="w-full px-4 py-3 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-action-primary focus:border-transparent transition-colors duration-200"
                />
              </div>
              
              {/* Due Date Input */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 text-center">
                  When are you due?
                </label>
                <div className="space-y-2">
                <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal px-4 py-3 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-action-primary focus:border-transparent transition-colors duration-200",
                        !dueDate && "text-muted-foreground"
                      )}
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      {dueDate ? (
                        <span className="text-gray-800 font-medium">
                          {formatDueDate(dueDate)}
                        </span>
                      ) : (
                        <span>Select due date</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={dueDate}
                      onSelect={handleDateSelect}
                      disabled={(date) => {
                        const today = new Date();
                        const minDate = new Date(today.getTime() + (7 * 24 * 60 * 60 * 1000)); // 1 week from now
                        const maxDate = new Date(today.getTime() + (45 * 7 * 24 * 60 * 60 * 1000)); // 45 weeks from now
                        return date < minDate || date > maxDate;
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                {dueDate && (
                  <p className="text-sm text-gray-500 text-center">
                    Due Date
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

          {/* Saving indicator */}
          {isSaving && (
            <div className="text-center text-sm text-gray-500">
              <div className="inline-flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-action-primary"></div>
                <span>Saving...</span>
              </div>
            </div>
          )}

          {/* Privacy Notice */}
          <PrivacyNotice />
        </div>

        {/* Next Button */}
        {expectingStatus && (expectingStatus !== 'yes' || (dueDate && expectedBabyName.trim())) && (
          <div className="flex justify-center">
            <Button
              onClick={handleNext}
              disabled={isSaving}
              className="flex items-center space-x-2 animate-fade-in bg-action-primary text-white hover:bg-indigo-800 font-semibold rounded-3xl px-8 py-3.5 text-base transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-action-primary border-0 shadow-lg disabled:opacity-50"
            >
              <span>Next</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>
    </OnboardingLayout>
  );
};

export default OnboardingKids;
