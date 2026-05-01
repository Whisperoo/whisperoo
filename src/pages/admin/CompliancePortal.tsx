import React from 'react';
import Chat from '../Chat';
import { useTranslation } from 'react-i18next';

const CompliancePortal: React.FC = () => {
  const { t } = useTranslation();
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-brand-primary mb-2">{t('admin.compliance.title')}</h1>
        <p className="text-gray-600">{t('admin.compliance.description')}</p>
      </div>

      <div className="flex flex-col">
        <div className="mb-4">
          <h2 className="text-xl font-bold text-brand-dark">{t('admin.compliance.testEnv')}</h2>
          <p className="text-sm text-gray-500">{t('admin.compliance.testEnvDesc')}</p>
        </div>
        <Chat isComplianceMode={true} isEmbedded={true} />
      </div>
    </div>
  );
};

export default CompliancePortal;
