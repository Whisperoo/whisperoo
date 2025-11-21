import React, { useState, useEffect } from 'react'
import { Edit3, Baby, Heart, Users, Calendar, MapPin } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from './button'
import { Card, CardContent, CardHeader, CardTitle } from './card'
import { Badge } from './badge'
import { Avatar, AvatarFallback, AvatarImage } from './avatar'
import { Separator } from './separator'
import { supabase } from '@/lib/supabase'
import { calculateAge } from '@/utils/age'
import { formatDueDate } from '@/utils/auth'
import ProfileEditModal from './ProfileEditModal'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './dialog'

interface ProfileViewModalProps {
  isOpen: boolean
  onClose: () => void
}

interface Child {
  id: string
  first_name: string
  birth_date?: string
  is_expecting?: boolean
  due_date?: string
  expected_name?: string
}

const ProfileViewModal: React.FC<ProfileViewModalProps> = ({ isOpen, onClose }) => {
  const { profile } = useAuth()
  const [children, setChildren] = useState<Child[]>([])
  const [loading, setLoading] = useState(true)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)

  // Fetch children data
  useEffect(() => {
    if (isOpen && profile?.id) {
      fetchChildren()
    }
  }, [isOpen, profile?.id])

  const fetchChildren = async () => {
    if (!profile?.id) return

    try {
      const { data, error } = await supabase
        .from('kids')
        .select('*')
        .eq('parent_id', profile.id)
        .order('created_at', { ascending: true })

      if (error) throw error
      setChildren(data || [])
    } catch (error) {
      console.error('Error fetching children:', error)
    } finally {
      setLoading(false)
    }
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'mom': return '👩'
      case 'dad': return '👨'
      case 'caregiver': return '🤱'
      default: return '👤'
    }
  }

  const getExpectingStatusColor = (status: string) => {
    switch (status) {
      case 'yes': return 'bg-pink-100 text-pink-700'
      case 'trying': return 'bg-purple-100 text-purple-700'
      default: return 'bg-gray-100 text-gray-700'
    }
  }

  const bornChildren = children.filter(child => !child.is_expecting)
  const expectedBabies = children.filter(child => child.is_expecting)

  const handleEditProfile = () => {
    setIsEditModalOpen(true)
    onClose() // Close view modal
  }

  const handleEditModalClose = () => {
    setIsEditModalOpen(false)
    // Don't automatically reopen view modal - let user click profile again if needed
  }

  if (!profile) {
    return null
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" style={{ backgroundColor: '#F2EBE5' }}>
          <DialogHeader className="border-b border-indigo-100 pb-4">
            <DialogTitle className="text-2xl font-bold text-action-primary text-center">
              My Profile
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-6">
            {/* Header Section with Avatar and Basic Info */}
            <Card className="bg-gradient-to-r from-indigo-50 to-indigo-100 border-indigo-200">
              <CardContent className="pt-8 pb-6">
                <div className="flex flex-col items-center space-y-4">
                  <Avatar className="h-32 w-32 border-4 border-white shadow-lg">
                    <AvatarImage 
                      src={profile.profile_image_url || undefined} 
                      alt={profile.first_name}
                    />
                    <AvatarFallback className="bg-action-primary text-white text-2xl font-bold">
                      {getInitials(profile.first_name)}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="text-center space-y-2">
                    <h2 className="text-3xl font-bold text-action-primary">
                      {profile.first_name}
                    </h2>
                    <div className="flex items-center justify-center space-x-2">
                      <span className="text-2xl">{getRoleIcon(profile.role || 'mom')}</span>
                      <span className="text-lg text-action-primary font-medium capitalize">
                        {profile.role === 'other' && profile.custom_role 
                          ? profile.custom_role 
                          : profile.role || 'Parent'
                        }
                      </span>
                    </div>
                    <p className="text-gray-600">{profile.email}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Family Overview */}
            <Card className="bg-white border-indigo-100">
              <CardHeader className="pb-3">
                <CardTitle className="text-xl text-indigo-700 flex items-center">
                  <Users className="w-5 h-5 mr-2" />
                  Family Overview
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-indigo-50 rounded-lg">
                    <div className="text-2xl font-bold text-indigo-700">{bornChildren.length}</div>
                    <div className="text-sm text-indigo-600">
                      {bornChildren.length === 1 ? 'Child' : 'Children'}
                    </div>
                  </div>
                  
                  {profile.expecting_status === 'yes' && (
                    <div className="text-center p-4 bg-pink-50 rounded-lg">
                      <div className="text-2xl font-bold text-pink-700">{expectedBabies.length}</div>
                      <div className="text-sm text-pink-600">Expecting</div>
                    </div>
                  )}
                  
                  <div className="text-center p-4 bg-purple-50 rounded-lg">
                    <Badge className={`text-sm font-medium ${getExpectingStatusColor(profile.expecting_status || 'no')}`}>
                      {profile.expecting_status === 'yes' ? 'Expecting' : 
                       profile.expecting_status === 'trying' ? 'Trying to Conceive' : 
                       'Not Expecting'}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Children Gallery */}
            {(bornChildren.length > 0 || expectedBabies.length > 0) && (
              <Card className="bg-white border-indigo-100">
                <CardHeader className="pb-3">
                  <CardTitle className="text-xl text-indigo-700 flex items-center">
                    <Heart className="w-5 h-5 mr-2" />
                    My Family
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Born Children */}
                  {bornChildren.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="font-medium text-gray-700">Children</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {bornChildren.map((child) => (
                          <div key={child.id} className="flex items-center space-x-3 p-3 bg-blue-50 rounded-lg">
                            <Avatar className="h-12 w-12">
                              <AvatarFallback className="bg-blue-200 text-blue-700 font-medium">
                                {getInitials(child.first_name)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium text-gray-900">{child.first_name}</p>
                              {child.birth_date && (
                                <p className="text-sm text-gray-600">
                                  {calculateAge(child.birth_date)}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Expected Babies */}
                  {expectedBabies.length > 0 && (
                    <div className="space-y-3">
                      {bornChildren.length > 0 && <Separator />}
                      <h4 className="font-medium text-gray-700">Expected Arrivals</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {expectedBabies.map((baby) => (
                          <div key={baby.id} className="flex items-center space-x-3 p-3 bg-pink-50 rounded-lg">
                            <div className="h-12 w-12 bg-pink-200 rounded-full flex items-center justify-center">
                              <Baby className="w-6 h-6 text-pink-600" />
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">
                                {baby.expected_name || 'Expected Baby'}
                              </p>
                              {baby.due_date && (
                                <p className="text-sm text-gray-600">
                                  Due: {formatDueDate(new Date(baby.due_date))}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Parenting Preferences */}
            {(profile.parenting_styles?.length > 0 || profile.topics_of_interest?.length > 0) && (
              <Card className="bg-white border-indigo-100">
                <CardHeader className="pb-3">
                  <CardTitle className="text-xl text-indigo-700">Parenting Preferences</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {profile.parenting_styles?.length > 0 && (
                    <div>
                      <h4 className="font-medium text-gray-700 mb-2">Parenting Styles</h4>
                      <div className="flex flex-wrap gap-2">
                        {profile.parenting_styles.map((style) => (
                          <Badge key={style} variant="secondary" className="bg-indigo-100 text-indigo-700">
                            {style}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {profile.topics_of_interest?.length > 0 && (
                    <div>
                      {profile.parenting_styles?.length > 0 && <Separator />}
                      <h4 className="font-medium text-gray-700 mb-2">Topics of Interest</h4>
                      <div className="flex flex-wrap gap-2">
                        {profile.topics_of_interest.map((topic) => (
                          <Badge key={topic} variant="outline" className="border-purple-200 text-purple-700">
                            {topic}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Personal Story */}
            {profile.personal_context && (
              <Card className="bg-white border-indigo-100">
                <CardHeader className="pb-3">
                  <CardTitle className="text-xl text-indigo-700">My Story</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-gray-50 p-4 rounded-lg border-l-4 border-indigo-500">
                    <p className="text-gray-700 leading-relaxed italic">
                      "{profile.personal_context}"
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Edit Profile Button */}
          <div className="flex justify-center pt-4 border-t border-indigo-100">
            <Button 
              onClick={handleEditProfile}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 text-lg font-medium"
              size="lg"
            >
              <Edit3 className="w-5 h-5 mr-2" />
              Edit Profile
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <ProfileEditModal 
        isOpen={isEditModalOpen}
        onClose={handleEditModalClose}
      />
    </>
  )
}

export default ProfileViewModal