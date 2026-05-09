import React from "react";
import { Button } from "@/components/ui/button";
import { Mail, FileText, Shield } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { TermsOfServiceContent, PrivacyPolicyContent } from "@/components/legal/LegalDocuments";

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

          <div className="mt-6 bg-white rounded-lg border border-gray-200 p-6 text-left">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center flex-shrink-0">
                <FileText className="h-5 w-5 text-gray-700" />
              </div>
              <div className="min-w-0">
                <h3 className="text-lg font-semibold text-gray-900">Policies</h3>
                <p className="text-sm text-gray-600">
                  Review how Whisperoo works and how we handle your data.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Dialog>
                <DialogTrigger asChild>
                  <button className="w-full text-left rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 px-4 py-3 transition-colors">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-gray-700" />
                      <span className="font-semibold text-gray-900">Privacy Policy</span>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">How we collect and use data</p>
                  </button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Privacy Policy</DialogTitle>
                  </DialogHeader>
                  <DialogDescription className="mt-4 text-left">
                    <PrivacyPolicyContent />
                  </DialogDescription>
                </DialogContent>
              </Dialog>

              <Dialog>
                <DialogTrigger asChild>
                  <button className="w-full text-left rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 px-4 py-3 transition-colors">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-gray-700" />
                      <span className="font-semibold text-gray-900">Terms of Use</span>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">Rules and disclaimers for using Whisperoo</p>
                  </button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Terms of Use</DialogTitle>
                  </DialogHeader>
                  <DialogDescription className="mt-4 text-left">
                    <TermsOfServiceContent />
                  </DialogDescription>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
