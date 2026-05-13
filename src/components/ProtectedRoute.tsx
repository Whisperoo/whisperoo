import React, { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useMfaStatus } from '@/hooks/useMfaStatus'
import MfaEnrollBanner from '@/components/MfaEnrollBanner'

interface ProtectedRouteProps {
  children: React.ReactNode
  requireAuth?: boolean
  requireOnboarding?: boolean
  /** When true, super-admin accounts must have a TOTP factor enrolled & verified (AAL2). See useMfaStatus. */
  requireMfa?: boolean
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  requireAuth = true, 
  requireOnboarding = false,
  requireMfa = false,
}) => {
  const { user, profile, loading, refreshProfile } = useAuth()
  const location = useLocation()
  const { mfaStatus, recheckMfa } = useMfaStatus()
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
    return <Navigate to="/auth/login" replace />
  }

  // If user exists but no profile yet, show loading
  if (requireAuth && user && !profile) {
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
    return <Navigate to="/onboarding/role" replace />
  }

  // ── HIPAA B6: MFA gate for staff routes ──────────────────────────────────
  if (requireMfa && profile) {
    const returnTo = encodeURIComponent(location.pathname + location.search)

    if (mfaStatus === 'loading') {
      // Still checking MFA state — show spinner so we don't flash a redirect
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-action-primary"></div>
        </div>
      )
    }

    if (mfaStatus === 'not_enrolled') {
      // Staff account with no TOTP factor yet. While MFA UX is still being
      // rolled out, allow access but show a non-blocking enrollment reminder.
      // Once MFA enrollment is required for production, switch this back to:
      //   return <Navigate to={`/auth/mfa-enroll?returnTo=${returnTo}`} replace />
      return (
        <>
          <MfaEnrollBanner returnTo={location.pathname + location.search} />
          {children}
        </>
      )
    }

    if (mfaStatus === 'enrolled_unverified') {
      // Factor exists but session is still AAL1 — must complete challenge
      return <Navigate to={`/auth/mfa-challenge?returnTo=${returnTo}`} replace />
    }

    if (mfaStatus === 'mfa_check_failed') {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
          <div className="max-w-md w-full rounded-xl border border-amber-200 bg-amber-50 p-6 text-center space-y-4">
            <p className="text-sm font-semibold text-amber-900">Could not verify two-factor status</p>
            <p className="text-xs text-amber-800">
              For security, this page stays blocked until we can confirm your authenticator setup. Check your connection and try again.
            </p>
            <button
              type="button"
              onClick={() => recheckMfa()}
              className="w-full py-2.5 rounded-lg bg-amber-700 text-white text-sm font-semibold hover:bg-amber-800"
            >
              Retry
            </button>
          </div>
        </div>
      )
    }

    // mfaStatus === 'verified' (AAL2) or 'not_required' — allow through
  }
  // ─────────────────────────────────────────────────────────────────────────

  return <>{children}</>
}

export default ProtectedRoute