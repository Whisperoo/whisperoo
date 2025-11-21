import React, { useState } from 'react';
import { ArrowLeft, User, Award, Settings, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { ExpertProfileEditor } from '@/components/expert/ExpertProfileEditor';
import { ExpertPersonalSection } from '@/components/expert/ExpertPersonalSection';
import { ExpertVerificationSection } from '@/components/expert/ExpertVerificationSection';
import { ExpertConsultationSettings } from '@/components/expert/ExpertConsultationSettings';

export const ExpertProfileSettings: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState('professional');

  if (!profile || profile.account_type !== 'expert') {
    return (
    <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardContent className="p-6">
              <p className="text-center text-muted-foreground">
                This page is only available for expert accounts.
              </p>
              <div className="flex justify-center mt-4">
                <Button onClick={() => navigate('/dashboard')}>
                  Return to Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate('/expert-dashboard')}
            className="p-2 hover:bg-white/20"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Expert Profile Settings
            </h1>
            <p className="text-gray-600 mt-1">
              Manage your professional profile and personal information
            </p>
          </div>
        </div>

        {/* Main Content */}
        <Card className="bg-white shadow-lg">
          <CardContent className="p-8">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
              <TabsList className="grid grid-cols-4 w-full">
                <TabsTrigger value="professional" className="gap-2">
                  <Award className="h-4 w-4" />
                  Professional
                </TabsTrigger>
                <TabsTrigger value="personal" className="gap-2">
                  <User className="h-4 w-4" />
                  Personal
                </TabsTrigger>
                <TabsTrigger value="consultation" className="gap-2">
                  <Settings className="h-4 w-4" />
                  Consultation
                </TabsTrigger>
                <TabsTrigger value="verification" className="gap-2">
                  <Shield className="h-4 w-4" />
                  Verification
                </TabsTrigger>
              </TabsList>

              <TabsContent value="professional" className="space-y-6">
                <div>
                  <h3 className="text-xl font-semibold mb-2">Professional Information</h3>
                  <p className="text-gray-600 mb-6">
                    Update your professional bio, credentials, and expertise areas
                  </p>
                  <ExpertProfileEditor />
                </div>
              </TabsContent>

              <TabsContent value="personal" className="space-y-6">
                <div>
                  <h3 className="text-xl font-semibold mb-2">Personal Information</h3>
                  <p className="text-gray-600 mb-6">
                    Manage your personal profile, family information, and preferences
                  </p>
                  <ExpertPersonalSection />
                </div>
              </TabsContent>

              <TabsContent value="consultation" className="space-y-6">
                <div>
                  <h3 className="text-xl font-semibold mb-2">Consultation Settings</h3>
                  <p className="text-gray-600 mb-6">
                    Configure how you offer consultations to families
                  </p>
                  <ExpertConsultationSettings />
                </div>
              </TabsContent>

              <TabsContent value="verification" className="space-y-6">
                <div>
                  <h3 className="text-xl font-semibold mb-2">Verification & Credentials</h3>
                  <p className="text-gray-600 mb-6">
                    Upload verification documents and manage your credential status
                  </p>
                  <ExpertVerificationSection />
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ExpertProfileSettings;