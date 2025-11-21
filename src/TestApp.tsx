import React, { useEffect, useState } from 'react';

// Test Supabase connection
const TestApp = () => {
  const [supabaseTest, setSupabaseTest] = useState<string>('Testing...');

  useEffect(() => {
    const testSupabase = async () => {
      try {
        // Test environment variables
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseAnonKey) {
          setSupabaseTest('❌ Missing environment variables');
          return;
        }

        // Test Supabase import
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(supabaseUrl, supabaseAnonKey);

        // Test basic connection
        const { data, error } = await supabase.from('profiles').select('count').limit(1);
        
        if (error) {
          setSupabaseTest(`❌ Supabase error: ${error.message}`);
        } else {
          setSupabaseTest('✅ Supabase connection working');
        }
      } catch (error: any) {
        setSupabaseTest(`❌ Import error: ${error.message}`);
      }
    };

    testSupabase();
  }, []);

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1 style={{ color: 'green' }}>✅ React is Working!</h1>
      <p>Environment Variables:</p>
      <ul>
        <li>VITE_SUPABASE_URL: {import.meta.env.VITE_SUPABASE_URL ? '✅ Set' : '❌ Missing'}</li>
        <li>VITE_SUPABASE_ANON_KEY: {import.meta.env.VITE_SUPABASE_ANON_KEY ? '✅ Set' : '❌ Missing'}</li>
      </ul>
      <p>Supabase Test: {supabaseTest}</p>
      <hr />
      <p><strong>Next Step:</strong> If everything above shows ✅, the issue is in the main App component.</p>
    </div>
  );
};

export default TestApp;