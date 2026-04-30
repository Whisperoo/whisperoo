import React, { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()
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
    { key: 'gentle', value: 'Gentle & Nurturing' },
    { key: 'structured', value: 'Structured & Routine-based' },
    { key: 'flexible', value: 'Flexible & Child-led' },
    { key: 'figuring', value: 'Still Figuring It Out' }
  ]

  const topicOptions = [
    { key: 'sleep', value: 'Sleep & Routines' },
    { key: 'feeding', value: 'Feeding & Nutrition' },
    { key: 'milestones', value: 'Developmental Milestones' },
    { key: 'mentalHealth', value: 'Mental Health & Self-Care' },
    { key: 'discipline', value: 'Discipline & Boundaries' },
    { key: 'play', value: 'Play & Learning' },
    { key: 'relationships', value: 'Relationships & Co-Parenting' },
    { key: 'community', value: 'Community & Support' }
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
        title: t('profileEdit.successTitle'),
        description: t('profileEdit.successDesc'),
      })

      onClose()

    } catch (error: any) {
      console.error('Error saving profile:', error)
      toast({
        title: t('profileEdit.errorTitle'),
        description: error.message || t('profileEdit.errorDesc'),
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
          <DialogTitle className="text-xl font-semibold">{t('profileEdit.title')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Profile Image Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('profileEdit.profileImage')}</CardTitle>
            </CardHeader>
            <CardContent>
              <AvatarUpload />
            </CardContent>
          </Card>

          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('profileEdit.basicInfo')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="first_name">{t('profileEdit.firstName')}</Label>
                <Input
                  id="first_name"
                  value={formData.first_name}
                  onChange={(e) => handleInputChange('first_name', e.target.value)}
                  placeholder={t('profileEdit.firstNamePlaceholder')}
                />
              </div>

              <div>
                <Label htmlFor="email">{t('profileEdit.email')}</Label>
                <Input
                  id="email"
                  value={profile.email}
                  disabled
                  className="bg-gray-50"
                />
                <p className="text-xs text-gray-500 mt-1">{t('profileEdit.emailNoChange')}</p>
              </div>

              <div>
                <Label>{t('profileEdit.role')}</Label>
                <div className="flex gap-2 mt-2">
                  {(['mom', 'dad', 'caregiver', 'other'] as const).map((role) => (
                    <Button
                      key={role}
                      variant={formData.role === role ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleInputChange('role', role)}
                      className="capitalize"
                    >
                      {t(`profileEdit.roles.${role}`)}
                    </Button>
                  ))}
                </div>
                {formData.role === 'other' && (
                  <Input
                    value={formData.custom_role}
                    onChange={(e) => handleInputChange('custom_role', e.target.value)}
                    placeholder={t('profileEdit.specifyRole')}
                    className="mt-2"
                  />
                )}
              </div>

              <div>
                <Label>{t('profileEdit.expectingStatus')}</Label>
                <div className="flex gap-2 mt-2">
                  {(['yes', 'no', 'trying'] as const).map((status) => (
                    <Button
                      key={status}
                      variant={formData.expecting_status === status ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleInputChange('expecting_status', status)}
                      className="capitalize"
                    >
                      {t(`profileEdit.expecting.${status}`)}
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Children Management */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('profileEdit.children')}</CardTitle>
            </CardHeader>
            <CardContent>
              <ChildrenManager onDataChange={onChildrenChange} />
            </CardContent>
          </Card>

          {/* Parenting Styles */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('profileEdit.parentingStyles')}</CardTitle>
              <p className="text-sm text-gray-600">{t('profileEdit.parentingStylesDesc')}</p>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {parentingStyleOptions.map((style) => (
                  <Badge
                    key={style.key}
                    variant={formData.parenting_styles.includes(style.value) ? 'default' : 'outline'}
                    className="cursor-pointer px-3 py-1"
                    onClick={() => handleInputChange('parenting_styles', 
                      toggleArrayItem(formData.parenting_styles, style.value)
                    )}
                  >
                    {t(`profileEdit.styleOptions.${style.key}`)}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Topics of Interest */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('profileEdit.topicsOfInterest')}</CardTitle>
              <p className="text-sm text-gray-600">{t('profileEdit.topicsOfInterestDesc')}</p>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {topicOptions.map((topic) => (
                  <Badge
                    key={topic.key}
                    variant={formData.topics_of_interest.includes(topic.value) ? 'default' : 'outline'}
                    className="cursor-pointer px-3 py-1"
                    onClick={() => handleInputChange('topics_of_interest', 
                      toggleArrayItem(formData.topics_of_interest, topic.value)
                    )}
                  >
                    {t(`profileEdit.topicOptions.${topic.key}`)}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Personal Context */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('profileEdit.personalContext')}</CardTitle>
              <p className="text-sm text-gray-600">
                {t('profileEdit.personalContextDesc')}
              </p>
            </CardHeader>
            <CardContent>
              <Textarea
                value={formData.personal_context}
                onChange={(e) => handleInputChange('personal_context', e.target.value)}
                placeholder={t('profileEdit.personalContextPlaceholder')}
                rows={4}
                maxLength={1000}
              />
              <p className="text-xs text-gray-500 mt-1">
                {formData.personal_context.length}/1000 {t('profileEdit.characters')}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            {t('profileEdit.cancel')}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? t('profileEdit.saving') : t('profileEdit.saveChanges')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default ProfileEditModal