import React from 'react';
import termsText from '@/assets/legal/terms.txt?raw';
import privacyText from '@/assets/legal/privacy.txt?raw';

export const TermsOfServiceContent: React.FC = () => (
  <div className="whitespace-pre-wrap text-sm text-gray-700 font-sans p-4 bg-gray-50 rounded-lg border border-gray-100">
    {termsText}
  </div>
);

export const PrivacyPolicyContent: React.FC = () => (
  <div className="whitespace-pre-wrap text-sm text-gray-700 font-sans p-4 bg-gray-50 rounded-lg border border-gray-100">
    {privacyText}
  </div>
);
