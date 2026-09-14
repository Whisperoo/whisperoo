import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MailCheck, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '../../components/ui/button';
import AuthLayout from '../../components/layouts/AuthLayout';
import { supabase } from '@/lib/supabase';
import { toast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';

/**
 * "Verify your email to continue."
 *
 * Shown after signup when the project requires email confirmation. In that
 * mode Supabase returns a user but NO session, so nothing downstream can load
 * a profile or start onboarding until the link in the email is clicked. Before
 * this page existed, CreateAccount waited for a session that could never
 * arrive and the user saw a success toast followed by nothing.
 *
 * The confirmation link (emailRedirectTo in AuthContext.signUp) lands on `/`,
 * where Splash sees the now-authenticated user and routes into onboarding.
 */
const CheckEmail: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const email = params.get('email') ?? '';
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  const resend = async () => {
    if (!email) return;
    setResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: { emailRedirectTo: `${window.location.origin}/` },
      });
      if (error) throw error;
      setResent(true);
      toast({ title: t('auth.checkEmail.resentTitle'), description: t('auth.checkEmail.resentDesc', { email }) });
    } catch (err) {
      console.error('Resend confirmation failed:', err);
      toast({ title: t('auth.checkEmail.resendFailed'), variant: 'destructive' });
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthLayout>
      <div className="max-w-md mx-auto text-center space-y-6 py-6">
        <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mx-auto">
          <MailCheck className="w-8 h-8 text-indigo-600" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-gray-900">{t('auth.checkEmail.title')}</h1>
          <p className="text-gray-600">
            {t('auth.checkEmail.sentTo')}{' '}
            <span className="font-semibold text-gray-900 break-all">{email || t('auth.checkEmail.yourInbox')}</span>
          </p>
          <p className="text-sm text-gray-500">{t('auth.checkEmail.instruction')}</p>
        </div>

        <div className="rounded-2xl bg-gray-50 border border-gray-100 p-4 text-left text-sm text-gray-600 space-y-1.5">
          <p>{t('auth.checkEmail.tipSpam')}</p>
          <p>{t('auth.checkEmail.tipExpiry')}</p>
        </div>

        <div className="space-y-3">
          <Button
            variant="outline"
            onClick={resend}
            disabled={resending || resent || !email}
            className="w-full h-11 rounded-2xl"
          >
            {resending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            <span className="ml-2">{resent ? t('auth.checkEmail.resentButton') : t('auth.checkEmail.resendButton')}</span>
          </Button>
          <button
            type="button"
            onClick={() => navigate('/auth/login')}
            className="text-sm text-indigo-600 hover:text-indigo-700"
          >
            {t('auth.checkEmail.alreadyVerified')}
          </button>
        </div>
      </div>
    </AuthLayout>
  );
};

export default CheckEmail;
