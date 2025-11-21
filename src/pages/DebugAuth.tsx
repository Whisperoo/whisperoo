import React from 'react';
import { useAuth } from '@/contexts/AuthContext';

const DebugAuth: React.FC = () => {
  const { user, profile, session, loading } = useAuth();

  return (
    <div className="min-h-screen p-8">
      <h1 className="text-2xl font-bold mb-6">Auth Debug Page</h1>
      
      <div className="space-y-4">
        <div className="bg-gray-100 p-4 rounded">
          <h2 className="font-semibold">Loading State:</h2>
          <p>{loading ? 'True' : 'False'}</p>
        </div>

        <div className="bg-gray-100 p-4 rounded">
          <h2 className="font-semibold">User:</h2>
          <pre className="text-sm overflow-auto">
            {user ? JSON.stringify(user, null, 2) : 'null'}
          </pre>
        </div>

        <div className="bg-gray-100 p-4 rounded">
          <h2 className="font-semibold">Profile:</h2>
          <pre className="text-sm overflow-auto">
            {profile ? JSON.stringify(profile, null, 2) : 'null'}
          </pre>
        </div>

        <div className="bg-gray-100 p-4 rounded">
          <h2 className="font-semibold">Session:</h2>
          <pre className="text-sm overflow-auto">
            {session ? JSON.stringify(session, null, 2) : 'null'}
          </pre>
        </div>
      </div>
    </div>
  );
};

export default DebugAuth;