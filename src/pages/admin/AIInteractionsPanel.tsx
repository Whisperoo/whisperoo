import React from 'react';
import AuditTrailTable from './AuditTrailTable';

// The existing compliance Q&A tool is imported here directly to avoid
// duplication — all its existing functionality is preserved unchanged.
import ExistingAdminContent from './ExistingAdminContent';

interface AIInteractionsPanelProps {
  tenantId: string | null;
}

const AIInteractionsPanel: React.FC<AIInteractionsPanelProps> = ({ tenantId }) => {
  return (
    <div className="space-y-6">
      {/* Existing compliance tool — preserved exactly as-is */}
      <ExistingAdminContent />

      {/* New audit trail */}
      <AuditTrailTable tenantId={tenantId} />
    </div>
  );
};

export default AIInteractionsPanel;
