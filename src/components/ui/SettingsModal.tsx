import React, { useState, useEffect } from 'react'
import { Trash2, MessageSquare, Calendar, Info } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs'
import { Button } from './button'
import { Card, CardContent, CardHeader, CardTitle } from './card'
import { Separator } from './separator'
import { Badge } from './badge'
import { toast } from '@/hooks/use-toast'
import { supabase } from '@/lib/supabase'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './alert-dialog'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

interface Session {
  id: string
  title: string | null
  summary: string | null
  last_message_at: string | null
  created_at: string | null
  child_id: string | null
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [sessionToDelete, setSessionToDelete] = useState<Session | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Fetch sessions when modal opens
  useEffect(() => {
    if (isOpen && profile?.id) {
      fetchSessions()
    }
  }, [isOpen, profile?.id])

  const fetchSessions = async () => {
    if (!profile?.id) return

    try {
      setLoading(true)
      
      const { data, error } = await supabase
        .from('sessions')
        .select('id, title, summary, last_message_at, created_at, child_id')
        .eq('user_id', profile.id)
        .not('summary', 'is', null)
        .order('last_message_at', { ascending: false, nullsFirst: false })

      if (error) {
        throw error
      }

      setSessions(data || [])
    } catch (error: any) {
      console.error('Error fetching sessions:', error)
      toast({
        title: "Failed to load conversation history",
        description: "Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteSession = async () => {
    if (!sessionToDelete || !profile?.id) return

    try {
      setDeleting(true)

      const { error } = await supabase
        .from('sessions')
        .delete()
        .eq('id', sessionToDelete.id)
        .eq('user_id', profile.id)

      if (error) {
        throw error
      }

      // Remove from local state
      setSessions(prev => prev.filter(s => s.id !== sessionToDelete.id))
      
      toast({
        title: "Conversation deleted",
        description: "This conversation has been removed from your history.",
      })

    } catch (error: any) {
      console.error('Error deleting session:', error)
      toast({
        title: "Failed to delete conversation",
        description: error.message || "Please try again.",
        variant: "destructive",
      })
    } finally {
      setDeleting(false)
      setDeleteDialogOpen(false)
      setSessionToDelete(null)
    }
  }

  const confirmDelete = (session: Session) => {
    setSessionToDelete(session)
    setDeleteDialogOpen(true)
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Unknown date'
    
    const date = new Date(dateString)
    const now = new Date()
    const diffTime = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays > 1 && diffDays <= 7) return `${diffDays} days ago`
    
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const truncateText = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text
    return text.substring(0, maxLength) + '...'
  }

  if (!profile) {
    return null
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-gray-50">
          <DialogHeader className="border-b border-gray-200 pb-4">
            <DialogTitle className="text-2xl font-bold text-indigo-700 text-center">
              Settings
            </DialogTitle>
          </DialogHeader>

          <div className="py-6">
            <Tabs defaultValue="history" className="w-full">
              <TabsList className="grid grid-cols-1 w-full">
                <TabsTrigger value="history">Conversation History</TabsTrigger>
              </TabsList>

              <TabsContent value="history" className="mt-6">
                {/* Conversation History Section */}
                <Card className="bg-white border-indigo-100">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl text-indigo-700 flex items-center">
                  <MessageSquare className="w-5 h-5 mr-2" />
                  Conversation History
                </CardTitle>
                
                {/* Educational Message */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-3">
                  <div className="flex items-start space-x-2">
                    <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-blue-800">
                      <p className="font-medium mb-1">About Your Conversation Context</p>
                      <p>
                        These are summaries of your past conversations. Whisperoo uses them to provide 
                        personalized advice based on your family's history and needs. You can delete 
                        any conversations you don't want included in future context.
                      </p>
                    </div>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-6">
                {loading ? (
                  <div className="flex items-center justify-center h-40">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-2"></div>
                      <p className="text-gray-600">Loading conversation history...</p>
                    </div>
                  </div>
                ) : sessions.length === 0 ? (
                  <div className="flex items-center justify-center h-40">
                    <div className="text-center text-gray-500">
                      <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                      <p className="text-lg font-medium">No conversation history yet</p>
                      <p className="text-sm">Start chatting to see your conversation summaries here.</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {sessions.map((session, index) => (
                        <div key={session.id}>
                          <Card className="bg-gray-50 border-gray-200 hover:shadow-md transition-shadow">
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between space-x-4">
                                <div className="flex-1 min-w-0">
                                  {/* Header with date and title */}
                                  <div className="flex items-center space-x-2 mb-2">
                                    <Calendar className="w-4 h-4 text-gray-500" />
                                    <span className="text-sm font-medium text-gray-600">
                                      {formatDate(session.last_message_at || session.created_at)}
                                    </span>
                                  </div>
                                  
                                  {/* Title */}
                                  {session.title && (
                                    <h4 className="font-medium text-gray-900 mb-2 line-clamp-1">
                                      {truncateText(session.title, 80)}
                                    </h4>
                                  )}
                                  
                                  {/* Summary */}
                                  {session.summary && (
                                    <div className="text-sm text-gray-700 leading-relaxed">
                                      <span className="font-medium text-gray-600">Summary: </span>
                                      {truncateText(session.summary, 200)}
                                    </div>
                                  )}
                                </div>
                                
                                {/* Delete Button */}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => confirmDelete(session)}
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50 flex-shrink-0"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                          
                          {index < sessions.length - 1 && (
                            <Separator className="my-2" />
                          )}
                          </div>
                        ))}
                      </div>
                    )}
              </CardContent>
                </Card>
              </TabsContent>

              {profile.account_type === 'expert' && (
                <div className="mt-6">
                  <Card className="bg-white border-indigo-100">
                    <CardContent className="p-6 text-center">
                      <h3 className="text-lg font-semibold mb-2">Expert Profile Management</h3>
                      <p className="text-gray-600 mb-4">
                        Manage your complete expert profile including professional credentials, 
                        personal information, and consultation settings.
                      </p>
                      <Button 
                        onClick={() => {
                          onClose();
                          navigate('/expert-settings');
                        }}
                        className="gap-2"
                      >
                        Open Expert Settings
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              )}
            </Tabs>
          </div>

        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Conversation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this conversation? This will remove it from 
              your chat history and Whisperoo will no longer use it for context in future conversations.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteSession}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export default SettingsModal