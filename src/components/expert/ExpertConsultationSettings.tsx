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
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { X, Clock, Globe, MapPin } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

const consultationSchema = z.object({
  expert_consultation_rate: z.number().min(0, 'Rate must be 0 or more'),
  expert_response_time_hours: z.number().min(1).max(168, 'Response time must be between 1-168 hours'),
  expert_office_location: z.string().optional(),
  expert_timezone: z.string(),
  expert_accepts_new_clients: z.boolean(),
  expert_profile_visibility: z.boolean(),
});

type ConsultationFormData = z.infer<typeof consultationSchema>;

const CONSULTATION_TYPES = [
  'Phone Call',
  'Video Call',
  'In-Person',
  'Email Consultation',
  'Text Message Support',
];

const LANGUAGES = [
  'English',
  'Spanish',
  'French',
  'German',
  'Italian',
  'Portuguese',
  'Mandarin',
  'Japanese',
  'Korean',
  'Hindi',
  'Arabic',
];

const TIMEZONES = [
  'America/New_York',
  'America/Chicago', 
  'America/Denver',
  'America/Los_Angeles',
  'America/Phoenix',
  'America/Alaska',
  'Pacific/Honolulu',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Australia/Sydney',
];

export const ExpertConsultationSettings: React.FC = () => {
  const { profile, updateProfile } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [consultationTypes, setConsultationTypes] = useState<string[]>(
    profile?.expert_consultation_types || []
  );
  const [languages, setLanguages] = useState<string[]>(
    profile?.expert_languages || ['English']
  );
  const [socialLinks, setSocialLinks] = useState<Record<string, string>>(
    (profile?.expert_social_links as Record<string, string>) || {}
  );

  const form = useForm<ConsultationFormData>({
    resolver: zodResolver(consultationSchema),
    defaultValues: {
      expert_consultation_rate: profile?.expert_consultation_rate || 0,
      expert_response_time_hours: profile?.expert_response_time_hours || 24,
      expert_office_location: profile?.expert_office_location || '',
      expert_timezone: profile?.expert_timezone || 'America/New_York',
      expert_accepts_new_clients: profile?.expert_accepts_new_clients !== false,
      expert_profile_visibility: profile?.expert_profile_visibility !== false,
    },
  });

  const onSubmit = async (data: ConsultationFormData) => {
    setIsLoading(true);
    try {
      const updates = {
        ...data,
        expert_consultation_types: consultationTypes,
        expert_languages: languages,
        expert_social_links: socialLinks,
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
          title: "Settings updated",
          description: "Your consultation settings have been saved successfully.",
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

  const toggleConsultationType = (type: string) => {
    setConsultationTypes(prev => 
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const toggleLanguage = (language: string) => {
    setLanguages(prev => 
      prev.includes(language) ? prev.filter(l => l !== language) : [...prev, language]
    );
  };

  const updateSocialLink = (platform: string, url: string) => {
    setSocialLinks(prev => ({
      ...prev,
      [platform]: url
    }));
  };

  const removeSocialLink = (platform: string) => {
    setSocialLinks(prev => {
      const updated = { ...prev };
      delete updated[platform];
      return updated;
    });
  };

  if (!profile || profile.account_type !== 'expert') {
    return null;
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Consultation Types */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center">
              <Clock className="h-5 w-5 mr-2" />
              Consultation Options
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <FormLabel>Types of Consultations Offered</FormLabel>
              <div className="flex flex-wrap gap-2 mt-2">
                {CONSULTATION_TYPES.map((type) => (
                  <Badge
                    key={type}
                    variant={consultationTypes.includes(type) ? 'default' : 'outline'}
                    className="cursor-pointer px-3 py-1"
                    onClick={() => toggleConsultationType(type)}
                  >
                    {type}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="expert_consultation_rate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Consultation Rate ($/hour)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value))}
                      />
                    </FormControl>
                    <FormDescription>
                      Your hourly rate for consultations
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="expert_response_time_hours"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Response Time (hours)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="1"
                        max="168"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value))}
                      />
                    </FormControl>
                    <FormDescription>
                      Expected response time for initial contact
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* Location and Languages */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center">
              <Globe className="h-5 w-5 mr-2" />
              Location & Languages
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="expert_office_location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Office/Practice Location</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="City, State or Online Only"
                        className="flex-1"
                      />
                    </FormControl>
                    <FormDescription>
                      Where you provide consultations
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="expert_timezone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Timezone</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select timezone" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {TIMEZONES.map((tz) => (
                          <SelectItem key={tz} value={tz}>
                            {tz.replace('_', ' ')}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div>
              <FormLabel>Languages</FormLabel>
              <div className="flex flex-wrap gap-2 mt-2">
                {LANGUAGES.map((language) => (
                  <Badge
                    key={language}
                    variant={languages.includes(language) ? 'default' : 'outline'}
                    className="cursor-pointer px-3 py-1"
                    onClick={() => toggleLanguage(language)}
                  >
                    {language}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Social Links */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Professional Social Links</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.entries(socialLinks).map(([platform, url]) => (
              <div key={platform} className="flex gap-2">
                <Input
                  value={url}
                  onChange={(e) => updateSocialLink(platform, e.target.value)}
                  placeholder={`${platform} URL`}
                  className="flex-1"
                />
                <Button 
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => removeSocialLink(platform)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            
            <div className="grid grid-cols-2 gap-2">
              {['LinkedIn', 'Twitter', 'Instagram', 'Facebook', 'YouTube', 'TikTok'].map((platform) => (
                !socialLinks[platform.toLowerCase()] && (
                  <Button
                    key={platform}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => updateSocialLink(platform.toLowerCase(), '')}
                  >
                    Add {platform}
                  </Button>
                )
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Profile Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Profile Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <FormField
              control={form.control}
              name="expert_profile_visibility"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">
                      Public Profile Visibility
                    </FormLabel>
                    <FormDescription>
                      Show your profile in public expert listings
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="expert_accepts_new_clients"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">
                      Accept New Clients
                    </FormLabel>
                    <FormDescription>
                      Allow new families to book consultations with you
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={isLoading}>
            {isLoading ? 'Saving...' : 'Save Consultation Settings'}
          </Button>
        </div>
      </form>
    </Form>
  );
};