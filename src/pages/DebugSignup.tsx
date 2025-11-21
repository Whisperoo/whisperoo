import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useNavigate } from 'react-router-dom';

const DebugSignup: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('test@example.com');
  const [password, setPassword] = useState('password123');
  const [firstName, setFirstName] = useState('Test');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<string>('');

  const testDirectSupabaseSignup = async () => {
    console.log('=== DIRECT SUPABASE SIGNUP TEST ===');
    setIsLoading(true);
    setResult('Starting direct Supabase signup...');
    
    try {
      console.log('Calling supabase.auth.signUp...');
      
      const { data, error } = await supabase.auth.signUp({
        email: `${Date.now()}@example.com`, // Unique email
        password: 'password123',
        options: {
          data: {
            first_name: 'Test User',
          },
        },
      });

      console.log('Supabase response:', { data, error });
      
      if (error) {
        setResult(`ERROR: ${error.message}`);
        console.error('Supabase error:', error);
      } else if (data.user) {
        setResult(`SUCCESS: User created with ID ${data.user.id}`);
        console.log('Success! User:', data.user);
        
        // Test navigation
        setTimeout(() => {
          alert('Navigating to onboarding in 2 seconds...');
          navigate('/onboarding/kids');
        }, 2000);
      } else {
        setResult('ERROR: No user returned');
      }
    } catch (err) {
      console.error('Exception:', err);
      setResult(`EXCEPTION: ${err}`);
    } finally {
      setIsLoading(false);
      console.log('=== TEST COMPLETED ===');
    }
  };

  const testAuthContext = async () => {
    console.log('=== AUTH CONTEXT TEST ===');
    setIsLoading(true);
    setResult('Testing AuthContext...');
    
    try {
      // Import useAuth hook
      const { useAuth } = await import('@/contexts/AuthContext');
      const auth = useAuth();
      
      console.log('Calling auth.signUp...');
      const { user, error } = await auth.signUp(
        `${Date.now()}@example.com`,
        'password123',
        'Test User'
      );
      
      console.log('AuthContext response:', { user, error });
      
      if (error) {
        setResult(`AUTH CONTEXT ERROR: ${error.message}`);
      } else if (user) {
        setResult(`AUTH CONTEXT SUCCESS: ${user.id}`);
        navigate('/onboarding/kids');
      } else {
        setResult('AUTH CONTEXT ERROR: No user returned');
      }
    } catch (err) {
      console.error('AuthContext exception:', err);
      setResult(`AUTH CONTEXT EXCEPTION: ${err}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-8 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-6">Debug Signup Issue</h1>
      
      <div className="space-y-4">
        <div className="p-4 border border-gray-300 rounded">
          <h2 className="font-semibold mb-2">Test Results:</h2>
          <p className="text-sm bg-gray-100 p-2 rounded">{result}</p>
        </div>
        
        <button
          onClick={testDirectSupabaseSignup}
          disabled={isLoading}
          className="w-full bg-blue-500 text-white p-3 rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {isLoading ? 'Testing...' : 'Test Direct Supabase Signup'}
        </button>
        
        <button
          onClick={testAuthContext}
          disabled={isLoading}
          className="w-full bg-green-500 text-white p-3 rounded hover:bg-green-600 disabled:opacity-50"
        >
          {isLoading ? 'Testing...' : 'Test AuthContext Signup'}
        </button>
        
        <div className="mt-4 p-4 border border-yellow-300 rounded bg-yellow-50">
          <h3 className="font-semibold mb-2">Instructions:</h3>
          <ol className="text-sm space-y-1">
            <li>1. Open browser developer tools (F12)</li>
            <li>2. Go to Console tab</li>
            <li>3. Click "Test Direct Supabase Signup" first</li>
            <li>4. Watch console logs and see what happens</li>
            <li>5. If that works, try "Test AuthContext Signup"</li>
          </ol>
        </div>
        
        <button
          onClick={() => navigate('/auth/create')}
          className="w-full bg-gray-500 text-white p-2 rounded hover:bg-gray-600"
        >
          Back to Original Form
        </button>
      </div>
    </div>
  );
};

export default DebugSignup;