
import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import AuthLayout from '../../components/layouts/AuthLayout';
import BackButton from '../../components/ui/BackButton';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';

const VerifyOTP: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const phone = searchParams.get('phone') || '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // TODO: Implement OTP verification with Supabase
      console.log('Verifying OTP:', otp, 'for phone:', phone);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      navigate('/onboarding/role');
    } catch (error) {
      console.error('OTP verification error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className="space-y-8">
        <BackButton onClick={() => navigate('/auth/create')} />
        
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-indigo-700">
            Verify Phone Number
          </h1>
          <p className="text-gray-500">
            We sent a code to {phone}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Verification Code
            </label>
            <Input
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              placeholder="Enter 6-digit code"
              maxLength={6}
              className="w-full px-4 py-3 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-indigo-700 focus:border-transparent transition-colors duration-200"
            />
          </div>

          <Button
            type="submit"
            className="w-full bg-indigo-700 text-white hover:bg-indigo-800 font-semibold rounded-2xl px-6 py-3 text-base transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-700"
            disabled={otp.length !== 6 || isLoading}
          >
            {isLoading ? 'Verifying...' : 'Verify'}
          </Button>
        </form>

        <div className="text-center">
          <button className="text-indigo-700 font-medium hover:underline">
            Resend Code
          </button>
        </div>
      </div>
    </AuthLayout>
  );
};

export default VerifyOTP;
