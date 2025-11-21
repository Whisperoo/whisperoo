
import React from 'react';

interface AuthLayoutProps {
  children: React.ReactNode;
}

const AuthLayout: React.FC<AuthLayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center px-4 py-8">
      <div className="mb-8">
        <img
          src="/lovable-uploads/96238edd-91f3-4ff1-87be-ac5d867fa98a.png"
          alt="Whisperoo"
          className="h-12 mx-auto"
        />
      </div>
      <div className="w-full max-w-md">
        {children}
      </div>
    </div>
  );
};

export default AuthLayout;
