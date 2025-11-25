import React, { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from './button'
import { Input } from './input'
import { Textarea } from './textarea'
import { Label } from './label'
import { Card, CardContent, CardHeader, CardTitle } from './card'
import { Separator } from './separator'
import { Badge } from './badge'
import { toast } from '@/hooks/use-toast'
import AvatarUpload from './AvatarUpload'
import ChildrenManager from './ChildrenManager'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './dialog'

interface ProfileEditModalProps {
  isOpen: boolean
  onClose: () => void
  onChildrenChange?: () => void
}

const ProfileEditModal: React.FC<ProfileEditModalProps> = ({ isOpen, onClose, onChildrenChange }) => {
  const { profile, updateProfile } = useAuth()
  const [formData, setFormData] = useState({
    first_name: '',
    role: 'mom' as 'mom' | 'dad' | 'caregiver' | 'other',
    custom_role: '',
    expecting_status: 'no' as 'yes' | 'no' | 'trying',
    parenting_styles: [] as string[],
    topics_of_interest: [] as string[],
    personal_context: '',
  })
  const [saving, setSaving] = useState(false)

  // Initialize form data when profile loads
  useEffect(() => {
    if (profile) {
      setFormData({
        first_name: profile.first_name || '',
        role: profile.role || 'mom',
        custom_role: profile.custom_role || '',
        expecting_status: profile.expecting_status || 'no',
        parenting_styles: profile.parenting_styles || [],
        topics_of_interest: profile.topics_of_interest || [],
        personal_context: profile.personal_context || '',
      })
    }
  }, [profile])

  const parentingStyleOptions = [
    'Gentle & Nurturing',
    'Structured & Routine-based',
    'Flexible & Child-led',
    'Still Figuring It Out'
  ]

  const topicOptions = [
    'Sleep & Routines',
    'Feeding & Nutrition',
    'Developmental Milestones',
    'Mental Health & Self-Care',
    'Discipline & Boundaries',
    'Play & Learning',
    'Relationships & Co-Parenting',
    'Community & Support'
  ]

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const toggleArrayItem = (array: string[], item: string) => {
    return array.includes(item)
      ? array.filter(i => i !== item)
      : [...array, item]
  }

  const handleSave = async () => {
    if (!profile) return

    try {
      setSaving(true)

      const updates = {
        first_name: formData.first_name.trim(),
        role: formData.role,
        custom_role: formData.role === 'other' ? formData.custom_role.trim() : null,
        expecting_status: formData.expecting_status,
        parenting_styles: formData.parenting_styles,
        topics_of_interest: formData.topics_of_interest,
        personal_context: formData.personal_context.trim() || null,
      }

      const { error } = await updateProfile(updates)

      if (error) {
        throw error
      }

      toast({
        title: "Profile updated",
        description: "Your profile has been saved successfully.",
      })

      onClose()

    } catch (error: any) {
      console.error('Error saving profile:', error)
      toast({
        title: "Failed to save",
        description: error.message || "Please try again.",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  if (!profile) {
    return null
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Edit Profile</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Profile Image Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Profile Image</CardTitle>
            </CardHeader>
            <CardContent>
              <AvatarUpload />
            </CardContent>
          </Card>

          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="first_name">First Name</Label>
                <Input
                  id="first_name"
                  value={formData.first_name}
                  onChange={(e) => handleInputChange('first_name', e.target.value)}
                  placeholder="Your first name"
                />
              </div>

              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  value={profile.email}
                  disabled
                  className="bg-gray-50"
                />
                <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
              </div>

              <div>
                <Label>Role</Label>
                <div className="flex gap-2 mt-2">
                  {(['mom', 'dad', 'caregiver', 'other'] as const).map((role) => (
                    <Button
                      key={role}
                      variant={formData.role === role ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleInputChange('role', role)}
                      className="capitalize"
                    >
                      {role}
                    </Button>
                  ))}
                </div>
                {formData.role === 'other' && (
                  <Input
                    value={formData.custom_role}
                    onChange={(e) => handleInputChange('custom_role', e.target.value)}
                    placeholder="Specify your role"
                    className="mt-2"
                  />
                )}
              </div>

              <div>
                <Label>Expecting Status</Label>
                <div className="flex gap-2 mt-2">
                  {(['yes', 'no', 'trying'] as const).map((status) => (
                    <Button
                      key={status}
                      variant={formData.expecting_status === status ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleInputChange('expecting_status', status)}
                      className="capitalize"
                    >
                      {status === 'trying' ? 'Trying' : status}
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Children Management */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Children</CardTitle>
            </CardHeader>
            <CardContent>
              <ChildrenManager onDataChange={onChildrenChange} />
            </CardContent>
          </Card>

          {/* Parenting Styles */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Parenting Styles</CardTitle>
              <p className="text-sm text-gray-600">Select all that apply to your approach</p>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {parentingStyleOptions.map((style) => (
                  <Badge
                    key={style}
                    variant={formData.parenting_styles.includes(style) ? 'default' : 'outline'}
                    className="cursor-pointer px-3 py-1"
                    onClick={() => handleInputChange('parenting_styles', 
                      toggleArrayItem(formData.parenting_styles, style)
                    )}
                  >
                    {style}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Topics of Interest */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Topics of Interest</CardTitle>
              <p className="text-sm text-gray-600">What would you like help with?</p>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {topicOptions.map((topic) => (
                  <Badge
                    key={topic}
                    variant={formData.topics_of_interest.includes(topic) ? 'default' : 'outline'}
                    className="cursor-pointer px-3 py-1"
                    onClick={() => handleInputChange('topics_of_interest', 
                      toggleArrayItem(formData.topics_of_interest, topic)
                    )}
                  >
                    {topic}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Personal Context */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Personal Context</CardTitle>
              <p className="text-sm text-gray-600">
                Tell us about your family situation and what you're looking for help with
              </p>
            </CardHeader>
            <CardContent>
              <Textarea
                value={formData.personal_context}
                onChange={(e) => handleInputChange('personal_context', e.target.value)}
                placeholder="Share what you're looking for help with, any challenges you're facing, or anything else that would help us provide better support..."
                rows={4}
                maxLength={1000}
              />
              <p className="text-xs text-gray-500 mt-1">
                {formData.personal_context.length}/1000 characters
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default ProfileEditModal