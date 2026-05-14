import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthLayout from "../../components/layouts/AuthLayout";
import BackButton from "../../components/ui/BackButton";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase"; // Import your Supabase client
import { useTranslation } from "react-i18next";

const Login: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [resetMode, setResetMode] = useState(false); // Toggle between login and reset
  const [resetEmail, setResetEmail] = useState(""); // Separate state for reset email

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (resetMode) {
      // Handle password reset request
      await handleResetPassword();
    } else {
      // Handle regular login
      await handleLogin();
    }
  };

  const handleLogin = async () => {
    setIsLoading(true);
    console.log("Signing in user");

    try {
      const { user, error } = await signIn(formData.email, formData.password);

      if (error) {
        // GoTrue occasionally returns a 500 "Database error querying schema"
        // even though the session was created successfully (the error occurs
        // in a post-login step). Check if the session that now exists belongs
        // to the account that just signed in — never fall through for a
        // stale session from a previously logged-in user.
        const { data: sessionCheck } = await supabase.auth.getSession();
        const sessionEmail = sessionCheck.session?.user?.email?.toLowerCase();
        const attemptedEmail = formData.email.toLowerCase();
        if (!sessionCheck.session || sessionEmail !== attemptedEmail) {
          console.error("Sign-in error:", error);
          toast({
            title: t('auth.login.toast.errorSigningIn'),
            description: error.message,
            variant: "destructive",
          });
          return;
        }
        // Session belongs to the right user despite the GoTrue error — continue.
        console.warn("Sign-in returned error but correct session exists, continuing:", error.message);
      }

      const resolvedUser = user ?? (await supabase.auth.getUser()).data.user;

      if (resolvedUser) {
        console.log("Sign-in successful:", resolvedUser.id);
        toast({
          title: t('auth.login.toast.welcomeBack'),
          description: t('auth.login.toast.signedInSuccess'),
        });

        // Route by role, not hardcoded email.
        const { data: signedInProfile } = await supabase
          .from("profiles")
          .select("account_type")
          .eq("id", resolvedUser.id)
          .maybeSingle();

        if (
          signedInProfile?.account_type === "admin" ||
          signedInProfile?.account_type === "super_admin" ||
          signedInProfile?.account_type === "superadmin"
        ) {
          navigate("/admin/super");
        } else {
          // Navigate to dashboard - ProtectedRoute will handle onboarding redirect if needed
          navigate("/dashboard");
        }
      }
    } catch (error) {
      console.error("Login error:", error);
      toast({
        title: t('auth.login.toast.errorSigningIn'),
        description: t('auth.login.toast.tryAgainLater'),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetEmail) {
      toast({
        title: t('auth.login.toast.emailRequired'),
        description: t('auth.login.toast.enterEmailAddress'),
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      // Determine the correct redirect URL based on environment
      const getRedirectUrl = () => {
        // Always use the current origin — works on localhost, Fly.io, or any deployment
        return `${window.location.origin}/update-password`;
      };

      const redirectUrl = getRedirectUrl();

      console.log("Environment:", window.location.hostname);
      console.log("Using redirect URL:", redirectUrl);

      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: redirectUrl,
      });

      if (error) {
        console.error("Supabase error:", error);
        throw error;
      }

      toast({
        title: t('auth.login.toast.emailSent'),
        description: t('auth.login.toast.resetLinkSent', { email: resetEmail }),
      });

      // Show success message
      setResetMode(false);
      setResetEmail("");
    } catch (error: any) {
      console.error("Password reset error:", error);

      // User-friendly error messages
      let errorMessage = t('auth.login.toast.failedToSendReset');

      if (error.message?.includes("rate limit")) {
        errorMessage = t('auth.login.toast.tooManyAttempts');
      } else if (error.message?.includes("email")) {
        errorMessage = t('auth.login.toast.enterValidEmail');
      }

      toast({
        title: t('auth.login.toast.resetFailed'),
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className="space-y-8">
        <BackButton onClick={() => navigate("/auth/create")} />

        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-indigo-700">
            {resetMode ? t('auth.login.resetTitle') : t('auth.login.title')}
          </h1>
          <p className="text-gray-500">
            {resetMode
              ? t('auth.login.resetSubtitle')
              : t('auth.login.subtitle')}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {resetMode ? (
            // Reset Password Mode
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                {t('auth.login.emailLabel')}
              </label>
              <Input
                type="email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                placeholder={t('auth.login.emailPlaceholder')}
                className="w-full px-4 py-3 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-indigo-700 focus:border-transparent transition-colors duration-200"
              />
            </div>
          ) : (
            // Login Mode
            <>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  {t('auth.login.emailLabel')}
                </label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  placeholder={t('auth.login.emailPlaceholder')}
                  className="w-full px-4 py-3 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-indigo-700 focus:border-transparent transition-colors duration-200"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  {t('auth.login.passwordLabel')}
                </label>
                <Input
                  type="password"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  placeholder={t('auth.login.passwordPlaceholder')}
                  className="w-full px-4 py-3 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-indigo-700 focus:border-transparent transition-colors duration-200"
                />
              </div>
            </>
          )}

          <Button
            type="submit"
            className="w-full bg-indigo-700 text-white hover:bg-indigo-800 font-semibold rounded-2xl px-6 py-3 text-base transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-700"
            disabled={
              resetMode
                ? !resetEmail || isLoading
                : !formData.email || !formData.password || isLoading
            }
          >
            {isLoading
              ? resetMode
                ? t('auth.login.sendingButton')
                : t('auth.login.signingInButton')
              : resetMode
              ? t('auth.login.sendResetLinkButton')
              : t('auth.login.signInButton')}
          </Button>
          {/* Add this right before the form closing tag */}
          {process.env.NODE_ENV === "development" && resetMode && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm">
              <div className="font-semibold text-yellow-800">Debug Info:</div>
              <div>Current host: {window.location.hostname}</div>
              <div>Environment: {process.env.NODE_ENV}</div>
              <div>Redirect URL: {window.location.origin}/update-password</div>
            </div>
          )}
        </form>

        <div className="text-center space-y-4">
          {!resetMode && (
            <div className="mt-4">
              <button
                onClick={() => setResetMode(true)}
                className="text-sm text-indigo-700 font-medium hover:underline"
              >
                {t('auth.login.forgotPassword')}
              </button>
            </div>
          )}

          {resetMode && (
            <div className="mt-4">
              <button
                onClick={() => {
                  setResetMode(false);
                  setResetEmail("");
                }}
                className="text-sm text-indigo-700 font-medium hover:underline"
              >
                {t('auth.login.backToSignIn')}
              </button>
            </div>
          )}

          {!resetMode && (
            <div>
              <p className="text-gray-500">
                {t('auth.login.noAccount')}{" "}
                <Link
                  to="/auth/create"
                  className="text-indigo-700 font-medium hover:underline"
                >
                  {t('auth.login.createAccountLink')}
                </Link>
              </p>
            </div>
          )}
        </div>
      </div>
    </AuthLayout>
  );
};

export default Login;
