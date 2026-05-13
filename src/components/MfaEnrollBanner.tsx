import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';

/**
 * Non-blocking reminder shown to staff accounts that have not yet enrolled
 * a TOTP factor. The MFA gate in ProtectedRoute allows them through to the
 * page; this banner nudges them to complete enrollment.
 */
export const MfaEnrollBanner: React.FC<{ returnTo: string }> = ({ returnTo }) => {
  const href = `/auth/mfa-enroll?returnTo=${encodeURIComponent(returnTo)}`;
  return (
    <div className="w-full bg-amber-50 border-b border-amber-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-start sm:items-center gap-3">
        <ShieldAlert className="w-5 h-5 text-amber-700 flex-shrink-0 mt-0.5 sm:mt-0" aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-amber-900">
            Two-factor authentication not enabled
          </p>
          <p className="text-xs text-amber-800">
            HIPAA B6 requires TOTP for staff accounts. Enroll your authenticator app to stay compliant.
          </p>
        </div>
        <Link
          to={href}
          className="flex-shrink-0 inline-flex items-center px-3 py-2 rounded-md bg-amber-700 text-white text-xs font-semibold hover:bg-amber-800 transition-colors"
        >
          Enroll Now
        </Link>
      </div>
    </div>
  );
};

export default MfaEnrollBanner;
