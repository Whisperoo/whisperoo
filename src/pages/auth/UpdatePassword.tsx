import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AuthLayout from "../../components/layouts/AuthLayout";
import BackButton from "../../components/ui/BackButton";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { useTranslation } from 'react-i18next';

const UpdatePassword: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    password: "",
    confirmPassword: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [hasValidSession, setHasValidSession] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);

  // Check for recovery session when page loads
  useEffect(() => {
    checkRecoverySession();
  }, []);

  const checkRecoverySession = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      // A recovery session exists if we have a session with recovery type
      // Supabase automatically sets this when the reset link is clicked
      if (session) {
        setHasValidSession(true);
      } else {
        toast({
          title: t('auth.updatePassword.invalidLink'),
          description: t('auth.updatePassword.invalidLinkDesc'),
          variant: "destructive",
        });
        navigate("/auth/login");
      }
    } catch (error) {
      console.error("Session check error:", error);
      toast({
        title: t('auth.updatePassword.error'),
        description: t('auth.updatePassword.validateError'),
        variant: "destructive",
      });
      navigate("/auth/login");
    } finally {
      setSessionChecked(true);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate passwords match
    if (formData.password !== formData.confirmPassword) {
      toast({
        title: t('auth.updatePassword.passwordsDontMatch'),
        description: t('auth.updatePassword.passwordsDontMatchDesc'),
        variant: "destructive",
      });
      return;
    }

    // Validate password strength
    if (formData.password.length < 6) {
      toast({
        title: t('auth.updatePassword.passwordTooShort'),
        description: t('auth.updatePassword.passwordTooShortDesc'),
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      // Update password using Supabase's recovery session
      const { error } = await supabase.auth.updateUser({
        password: formData.password,
      });

      if (error) {
        throw error;
      }

      toast({
        title: t('auth.updatePassword.passwordUpdated'),
        description: t('auth.updatePassword.passwordUpdatedDesc'),
      });

      // Optional: Sign out all other sessions for security
      await supabase.auth.signOut();

      // Redirect to login page
      setTimeout(() => navigate("/auth/login"), 1500);
    } catch (error: any) {
      console.error("Password update error:", error);
      toast({
        title: t('auth.updatePassword.updateFailed'),
        description:
          error.message || t('auth.updatePassword.updateFailedDesc'),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!sessionChecked) {
    return (
      <AuthLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-700 mx-auto mb-4"></div>
            <p className="text-gray-600">{t('auth.updatePassword.validatingLink')}</p>
          </div>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="space-y-8">
        <BackButton onClick={() => navigate("/auth/login")} />

        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-indigo-700">
            {t('auth.updatePassword.title')}
          </h1>
          <p className="text-gray-500">{t('auth.updatePassword.subtitle')}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              {t('auth.updatePassword.newPassword')}
            </label>
            <Input
              type="password"
              value={formData.password}
              onChange={(e) =>
                setFormData({ ...formData, password: e.target.value })
              }
              placeholder={t('auth.updatePassword.newPasswordPlaceholder')}
              className="w-full px-4 py-3 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-indigo-700 focus:border-transparent transition-colors duration-200"
              minLength={6}
              required
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              {t('auth.updatePassword.confirmPassword')}
            </label>
            <Input
              type="password"
              value={formData.confirmPassword}
              onChange={(e) =>
                setFormData({ ...formData, confirmPassword: e.target.value })
              }
              placeholder={t('auth.updatePassword.confirmPasswordPlaceholder')}
              className="w-full px-4 py-3 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-indigo-700 focus:border-transparent transition-colors duration-200"
              minLength={6}
              required
            />
          </div>

          <div className="text-sm text-gray-500 space-y-1">
            <p className="flex items-center">
              <span className="inline-block w-2 h-2 bg-gray-300 rounded-full mr-2"></span>
              {t('auth.updatePassword.requirement1')}
            </p>
            <p className="flex items-center">
              <span className="inline-block w-2 h-2 bg-gray-300 rounded-full mr-2"></span>
              {t('auth.updatePassword.requirement2')}
            </p>
          </div>

          <Button
            type="submit"
            className="w-full bg-indigo-700 text-white hover:bg-indigo-800 font-semibold rounded-2xl px-6 py-3 text-base transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-700"
            disabled={
              !formData.password || !formData.confirmPassword || isLoading
            }
          >
            {isLoading ? t('auth.updatePassword.updating') : t('auth.updatePassword.resetButton')}
          </Button>
        </form>

        <div className="text-center">
          <p className="text-gray-500 text-sm">
            {t('auth.updatePassword.rememberPassword')}{" "}
            <button
              onClick={() => navigate("/auth/login")}
              className="text-indigo-700 font-medium hover:underline"
            >
              {t('auth.updatePassword.backToSignIn')}
            </button>
          </p>
        </div>
      </div>
    </AuthLayout>
  );
};

export default UpdatePassword;
