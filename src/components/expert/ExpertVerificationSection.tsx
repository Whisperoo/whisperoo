import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Upload, 
  FileText, 
  CheckCircle, 
  AlertCircle, 
  X,
  Download,
  ExternalLink 
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

const verificationSchema = z.object({
  expert_education: z.array(z.string()).default([]),
  expert_website_url: z.string().url().optional().or(z.literal('')),
});

type VerificationFormData = z.infer<typeof verificationSchema>;

export const ExpertVerificationSection: React.FC = () => {
  const { profile, updateProfile } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [education, setEducation] = useState<string[]>(profile?.expert_education || []);
  const [newEducation, setNewEducation] = useState('');
  const [uploadingDocument, setUploadingDocument] = useState(false);

  const form = useForm<VerificationFormData>({
    resolver: zodResolver(verificationSchema),
    defaultValues: {
      expert_education: education,
      expert_website_url: profile?.expert_website_url || '',
    },
  });

  const onSubmit = async (data: VerificationFormData) => {
    setIsLoading(true);
    try {
      const updates = {
        expert_education: education,
        expert_website_url: data.expert_website_url || null,
      };

      const { error } = await updateProfile(updates);
      if (error) {
        console.error('Profile update error:', error);
        toast({
          title: "Failed to update",
          description: "Please try again.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Verification info updated",
          description: "Your verification information has been saved successfully.",
        });
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const addEducation = () => {
    if (newEducation.trim() && !education.includes(newEducation.trim())) {
      setEducation([...education, newEducation.trim()]);
      setNewEducation('');
    }
  };

  const removeEducation = (edu: string) => {
    setEducation(education.filter(e => e !== edu));
  };

  const handleDocumentUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingDocument(true);
    try {
      // This would integrate with Supabase Storage for document upload
      // For now, showing the interface structure
      toast({
        title: "Document upload",
        description: "Document upload feature will be implemented with Supabase Storage integration.",
      });
    } catch (error) {
      toast({
        title: "Upload failed",
        description: "Failed to upload document. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploadingDocument(false);
    }
  };

  if (!profile || profile.account_type !== 'expert') {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Verification Status */}
      <Alert className={profile.expert_verified ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}>
        <div className="flex items-center">
          {profile.expert_verified ? (
            <CheckCircle className="h-4 w-4 text-green-600" />
          ) : (
            <AlertCircle className="h-4 w-4 text-yellow-600" />
          )}
          <AlertDescription className="ml-2">
            {profile.expert_verified 
              ? "Your expert credentials have been verified by our team."
              : profile.expert_certifications_verified 
                ? "Your documents are under review. Verification typically takes 2-3 business days."
                : "Upload verification documents to complete your expert profile verification."
            }
          </AlertDescription>
        </div>
      </Alert>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Website URL */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Professional Website</CardTitle>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="expert_website_url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Website URL</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="https://your-professional-website.com"
                        type="url"
                      />
                    </FormControl>
                    <FormDescription>
                      Link to your professional website or practice page
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Education */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Education Background</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {education.map((edu) => (
                  <Badge key={edu} variant="secondary" className="gap-1">
                    {edu}
                    <X
                      className="h-3 w-3 cursor-pointer"
                      onClick={() => removeEducation(edu)}
                    />
                  </Badge>
                ))}
              </div>
              
              <div className="flex gap-2">
                <Input
                  placeholder="Add degree, institution, or certification"
                  value={newEducation}
                  onChange={(e) => setNewEducation(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addEducation();
                    }
                  }}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={addEducation}
                  disabled={!newEducation.trim()}
                >
                  Add
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Document Upload */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Verification Documents</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h4 className="text-lg font-medium text-gray-700 mb-2">
                  Upload Verification Documents
                </h4>
                <p className="text-gray-600 mb-4">
                  Upload copies of your licenses, certifications, or degrees for verification
                </p>
                <div className="flex flex-col items-center gap-3">
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={handleDocumentUpload}
                    className="hidden"
                    id="document-upload"
                    multiple
                  />
                  <label htmlFor="document-upload">
                    <Button 
                      type="button" 
                      variant="outline" 
                      className="gap-2"
                      disabled={uploadingDocument}
                      asChild
                    >
                      <span>
                        <FileText className="h-4 w-4" />
                        {uploadingDocument ? 'Uploading...' : 'Choose Files'}
                      </span>
                    </Button>
                  </label>
                  <p className="text-sm text-gray-500">
                    Supported formats: PDF, JPG, PNG (Max 10MB per file)
                  </p>
                </div>
              </div>

              {/* Uploaded Documents List */}
              {profile.expert_verification_documents && Object.keys(profile.expert_verification_documents).length > 0 && (
                <div className="space-y-3">
                  <h5 className="font-medium text-gray-700">Uploaded Documents</h5>
                  <div className="space-y-2">
                    {Object.entries(profile.expert_verification_documents).map(([filename, metadata]: [string, any]) => (
                      <div key={filename} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <FileText className="h-4 w-4 text-gray-500" />
                          <span className="text-sm font-medium text-gray-700">{filename}</span>
                          <Badge 
                            variant={metadata.verified ? 'default' : 'secondary'}
                            className="text-xs"
                          >
                            {metadata.verified ? 'Verified' : 'Pending Review'}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="ghost">
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost">
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Saving...' : 'Save Verification Info'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
};