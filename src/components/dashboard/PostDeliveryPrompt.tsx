import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { calculateAgeInYears } from '@/utils/age';
import { Baby, Calendar, ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';

interface ExpectingKid {
  id: string;
  expected_name?: string;
  first_name?: string;
  due_date?: string | null;
}

interface PostDeliveryPromptProps {
  expectingKids: ExpectingKid[];
  onBirthRecorded: () => void;
}

/**
 * PostDeliveryPrompt — Dashboard card for pregnant users to record baby's birth.
 * Shown when user has at least one kid with is_expecting = true.
 * Entering DOB flips the kid record from expecting → born (postpartum).
 */
const PostDeliveryPrompt: React.FC<PostDeliveryPromptProps> = ({ expectingKids, onBirthRecorded }) => {
  const { t } = useTranslation();
  const { user, updateProfile } = useAuth();
  const [selectedKid, setSelectedKid] = useState<string | null>(null);
  const [birthDate, setBirthDate] = useState('');
  const [babyName, setBabyName] = useState('');
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Set default selected kid when data loads
  React.useEffect(() => {
    if (expectingKids.length > 0 && !selectedKid) {
      setSelectedKid(expectingKids[0].id);
    }
  }, [expectingKids, selectedKid]);

  const handleRecordBirth = async () => {
    if (!user || !selectedKid || !birthDate) return;

    // Validate birth date is not in the future
    const bDate = new Date(birthDate);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (bDate > today) {
      toast({
        title: t('postDelivery.form.invalidDate'),
        description: t('postDelivery.form.invalidDateDescription'),
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      // Update the kid record: flip from expecting → born
      const formattedDate = new Date(birthDate).toISOString().split('T')[0];
      const updateData: Record<string, unknown> = {
        is_expecting: false,
        due_date: null,
        birth_date: formattedDate,
        age: calculateAgeInYears(formattedDate).toString()
      };
      if (babyName.trim()) {
        updateData.first_name = babyName.trim();
      }

      console.log('[PostDeliveryPrompt] Updating kid:', selectedKid);
      console.log('[PostDeliveryPrompt] Update payload prepared');

      const { data, error, status, statusText } = await supabase
        .from('kids')
        .update(updateData)
        .eq('id', selectedKid)
        .select();

      console.log('[PostDeliveryPrompt] Response status:', status, statusText);
      console.log('[PostDeliveryPrompt] Response data:', data);
      console.log('[PostDeliveryPrompt] Response error:', error);

      if (error) {
        console.error('[PostDeliveryPrompt] Supabase error details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
        });
        throw error;
      }

      // Update parent profile expecting status if no more expecting kids
      const remainingExpecting = expectingKids.filter(k => k.id !== selectedKid);
      if (remainingExpecting.length === 0) {
        await updateProfile({ expecting_status: 'no' });
      }

      toast({
        title: t('postDelivery.form.successTitle'),
        description: t('postDelivery.form.successDescription'),
      });

      onBirthRecorded();
    } catch (err: any) {
      console.error('Error recording birth:', err);
      const errMsg = err?.message || err?.details || err?.hint || (typeof err === 'object' ? JSON.stringify(err) : String(err));
      toast({
        title: t('postDelivery.form.errorTitle'),
        description: errMsg || t('postDelivery.form.errorDescription'),
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const kid = expectingKids.find(k => k.id === selectedKid);
  const kidDisplayName = kid?.expected_name || kid?.first_name || 'your baby';

  if (!showForm) {
    return (
      <div className="bg-brand-light/30 rounded-xl shadow-card p-5 border border-brand-primary/20 transition-all duration-300">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-brand-primary rounded-xl flex items-center justify-center shadow-md flex-shrink-0">
            <Baby className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-bold text-gray-900 mb-1">
              {t('postDelivery.preview.title')}
            </h3>
            <p className="text-sm text-gray-600 mb-3 leading-relaxed">
              {t('postDelivery.preview.description', { name: kidDisplayName })}
            </p>
            <Button
              onClick={() => setShowForm(true)}
              className="bg-brand-primary hover:bg-brand-primary/90 text-white font-semibold text-sm rounded-lg px-4 py-2 shadow-sm transition-all duration-200"
            >
              <Sparkles className="w-4 h-4 mr-1.5" />
              {t('postDelivery.preview.recordButton')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-brand-light/30 rounded-xl shadow-card p-5 border border-brand-primary/20 transition-all duration-300">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-brand-primary rounded-lg flex items-center justify-center shadow-sm">
          <Baby className="w-5 h-5 text-white" />
        </div>
        <h3 className="text-base font-bold text-gray-900">
          {t('postDelivery.form.title')}
        </h3>
      </div>

      {/* Baby selector if multiple expecting */}
      {expectingKids.length > 1 && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('postDelivery.form.whichBaby')}</label>
          <div className="flex flex-wrap gap-2">
            {expectingKids.map(k => (
              <button
                key={k.id}
                onClick={() => setSelectedKid(k.id)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                  selectedKid === k.id
                    ? 'bg-brand-primary text-white shadow-sm'
                    : 'bg-white text-gray-700 border border-gray-200 hover:border-brand-primary/50'
                }`}
              >
                {k.expected_name || k.first_name || 'Baby'}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Baby name update */}
      <div className="mb-3">
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          {t('postDelivery.form.babyNameLabel')}
        </label>
        <Input
          value={babyName}
          onChange={(e) => setBabyName(e.target.value)}
          placeholder={kidDisplayName}
          className="w-full rounded-lg border-gray-200 focus:ring-brand-primary focus:border-brand-primary"
        />
      </div>

      {/* Birth date */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          <Calendar className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
          {t('postDelivery.form.dateOfBirthLabel')}
        </label>
        <Input
          type="date"
          value={birthDate}
          onChange={(e) => setBirthDate(e.target.value)}
          max={new Date().toISOString().split('T')[0]}
          className="w-full rounded-lg border-gray-200 focus:ring-brand-primary focus:border-brand-primary"
        />
      </div>

      <div className="flex gap-2">
        <Button
          variant="outline"
          onClick={() => setShowForm(false)}
          className="flex-1 rounded-lg text-sm"
        >
          {t('postDelivery.form.cancelButton')}
        </Button>
        <Button
          onClick={handleRecordBirth}
          disabled={!selectedKid || !birthDate || saving}
          className="flex-1 bg-brand-primary hover:bg-brand-primary/90 text-white font-semibold rounded-lg text-sm disabled:opacity-50 transition-all duration-200"
        >
          {saving ? (
            <div className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              {t('postDelivery.form.savingButton')}
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              {t('postDelivery.form.saveButton')} <ArrowRight className="w-3.5 h-3.5" />
            </div>
          )}
        </Button>
      </div>
    </div>
  );
};

export default PostDeliveryPrompt;
