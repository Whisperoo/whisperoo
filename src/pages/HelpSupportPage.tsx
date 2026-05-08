import React from "react";
import { Button } from "@/components/ui/button";
import { Mail } from "lucide-react";
import { useTranslation } from "react-i18next";

export const HelpSupportPage: React.FC = () => {
  const { t } = useTranslation();
  const handleEmailSupport = () => {
    window.location.href = "mailto:support@whisperoo.app?subject=Support Request";
  };

  return (
    <div className="min-h-screen bg-gray-50 py-6">
      <div className="container mx-auto max-w-2xl">
        <div className="bg-white rounded-lg shadow-sm p-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">
            {t('help.pageTitle')}
          </h1>

          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              {t('help.whatIsWhisperoo')}
            </h2>
            <p className="text-gray-700 text-lg leading-relaxed">
              {t('help.whatIsWhisperooDesc')}
            </p>
          </div>

          <div className="bg-blue-50 rounded-lg p-6">
            <Mail className="h-12 w-12 text-blue-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              {t('help.needSupport')}
            </h3>
            <p className="text-gray-600 mb-4">
              {t('help.needSupportDesc')}
            </p>
            <Button
              onClick={handleEmailSupport}
              size="lg"
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Mail className="h-4 w-4 mr-2" />
              support@whisperoo.app
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
