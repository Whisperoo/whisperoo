import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import AuthLayout from '../../components/layouts/AuthLayout';
import BackButton from '../../components/ui/BackButton';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import Divider from '../../components/ui/Divider';
import { Checkbox } from '../../components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n/config';
import { TermsOfServiceContent, PrivacyPolicyContent } from '@/components/legal/LegalDocuments';
import { isComingSoonTenant } from '@/config/comingSoon';
import { formatUsPhone, isValidUsPhone } from '@/utils/phone';
import { LANDING_URL } from '@/config/urls';

const LANGUAGES = [
  { code: 'en', flag: '🇺🇸', label: 'English' },
  { code: 'es', flag: '🇲🇽', label: 'Español' },
  { code: 'vi', flag: '🇻🇳', label: 'Tiếng Việt' },
] as const;
const LANGUAGE_STORAGE_KEY = 'whisperoo-language';

const CreateAccount: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { signUp, user, profile } = useAuth();
  const [formData, setFormData] = useState({
    firstName: '',
    phoneNumber: '',
    email: '',
    password: '',
    agreeToTerms: false
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [waitingForProfile, setWaitingForProfile] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<string>(
    () => (typeof window !== 'undefined' ? window.localStorage.getItem(LANGUAGE_STORAGE_KEY) : null) || 'en'
  );

  const handleLanguageSelect = (lang: string) => {
    setSelectedLanguage(lang);
    i18n.changeLanguage(lang);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
    }
  };

  // MT.3 Tenant Detection
  const tenantSlug = searchParams.get('tenant');
  const querySource = searchParams.get('source');
  const queryDept = searchParams.get('dept');
  const queryQr = searchParams.get('qr');
  const [tenantInfo, setTenantInfo] = useState<any>(null);
  const [resolvedQrToken, setResolvedQrToken] = useState<string | null>(queryQr || null);

  // Redirect coming-soon tenants (e.g. SJMC pre-launch) to the waitlist page
  // before any signup form renders.
  useEffect(() => {
    if (isComingSoonTenant(tenantSlug)) {
      navigate(`/coming-soon?${searchParams.toString()}`, { replace: true });
    }
  }, [tenantSlug, searchParams, navigate]);

  useEffect(() => {
    if (tenantSlug && !isComingSoonTenant(tenantSlug)) {
      supabase.from('tenants').select('*').eq('slug', tenantSlug).single()
        .then(({ data }) => setTenantInfo(data));
    }
  }, [tenantSlug]);

  // Log a QR scan event on page load so raw scan counts are tracked even when
  // the user doesn't complete signup. Runs once when tenantInfo resolves.
  useEffect(() => {
    if (!tenantInfo?.id) return;
    const logScan = async () => {
      let token = queryQr;
      if (!token) {
        const { data: autoQr } = await supabase
          .from('qr_codes')
          .select('token, id')
          .eq('tenant_id', tenantInfo.id)
          .eq('is_active', true)
          .limit(1)
          .maybeSingle();
        token = autoQr?.token ?? null;
      }
      if (!token) return;
      setResolvedQrToken(token);
      const { data: qrRow } = await supabase
        .from('qr_codes')
        .select('id')
        .eq('token', token)
        .maybeSingle();
      if (!qrRow?.id) return;
      await supabase.from('qr_events').insert({
        qr_code_id: qrRow.id,
        event_type: 'scan',
        anon_id: null,
        user_id: null,
        metadata: { tenant_slug: tenantSlug, source: querySource || 'qr_hospital' },
      });
    };
    logScan();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantInfo?.id]);

  const handleSkipAffiliation = () => {
    setTenantInfo(null);
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('tenant');
    newParams.delete('source');
    newParams.delete('dept');
    setSearchParams(newParams, { replace: true });
  };

  // Watch for profile to be loaded after signup
  useEffect(() => {
    console.log('CreateAccount useEffect:', { waitingForProfile, user: !!user, profile: !!profile });
    if (waitingForProfile && user && profile) {
      console.log('Profile loaded, navigating to onboarding');
      setIsLoading(false);
      navigate('/onboarding/role');
    }
  }, [waitingForProfile, user, profile, navigate]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.firstName.trim()) {
      newErrors.firstName = t('auth.createAccount.errors.firstNameRequired');
    }

    if (!formData.phoneNumber.trim()) {
      newErrors.phoneNumber = 'Phone number is required.';
    } else if (!isValidUsPhone(formData.phoneNumber)) {
      newErrors.phoneNumber = 'Enter a 10-digit US phone number — we\'ll format it as (XXX) XXX-XXXX.';
    }

    if (!formData.email.trim()) {
      newErrors.email = t('auth.createAccount.errors.emailRequired');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = t('auth.createAccount.errors.invalidEmail');
    }

    if (!formData.password.trim()) {
      newErrors.password = t('auth.createAccount.errors.passwordRequired');
    } else if (formData.password.length < 6) {
      newErrors.password = t('auth.createAccount.errors.passwordLength');
    }

    if (!formData.agreeToTerms) {
      newErrors.agreeToTerms = t('auth.createAccount.errors.agreeTermsRequired');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setIsLoading(true);
    console.log('Creating account...');
    
    try {
      // resolvedQrToken is set on page load by the scan-logging useEffect,
      // so no second lookup is needed here.
      const effectiveQrToken = resolvedQrToken;
      const acquisitionSource = querySource || (effectiveQrToken ? 'qr_hospital' : tenantSlug ? 'hospital_direct' : 'organic');
      const acquisitionDept = queryDept || null;
      const { user, error } = await signUp(
        formData.email,
        formData.password,
        formData.firstName,
        formData.phoneNumber,
        tenantInfo?.id,
        acquisitionSource,
        acquisitionDept,
        effectiveQrToken,
        selectedLanguage
      );
      
      if (error) {
        console.error('Sign-up error:', error);
        toast({
          title: t('auth.createAccount.toast.errorCreating'),
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      if (user) {
        console.log('Account created successfully:', user.id);
        toast({
          title: t('auth.createAccount.toast.success'),
          description: t('auth.createAccount.toast.welcome'),
        });
        
        // Wait for profile to be loaded
        setWaitingForProfile(true);
        setIsLoading(true); // Keep loading state while waiting for profile
      } else {
        console.error('No user returned from signUp');
        toast({
          title: t('auth.createAccount.toast.errorCreating'),
          description: t('auth.createAccount.toast.tryAgainLater'),
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Sign-up error:', error);
      toast({
        title: t('auth.createAccount.toast.errorCreating'),
        description: t('auth.createAccount.toast.tryAgainLater'),
        variant: "destructive",
      });
    } finally {
      if (!user) {
        setIsLoading(false);
      }
      // Keep loading if we're waiting for profile
    }
  };

  const isFormValid = formData.firstName.trim() &&
                     isValidUsPhone(formData.phoneNumber) &&
                     formData.email.trim() &&
                     formData.password.trim() &&
                     formData.agreeToTerms;

  return (
    <AuthLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <BackButton onClick={() => window.location.href = LANDING_URL} />
          <Link 
            to="/auth/login" 
            className="text-indigo-700 text-sm font-medium hover:underline"
          >
            {t('auth.createAccount.applyExpert')}
          </Link>
        </div>

        {/* Language selector */}
        <div className="flex justify-center gap-2">
          {LANGUAGES.map((lang) => {
            const isActive = selectedLanguage === lang.code;
            return (
              <button
                key={lang.code}
                type="button"
                onClick={() => handleLanguageSelect(lang.code)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all ${
                  isActive
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                    : 'border-gray-200 text-gray-500 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50/50'
                }`}
                style={isActive && tenantInfo?.config?.branding?.primary_color ? {
                  borderColor: tenantInfo.config.branding.primary_color,
                  backgroundColor: `${tenantInfo.config.branding.primary_color}15`,
                  color: tenantInfo.config.branding.primary_color,
                } : {}}
              >
                <span>{lang.flag}</span>
                <span>{lang.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl md:text-5xl font-bold text-indigo-700 transition-colors" style={tenantInfo?.config?.branding?.primary_color ? { color: tenantInfo.config.branding.primary_color } : {}}>
            {tenantInfo ? t('auth.createAccount.welcomeTo', { name: tenantInfo.name }) : t('auth.createAccount.title')}
          </h1>
          <p className="text-gray-500 text-lg">
            {tenantInfo && queryDept 
              ? t('auth.createAccount.signingUpVia', { name: tenantInfo.config?.branding?.display_name || tenantInfo.name, dept: queryDept.toUpperCase() })
              : t('auth.createAccount.subtitle')}
          </p>
          
          {tenantInfo && (
            <div className="mt-4 pt-4 flex flex-col items-center gap-2">
              <button 
                onClick={handleSkipAffiliation}
                type="button"
                className="text-xs text-gray-400 hover:text-indigo-600 underline transition-colors"
              >
                Not a patient here? Continue directly to Whisperoo
              </button>
            </div>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6 max-w-md mx-auto">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              {t('auth.createAccount.firstNameLabel')}
            </label>
            <Input
              value={formData.firstName}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              placeholder={t('auth.createAccount.firstNamePlaceholder')}
              className={`w-full px-4 py-3 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-indigo-700 focus:border-transparent transition-colors duration-200 ${
                errors.firstName ? 'border-red-500' : ''
              }`}
            />
            {errors.firstName && (
              <p className="text-sm text-red-600" role="alert" aria-live="assertive">
                {errors.firstName}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Phone Number <span className="text-red-500">*</span>
            </label>
            <Input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={formData.phoneNumber}
              onChange={(e) => setFormData({ ...formData, phoneNumber: formatUsPhone(e.target.value) })}
              placeholder="(555) 123-4567"
              maxLength={14}
              className={`w-full px-4 py-3 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-indigo-700 focus:border-transparent transition-colors duration-200 ${
                errors.phoneNumber ? 'border-red-500' : ''
              }`}
            />
            {errors.phoneNumber && (
              <p className="text-sm text-red-600" role="alert" aria-live="assertive">
                {errors.phoneNumber}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              {t('auth.createAccount.emailLabel')}
            </label>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder={t('auth.createAccount.emailPlaceholder')}
              className={`w-full px-4 py-3 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-indigo-700 focus:border-transparent transition-colors duration-200 ${
                errors.email ? 'border-red-500' : ''
              }`}
            />
            {errors.email && (
              <p className="text-sm text-red-600" role="alert" aria-live="assertive">
                {errors.email}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              {t('auth.createAccount.passwordLabel')}
            </label>
            <Input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              placeholder={t('auth.createAccount.passwordPlaceholder')}
              className={`w-full px-4 py-3 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-indigo-700 focus:border-transparent transition-colors duration-200 ${
                errors.password ? 'border-red-500' : ''
              }`}
            />
            {errors.password && (
              <p className="text-sm text-red-600" role="alert" aria-live="assertive">
                {errors.password}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label className="flex items-start space-x-3 cursor-pointer">
              <Checkbox
                checked={formData.agreeToTerms}
                onCheckedChange={(checked) => setFormData({ ...formData, agreeToTerms: checked === true })}
              />
              <span className="text-sm text-gray-700 leading-5">
                I agree to the{" "}
                <Dialog>
                  <DialogTrigger className="text-indigo-700 hover:underline">
                    Terms of Service
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Terms of Service</DialogTitle>
                    </DialogHeader>
                    <DialogDescription className="mt-4 text-left">
                      <TermsOfServiceContent />
                    </DialogDescription>
                  </DialogContent>
                </Dialog>
                {" "}and{" "}
                <Dialog>
                  <DialogTrigger className="text-indigo-700 hover:underline">
                    Privacy Policy
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Privacy Policy</DialogTitle>
                    </DialogHeader>
                    <DialogDescription className="mt-4 text-left">
                      <PrivacyPolicyContent />
                    </DialogDescription>
                  </DialogContent>
                </Dialog>
              </span>
            </label>
            {errors.agreeToTerms && (
              <p className="text-sm text-red-600 ml-8" role="alert" aria-live="assertive">
                {errors.agreeToTerms}
              </p>
            )}
          </div>

          <Button
            type="submit"
            className="w-full bg-indigo-700 text-white hover:opacity-90 font-semibold rounded-2xl px-6 py-3 text-base transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2"
            style={tenantInfo?.config?.branding?.primary_color ? { backgroundColor: tenantInfo.config.branding.primary_color, color: 'white' } : {}}
            disabled={!isFormValid || isLoading}
          >
            {isLoading ? t('auth.createAccount.creatingButton') : t('auth.createAccount.createButton')}
          </Button>
        </form>

        {/* Footer */}
        <div className="text-center">
          <p className="text-gray-500">
            {t('auth.createAccount.alreadyHaveAccount')}{' '}
            <Link to="/auth/login" className="text-indigo-700 font-medium hover:underline">
              {t('auth.createAccount.loginLink')}
            </Link>
          </p>
        </div>
      </div>
    </AuthLayout>
  );
};

export default CreateAccount;