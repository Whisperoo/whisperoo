import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthLayout from "../../components/layouts/AuthLayout";
import BackButton from "../../components/ui/BackButton";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase"; // Import your Supabase client

const Login: React.FC = () => {
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
    console.log("Signing in user:", formData.email);

    try {
      const { user, error } = await signIn(formData.email, formData.password);

      if (error) {
        console.error("Sign-in error:", error);
        toast({
          title: "Error signing in",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      if (user) {
        console.log("Sign-in successful:", user.id);
        toast({
          title: "Welcome back!",
          description: "You have successfully signed in.",
        });

        // Navigate to dashboard - ProtectedRoute will handle onboarding redirect if needed
        navigate("/dashboard");
      }
    } catch (error) {
      console.error("Login error:", error);
      toast({
        title: "Error signing in",
        description: "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetEmail) {
      toast({
        title: "Email required",
        description: "Please enter your email address.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      // Determine the correct redirect URL based on environment
      const getRedirectUrl = () => {
        const isLocalhost =
          window.location.hostname === "localhost" ||
          window.location.hostname === "127.0.0.1";

        if (isLocalhost) {
          // Development
          return "http://localhost:8080/update-password";
        } else {
          // Production - use your Railway domain
          return "https://whisperoo-production.up.railway.app/update-password";
        }
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
        title: "Email sent!",
        description: `Reset link sent to ${resetEmail}. Check your inbox.`,
      });

      // Show success message
      setResetMode(false);
      setResetEmail("");
    } catch (error: any) {
      console.error("Password reset error:", error);

      // User-friendly error messages
      let errorMessage = "Failed to send reset email. Please try again.";

      if (error.message?.includes("rate limit")) {
        errorMessage = "Too many attempts. Please wait a few minutes.";
      } else if (error.message?.includes("email")) {
        errorMessage = "Please enter a valid email address.";
      }

      toast({
        title: "Reset failed",
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
            {resetMode ? "Reset Password" : "Welcome Back"}
          </h1>
          <p className="text-gray-500">
            {resetMode
              ? "Enter your email to receive a reset link"
              : "Sign in to your account"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {resetMode ? (
            // Reset Password Mode
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Email
              </label>
              <Input
                type="email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                placeholder="Enter your email"
                className="w-full px-4 py-3 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-indigo-700 focus:border-transparent transition-colors duration-200"
              />
            </div>
          ) : (
            // Login Mode
            <>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Email
                </label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  placeholder="Enter your email"
                  className="w-full px-4 py-3 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-indigo-700 focus:border-transparent transition-colors duration-200"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Password
                </label>
                <Input
                  type="password"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  placeholder="Enter your password"
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
                ? "Sending..."
                : "Signing In..."
              : resetMode
              ? "Send Reset Link"
              : "Sign In"}
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
                Forgot your password?
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
                Back to Sign In
              </button>
            </div>
          )}

          {!resetMode && (
            <div>
              <p className="text-gray-500">
                Don't have an account?{" "}
                <Link
                  to="/auth/create"
                  className="text-indigo-700 font-medium hover:underline"
                >
                  Create Account
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
