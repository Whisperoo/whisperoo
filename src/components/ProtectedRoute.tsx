import React, { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

interface ProtectedRouteProps {
  children: React.ReactNode
  requireAuth?: boolean
  requireOnboarding?: boolean
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  requireAuth = true, 
  requireOnboarding = false 
}) => {
  const { user, profile, loading, refreshProfile } = useAuth()
  const [profileTimeout, setProfileTimeout] = useState(false)

  // Set a timeout for profile loading
  useEffect(() => {
    if (requireAuth && user && !profile && !loading) {
      const timer = setTimeout(() => {
        console.log('Profile loading timeout reached');
        setProfileTimeout(true);
      }, 5000); // 5 second timeout

      return () => clearTimeout(timer);
    }
  }, [requireAuth, user, profile, loading]);

  console.log('ProtectedRoute check:', { 
    loading, 
    user: !!user, 
    profile: !!profile, 
    requireAuth, 
    requireOnboarding,
    profileOnboarded: profile?.onboarded
  });

  // Show loading spinner while auth is initializing
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-action-primary"></div>
      </div>
    )
  }

  // Redirect to login if auth is required but no user
  if (requireAuth && !user) {
    console.log('ProtectedRoute: redirecting to login - no user');
    return <Navigate to="/auth/login" replace />
  }

  // If user exists but no profile yet, show loading
  if (requireAuth && user && !profile) {
    console.log('ProtectedRoute: user exists but profile loading...');
    
    if (profileTimeout) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center space-y-4">
            <p className="text-red-600">Failed to load profile</p>
            <button
              onClick={() => {
                setProfileTimeout(false);
                refreshProfile();
              }}
              className="px-4 py-2 bg-action-primary text-white rounded hover:bg-indigo-800"
            >
              Retry
            </button>
          </div>
        </div>
      )
    }
    
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-action-primary mx-auto"></div>
          <p className="text-gray-600">Loading your profile...</p>
        </div>
      </div>
    )
  }

  // Check onboarding requirements
  if (requireOnboarding && profile && !profile.onboarded) {
    console.log('ProtectedRoute: redirecting to onboarding - user not onboarded');
    console.log('ProtectedRoute: profile data:', { 
      role: profile.role, 
      expecting_status: profile.expecting_status, 
      has_kids: profile.has_kids,
      onboarded: profile.onboarded 
    });
    return <Navigate to="/onboarding/role" replace />
  }

  console.log('ProtectedRoute: rendering children');
  return <>{children}</>
}

export default ProtectedRoute