import React, { useState, useEffect } from 'react'
import { Edit3, Baby, Heart, Users, Calendar, Globe, Trash2, MessageSquare } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { supabase } from '@/lib/supabase'
import { calculateAge } from '@/utils/age'
import { formatDueDate } from '@/utils/kids'
import ProfileEditModal from '@/components/ui/ProfileEditModal'
import LanguageSwitcher from '@/components/common/LanguageSwitcher'
import { useTranslation } from 'react-i18next'
import { toast } from '@/hooks/use-toast'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { useNavigate } from 'react-router-dom'

interface Child {
  id: string
  first_name: string
  birth_date?: string
  is_expecting?: boolean
  due_date?: string
  expected_name?: string
}

interface Session {
  id: string;
  title: string | null;
  summary: string | null;
  last_message_at: string | null;
  created_at: string | null;
  child_id: string | null;
}

const ProfilePage: React.FC = () => {
  const { t } = useTranslation()
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [children, setChildren] = useState<Child[]>([])
  const [loading, setLoading] = useState(true)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  
  // Chat History State
  const [sessions, setSessions] = useState<Session[]>([])
  const [sessionsLoading, setSessionsLoading] = useState(true)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [sessionToDelete, setSessionToDelete] = useState<Session | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Fetch children data
  useEffect(() => {
    if (profile?.id) {
      fetchChildren()
      fetchSessions()
    }
  }, [profile?.id])

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

  const fetchSessions = async () => {
    if (!profile?.id) return
    try {
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('user_id', profile.id)
        .order('last_message_at', { ascending: false, nullsFirst: false })
      if (error) throw error
      setSessions(data || [])
    } catch (error) {
      console.error('Error fetching sessions:', error)
    } finally {
      setSessionsLoading(false)
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return t('settings.never')
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    })
  }

  const handleDeleteSession = async () => {
    if (!sessionToDelete) return
    setDeleting(true)
    try {
      const { error } = await supabase.from('sessions').delete().eq('id', sessionToDelete.id)
      if (error) throw error
      setSessions(prev => prev.filter(s => s.id !== sessionToDelete.id))
      toast({
        title: t('settings.toastDeletedTitle'),
        description: t('settings.toastDeletedDesc')
      })
    } catch (error) {
      console.error('Error deleting session:', error)
      toast({
        title: t('settings.toastErrorTitle'),
        description: t('settings.toastErrorDesc'),
        variant: 'destructive'
      })
    } finally {
      setDeleting(false)
      setDeleteDialogOpen(false)
      setSessionToDelete(null)
    }
  }

  const openDeleteDialog = (session: Session) => {
    setSessionToDelete(session)
    setDeleteDialogOpen(true)
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
  }

  const handleEditModalClose = () => {
    setIsEditModalOpen(false)
    // Refetch children data when modal closes to show any changes
    fetchChildren()
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">{t('profile.noProfileTitle')}</h2>
          <p className="text-gray-600 mt-2">{t('profile.noProfileDesc')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto p-6">
        {/* Page Header */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">{t('profile.pageTitle')}</h1>
          <p className="text-gray-600 text-lg">{t('profile.pageSubtitle')}</p>
        </div>

        <div className="space-y-6">
          {/* Header Section with Avatar and Basic Info */}
          <Card className="bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-200">
            <CardContent className="pt-8 pb-6">
              <div className="flex flex-col items-center space-y-4">
                <Avatar className="h-32 w-32 border-4 border-white shadow-lg">
                  <AvatarImage 
                    src={profile.profile_image_url || undefined} 
                    alt={profile.first_name}
                  />
                  <AvatarFallback className="bg-indigo-600 text-white text-2xl font-bold">
                    {getInitials(profile.first_name)}
                  </AvatarFallback>
                </Avatar>
                
                <div className="text-center space-y-2">
                  <h2 className="text-3xl font-bold text-indigo-700">
                    {profile.first_name}
                  </h2>
                  <div className="flex items-center justify-center space-x-2">
                    <span className="text-2xl">{getRoleIcon(profile.role || 'mom')}</span>
                    <span className="text-lg text-indigo-600 font-medium capitalize">
                      {profile.role === 'other' && profile.custom_role 
                        ? profile.custom_role 
                        : profile.role === 'mom' ? t('profile.roleMom')
                        : profile.role === 'dad' ? t('profile.roleDad')
                        : profile.role === 'caregiver' ? t('profile.roleCaregiver')
                        : t('profile.roleParent')
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
                {t('profile.familyOverview')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-indigo-50 rounded-lg">
                  <div className="text-2xl font-bold text-indigo-700">{bornChildren.length}</div>
                  <div className="text-sm text-indigo-600">
                    {bornChildren.length === 1 ? t('profile.child') : t('profile.children')}
                  </div>
                </div>
                
                {profile.expecting_status === 'yes' && (
                  <div className="text-center p-4 bg-pink-50 rounded-lg">
                    <div className="text-2xl font-bold text-pink-700">{expectedBabies.length}</div>
                    <div className="text-sm text-pink-600">{t('profile.expecting')}</div>
                  </div>
                )}
                
                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <Badge className={`text-sm font-medium ${getExpectingStatusColor(profile.expecting_status || 'no')}`}>
                    {profile.expecting_status === 'yes' ? t('profile.expecting') : 
                     profile.expecting_status === 'trying' ? t('profile.tryingToConceive') : 
                     t('profile.notExpecting')}
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
                  {t('profile.myFamily')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Born Children */}
                {bornChildren.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="font-medium text-gray-700">{t('profile.children')}</h4>
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
                    <h4 className="font-medium text-gray-700">{t('profile.expectedArrivals')}</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {expectedBabies.map((baby) => (
                        <div key={baby.id} className="flex items-center space-x-3 p-3 bg-pink-50 rounded-lg">
                          <div className="h-12 w-12 bg-pink-200 rounded-full flex items-center justify-center">
                            <Baby className="w-6 h-6 text-pink-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">
                              {baby.expected_name || t('profile.expectedBaby')}
                            </p>
                            {baby.due_date && (
                              <p className="text-sm text-gray-600">
                                {t('profile.due', { date: formatDueDate(baby.due_date) })}
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
                <CardTitle className="text-xl text-indigo-700">{t('profile.parentingPreferences')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {profile.parenting_styles?.length > 0 && (
                  <div>
                    <h4 className="font-medium text-gray-700 mb-2">{t('profile.parentingStyles')}</h4>
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
                    <h4 className="font-medium text-gray-700 mb-2">{t('profile.topicsOfInterest')}</h4>
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

          {/* Chat History Management */}
          <Card className="bg-white border-indigo-100">
            <CardHeader className="pb-3">
              <CardTitle className="text-xl text-indigo-700 flex items-center">
                <MessageSquare className="w-5 h-5 mr-2" />
                {t('settings.chatHistoryTitle')}
              </CardTitle>
              <p className="text-sm text-gray-600">{t('settings.chatHistoryDesc')}</p>
            </CardHeader>
            <CardContent>
              {sessionsLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                  <p className="text-gray-600 mt-2">{t('settings.loading')}</p>
                </div>
              ) : sessions.length === 0 ? (
                <div className="text-center py-8">
                  <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">{t('settings.noSessions')}</p>
                  <p className="text-sm text-gray-500 mt-1">
                    {t('settings.startChatPrompt')}
                  </p>
                  <Button onClick={() => navigate('/chat')} className="mt-4 bg-indigo-600 hover:bg-indigo-700">
                    {t('settings.startChattingBtn')}
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {sessions.map(session => (
                    <div key={session.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <h4 className="font-medium text-gray-900">
                            {session.title || t('settings.untitledChat')}
                          </h4>
                          {session.child_id && (
                            <Badge variant="outline" className="text-xs">
                              {t('settings.childSpecific')}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                          {session.summary || t('settings.noSummary')}
                        </p>
                        <div className="flex items-center space-x-4 text-xs text-gray-500">
                          <span className="flex items-center">
                            <Calendar className="w-3 h-3 mr-1" />
                            {t('settings.created', { date: formatDate(session.created_at) })}
                          </span>
                          <span className="flex items-center">
                            <MessageSquare className="w-3 h-3 mr-1" />
                            {t('settings.lastActivity', { date: formatDate(session.last_message_at) })}
                          </span>
                        </div>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => openDeleteDialog(session)} className="ml-4 text-red-600 hover:text-red-700 hover:bg-red-50">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Language Preference */}
          <Card className="bg-white border-indigo-100">
            <CardHeader className="pb-3">
              <CardTitle className="text-xl text-indigo-700 flex items-center">
                <Globe className="w-5 h-5 mr-2" />
                {t('profile.languagePreference')}
              </CardTitle>
              <p className="text-sm text-gray-600">
                {t('profile.languagePreferenceDesc')}
              </p>
            </CardHeader>
            <CardContent>
              <LanguageSwitcher />
            </CardContent>
          </Card>

          {/* Personal Story */}
          {profile.personal_context && (
            <Card className="bg-white border-indigo-100">
              <CardHeader className="pb-3">
                <CardTitle className="text-xl text-indigo-700">{t('profile.myStory')}</CardTitle>
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

          {/* Edit Profile Button */}
          <div className="flex justify-center pt-4">
            <Button 
              onClick={handleEditProfile}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 text-lg font-medium"
              size="lg"
            >
              <Edit3 className="w-5 h-5 mr-2" />
              {t('profile.editProfile')}
            </Button>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      <ProfileEditModal
        isOpen={isEditModalOpen}
        onClose={handleEditModalClose}
        onChildrenChange={fetchChildren}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('settings.deleteDialogTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('settings.deleteDialogDesc')}
              <br /><br />
              <strong>{t('settings.deleteDialogSession')}</strong> {sessionToDelete?.title || t('settings.untitledChat')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{t('settings.cancelBtn')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteSession} disabled={deleting} className="bg-red-600 hover:bg-red-700">
              {deleting ? t('settings.deletingBtn') : t('settings.deleteBtn')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default ProfilePage