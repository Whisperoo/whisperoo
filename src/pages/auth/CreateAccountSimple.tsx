import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

const CreateAccountSimple: React.FC = () => {
  const navigate = useNavigate();
  const { signUp, user, profile } = useAuth();
  const [formData, setFormData] = useState({
    firstName: '',
    email: '',
    password: '',
    agreeToTerms: false
  });
  const [isLoading, setIsLoading] = useState(false);
  const [waitingForProfile, setWaitingForProfile] = useState(false);

  // Navigate to onboarding once profile is loaded
  useEffect(() => {
    if (waitingForProfile && user && profile) {
      console.log('Profile loaded, navigating to onboarding...');
      navigate('/onboarding/role');
    }
  }, [waitingForProfile, user, profile, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('=== SIMPLE FORM SUBMITTED ===');
    console.log('Form data:', formData);
    
    if (!formData.firstName || !formData.email || !formData.password || !formData.agreeToTerms) {
      alert('Please fill all fields and agree to terms');
      return;
    }

    setIsLoading(true);
    
    try {
      console.log('Calling signUp...');
      const { user, error } = await signUp(formData.email, formData.password, formData.firstName);
      
      console.log('SignUp result:', { user: !!user, error: error?.message });
      
      if (error) {
        alert(`Error: ${error.message}`);
        return;
      }

      if (user) {
        alert('Account created! Loading your profile...');
        setWaitingForProfile(true);
      }
    } catch (error) {
      console.error('Sign-up error:', error);
      alert('Error creating account');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-8 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-6">Simple Create Account</h1>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">First Name:</label>
          <input
            type="text"
            value={formData.firstName}
            onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
            className="w-full p-2 border border-gray-300 rounded"
            required
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-2">Email:</label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            className="w-full p-2 border border-gray-300 rounded"
            required
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-2">Password:</label>
          <input
            type="password"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            className="w-full p-2 border border-gray-300 rounded"
            required
          />
        </div>
        
        <div>
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={formData.agreeToTerms}
              onChange={(e) => setFormData({ ...formData, agreeToTerms: e.target.checked })}
              className="form-checkbox"
            />
            <span className="text-sm">I agree to the Terms of Service</span>
          </label>
        </div>
        
        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-blue-500 text-white p-3 rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {isLoading ? 'Creating Account...' : 'Create Account'}
        </button>
      </form>
      
      <div className="mt-4">
        <button
          type="button"
          onClick={() => navigate('/auth/create')}
          className="text-blue-500 underline"
        >
          Back to Original Form
        </button>
      </div>
    </div>
  );
};

export default CreateAccountSimple;