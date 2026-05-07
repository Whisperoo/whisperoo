import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import OnboardingLayout from '../../components/layouts/OnboardingLayout';
import RadioButton from '../../components/ui/RadioButton';
import { Button } from '../../components/ui/button';
import { ArrowRight, Building2, Stethoscope } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { toast } from '@/hooks/use-toast';
import PrivacyNotice from '../../components/ui/PrivacyNotice';
import { useTranslation } from 'react-i18next';

interface ActiveTenant {
  id: string;
  slug: string;
  name: string;
  config: {
    branding?: {
      primary_color?: string;
      logo_url?: string;
      display_name?: string;
    };
    departments?: Array<{
      name: string;
      phone?: string;
      email?: string;
    }>;
  } | null;
}

const OnboardingHospitalCheck: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { profile, refreshProfile } = useAuth();
  const [activeTenants, setActiveTenants] = useState<ActiveTenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPatient, setIsPatient] = useState<string>('');
  const [selectedTenantId, setSelectedTenantId] = useState<string>('');
  const [selectedDept, setSelectedDept] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  // If user already has a tenant_id (came via QR code), skip this step
  useEffect(() => {
    if (profile?.tenant_id) {
      navigate('/onboarding/kids');
    }
  }, [profile?.tenant_id, navigate]);

  // Fetch active hospital tenants
  useEffect(() => {
    const fetchTenants = async () => {
      try {
        const { data, error } = await supabase
          .from('tenants')
          .select('*')
          .eq('is_active', true);

        if (error) throw error;

        setActiveTenants(data || []);
      } catch (err) {
        console.error('Error fetching tenants:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchTenants();
  }, []);

  // If no active tenants, skip this step entirely (pure B2C)
  useEffect(() => {
    if (!loading && activeTenants.length === 0) {
      navigate('/onboarding/kids');
    }
  }, [loading, activeTenants, navigate]);

  const selectedTenant = activeTenants.find(t => t.id === selectedTenantId);
  const departments = selectedTenant?.config?.departments || [];

  const handleNext = async () => {
    if (isPatient === 'no') {
      // B2C user — no tenant affiliation
      navigate('/onboarding/kids');
      return;
    }

    if (isPatient === 'yes' && selectedTenantId) {
      setIsSaving(true);
      try {
        // Use a SECURITY DEFINER RPC to bypass the RLS recursion on profiles
        const { error } = await supabase.rpc('fn_link_user_to_hospital', {
          p_tenant_id: selectedTenantId,
          p_department: selectedDept || null,
        });

        if (error) throw error;

        // Refresh the local profile state after successful RPC
        await refreshProfile();

        toast({
          title: t('onboarding.hospitalCheck.toast.hospitalLinked'),
          description: t('onboarding.hospitalCheck.toast.connectedTo', { name: selectedTenant?.config?.branding?.display_name || selectedTenant?.name }),
        });

        navigate('/onboarding/kids');
      } catch (err: any) {
        console.error('Error linking hospital:', err);
        toast({
          title: t('onboarding.hospitalCheck.toast.error'),
          description: t('onboarding.hospitalCheck.toast.errorDesc'),
          variant: 'destructive',
        });
        navigate('/onboarding/kids');
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleBack = () => {
    navigate('/onboarding/role');
  };

  const handleSkip = () => {
    navigate('/onboarding/kids');
  };

  if (loading) {
    return (
      <OnboardingLayout step={2} total={6} onBack={handleBack} onSkip={handleSkip}>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
        </div>
      </OnboardingLayout>
    );
  }

  const canProceed =
    isPatient === 'no' ||
    (isPatient === 'yes' && selectedTenantId && (departments.length === 0 || selectedDept));

  return (
    <OnboardingLayout step={2} total={6} onBack={handleBack} onSkip={handleSkip}>
      <div className="space-y-8">
        {/* Main Card */}
        <div className="bg-white rounded-3xl shadow-lg p-8 space-y-6">
          {/* Step indicator */}
          <div className="text-center">
            <span className="text-sm font-medium text-gray-500">2/6</span>
          </div>

          {/* Question */}
          <div className="text-center space-y-2">
            <div className="flex justify-center mb-4">
              <div className="w-14 h-14 bg-indigo-50 rounded-full flex items-center justify-center">
                <Building2 className="w-7 h-7 text-indigo-600" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">
              {t('onboarding.hospitalCheck.question')}
            </h1>
            <p className="text-gray-500 text-sm">
              {t('onboarding.hospitalCheck.subtitle')}
            </p>
          </div>

          {/* Yes/No Radio */}
          <div className="space-y-3">
            <RadioButton
              name="isPatient"
              value="yes"
              checked={isPatient === 'yes'}
              onChange={setIsPatient}
            >
              {t('onboarding.hospitalCheck.yesPatient')}
            </RadioButton>
            <RadioButton
              name="isPatient"
              value="no"
              checked={isPatient === 'no'}
              onChange={setIsPatient}
            >
              {t('onboarding.hospitalCheck.noIndependent')}
            </RadioButton>
          </div>

          {/* Hospital Selection (only if "yes") */}
          {isPatient === 'yes' && (
            <div className="space-y-4 animate-fade-in">
              <h3 className="text-lg font-semibold text-gray-800 text-center">
                {t('onboarding.hospitalCheck.selectHospital')}
              </h3>
              <div className="space-y-3">
                {activeTenants.map((tenant) => (
                  <button
                    key={tenant.id}
                    onClick={() => {
                      setSelectedTenantId(tenant.id);
                      setSelectedDept('');
                    }}
                    className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all duration-200 text-left ${
                      selectedTenantId === tenant.id
                        ? 'border-indigo-600 bg-indigo-50 shadow-sm'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    {tenant.config?.branding?.logo_url ? (
                      <img
                        src={tenant.config.branding.logo_url}
                        alt={tenant.name}
                        className="w-12 h-12 object-contain rounded-lg bg-white p-1 border border-gray-100"
                      />
                    ) : (
                      <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-600 font-bold text-lg">
                        {tenant.name.charAt(0)}
                      </div>
                    )}
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">
                        {tenant.config?.branding?.display_name || tenant.name}
                      </p>
                      {tenant.config?.departments && tenant.config.departments.length > 0 && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          {tenant.config.departments.length} {tenant.config.departments.length > 1 ? t('onboarding.hospitalCheck.departments') : t('onboarding.hospitalCheck.department')}
                        </p>
                      )}
                    </div>
                    {selectedTenantId === tenant.id && (
                      <div className="w-6 h-6 bg-indigo-600 rounded-full flex items-center justify-center flex-shrink-0">
                        <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </button>
                ))}
              </div>

              {/* Department Selection (only if hospital selected and has departments) */}
              {selectedTenantId && departments.length > 0 && (
                <div className="space-y-3 animate-fade-in">
                  <h3 className="text-base font-semibold text-gray-700 text-center flex items-center justify-center gap-2">
                    <Stethoscope className="w-4 h-4" />
                    {t('onboarding.hospitalCheck.whichDepartment')}
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    {departments.map((dept, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedDept(dept.name)}
                        className={`p-3 rounded-xl border-2 text-sm font-medium transition-all duration-200 ${
                          selectedDept === dept.name
                            ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                            : 'border-gray-200 text-gray-700 hover:border-gray-300'
                        }`}
                      >
                        {dept.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Privacy Notice */}
          <PrivacyNotice />
        </div>

        {/* Next Button */}
        {canProceed && (
          <div className="flex justify-center">
            <Button
              onClick={handleNext}
              disabled={isSaving}
              className="flex items-center space-x-2 animate-fade-in bg-indigo-600 text-white hover:bg-indigo-700 font-semibold rounded-3xl px-8 py-3.5 text-base transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-600 border-0 shadow-lg disabled:opacity-50"
            >
              <span>{isSaving ? t('onboarding.common.saving') : t('onboarding.common.next')}</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>
    </OnboardingLayout>
  );
};

export default OnboardingHospitalCheck;
