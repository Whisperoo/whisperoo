import React from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { X, Eye, CheckCircle, AlertCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useState, useMemo } from 'react';
import AvatarUpload from '@/components/ui/AvatarUpload';
import { useNavigate } from 'react-router-dom';
import { Progress } from '@/components/ui/progress';

const expertProfileSchema = z.object({
  first_name: z.string().min(1, 'First name is required'),
  expert_bio: z.string().min(50, 'Bio must be at least 50 characters'),
  expert_experience_years: z.number().min(0, 'Experience must be 0 or more years'),
  expert_consultation_rate: z.number().min(0, 'Rate must be 0 or more'),
  expert_availability_status: z.enum(['available', 'busy', 'unavailable']),
});

type ExpertProfileFormData = z.infer<typeof expertProfileSchema>;

const COMMON_SPECIALTIES = [
  'Child Development',
  'Parenting Strategies',
  'Sleep Training',
  'Nutrition',
  'Behavioral Issues',
  'Newborn Care',
  'Breastfeeding',
  'Potty Training',
  'Educational Development',
  'Special Needs',
  'Mental Health',
  'Family Dynamics',
  'Discipline Strategies',
];

const COMMON_CREDENTIALS = [
  'Licensed Family Therapist (LFT)',
  'Licensed Clinical Social Worker (LCSW)',
  'Licensed Professional Counselor (LPC)',
  'Licensed Marriage and Family Therapist (LMFT)',
  'Board Certified Pediatrician',
  'Registered Nurse (RN)',
  'Certified Lactation Consultant',
  'Certified Parenting Coach',
  'Child Development Associate (CDA)',
  'Child Development Specialist',
  'Master\'s in Child Psychology',
  'PhD in Developmental Psychology',
  'Certified Sleep Consultant',
  'Certified Pediatric Sleep Consultant',
];

export const ExpertProfileEditor: React.FC = () => {
  const { profile, updateProfile } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [specialties, setSpecialties] = useState<string[]>(profile?.expert_specialties || []);
  const [credentials, setCredentials] = useState<string[]>(profile?.expert_credentials || []);
  const [newSpecialty, setNewSpecialty] = useState('');
  const [newCredential, setNewCredential] = useState('');
  const [customSpecialty, setCustomSpecialty] = useState('');
  const [customCredential, setCustomCredential] = useState('');

  const form = useForm<ExpertProfileFormData>({
    resolver: zodResolver(expertProfileSchema),
    defaultValues: {
      first_name: profile?.first_name || '',
      expert_bio: profile?.expert_bio || '',
      expert_experience_years: profile?.expert_experience_years || 0,
      expert_consultation_rate: profile?.expert_consultation_rate || 0,
      expert_availability_status: (profile?.expert_availability_status as 'available' | 'busy' | 'unavailable') || 'available',
    },
  });

  const onSubmit = async (data: ExpertProfileFormData) => {
    setIsLoading(true);
    try {
      const updates = {
        ...data,
        expert_specialties: specialties,
        expert_credentials: credentials,
      };

      const { error } = await updateProfile(updates);
      if (error) {
        console.error('Profile update error:', error);
      } else {
        // Show success message
        console.log('Profile updated successfully');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const addSpecialty = (specialty: string) => {
    if (specialty && !specialties.includes(specialty)) {
      setSpecialties([...specialties, specialty]);
      setNewSpecialty('');
      setCustomSpecialty('');
    }
  };

  const removeSpecialty = (specialty: string) => {
    setSpecialties(specialties.filter(s => s !== specialty));
  };

  const addCredential = (credential: string) => {
    if (credential && !credentials.includes(credential)) {
      setCredentials([...credentials, credential]);
      setNewCredential('');
      setCustomCredential('');
    }
  };

  const removeCredential = (credential: string) => {
    setCredentials(credentials.filter(c => c !== credential));
  };

  const handlePreviewProfile = () => {
    if (profile?.id) {
      // Open expert profile in new tab to preview
      window.open(`/experts/${profile.id}`, '_blank');
    }
  };

  // Calculate profile completeness
  const profileCompleteness = useMemo(() => {
    if (!profile) return { percentage: 0, completedItems: [], missingItems: [] };

    const items = [
      { key: 'profile_image', completed: !!profile.profile_image_url, label: 'Profile Photo' },
      { key: 'first_name', completed: !!profile.first_name, label: 'Name' },
      { key: 'expert_bio', completed: !!profile.expert_bio && profile.expert_bio.length >= 50, label: 'Professional Bio (50+ characters)' },
      { key: 'expert_specialties', completed: !!profile.expert_specialties && profile.expert_specialties.length > 0, label: 'Areas of Specialization' },
      { key: 'expert_credentials', completed: !!profile.expert_credentials && profile.expert_credentials.length > 0, label: 'Professional Credentials' },
      { key: 'expert_experience_years', completed: !!profile.expert_experience_years && profile.expert_experience_years > 0, label: 'Years of Experience' },
      { key: 'expert_consultation_rate', completed: !!profile.expert_consultation_rate && profile.expert_consultation_rate > 0, label: 'Consultation Rate' },
    ];

    const completedItems = items.filter(item => item.completed);
    const missingItems = items.filter(item => !item.completed);
    const percentage = Math.round((completedItems.length / items.length) * 100);

    return { percentage, completedItems, missingItems };
  }, [profile]);

  if (!profile || profile.account_type !== 'expert') {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-center text-muted-foreground">
            This section is only available for expert accounts.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Expert Profile Information</CardTitle>
        {/* Profile Completeness Indicator */}
        <div className="mt-4 p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Profile Completeness</span>
            <span className="text-sm font-semibold">{profileCompleteness.percentage}%</span>
          </div>
          <Progress value={profileCompleteness.percentage} className="mb-3" />
          {profileCompleteness.missingItems.length > 0 && (
            <div className="space-y-1">
              <p className="text-sm text-gray-600 font-medium">Complete your profile to attract more families:</p>
              {profileCompleteness.missingItems.map((item) => (
                <div key={item.key} className="flex items-center text-sm text-gray-600">
                  <AlertCircle className="h-3 w-3 mr-2 text-amber-500" />
                  {item.label}
                </div>
              ))}
            </div>
          )}
          {profileCompleteness.percentage === 100 && (
            <div className="flex items-center text-sm text-green-600">
              <CheckCircle className="h-4 w-4 mr-2" />
              Your profile is complete! Families can see all your information.
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Profile Image */}
            <div className="flex flex-col items-center mb-6">
              <h3 className="text-lg font-medium mb-4">Profile Photo</h3>
              <AvatarUpload className="mb-2" />
              <p className="text-sm text-gray-600 text-center max-w-md">
                Upload a professional headshot. This image will be visible to families browsing expert profiles.
              </p>
            </div>

            {/* Basic Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="first_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="expert_experience_years"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Years of Experience</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Bio */}
            <FormField
              control={form.control}
              name="expert_bio"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Professional Bio</FormLabel>
                  <FormControl>
                    <Textarea
                      className="min-h-[120px]"
                      placeholder="Tell parents about your background, experience, and approach..."
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Describe your expertise, approach, and what makes you unique as a parenting expert.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Specialties */}
            <div>
              <FormLabel>Areas of Specialization</FormLabel>
              <div className="space-y-3 mt-2">
                <div className="flex flex-wrap gap-2">
                  {specialties.map((specialty) => (
                    <Badge key={specialty} variant="secondary" className="gap-1">
                      {specialty}
                      <X
                        className="h-3 w-3 cursor-pointer"
                        onClick={() => removeSpecialty(specialty)}
                      />
                    </Badge>
                  ))}
                </div>
                
                <div className="flex gap-2">
                  <Select value={newSpecialty} onValueChange={setNewSpecialty}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Choose a specialty" />
                    </SelectTrigger>
                    <SelectContent>
                      {COMMON_SPECIALTIES.filter(s => !specialties.includes(s)).map((specialty) => (
                        <SelectItem key={specialty} value={specialty}>
                          {specialty}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => addSpecialty(newSpecialty)}
                    disabled={!newSpecialty}
                  >
                    Add
                  </Button>
                </div>
                
                <div className="flex gap-2">
                  <Input
                    placeholder="Or add custom specialty"
                    value={customSpecialty}
                    onChange={(e) => setCustomSpecialty(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addSpecialty(customSpecialty);
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => addSpecialty(customSpecialty)}
                    disabled={!customSpecialty}
                  >
                    Add
                  </Button>
                </div>
              </div>
            </div>

            {/* Credentials */}
            <div>
              <FormLabel>Professional Credentials</FormLabel>
              <div className="space-y-3 mt-2">
                <div className="flex flex-wrap gap-2">
                  {credentials.map((credential) => (
                    <Badge key={credential} variant="secondary" className="gap-1">
                      {credential}
                      <X
                        className="h-3 w-3 cursor-pointer"
                        onClick={() => removeCredential(credential)}
                      />
                    </Badge>
                  ))}
                </div>
                
                <div className="flex gap-2">
                  <Select value={newCredential} onValueChange={setNewCredential}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Choose a credential" />
                    </SelectTrigger>
                    <SelectContent>
                      {COMMON_CREDENTIALS.filter(c => !credentials.includes(c)).map((credential) => (
                        <SelectItem key={credential} value={credential}>
                          {credential}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => addCredential(newCredential)}
                    disabled={!newCredential}
                  >
                    Add
                  </Button>
                </div>
                
                <div className="flex gap-2">
                  <Input
                    placeholder="Or add custom credential"
                    value={customCredential}
                    onChange={(e) => setCustomCredential(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addCredential(customCredential);
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => addCredential(customCredential)}
                    disabled={!customCredential}
                  >
                    Add
                  </Button>
                </div>
              </div>
            </div>

            {/* Consultation Rate and Availability */}
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
                        placeholder="0.00"
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
                name="expert_availability_status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Availability Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="available">Available</SelectItem>
                        <SelectItem value="busy">Busy</SelectItem>
                        <SelectItem value="unavailable">Unavailable</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex gap-3">
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Saving...' : 'Save Profile'}
              </Button>
              <Button 
                type="button" 
                variant="outline" 
                onClick={handlePreviewProfile}
                className="gap-2"
              >
                <Eye className="h-4 w-4" />
                Preview Profile
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};