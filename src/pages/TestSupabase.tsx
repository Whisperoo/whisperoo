import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

const TestSupabase: React.FC = () => {
  const [connectionStatus, setConnectionStatus] = useState('Testing...');
  const [authTest, setAuthTest] = useState('');

  useEffect(() => {
    testConnection();
  }, []);

  const testConnection = async () => {
    try {
      console.log('Testing Supabase connection...');
      
      // Test basic connection
      const { data, error } = await supabase.from('profiles').select('count').limit(1);
      
      if (error) {
        setConnectionStatus(`Connection Error: ${error.message}`);
        console.error('Supabase connection error:', error);
      } else {
        setConnectionStatus('✅ Supabase connection successful');
        console.log('Supabase connection successful');
      }
    } catch (err) {
      setConnectionStatus(`Exception: ${err}`);
      console.error('Supabase test exception:', err);
    }
  };

  const testAuth = async () => {
    try {
      console.log('Testing Supabase auth...');
      setAuthTest('Testing auth...');
      
      const { data, error } = await supabase.auth.signUp({
        email: `test${Date.now()}@example.com`,
        password: 'testpassword123',
        options: {
          data: {
            first_name: 'Test User',
          },
        },
      });

      if (error) {
        setAuthTest(`Auth Error: ${error.message}`);
        console.error('Auth test error:', error);
      } else {
        setAuthTest(`✅ Auth test successful - User: ${data.user?.email}`);
        console.log('Auth test successful:', data);
      }
    } catch (err) {
      setAuthTest(`Auth Exception: ${err}`);
      console.error('Auth test exception:', err);
    }
  };

  return (
    <div className="min-h-screen p-8 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-6">Supabase Connection Test</h1>
      
      <div className="space-y-4">
        <div className="p-4 border border-gray-300 rounded">
          <h2 className="font-semibold mb-2">Database Connection:</h2>
          <p>{connectionStatus}</p>
        </div>
        
        <div className="p-4 border border-gray-300 rounded">
          <h2 className="font-semibold mb-2">Auth Test:</h2>
          <p>{authTest}</p>
          <button
            onClick={testAuth}
            className="mt-2 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Test Auth Signup
          </button>
        </div>
        
        <div className="p-4 border border-gray-300 rounded">
          <h2 className="font-semibold mb-2">Environment Variables:</h2>
          <p>URL: {import.meta.env.VITE_SUPABASE_URL ? '✅ Set' : '❌ Missing'}</p>
          <p>Key: {import.meta.env.VITE_SUPABASE_ANON_KEY ? '✅ Set' : '❌ Missing'}</p>
        </div>
      </div>
    </div>
  );
};

export default TestSupabase;