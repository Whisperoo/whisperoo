import React from "react";
import { Button } from "@/components/ui/button";
import { Mail } from "lucide-react";

export const HelpSupportPage: React.FC = () => {
  const handleEmailSupport = () => {
    window.location.href = "mailto:info@whisperoo.app?subject=Support Request";
  };

  return (
    <div className="min-h-screen bg-gray-50 py-6">
      <div className="container mx-auto max-w-2xl">
        <div className="bg-white rounded-lg shadow-sm p-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">
            Help & Support
          </h1>

          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              What is Whisperoo?
            </h2>
            <p className="text-gray-700 text-lg leading-relaxed">
              Whisperoo is your family's trusted companion for navigating the
              journey of parenting. We provide personalized guidance, expert
              insights, and 24/7 AI support to help you make informed decisions
              for your children at every stage of their development.
            </p>
          </div>

          <div className="bg-blue-50 rounded-lg p-6">
            <Mail className="h-12 w-12 text-blue-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Need Support?
            </h3>
            <p className="text-gray-600 mb-4">
              Have questions or need assistance? Contact our support team.
            </p>
            <Button
              onClick={handleEmailSupport}
              size="lg"
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Mail className="h-4 w-4 mr-2" />
              info@whisperoo.app
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
