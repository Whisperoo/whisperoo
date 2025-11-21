import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthLayout from '../../components/layouts/AuthLayout';
import BackButton from '../../components/ui/BackButton';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import Divider from '../../components/ui/Divider';
import GoogleAuthButton from '../../components/ui/GoogleAuthButton';
import { Checkbox } from '../../components/ui/checkbox';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

const CreateAccount: React.FC = () => {
  const navigate = useNavigate();
  const { signUp, user, profile } = useAuth();
  const [formData, setFormData] = useState({
    firstName: '',
    email: '',
    password: '',
    agreeToTerms: false
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [waitingForProfile, setWaitingForProfile] = useState(false);

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
      newErrors.firstName = 'First name is required';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!formData.password.trim()) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    if (!formData.agreeToTerms) {
      newErrors.agreeToTerms = 'You must agree to the terms and conditions';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setIsLoading(true);
    console.log('Creating account for:', formData.email);
    
    try {
      const { user, error } = await signUp(formData.email, formData.password, formData.firstName);
      
      if (error) {
        console.error('Sign-up error:', error);
        toast({
          title: "Error creating account",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      if (user) {
        console.log('Account created successfully:', user.id);
        toast({
          title: "Account created successfully!",
          description: "Welcome to Whispéroo!",
        });
        
        // Wait for profile to be loaded
        setWaitingForProfile(true);
        setIsLoading(true); // Keep loading state while waiting for profile
      } else {
        console.error('No user returned from signUp');
        toast({
          title: "Error creating account",
          description: "No user data received. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Sign-up error:', error);
      toast({
        title: "Error creating account",
        description: "Please try again later.",
        variant: "destructive",
      });
    } finally {
      if (!user) {
        setIsLoading(false);
      }
      // Keep loading if we're waiting for profile
    }
  };

  const handleGoogleAuth = async () => {
    try {
      // TODO: Implement Google OAuth
      console.log('Google auth triggered');
      toast({
        title: "Google sign-in",
        description: "Google authentication coming soon!",
      });
    } catch (error) {
      console.error('Google auth error:', error);
    }
  };

  const isFormValid = formData.firstName.trim() && 
                     formData.email.trim() && 
                     formData.password.trim() &&
                     formData.agreeToTerms;

  return (
    <AuthLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <BackButton onClick={() => navigate('/')} />
          <Link 
            to="/auth/login" 
            className="text-indigo-700 text-sm font-medium hover:underline"
          >
            Apply As Expert
          </Link>
        </div>

        {/* Content */}
        <div className="text-center space-y-2">
          <h1 className="text-5xl font-bold text-indigo-700">
            Create Account
          </h1>
          <p className="text-gray-500 text-lg">
            Time is precious so we'll make this quick!
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6 max-w-md mx-auto">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              First Name
            </label>
            <Input
              value={formData.firstName}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              placeholder="Enter your first name"
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
              Email
            </label>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="Enter your email"
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
              Password
            </label>
            <Input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              placeholder="Create a password"
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

          <Divider label="or" />

          <GoogleAuthButton onClick={handleGoogleAuth} />

          <div className="space-y-2">
            <label className="flex items-start space-x-3 cursor-pointer">
              <Checkbox
                checked={formData.agreeToTerms}
                onCheckedChange={(checked) => setFormData({ ...formData, agreeToTerms: checked === true })}
              />
              <span className="text-sm text-gray-700 leading-5">
                I agree to the Terms of Service and Privacy Policy
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
            className="w-full bg-primary text-white hover:bg-action-primary font-semibold rounded-2xl px-6 py-3 text-base transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
            disabled={!isFormValid || isLoading}
          >
            {isLoading ? 'Creating Account...' : 'Create Account'}
          </Button>
        </form>

        {/* Footer */}
        <div className="text-center">
          <p className="text-gray-500">
            Already have an account?{' '}
            <Link to="/auth/login" className="text-indigo-700 font-medium hover:underline">
              Login
            </Link>
          </p>
        </div>
      </div>
    </AuthLayout>
  );
};

export default CreateAccount;