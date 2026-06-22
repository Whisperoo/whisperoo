import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import OnboardingLayout from '../../components/layouts/OnboardingLayout';
import { Button } from '../../components/ui/button';
import { ArrowRight, Stethoscope } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { toast } from '@/hooks/use-toast';

const OnboardingReferred: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();

  const [nurseName, setNurseName] = useState('');
  const [knowsName, setKnowsName] = useState(true);
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  // Only hospital users reach this page — B2C users skip straight to kids
  useEffect(() => {
    if (profile && !profile.tenant_id) {
      navigate('/onboarding/kids', { replace: true });
    }
  }, [profile, navigate]);

  const handleBack = () => navigate('/onboarding/hospital-check');
  const handleSkip = () => navigate('/onboarding/kids');

  const handleContinue = async () => {
    const nameValue = knowsName ? nurseName.trim() : '';
    const hintValue = !knowsName ? description.trim() : '';

    // Nothing entered — treat as skip
    if (!nameValue && !hintValue) {
      navigate('/onboarding/kids');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.rpc('fn_save_nurse_referral', {
        p_nurse_name:    nameValue || null,
        p_referral_hint: hintValue || null,
      });
      if (error) throw error;
    } catch (err: any) {
      console.error('fn_save_nurse_referral error:', err);
      toast({
        title: 'Could not save referral',
        description: "We'll continue without it — you can always update later.",
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
      navigate('/onboarding/kids');
    }
  };

  const canContinue = knowsName ? nurseName.trim().length > 0 : description.trim().length > 0;

  return (
    <OnboardingLayout onBack={handleBack} onSkip={handleSkip}>
      <div className="space-y-8">
        <div className="bg-white rounded-3xl shadow-lg p-8 space-y-6">

          {/* Header */}
          <div className="text-center space-y-2">
            <div className="flex justify-center mb-4">
              <div className="w-14 h-14 bg-indigo-50 rounded-full flex items-center justify-center">
                <Stethoscope className="w-7 h-7 text-indigo-600" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">
              Did a nurse or staff member tell you about Whisperoo?
            </h1>
            <p className="text-gray-500 text-sm">
              Enter their name if you'd like to help us recognize them.
              Otherwise, feel free to skip.
            </p>
          </div>

          {/* Input */}
          {knowsName ? (
            <div className="space-y-2">
              <input
                type="text"
                value={nurseName}
                onChange={(e) => setNurseName(e.target.value)}
                placeholder="Nurse or staff member's first and last name"
                className="w-full px-4 py-3 border border-gray-300 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-600 focus:border-transparent outline-none transition-colors"
              />
            </div>
          ) : (
            <div className="space-y-2">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe them — their role, what they were wearing, which floor or department, anything that helps us identify who told you about Whisperoo."
                rows={4}
                className="w-full px-4 py-3 border border-gray-300 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-600 focus:border-transparent outline-none transition-colors resize-none"
              />
            </div>
          )}

          {/* Toggle */}
          <button
            type="button"
            onClick={() => {
              setKnowsName((prev) => !prev);
              setNurseName('');
              setDescription('');
            }}
            className="text-sm text-indigo-600 hover:text-indigo-700 underline underline-offset-2 w-full text-center"
          >
            {knowsName
              ? "I don't know their name"
              : 'I know their name — let me enter it'}
          </button>

          {/* Footer note */}
          <p className="text-xs text-gray-400 text-center leading-relaxed">
            We use this information to recognize team members who help the most
            families discover Whisperoo.
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col items-center gap-3">
          <Button
            onClick={handleContinue}
            disabled={saving}
            className="flex items-center space-x-2 bg-indigo-600 text-white hover:bg-indigo-700 font-semibold rounded-3xl px-8 py-3.5 text-base transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-600 border-0 shadow-lg disabled:opacity-50"
          >
            <span>{saving ? 'Saving…' : canContinue ? 'Continue' : 'Skip'}</span>
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </OnboardingLayout>
  );
};

export default OnboardingReferred;
