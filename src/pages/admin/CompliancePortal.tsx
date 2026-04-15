import React from 'react';
import Chat from '../Chat';

const CompliancePortal: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-brand-primary mb-2">AI Compliance Training Portal</h1>
        <p className="text-gray-600">Interact with the AI to test edge cases. All feedback is reviewed in the Super Admin dashboard.</p>
      </div>

      <div className="flex flex-col">
        <div className="mb-4">
          <h2 className="text-xl font-bold text-brand-dark">Test Environment</h2>
          <p className="text-sm text-gray-500">Interact with the AI to trigger potential issues and flag them.</p>
        </div>
        <Chat isComplianceMode={true} isEmbedded={true} />
      </div>
    </div>
  );
};

export default CompliancePortal;
